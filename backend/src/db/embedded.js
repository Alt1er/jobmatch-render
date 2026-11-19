/**
 * Вбудований PostgreSQL: справжній сервер PostgreSQL 17, який запускається разом із застосунком.
 * Нічого встановлювати вручну не потрібно — бінарники приходять через npm.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const pool = require('./pool');

const DB_NAME = 'jobmatch';
const DB_USER = 'jobmatch';
const DB_PASSWORD = 'jobmatch';

let instance = null;

async function canConnect() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function startEmbedded() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = config.embedded.dir;
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const debug = !!process.env.DEBUG_PG;

  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    port: config.embedded.port,
    user: DB_USER,
    password: DB_PASSWORD,
    persistent: true,
    // UTF8 + C-локаль: однаково на Windows/Linux/macOS і без проблем із кирилицею
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    // працює і в Docker, де процес запущено від root
    createPostgresUser: isRoot,
    onLog: debug ? console.log : () => {},
    onError: debug ? console.error : () => {},
  });

  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) {
    console.log('• Перший запуск: створюю локальну базу даних PostgreSQL…');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE ${DB_NAME}`);
  } finally {
    await client.end();
  }
  instance = pg;
  console.log(`✔ Вбудований PostgreSQL запущено (порт ${config.embedded.port}, дані: ${dir})`);
}

async function stopEmbedded() {
  if (!instance) return;
  const pg = instance;
  instance = null;
  await pg.stop().catch(() => {});
}

/**
 * Гарантує, що база даних доступна. Повертає функцію зупинки.
 *  • зовнішня БД (задано DATABASE_URL) — нічого не робить;
 *  • вбудована БД уже працює (наприклад, у сусідньому терміналі) — підключається до неї;
 *  • інакше запускає вбудований PostgreSQL.
 */
async function ensureDatabase() {
  if (!config.embedded.enabled) return async () => {};
  if (await canConnect()) return async () => {};
  await startEmbedded();
  return stopEmbedded;
}

module.exports = { ensureDatabase };
