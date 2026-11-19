require('dotenv').config();
const path = require('path');

// Якщо DATABASE_URL не задано — сервер сам запускає вбудований PostgreSQL
// (дані зберігаються в backend/.pgdata). Якщо задано — використовується ваша БД.
const explicitDb = process.env.DATABASE_URL || '';
const embeddedPort = Number(process.env.EMBEDDED_PG_PORT) || 54329;
const embeddedEnabled = !explicitDb;

const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: explicitDb || `postgres://jobmatch:jobmatch@127.0.0.1:${embeddedPort}/jobmatch`,
  embedded: {
    enabled: embeddedEnabled,
    port: embeddedPort,
    dir: process.env.EMBEDDED_PG_DIR || path.join(__dirname, '..', '.pgdata'),
  },
  version: require('../package.json').version,
  startedAt: new Date(),
  // Показувати підказку з тестовими акаунтами на сторінці входу (SHOW_TEST_ACCOUNTS=false — приховати)
  showTestAccounts: process.env.SHOW_TEST_ACCOUNTS !== 'false',
  // Автоматично додавати початкові дані, якщо в БД ще немає жодного користувача
  autoSeed: process.env.AUTO_SEED ? process.env.AUTO_SEED === 'true' : embeddedEnabled,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  uploadsDir: path.join(__dirname, '..', 'uploads'),
};

if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('У production потрібно задати JWT_SECRET у змінних середовища');
}

module.exports = config;
