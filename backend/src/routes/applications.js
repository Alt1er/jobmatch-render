const express = require('express');
const pool = require('../db/pool');
const repo = require('../services/repo');
const { asyncHandler, HttpError } = require('../middleware/error');
const { authRequired, requireRole, loadCompany } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const STATUSES = ['new', 'viewed', 'invited', 'rejected'];

// Відгук кандидата на вакансію
router.post(
  '/',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const vacancyId = parseInt((req.body || {}).vacancy_id, 10);
    const resumeId = parseInt((req.body || {}).resume_id, 10);
    const message = String((req.body || {}).message || '').trim().slice(0, 2000);
    if (Number.isNaN(vacancyId) || Number.isNaN(resumeId)) {
      throw new HttpError(400, 'Вкажіть вакансію та резюме');
    }

    const resume = await repo.getResume(resumeId);
    if (!resume || resume.user_id !== req.user.id) throw new HttpError(403, 'Оберіть власне резюме');
    const vacancy = await repo.getVacancy(vacancyId);
    if (!vacancy || !vacancy.is_active) throw new HttpError(404, 'Вакансію не знайдено або вона закрита');

    const dup = await pool.query('SELECT 1 FROM applications WHERE user_id = $1 AND vacancy_id = $2', [
      req.user.id,
      vacancyId,
    ]);
    if (dup.rowCount) throw new HttpError(409, 'Ви вже відгукнулися на цю вакансію');

    const ranked = await repo.matchVacanciesForResume(resume);
    const hit = ranked.find((m) => m.vacancy.id === vacancyId);
    const score = hit ? hit.score : 0;

    const { rows } = await pool.query(
      `INSERT INTO applications (resume_id, vacancy_id, user_id, score, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, status, score, created_at`,
      [resumeId, vacancyId, req.user.id, score, message]
    );
    res.status(201).json({ application: rows[0] });
  })
);

// Мої відгуки
router.get(
  '/mine',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT a.id, a.status, a.score, a.message, a.created_at,
              v.id AS vacancy_id, v.title AS vacancy_title, v.is_active,
              c.name AS company_name, r.title AS resume_title
         FROM applications a
         JOIN vacancies v ON v.id = a.vacancy_id
         JOIN companies c ON c.id = v.company_id
         JOIN resumes r ON r.id = a.resume_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ applications: rows });
  })
);

// Зміна статусу відгуку роботодавцем
router.patch(
  '/:id/status',
  requireRole('employer'),
  loadCompany,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = (req.body || {}).status;
    if (Number.isNaN(id)) throw new HttpError(400, 'Некоректний ідентифікатор');
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Невідомий статус');

    const { rowCount } = await pool.query(
      `UPDATE applications a SET status = $1
         FROM vacancies v
        WHERE a.id = $2 AND v.id = a.vacancy_id AND v.company_id = $3`,
      [status, id, req.company.id]
    );
    if (!rowCount) throw new HttpError(404, 'Відгук не знайдено');
    res.json({ ok: true, status });
  })
);

// Відкликання відгуку кандидатом
router.delete(
  '/:id',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw new HttpError(400, 'Некоректний ідентифікатор');
    const { rowCount } = await pool.query('DELETE FROM applications WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);
    if (!rowCount) throw new HttpError(404, 'Відгук не знайдено');
    res.json({ ok: true });
  })
);

module.exports = router;
