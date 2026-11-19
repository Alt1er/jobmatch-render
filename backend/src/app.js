const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { errorHandler } = require('./middleware/error');
const { CANONICAL } = require('./services/skills');
const pool = require('./db/pool');
const { TEST_PASSWORD, CANDIDATE, EMPLOYERS } = require('./db/accounts');

const app = express();
app.set('trust proxy', 1); // Render та інші платформи працюють через проксі — потрібна справжня IP-адреса

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));

// Перевірка стану для моніторингу (Render Health Check, UptimeRobot тощо)
app.get('/api/health', async (_req, res) => {
  const t0 = Date.now();
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'error';
  }
  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    dbLatencyMs: Date.now() - t0,
    version: config.version,
    uptimeSec: Math.round(process.uptime()),
  });
});

// Загальна інформація для фронтенду: версія та (за потреби) тестові акаунти
app.get('/api/meta', (_req, res) => {
  res.json({
    version: config.version,
    testAccounts: config.showTestAccounts
      ? {
          password: TEST_PASSWORD,
          list: [
            { label: 'Кандидат', email: CANDIDATE.email },
            ...EMPLOYERS.map((e) => ({ label: `Роботодавець (${e.company})`, email: e.email })),
          ],
        }
      : null,
  });
});
app.get('/api/skills', (_req, res) => res.json({ skills: CANONICAL }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/vacancies', require('./routes/vacancies'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не знайдено' }));

// Якщо зібрано фронтенд (npm run build) — віддаємо його з цього ж сервера
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
