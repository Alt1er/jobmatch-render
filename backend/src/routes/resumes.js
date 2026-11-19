const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const pool = require('../db/pool');
const repo = require('../services/repo');
const { detectType, extractText, estimateYears, guessTitle } = require('../services/parser');
const { extractSkills, normalizeSkillNames } = require('../services/skills');
const { asyncHandler, HttpError } = require('../middleware/error');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // multer віддає назву у latin1 — відновлюємо UTF-8 (кирилиця)
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      return cb(new HttpError(400, 'Підтримуються лише файли PDF та DOCX'));
    }
    cb(null, true);
  },
});

function parseYears(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 60) throw new HttpError(400, 'Стаж має бути числом від 0 до 60');
  return Math.round(n * 2) / 2;
}

function toBool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  return v === true || v === 'true' || v === '1' || v === 'on';
}

/** Формат відповіді; повний текст — лише на вимогу */
function shape(r, { withText = false, withEmail = false } = {}) {
  const out = {
    id: r.id,
    title: r.title,
    years_experience: r.years_experience,
    file_name: r.file_name,
    is_visible: r.is_visible,
    created_at: r.created_at,
    skills: r.skills,
    candidate_name: r.candidate_name,
    excerpt: r.full_text.slice(0, 280),
  };
  if (withEmail) out.candidate_email = r.candidate_email;
  if (withText) out.full_text = r.full_text;
  return out;
}

/** Чи може роботодавець бачити резюме: воно відкрите або кандидат відгукнувся на його вакансію */
async function employerCanSee(userId, resume) {
  if (resume.is_visible) return { ok: true, applied: false };
  const { rowCount } = await pool.query(
    `SELECT 1 FROM applications a
       JOIN vacancies v ON v.id = a.vacancy_id
       JOIN companies c ON c.id = v.company_id
      WHERE a.resume_id = $1 AND c.user_id = $2`,
    [resume.id, userId]
  );
  return { ok: rowCount > 0, applied: rowCount > 0 };
}

async function appliedToEmployer(userId, resumeId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM applications a
       JOIN vacancies v ON v.id = a.vacancy_id
       JOIN companies c ON c.id = v.company_id
      WHERE a.resume_id = $1 AND c.user_id = $2`,
    [resumeId, userId]
  );
  return rowCount > 0;
}

async function loadAccessible(req) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new HttpError(400, 'Некоректний ідентифікатор');
  const resume = await repo.getResume(id);
  if (!resume) throw new HttpError(404, 'Резюме не знайдено');
  if (req.user.role === 'candidate') {
    if (resume.user_id !== req.user.id) throw new HttpError(403, 'Це резюме вам не належить');
    return { resume, isOwner: true, applied: false };
  }
  const access = await employerCanSee(req.user.id, resume);
  if (!access.ok) throw new HttpError(403, 'Кандидат приховав це резюме');
  return { resume, isOwner: false, applied: await appliedToEmployer(req.user.id, resume.id) };
}

// Список власних резюме
router.get(
  '/',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const list = await repo.listResumesByUser(req.user.id);
    res.json({ resumes: list.map((r) => shape(r)) });
  })
);

// Завантаження резюме (PDF / DOCX)
router.post(
  '/',
  requireRole('candidate'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Додайте файл резюме (PDF або DOCX)');
    const { buffer, originalname } = req.file;

    const type = detectType(buffer, originalname);
    if (!type) throw new HttpError(400, 'Файл пошкоджений або має неправильний формат (потрібен PDF чи DOCX)');

    let text;
    try {
      text = await extractText(buffer, type);
    } catch {
      throw new HttpError(422, 'Не вдалося прочитати файл. Спробуйте зберегти резюме у PDF/DOCX ще раз.');
    }
    if (text.length < 50) {
      throw new HttpError(
        422,
        'У файлі майже немає тексту. Якщо це скан або зображення — завантажте версію з текстовим шаром.'
      );
    }

    const count = await pool.query('SELECT COUNT(*)::int AS n FROM resumes WHERE user_id = $1', [req.user.id]);
    if (count.rows[0].n >= 10) throw new HttpError(400, 'Досягнуто ліміт — 10 резюме. Видаліть непотрібні.');

    const title = String(req.body.title || '').trim().slice(0, 200) || guessTitle(text, originalname);
    const years = parseYears(req.body.years_experience) ?? estimateYears(text);
    const skills = extractSkills(text);
    const visible = toBool(req.body.is_visible, true);

    await fsp.mkdir(config.uploadsDir, { recursive: true });
    const storedName = `${crypto.randomUUID()}.${type}`;
    const storedPath = path.join(config.uploadsDir, storedName);
    await fsp.writeFile(storedPath, buffer);

    const client = await pool.connect();
    let resumeId;
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO resumes (user_id, title, full_text, years_experience, file_name, file_path, is_visible)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.user.id, title, text, years, originalname.slice(0, 255), storedName, visible]
      );
      resumeId = ins.rows[0].id;
      await repo.setSkills(client, 'resume_skills', 'resume_id', resumeId, skills);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      await fsp.unlink(storedPath).catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const resume = await repo.getResume(resumeId);
    res.status(201).json({ resume: shape(resume) });
  })
);

// Деталі резюме
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { resume, isOwner, applied } = await loadAccessible(req);
    res.json({ resume: shape(resume, { withText: true, withEmail: isOwner || applied }) });
  })
);

// Редагування (назва, стаж, видимість, навички)
router.patch(
  '/:id',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const { resume } = await loadAccessible(req);
    const body = req.body || {};

    const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : resume.title;
    if (!title) throw new HttpError(400, 'Назва резюме не може бути порожньою');
    const years = body.years_experience !== undefined ? parseYears(body.years_experience) ?? 0 : resume.years_experience;
    const visible = body.is_visible !== undefined ? toBool(body.is_visible, resume.is_visible) : resume.is_visible;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE resumes SET title = $1, years_experience = $2, is_visible = $3 WHERE id = $4',
        [title, years, visible, resume.id]
      );
      if (Array.isArray(body.skills)) {
        await repo.setSkills(client, 'resume_skills', 'resume_id', resume.id, normalizeSkillNames(body.skills));
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ resume: shape(await repo.getResume(resume.id)) });
  })
);

// Видалення
router.delete(
  '/:id',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const { resume } = await loadAccessible(req);
    const { rows } = await pool.query('DELETE FROM resumes WHERE id = $1 RETURNING file_path', [resume.id]);
    if (rows[0]) await fsp.unlink(path.join(config.uploadsDir, rows[0].file_path)).catch(() => {});
    res.json({ ok: true });
  })
);

// Завантаження оригінального файлу
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const { resume } = await loadAccessible(req);
    const { rows } = await pool.query('SELECT file_path, file_name FROM resumes WHERE id = $1', [resume.id]);
    const full = path.join(config.uploadsDir, rows[0].file_path);
    if (!fs.existsSync(full)) throw new HttpError(404, 'Файл не знайдено на сервері');
    res.download(full, rows[0].file_name);
  })
);

// Підбір вакансій для резюме з відсотком схожості
router.get(
  '/:id/matches',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const { resume } = await loadAccessible(req);
    const ranked = await repo.matchVacanciesForResume(resume);

    const applied = await pool.query('SELECT vacancy_id FROM applications WHERE user_id = $1', [req.user.id]);
    const appliedSet = new Set(applied.rows.map((a) => a.vacancy_id));

    const min = Math.max(0, parseInt(req.query.min, 10) || 0);
    const matches = ranked
      .filter((m) => m.score >= min)
      .map((m) => ({
        vacancy: {
          id: m.vacancy.id,
          title: m.vacancy.title,
          company_name: m.vacancy.company_name,
          location: m.vacancy.location,
          employment: m.vacancy.employment,
          min_experience: m.vacancy.min_experience,
          skills: m.vacancy.skills,
          created_at: m.vacancy.created_at,
        },
        score: m.score,
        level: m.level,
        breakdown: m.breakdown,
        matchedSkills: m.matchedSkills,
        missingSkills: m.missingSkills,
        applied: appliedSet.has(m.vacancy.id),
      }));
    res.json({
      resume: { id: resume.id, title: resume.title, skills: resume.skills, years_experience: resume.years_experience },
      matches,
    });
  })
);

module.exports = router;
