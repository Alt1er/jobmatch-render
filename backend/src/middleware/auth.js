const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db/pool');
const { HttpError } = require('./error');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function decode(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

/** Додає req.user, якщо токен валідний; інакше пропускає далі */
function authOptional(req, _res, next) {
  const token = readToken(req);
  const payload = token ? decode(token) : null;
  req.user = payload ? { id: payload.id, role: payload.role } : null;
  next();
}

function authRequired(req, _res, next) {
  const token = readToken(req);
  const payload = token ? decode(token) : null;
  if (!payload) return next(new HttpError(401, 'Потрібна авторизація. Увійдіть у свій акаунт.'));
  req.user = { id: payload.id, role: payload.role };
  next();
}

function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Потрібна авторизація'));
    if (req.user.role !== role) {
      const text = { employer: 'Доступно лише роботодавцям', candidate: 'Доступно лише кандидатам', admin: 'Доступно лише адміністратору' };
      return next(new HttpError(403, text[role] || 'Недостатньо прав'));
    }
    next();
  };
}

/** Підвантажує компанію поточного роботодавця у req.company */
async function loadCompany(req, _res, next) {
  try {
    const { rows } = await pool.query('SELECT id, name, industry FROM companies WHERE user_id = $1', [
      req.user.id,
    ]);
    if (!rows[0]) throw new HttpError(403, 'Профіль компанії не знайдено');
    req.company = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

module.exports = { authOptional, authRequired, requireRole, loadCompany, signToken };
