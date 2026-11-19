const express = require('express');
const pool = require('../db/pool');
const repo = require('../services/repo');
const { extractSkills, normalizeSkillNames } = require('../services/skills');
const { asyncHandler, HttpError } = require('../middleware/error');
const { authOptional, authRequired, requireRole, loadCompany } = require('../middleware/auth');

const router = express.Router();

const EMPLOYMENT = ['Повна зайнятість', 'Часткова зайнятість', 'Стажування', 'Контракт'];

function parseId(req) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new HttpError(400, 'Некоректний ідентифікатор');
  return id;
}

function publicVacancy(v) {
  return {
    id: v.id,
    company_id: v.company_id,
    company_name: v.company_name,
    industry: v.industry,
    title: v.title,
    description: v.description,
    requirements: v.requirements,
    location: v.location,
    employment: v.employment,
    min_experience: v.min_experience,
    is_active: v.is_active,
    created_at: v.created_at,
    skills: v.skills,
  };
}

function validateVacancy(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const requirements = String(body.requirements || '').trim();
  const location = String(body.location || '').trim().slice(0, 120) || 'Віддалено';
  const employment = EMPLOYMENT.includes(body.employment) ? body.employment : EMPLOYMENT[0];
  const minExp = parseFloat(String(body.min_experience ?? 0).replace(',', '.'));

  if (title.length < 3 || title.length > 200) throw new HttpError(400, 'Назва вакансії: 3–200 символів');
  if (description.length < 20) throw new HttpError(400, 'Опишіть вакансію детальніше (щонайменше 20 символів)');
  if (Number.isNaN(minExp) || minExp < 0 || minExp > 40) throw new HttpError(400, 'Мінімальний стаж: число від 0 до 40');

  // навички: вказані вручну + знайдені у назві та вимогах (або в описі, якщо вимог немає)
  const explicit = normalizeSkillNames(body.skills);
  const auto = extractSkills(`${title}\n${requirements || description}`);
  const skills = [...new Set([...explicit, ...auto])].slice(0, 30);

  return { title, description, requirements, location, employment, minExp: Math.round(minExp * 2) / 2, skills };
}

// Публічний каталог активних вакансій
router.get(
  '/',
  authOptional,
  asyncHandler(async (req, res) => {
    let list = await repo.listActiveVacancies();
    const q = String(req.query.q || '').trim().toLowerCase();
    const location = String(req.query.location || '').trim().toLowerCase();
    const skill = String(req.query.skill || '').trim().toLowerCase();
    if (q) {
      list = list.filter((v) =>
        `${v.title} ${v.company_name} ${v.description} ${v.requirements}`.toLowerCase().includes(q)
      );
    }
    if (location) list = list.filter((v) => v.location.toLowerCase().includes(location));
    if (skill) list = list.filter((v) => v.skills.some((s) => s.toLowerCase() === skill));

    let appliedSet = new Set();
    if (req.user && req.user.role === 'candidate') {
      const { rows } = await pool.query('SELECT vacancy_id FROM applications WHERE user_id = $1', [req.user.id]);
      appliedSet = new Set(rows.map((r) => r.vacancy_id));
    }
    res.json({ vacancies: list.map((v) => ({ ...publicVacancy(v), applied: appliedSet.has(v.id) })) });
  })
);

// Вакансії поточного роботодавця
router.get(
  '/mine',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    res.json({ company: req.company, vacancies: await repo.listVacanciesByCompany(req.company.id) });
  })
);

// Створення
router.post(
  '/',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const data = validateVacancy(req.body || {});
    const client = await pool.connect();
    let id;
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO vacancies (company_id, title, description, requirements, location, employment, min_experience)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.company.id, data.title, data.description, data.requirements, data.location, data.employment, data.minExp]
      );
      id = ins.rows[0].id;
      await repo.setSkills(client, 'vacancy_skills', 'vacancy_id', id, data.skills);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.status(201).json({ vacancy: publicVacancy(await repo.getVacancy(id)) });
  })
);

// Допоміжне: вакансія, що належить поточному роботодавцю
async function ownVacancy(req) {
  const id = parseId(req);
  const vacancy = await repo.getVacancy(id);
  if (!vacancy) throw new HttpError(404, 'Вакансію не знайдено');
  if (vacancy.company_id !== req.company.id) throw new HttpError(403, 'Це не ваша вакансія');
  return vacancy;
}

// Деталі вакансії (публічно; неактивні бачить лише власник)
router.get(
  '/:id',
  authOptional,
  asyncHandler(async (req, res) => {
    const vacancy = await repo.getVacancy(parseId(req));
    if (!vacancy) throw new HttpError(404, 'Вакансію не знайдено');
    if (!vacancy.is_active) {
      let owner = false;
      if (req.user && req.user.role === 'employer') {
        const { rows } = await pool.query('SELECT 1 FROM companies WHERE user_id = $1 AND id = $2', [
          req.user.id,
          vacancy.company_id,
        ]);
        owner = rows.length > 0;
      }
      if (!owner) throw new HttpError(404, 'Вакансію не знайдено');
    }
    res.json({ vacancy: publicVacancy(vacancy) });
  })
);

// Редагування
router.put(
  '/:id',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const vacancy = await ownVacancy(req);
    const body = req.body || {};
    const data = validateVacancy(body);
    const active = body.is_active === undefined ? vacancy.is_active : !!body.is_active;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE vacancies SET title=$1, description=$2, requirements=$3, location=$4,
                employment=$5, min_experience=$6, is_active=$7 WHERE id=$8`,
        [data.title, data.description, data.requirements, data.location, data.employment, data.minExp, active, vacancy.id]
      );
      await repo.setSkills(client, 'vacancy_skills', 'vacancy_id', vacancy.id, data.skills);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ vacancy: publicVacancy(await repo.getVacancy(vacancy.id)) });
  })
);

// Публікація / зняття з публікації
router.patch(
  '/:id/active',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const vacancy = await ownVacancy(req);
    const active = !!(req.body || {}).is_active;
    await pool.query('UPDATE vacancies SET is_active = $1 WHERE id = $2', [active, vacancy.id]);
    res.json({ ok: true, is_active: active });
  })
);

router.delete(
  '/:id',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const vacancy = await ownVacancy(req);
    await pool.query('DELETE FROM vacancies WHERE id = $1', [vacancy.id]);
    res.json({ ok: true });
  })
);

// Ранжований список кандидатів для вакансії
router.get(
  '/:id/candidates',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const vacancy = await ownVacancy(req);
    const ranked = await repo.matchResumesForVacancy(vacancy);

    const apps = await pool.query('SELECT id, resume_id, status FROM applications WHERE vacancy_id = $1', [vacancy.id]);
    const byResume = new Map(apps.rows.map((a) => [a.resume_id, a]));

    const min = Math.max(0, parseInt(req.query.min, 10) || 0);
    const candidates = ranked
      .filter((m) => m.score >= min || byResume.has(m.resume.id))
      .map((m) => {
        const app = byResume.get(m.resume.id);
        return {
          resume: {
            id: m.resume.id,
            title: m.resume.title,
            years_experience: m.resume.years_experience,
            skills: m.resume.skills,
            candidate_name: m.resume.candidate_name,
            // контакти показуємо лише тим, хто сам відгукнувся
            candidate_email: app ? m.resume.candidate_email : null,
            excerpt: m.resume.full_text.slice(0, 220),
          },
          score: m.score,
          level: m.level,
          breakdown: m.breakdown,
          matchedSkills: m.matchedSkills,
          missingSkills: m.missingSkills,
          application: app ? { id: app.id, status: app.status } : null,
        };
      });
    res.json({ vacancy: publicVacancy(vacancy), candidates });
  })
);

// Відгуки на вакансію
router.get(
  '/:id/applications',
  authRequired,
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const vacancy = await ownVacancy(req);
    const { rows } = await pool.query(
      `SELECT a.id, a.status, a.score, a.message, a.created_at, a.resume_id,
              u.name AS candidate_name, u.email AS candidate_email,
              r.title AS resume_title, r.years_experience::float8 AS years_experience
         FROM applications a
         JOIN users u ON u.id = a.user_id
         JOIN resumes r ON r.id = a.resume_id
        WHERE a.vacancy_id = $1
        ORDER BY a.score DESC, a.created_at DESC`,
      [vacancy.id]
    );
    res.json({ vacancy: publicVacancy(vacancy), applications: rows });
  })
);

module.exports = router;
