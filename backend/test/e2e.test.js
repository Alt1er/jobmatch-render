/**
 * Наскрізний тест API. База піднімається автоматично (вбудований PostgreSQL), початкові дані додаються самі.
 * Запуск: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = require('../src/app');
const pool = require('../src/db/pool');
const migrate = require('../src/db/migrate');
const seed = require('../src/db/seed');
const { ensureDatabase } = require('../src/db/embedded');
const bcrypt = require('bcryptjs');
const { runMaintenance } = require('../src/db/maintenance');
const { TEST_PASSWORD, ADMIN, CANDIDATE } = require('../src/db/accounts');

const SAMPLES = path.join(__dirname, '..', '..', 'samples');
let server;
let base;
let stopDb = async () => {};
const stamp = Date.now();

async function api(method, url, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(base + url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function fileForm(name, extra = {}) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(path.join(SAMPLES, name))]), name);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

test.before(async () => {
  // тести самі піднімають вбудовану БД (або підключаються до запущеної) і додають початкові дані
  stopDb = await ensureDatabase();
  await migrate();
  await seed({ quiet: true });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
  await stopDb();
});

const ctx = {};

test('реєстрація та валідація', async () => {
  let r = await api('POST', '/api/auth/register', { json: { name: 'A', email: 'bad', password: '1', role: 'x' } });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/auth/register', {
    json: { name: 'Тест Кандидат', email: `cand${stamp}@test.ua`, password: 'Password1!', role: 'candidate' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'candidate');
  ctx.cand = r.data.token;

  r = await api('POST', '/api/auth/register', {
    json: { name: 'Тест HR', email: `hr${stamp}@test.ua`, password: 'Password1!', role: 'employer', companyName: 'TestCorp' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.companyName, 'TestCorp');
  ctx.emp = r.data.token;

  r = await api('POST', '/api/auth/register', {
    json: { name: 'Дубль', email: `cand${stamp}@test.ua`, password: 'Password1!', role: 'candidate' },
  });
  assert.equal(r.status, 409);
});

test('вхід та /me', async () => {
  let r = await api('POST', '/api/auth/login', { json: { email: `cand${stamp}@test.ua`, password: 'wrong-pass' } });
  assert.equal(r.status, 401);
  r = await api('POST', '/api/auth/login', { json: { email: `cand${stamp}@test.ua`, password: 'Password1!' } });
  assert.equal(r.status, 200);
  r = await api('GET', '/api/auth/me', { token: r.data.token });
  assert.equal(r.data.user.email, `cand${stamp}@test.ua`);
  r = await api('GET', '/api/auth/me');
  assert.equal(r.status, 401);
});

test('ролі: роботодавець не може завантажувати резюме, кандидат — створювати вакансії', async () => {
  let r = await api('POST', '/api/resumes', { token: ctx.emp, form: fileForm('resume_frontend.docx') });
  assert.equal(r.status, 403);
  r = await api('POST', '/api/vacancies', {
    token: ctx.cand,
    json: { title: 'Тест', description: 'Опис вакансії тест тест тест тест' },
  });
  assert.equal(r.status, 403);
});

test('завантаження DOCX та PDF, виділення навичок і стажу', async () => {
  let r = await api('POST', '/api/resumes', { token: ctx.cand, form: fileForm('resume_frontend.docx') });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.resume.skills.includes('React'));
  assert.ok(r.data.resume.skills.includes('TypeScript'));
  assert.equal(r.data.resume.years_experience, 3, 'діапазони 2021–2022 і 2022–2024 дають 3 роки (більше за явні 2)');
  ctx.docxId = r.data.resume.id;

  r = await api('POST', '/api/resumes', { token: ctx.cand, form: fileForm('resume_frontend.pdf') });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.resume.skills.includes('React'), 'PDF: навички мають знаходитись');
  assert.equal(r.data.resume.years_experience, 3, 'PDF: освіта (перенесений рядок) не має рахуватись як стаж');
  ctx.pdfId = r.data.resume.id;

  // неправильний формат
  const bad = new FormData();
  bad.append('file', new Blob(['hello']), 'note.txt');
  r = await api('POST', '/api/resumes', { token: ctx.cand, form: bad });
  assert.equal(r.status, 400);

  // підроблене розширення
  const fake = new FormData();
  fake.append('file', new Blob(['це не pdf']), 'fake.pdf');
  r = await api('POST', '/api/resumes', { token: ctx.cand, form: fake });
  assert.equal(r.status, 400);
});

test('підбір вакансій: фронтенд-резюме має найвищий збіг із React-вакансіями', async () => {
  const r = await api('GET', `/api/resumes/${ctx.docxId}/matches`, { token: ctx.cand });
  assert.equal(r.status, 200);
  const m = r.data.matches;
  assert.ok(m.length >= 15);
  assert.match(m[0].vacancy.title, /Frontend|React|Fullstack/i, `топ-1: ${m[0].vacancy.title}`);
  assert.ok(m[0].score >= 60, `відсоток топ-1: ${m[0].score}`);
  assert.ok(m[0].score > m[m.length - 1].score);
  // відсортовано за спаданням
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].score >= m[i].score);
  assert.ok(m[0].matchedSkills.length > 0);
  console.log('  топ-3 для frontend:', m.slice(0, 3).map((x) => `${x.score}% ${x.vacancy.title}`).join(' | '));
});

test('підбір для бекенд- та дата-резюме', async () => {
  let r = await api('POST', '/api/resumes', { token: ctx.cand, form: fileForm('resume_backend.docx') });
  const backId = r.data.resume.id;
  r = await api('GET', `/api/resumes/${backId}/matches`, { token: ctx.cand });
  console.log('  топ-3 для backend:', r.data.matches.slice(0, 3).map((x) => `${x.score}% ${x.vacancy.title}`).join(' | '));
  assert.match(r.data.matches[0].vacancy.title, /Node|Fullstack|Backend/i);

  r = await api('POST', '/api/resumes', { token: ctx.cand, form: fileForm('resume_data_analyst.docx') });
  const dataId = r.data.resume.id;
  r = await api('GET', `/api/resumes/${dataId}/matches`, { token: ctx.cand });
  console.log('  топ-3 для data:', r.data.matches.slice(0, 3).map((x) => `${x.score}% ${x.vacancy.title}`).join(' | '));
  assert.match(r.data.matches[0].vacancy.title, /Data|BI|Analyst/i);
});

test('роботодавець: вакансія, рейтинг кандидатів, відгуки та статуси', async () => {
  let r = await api('POST', '/api/vacancies', {
    token: ctx.emp,
    json: {
      title: 'React розробник',
      description: 'Шукаємо розробника для роботи над веб-інтерфейсами нашого продукту у складі команди.',
      requirements: 'React, TypeScript, Redux, Git, REST API. Досвід від 1 року.',
      min_experience: 1,
      location: 'Віддалено',
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.vacancy.skills.includes('React'));
  ctx.vacId = r.data.vacancy.id;

  // чужа вакансія
  r = await api('GET', '/api/vacancies/1/candidates', { token: ctx.emp });
  assert.equal(r.status, 403);

  r = await api('GET', `/api/vacancies/${ctx.vacId}/candidates`, { token: ctx.emp });
  assert.equal(r.status, 200);
  const c = r.data.candidates;
  assert.ok(c.length >= 3);
  assert.equal(c[0].resume.title.toLowerCase().includes('frontend'), true, `топ кандидат: ${c[0].resume.title}`);
  assert.equal(c[0].resume.candidate_email, null, 'email приховано до відгуку');

  // кандидат відгукується
  r = await api('POST', '/api/applications', {
    token: ctx.cand,
    json: { vacancy_id: ctx.vacId, resume_id: ctx.docxId, message: 'Цікавить вакансія' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.application.score > 0);
  ctx.appId = r.data.application.id;

  r = await api('POST', '/api/applications', { token: ctx.cand, json: { vacancy_id: ctx.vacId, resume_id: ctx.docxId } });
  assert.equal(r.status, 409);

  r = await api('GET', `/api/vacancies/${ctx.vacId}/applications`, { token: ctx.emp });
  assert.equal(r.data.applications.length, 1);

  r = await api('PATCH', `/api/applications/${ctx.appId}/status`, { token: ctx.emp, json: { status: 'invited' } });
  assert.equal(r.status, 200);

  r = await api('GET', '/api/applications/mine', { token: ctx.cand });
  assert.equal(r.data.applications[0].status, 'invited');

  // після відгуку email доступний
  r = await api('GET', `/api/vacancies/${ctx.vacId}/candidates`, { token: ctx.emp });
  const applied = r.data.candidates.find((x) => x.application);
  assert.equal(applied.resume.candidate_email, `cand${stamp}@test.ua`);

  // роботодавець може завантажити файл резюме кандидата
  const dl = await fetch(`${base}/api/resumes/${ctx.docxId}/file`, { headers: { Authorization: `Bearer ${ctx.emp}` } });
  assert.equal(dl.status, 200);
  assert.ok((await dl.arrayBuffer()).byteLength > 1000);
});

test('приховане резюме не потрапляє в рейтинг роботодавця', async () => {
  let r = await api('PATCH', `/api/resumes/${ctx.pdfId}`, { token: ctx.cand, json: { is_visible: false } });
  assert.equal(r.status, 200);
  r = await api('GET', `/api/vacancies/${ctx.vacId}/candidates`, { token: ctx.emp });
  assert.ok(!r.data.candidates.some((x) => x.resume.id === ctx.pdfId));
  r = await api('GET', `/api/resumes/${ctx.pdfId}`, { token: ctx.emp });
  assert.equal(r.status, 403);
});

test('чуже резюме недоступне іншому кандидату; видалення', async () => {
  const other = await api('POST', '/api/auth/register', {
    json: { name: 'Інший', email: `other${stamp}@test.ua`, password: 'Password1!', role: 'candidate' },
  });
  let r = await api('GET', `/api/resumes/${ctx.docxId}`, { token: other.data.token });
  assert.equal(r.status, 403);
  r = await api('DELETE', `/api/resumes/${ctx.pdfId}`, { token: ctx.cand });
  assert.equal(r.status, 200);
  r = await api('GET', `/api/resumes/${ctx.pdfId}`, { token: ctx.cand });
  assert.equal(r.status, 404);
});

test('тестові акаунти: нові паролі працюють, старий пароль Demo1234! — ні', async () => {
  let r = await api('POST', '/api/auth/login', { json: { email: CANDIDATE.email, password: TEST_PASSWORD } });
  assert.equal(r.status, 200);
  r = await api('POST', '/api/auth/login', { json: { email: CANDIDATE.email, password: 'Demo1234!' } });
  assert.equal(r.status, 401);
  // старий акаунт першої версії після обслуговування втрачає старий пароль
  const oldHash = await bcrypt.hash('Demo1234!', 4);
  await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Old', 'candidate@demo.ua', $1, 'candidate') ON CONFLICT (email) DO UPDATE SET password_hash = $1",
    [oldHash]
  );
  await runMaintenance({ quiet: true });
  r = await api('POST', '/api/auth/login', { json: { email: 'candidate@demo.ua', password: 'Demo1234!' } });
  assert.equal(r.status, 401);
  await pool.query("DELETE FROM users WHERE email = 'candidate@demo.ua'");
  // підказка на сторінці входу не містить слова demo
  r = await api('GET', '/api/meta');
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.data).toLowerCase().includes('demo'));
});

test('health: стан сервера та бази', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'ok');
  assert.equal(r.data.db, 'ok');
  assert.ok(r.data.version);
});

test('зворотний зв\'язок: звернення, відповідь адміністратора, права доступу', async () => {
  // анонімне звернення
  let r = await api('POST', '/api/feedback', { json: { category: 'bug', message: 'коротко' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/feedback', {
    json: { category: 'idea', message: 'Додайте фільтр вакансій за зарплатою', email: `anon${stamp}@test.ua`, rating: 4 },
  });
  assert.equal(r.status, 201);

  // звернення від кандидата
  r = await api('POST', '/api/feedback', {
    token: ctx.cand,
    json: { category: 'bug', priority: 'high', page: '/cabinet', message: 'Після завантаження PDF не оновився список резюме' },
  });
  assert.equal(r.status, 201);
  const fid = r.data.feedback.id;
  assert.ok(r.data.feedback.email.endsWith('@test.ua'));

  // кандидат не має доступу до адмін-функцій
  r = await api('GET', '/api/feedback', { token: ctx.cand });
  assert.equal(r.status, 403);
  r = await api('GET', '/api/admin/stats', { token: ctx.cand });
  assert.equal(r.status, 403);

  // адміністратор
  const login = await api('POST', '/api/auth/login', { json: { email: ADMIN.email, password: ADMIN.password } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  const admin = login.data.token;
  r = await api('GET', '/api/feedback?status=new', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.data.feedback.some((f) => f.id === fid));
  r = await api('PATCH', `/api/feedback/${fid}`, {
    token: admin,
    json: { status: 'resolved', reply: 'Виправлено у версії 1.1.0, дякуємо!' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.feedback.status, 'resolved');
  r = await api('PATCH', `/api/feedback/${fid}`, { token: admin, json: { status: 'wrong' } });
  assert.equal(r.status, 400);

  // кандидат бачить відповідь
  r = await api('GET', '/api/feedback/mine', { token: ctx.cand });
  const mine = r.data.feedback.find((f) => f.id === fid);
  assert.equal(mine.status, 'resolved');
  assert.match(mine.admin_reply, /Виправлено/);

  r = await api('GET', '/api/admin/stats', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.data.feedback.byStatus.resolved >= 1);
  assert.ok(r.data.system.version);

  // через реєстрацію не можна стати адміністратором
  r = await api('POST', '/api/auth/register', {
    json: { name: 'Хакер', email: `adm${stamp}@test.ua`, password: 'Password1!', role: 'admin' },
  });
  assert.equal(r.status, 400);
});

test('очищення тестових даних', async () => {
  await pool.query("DELETE FROM feedback WHERE email LIKE '%" + stamp + "@test.ua'");
  await pool.query("DELETE FROM users WHERE email LIKE '%" + stamp + "@test.ua'");
  const { rows } = await pool.query('SELECT file_path FROM resumes');
  assert.ok(rows.length >= 0);
});
