/**
 * Сервісні дії, що виконуються при кожному старті (безпечно запускати повторно):
 *  1) старі акаунти першої версії (…@demo.ua / …demo) отримують нові адреси й нові паролі;
 *  2) створюється обліковий запис адміністратора, якщо його ще немає.
 */
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { TEST_PASSWORD, ADMIN, CANDIDATE, LEGACY_EMAILS } = require('./accounts');

async function upgradeLegacyAccounts(log = console.log) {
  const oldEmails = Object.keys(LEGACY_EMAILS);
  const { rows } = await pool.query('SELECT id, email FROM users WHERE email = ANY($1)', [oldEmails]);
  if (!rows.length) return 0;

  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  let changed = 0;
  for (const u of rows) {
    const next = LEGACY_EMAILS[u.email];
    const taken = await pool.query('SELECT 1 FROM users WHERE email = $1', [next]);
    if (taken.rowCount) {
      // новий акаунт уже існує — старий просто блокуємо новим паролем
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, u.id]);
    } else {
      await pool.query('UPDATE users SET email = $1, password_hash = $2 WHERE id = $3', [next, hash, u.id]);
      if (next === CANDIDATE.email) {
        await pool.query('UPDATE users SET name = $1 WHERE id = $2', [CANDIDATE.name, u.id]);
      }
    }
    changed += 1;
  }
  log(`✔ Оновлено ${changed} старих тестових акаунтів (нові адреси та паролі)`);
  return changed;
}

async function ensureAdmin(log = console.log) {
  const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [ADMIN.email]);
  if (rowCount) return false;
  const hash = await bcrypt.hash(ADMIN.password, 10);
  await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [
    ADMIN.name,
    ADMIN.email,
    hash,
  ]);
  log(`✔ Створено адміністратора: ${ADMIN.email}`);
  return true;
}

async function runMaintenance({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  await upgradeLegacyAccounts(log);
  await ensureAdmin(log);
}

module.exports = { runMaintenance, upgradeLegacyAccounts, ensureAdmin };
