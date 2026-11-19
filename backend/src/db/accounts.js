/**
 * Початкові облікові записи JobMatch.
 * Паролі можна перевизначити змінними середовища (SEED_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD).
 */
const TEST_PASSWORD = process.env.SEED_PASSWORD || 'JobMatch#2026';

const ADMIN = {
  name: 'Адміністратор JobMatch',
  email: (process.env.ADMIN_EMAIL || 'admin@jobmatch.ua').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'JmAdmin@2026',
};

const CANDIDATE = { name: 'Максим Бондаренко', email: 'candidate@jobmatch.ua' };

const EMPLOYERS = [
  { name: 'Олена Коваль', email: 'hr@technova.com.ua', company: 'TechNova', industry: 'Розробка програмного забезпечення' },
  { name: 'Андрій Мельник', email: 'hr@databridge.com.ua', company: 'DataBridge', industry: 'Аналітика та Data Science' },
  { name: 'Ірина Шевченко', email: 'hr@creativelab.com.ua', company: 'CreativeLab', industry: 'Дизайн та продукт' },
];

/** Старі адреси першої версії → нові (для оновлення вже розгорнутої бази) */
const LEGACY_EMAILS = {
  'candidate@demo.ua': CANDIDATE.email,
  'hr@technova.demo': EMPLOYERS[0].email,
  'hr@databridge.demo': EMPLOYERS[1].email,
  'hr@creativelab.demo': EMPLOYERS[2].email,
};

module.exports = { TEST_PASSWORD, ADMIN, CANDIDATE, EMPLOYERS, LEGACY_EMAILS };
