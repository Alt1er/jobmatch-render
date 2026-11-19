const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { ensureDatabase } = require('./embedded');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  (async () => {
    const stop = await ensureDatabase();
    try {
      await migrate();
      console.log('✔ Схему бази даних створено / оновлено');
    } finally {
      await pool.end();
      await stop();
    }
  })().catch((err) => {
    console.error('Помилка міграції:', err.message);
    process.exit(1);
  });
}

module.exports = migrate;
