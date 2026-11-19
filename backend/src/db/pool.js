const { Pool } = require('pg');
const config = require('../config');

// Хмарні бази (Render, Neon, Supabase…) вимагають SSL при зовнішньому підключенні.
// Вмикається змінною DATABASE_SSL=true (для внутрішнього URL Render не потрібно).
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({ connectionString: config.databaseUrl, ssl });

pool.on('error', (err) => {
  console.error('Несподівана помилка пулу PostgreSQL:', err.message);
});

module.exports = pool;
