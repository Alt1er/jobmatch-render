/**
 * Панель адміністратора: стан системи та статистика для моніторингу.
 */
const express = require('express');
const pool = require('../db/pool');
const config = require('../config');
const { asyncHandler } = require('../middleware/error');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

const countBy = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r.n]));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const t0 = Date.now();
    const [users, vacancies, resumes, applications, fbStatus, fbCategory, errors24h, avgRating] = await Promise.all([
      pool.query('SELECT role, COUNT(*)::int AS n FROM users GROUP BY role'),
      pool.query('SELECT COUNT(*) FILTER (WHERE is_active)::int AS active, COUNT(*)::int AS total FROM vacancies'),
      pool.query('SELECT COUNT(*)::int AS n FROM resumes'),
      pool.query('SELECT COUNT(*)::int AS n FROM applications'),
      pool.query('SELECT status, COUNT(*)::int AS n FROM feedback GROUP BY status'),
      pool.query('SELECT category, COUNT(*)::int AS n FROM feedback GROUP BY category'),
      pool.query("SELECT COUNT(*)::int AS n FROM error_log WHERE created_at > now() - interval '24 hours'"),
      pool.query('SELECT ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(rating)::int AS n FROM feedback'),
    ]);
    const mem = process.memoryUsage();
    res.json({
      system: {
        version: config.version,
        node: process.version,
        uptimeSec: Math.round(process.uptime()),
        startedAt: config.startedAt,
        memoryMb: Math.round(mem.rss / 1024 / 1024),
        dbLatencyMs: Date.now() - t0,
        database: config.embedded.enabled ? 'вбудований PostgreSQL' : 'зовнішній PostgreSQL',
      },
      users: countBy(users.rows, 'role'),
      vacancies: vacancies.rows[0],
      resumes: resumes.rows[0].n,
      applications: applications.rows[0].n,
      feedback: {
        byStatus: countBy(fbStatus.rows, 'status'),
        byCategory: countBy(fbCategory.rows, 'category'),
        avgRating: avgRating.rows[0].avg ? Number(avgRating.rows[0].avg) : null,
        ratings: avgRating.rows[0].n,
      },
      errors24h: errors24h.rows[0].n,
    });
  })
);

router.get(
  '/errors',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM error_log ORDER BY created_at DESC LIMIT 50');
    res.json({ errors: rows });
  })
);

module.exports = router;
