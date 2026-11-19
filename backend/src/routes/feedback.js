/**
 * Зворотний зв'язок користувачів (ЛР7 — технічне обслуговування).
 * Будь-хто може повідомити про помилку чи запропонувати покращення;
 * адміністратор переглядає звернення, змінює статус і відповідає.
 */
const express = require('express');
const pool = require('../db/pool');
const { asyncHandler, HttpError } = require('../middleware/error');
const { authOptional, authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['bug', 'idea', 'question', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];
const STATUSES = ['new', 'in_progress', 'resolved', 'rejected'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Простий захист від спаму: не більше 5 звернень за 10 хвилин з однієї адреси
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Number(process.env.FEEDBACK_RATE_LIMIT) || 5;
const hits = new Map();
function rateLimit(req, _res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) return next(new HttpError(429, 'Забагато звернень. Спробуйте трохи пізніше.'));
  list.push(now);
  hits.set(key, list);
  next();
}

router.post(
  '/',
  authOptional,
  rateLimit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const category = String(b.category || '');
    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'normal';
    const message = String(b.message || '').trim();
    const page = String(b.page || '').trim().slice(0, 200);
    const rating = b.rating ? Number(b.rating) : null;
    let name = String(b.name || '').trim().slice(0, 120);
    let email = String(b.email || '').trim().toLowerCase().slice(0, 255);

    if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Оберіть тип звернення');
    if (message.length < 10) throw new HttpError(400, 'Опишіть проблему чи ідею детальніше (мінімум 10 символів)');
    if (message.length > 3000) throw new HttpError(400, 'Повідомлення задовге (максимум 3000 символів)');
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      throw new HttpError(400, 'Оцінка має бути від 1 до 5');
    }

    if (req.user) {
      const { rows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
      if (rows[0]) ({ name, email } = rows[0]);
    } else if (email && !EMAIL_RE.test(email)) {
      throw new HttpError(400, 'Некоректна адреса електронної пошти');
    }

    const { rows } = await pool.query(
      `INSERT INTO feedback (user_id, name, email, category, priority, page, message, rating, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.user ? req.user.id : null,
        name,
        email,
        category,
        priority,
        page,
        message,
        rating,
        String(req.headers['user-agent'] || '').slice(0, 300),
      ]
    );
    res.status(201).json({ feedback: rows[0] });
  })
);

router.get(
  '/mine',
  authRequired,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ feedback: rows });
  })
);

router.get(
  '/',
  authRequired,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const where = [];
    const params = [];
    if (STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`f.status = $${params.length}`);
    }
    if (CATEGORIES.includes(req.query.category)) {
      params.push(req.query.category);
      where.push(`f.category = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT f.*, u.role AS user_role
         FROM feedback f LEFT JOIN users u ON u.id = f.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY CASE WHEN f.status IN ('new', 'in_progress') THEN 0 ELSE 1 END,
                 CASE f.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                 f.created_at DESC
        LIMIT 200`,
      params
    );
    res.json({ feedback: rows });
  })
);

router.patch(
  '/:id',
  authRequired,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const sets = [];
    const params = [];
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Некоректний статус');
      params.push(b.status);
      sets.push(`status = $${params.length}`);
    }
    if (b.priority !== undefined) {
      if (!PRIORITIES.includes(b.priority)) throw new HttpError(400, 'Некоректний пріоритет');
      params.push(b.priority);
      sets.push(`priority = $${params.length}`);
    }
    if (b.reply !== undefined) {
      params.push(String(b.reply).trim().slice(0, 3000));
      sets.push(`admin_reply = $${params.length}`);
    }
    if (!sets.length) throw new HttpError(400, 'Немає змін');
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE feedback SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) throw new HttpError(404, 'Звернення не знайдено');
    res.json({ feedback: rows[0] });
  })
);

module.exports = router;
