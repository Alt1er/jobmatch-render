const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { asyncHandler, HttpError } = require('../middleware/error');
const { authRequired, signToken } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function loadUser(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, c.name AS company_name
       FROM users u LEFT JOIN companies c ON c.user_id = u.id
      WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  companyName: u.company_name || null,
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role;
    const companyName = String(body.companyName || '').trim();

    if (name.length < 2 || name.length > 120) throw new HttpError(400, "Вкажіть ім'я (2–120 символів)");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Некоректна адреса електронної пошти');
    if (password.length < 8) throw new HttpError(400, 'Пароль має містити щонайменше 8 символів');
    if (!['candidate', 'employer'].includes(role)) throw new HttpError(400, 'Оберіть роль: кандидат або роботодавець');
    if (role === 'employer' && companyName.length < 2) throw new HttpError(400, 'Вкажіть назву компанії');

    const hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let userId;
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (exists.rowCount) throw new HttpError(409, 'Користувач з такою поштою вже зареєстрований');
      const ins = await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, email, hash, role]
      );
      userId = ins.rows[0].id;
      if (role === 'employer') {
        await client.query('INSERT INTO companies (user_id, name, industry) VALUES ($1, $2, $3)', [
          userId,
          companyName,
          String(body.industry || '').trim().slice(0, 120) || null,
        ]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await loadUser(userId);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const password = String((req.body || {}).password || '');
    if (!email || !password) throw new HttpError(400, 'Введіть пошту та пароль');

    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
    const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
    if (!ok) throw new HttpError(401, 'Невірна пошта або пароль');

    const user = await loadUser(rows[0].id);
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    if (!user) throw new HttpError(401, 'Користувача не знайдено');
    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
