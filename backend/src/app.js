const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { errorHandler } = require('./middleware/error');
const { CANONICAL } = require('./services/skills');

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/skills', (_req, res) => res.json({ skills: CANONICAL }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/vacancies', require('./routes/vacancies'));
app.use('/api/applications', require('./routes/applications'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не знайдено' }));

// Якщо зібрано фронтенд (npm run build) — віддаємо його з цього ж сервера
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
