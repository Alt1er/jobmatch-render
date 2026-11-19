const fs = require('fs');
const config = require('./config');
const migrate = require('./db/migrate');
const seed = require('./db/seed');
const pool = require('./db/pool');
const { ensureDatabase } = require('./db/embedded');
const app = require('./app');

async function prepareDatabase() {
  const stopDb = await ensureDatabase(); // вбудований PostgreSQL стартує сам, якщо DATABASE_URL не задано
  await migrate(); // створює таблиці, якщо їх ще немає

  if (config.autoSeed) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n === 0) {
      console.log('• База порожня — додаю демо-дані…');
      await seed();
    }
  }
  return stopDb;
}

async function start() {
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  let stopDb;
  try {
    stopDb = await prepareDatabase();
  } catch (err) {
    console.error('✖ Не вдалося підготувати базу даних:', err.message);
    if (config.embedded.enabled) {
      console.error('  Вбудований PostgreSQL не запустився. Запустіть з DEBUG_PG=1 для докладного журналу,');
      console.error('  або вкажіть власну БД у backend/.env (DATABASE_URL).');
    } else {
      console.error('  Перевірте DATABASE_URL у backend/.env та що сервер БД запущено.');
    }
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`✔ JobMatch запущено: http://localhost:${config.port}`);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('\nЗупиняю сервер…');
    server.close();
    await pool.end().catch(() => {});
    await stopDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
