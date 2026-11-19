class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Записує серверну помилку в таблицю error_log (не блокує відповідь) */
function logError(req, err) {
  try {
    const pool = require('../db/pool');
    pool
      .query('INSERT INTO error_log (method, path, message) VALUES ($1, $2, $3)', [
        String(req.method || '').slice(0, 10),
        String(req.originalUrl || '').slice(0, 300),
        String((err && err.message) || err).slice(0, 2000),
      ])
      .catch(() => {});
  } catch {
    /* журнал недоступний — ігноруємо */
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Файл завеликий. Максимальний розмір — 5 МБ.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Очікується один файл у полі "file"' });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'Такий запис уже існує' });
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некоректний JSON у запиті' });
  }

  console.error(err);
  logError(req, err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
