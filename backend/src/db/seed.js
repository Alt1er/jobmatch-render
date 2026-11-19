/**
 * Наповнення БД демо-даними: 3 роботодавці, 1 кандидат та 18 вакансій.
 * Запуск: npm run db:seed (безпечно запускати повторно).
 */
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const migrate = require('./migrate');
const { ensureDatabase } = require('./embedded');
const repo = require('../services/repo');
const { extractSkills } = require('../services/skills');

const PASSWORD = 'Demo1234!';

const EMPLOYERS = [
  { name: 'Олена Коваль', email: 'hr@technova.demo', company: 'TechNova', industry: 'Розробка програмного забезпечення' },
  { name: 'Андрій Мельник', email: 'hr@databridge.demo', company: 'DataBridge', industry: 'Аналітика та Data Science' },
  { name: 'Ірина Шевченко', email: 'hr@creativelab.demo', company: 'CreativeLab', industry: 'Дизайн та продукт' },
];

const VACANCIES = [
  // TechNova
  [0, 'Junior Frontend розробник (React)', 'Віддалено', 'Повна зайнятість', 0.5,
    'Приєднуйтесь до команди, що розробляє клієнтські застосунки для e-commerce. Працюватимете над інтерфейсами, інтеграцією з API та покращенням продуктивності.',
    'Знання JavaScript, HTML, CSS. Досвід з React та Git. Розуміння REST API. Бажано TypeScript та Redux.'],
  [0, 'Middle Frontend Developer (React, TypeScript)', 'Київ / Віддалено', 'Повна зайнятість', 2.5,
    'Розвиток великого SPA-застосунку для фінтех-клієнтів: нові функції, рефакторинг, код-рев\'ю, наставництво джуніорів.',
    'Від 2.5 років комерційного досвіду з React та TypeScript. Redux, Next.js, Jest. Знання Git, CI/CD. Англійська — Intermediate.'],
  [0, 'Node.js Backend розробник', 'Віддалено', 'Повна зайнятість', 2,
    'Проєктуватимете та підтримуватимете REST API для високонавантаженої платформи. Робота з базами даних, чергами та мікросервісами.',
    'Node.js, Express, JavaScript або TypeScript. PostgreSQL, Redis. REST API, Docker, Git. Розуміння мікросервісів буде плюсом.'],
  [0, 'Fullstack Developer (React + Node.js)', 'Львів', 'Повна зайнятість', 3,
    'Повний цикл розробки продукту: від проєктування бази даних до інтерфейсу користувача. Невелика команда, багато відповідальності.',
    'React, Node.js, Express, PostgreSQL, TypeScript. Docker, Git, REST API. Досвід з CI/CD. Англійська — Intermediate.'],
  [0, 'Senior Java Developer', 'Київ', 'Повна зайнятість', 5,
    'Розробка бекенду банківських сервісів, оптимізація запитів, участь в архітектурних рішеннях.',
    'Java, Spring Boot, мікросервіси, PostgreSQL, Kafka. SQL, Docker, Kubernetes. Досвід від 5 років. Алгоритми та структури даних.'],
  [0, 'DevOps Engineer', 'Віддалено', 'Повна зайнятість', 3,
    'Побудова та підтримка CI/CD, управління інфраструктурою в хмарі, моніторинг і автоматизація.',
    'Linux, Docker, Kubernetes, AWS, Terraform, Ansible. CI/CD (GitHub Actions, Jenkins), Bash, Python. Prometheus/Grafana.'],
  [0, 'QA Engineer (Automation)', 'Дніпро / Віддалено', 'Повна зайнятість', 2,
    'Автоматизація тестування веб-застосунків, підтримка тестових фреймворків, участь у релізах.',
    'Автотестування на JavaScript або Python, Cypress або Selenium, Postman, REST API. Тест-кейси, Jira, Git. Англійська — Intermediate.'],
  [0, 'Junior QA Engineer (ручне тестування)', 'Одеса', 'Повна зайнятість', 0,
    'Ручне тестування вебу та мобільних додатків, написання тест-кейсів і баг-репортів у Jira.',
    'Розуміння основ тестування, тест-кейси, ручне тестування, Postman, SQL на базовому рівні. Jira. Уважність та комунікабельність.'],
  [0, 'Android розробник (Kotlin)', 'Віддалено', 'Повна зайнятість', 2,
    'Розробка мобільного застосунку для логістичної компанії: нові екрани, офлайн-режим, push-повідомлення.',
    'Android, Kotlin, REST API, Git. Досвід з Jetpack, SQLite. Розуміння ООП та алгоритмів. Бажано Flutter.'],
  // DataBridge
  [1, 'Data Analyst', 'Київ / Віддалено', 'Повна зайнятість', 1,
    'Аналіз продуктових та маркетингових даних, побудова дашбордів, підготовка рекомендацій для менеджменту.',
    'SQL, Excel, Power BI або Tableau. Python (Pandas). Аналіз даних, статистика. Англійська — Intermediate.'],
  [1, 'Junior Python розробник', 'Віддалено', 'Повна зайнятість', 0.5,
    'Розробка внутрішніх інструментів на Python, автоматизація обробки даних, підтримка API.',
    'Python, SQL, Git, Linux. Знання Flask або Django. REST API. Бажано PostgreSQL, Docker.'],
  [1, 'Machine Learning Engineer', 'Віддалено', 'Повна зайнятість', 3,
    'Розробка та впровадження ML-моделей: NLP, рекомендаційні системи, оцінка якості та MLOps.',
    'Python, PyTorch або TensorFlow, scikit-learn, Pandas, NumPy. Machine Learning, NLP, глибоке навчання. SQL, Docker, Git. Статистика.'],
  [1, 'Data Engineer', 'Київ', 'Повна зайнятість', 3,
    'Побудова ETL-пайплайнів, підтримка сховища даних, оптимізація запитів.',
    'Python, SQL, PostgreSQL, Spark, ETL, Airflow. Docker, AWS, Git. Бази даних, оптимізація запитів.'],
  [1, 'BI розробник (Power BI)', 'Одеса / Віддалено', 'Повна зайнятість', 1.5,
    'Створення звітів і дашбордів для бізнес-підрозділів, підготовка моделей даних.',
    'Power BI, SQL, Excel, аналіз даних. Розуміння ETL. Англійська — Intermediate. Комунікація зі стейкхолдерами.'],
  // CreativeLab
  [2, 'UI/UX дизайнер', 'Віддалено', 'Повна зайнятість', 1.5,
    'Проєктування інтерфейсів вебсервісів і мобільних додатків: дослідження, прототипи, дизайн-система.',
    'Figma, UI/UX, прототипування, дослідження користувачів. Photoshop. Розуміння HTML та CSS буде перевагою. Англійська.'],
  [2, 'Product Manager', 'Київ / Віддалено', 'Повна зайнятість', 3,
    'Управління продуктом: роадмап, пріоритезація, аналітика, взаємодія з розробкою та дизайном.',
    'Product management, Agile, Scrum, Jira, аналіз даних, SQL. Roadmap, комунікація, лідерство. Англійська — Upper-Intermediate.'],
  [2, 'Project Manager (IT)', 'Львів', 'Повна зайнятість', 3,
    'Керування IT-проєктами: планування, ризики, бюджет, комунікація з клієнтами.',
    'Project management, Agile, Scrum, Kanban, Jira, Confluence. Комунікація, командна робота, лідерство. Англійська — Upper-Intermediate.'],
  [2, 'Стажування: Frontend (HTML/CSS/JS)', 'Віддалено', 'Стажування', 0,
    'Оплачувана програма стажування: навчання на реальних проєктах під керівництвом ментора.',
    'HTML, CSS, JavaScript на базовому рівні. Git. Бажання вчитись, англійська — Pre-Intermediate. React буде плюсом.'],
];

async function seed({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  await migrate();
  const hash = await bcrypt.hash(PASSWORD, 10);

  const companyIds = [];
  for (const e of EMPLOYERS) {
    let { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [e.email]);
    let userId = rows[0] && rows[0].id;
    if (!userId) {
      ({ rows } = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'employer') RETURNING id",
        [e.name, e.email, hash]
      ));
      userId = rows[0].id;
    }
    ({ rows } = await pool.query('SELECT id FROM companies WHERE user_id = $1', [userId]));
    if (!rows[0]) {
      ({ rows } = await pool.query(
        'INSERT INTO companies (user_id, name, industry) VALUES ($1, $2, $3) RETURNING id',
        [userId, e.company, e.industry]
      ));
    }
    companyIds.push(rows[0].id);
  }

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Демо Кандидат', 'candidate@demo.ua', $1, 'candidate') ON CONFLICT (email) DO NOTHING`,
    [hash]
  );

  const { rows: cnt } = await pool.query('SELECT COUNT(*)::int AS n FROM vacancies');
  if (cnt[0].n === 0) {
    for (const [ci, title, location, employment, minExp, description, requirements] of VACANCIES) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO vacancies (company_id, title, description, requirements, location, employment, min_experience)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [companyIds[ci], title, description, requirements, location, employment, minExp]
        );
        const skills = extractSkills(`${title}\n${requirements}`);
        await repo.setSkills(client, 'vacancy_skills', 'vacancy_id', rows[0].id, skills);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    log(`✔ Додано ${VACANCIES.length} демо-вакансій`);
  } else {
    log('• Вакансії вже є — пропускаю');
  }

  log('✔ Демо-акаунти (пароль для всіх: ' + PASSWORD + '):');
  log('   кандидат:     candidate@demo.ua');
  EMPLOYERS.forEach((e) => log(`   роботодавець: ${e.email}  (${e.company})`));
}

if (require.main === module) {
  (async () => {
    const stop = await ensureDatabase();
    try {
      await seed();
    } finally {
      await pool.end();
      await stop();
    }
  })().catch((err) => {
    console.error('Помилка seed:', err);
    process.exit(1);
  });
}

module.exports = seed;
