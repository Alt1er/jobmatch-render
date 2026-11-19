/**
 * Словник навичок та їх варіантів написання (укр/англ).
 * Використовується для виділення навичок з тексту резюме та вакансій.
 */

const DICTIONARY = {
  // Мови програмування
  JavaScript: ['javascript', 'js', 'ecmascript', 'es6', 'es2015'],
  TypeScript: ['typescript'],
  Python: ['python', 'пайтон', 'питон'],
  Java: ['java'],
  'C#': ['c#', 'csharp', 'c sharp'],
  'C++': ['c++', 'cpp'],
  PHP: ['php'],
  Go: ['golang'],
  Ruby: ['ruby'],
  Kotlin: ['kotlin'],
  Swift: ['swift'],
  Rust: ['rust'],
  Dart: ['dart'],
  SQL: ['sql'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  SASS: ['sass', 'scss'],
  Bash: ['bash', 'shell'],

  // Фронтенд
  React: ['react', 'reactjs', 'react.js'],
  Redux: ['redux'],
  'Next.js': ['next.js', 'nextjs'],
  Vue: ['vue', 'vuejs', 'vue.js'],
  Angular: ['angular', 'angularjs'],
  'Tailwind CSS': ['tailwind', 'tailwindcss'],
  Bootstrap: ['bootstrap'],
  Webpack: ['webpack', 'vite'],

  // Бекенд
  'Node.js': ['node.js', 'nodejs', 'node'],
  Express: ['express', 'express.js', 'expressjs'],
  NestJS: ['nestjs', 'nest.js'],
  Django: ['django'],
  Flask: ['flask'],
  FastAPI: ['fastapi'],
  'Spring Boot': ['spring boot', 'spring framework'],
  '.NET': ['.net', 'dotnet', 'asp.net'],
  Laravel: ['laravel'],
  'REST API': ['rest', 'restful', 'rest api'],
  GraphQL: ['graphql'],
  Microservices: ['microservices', 'мікросервіси', 'мікросервісна'],
  WebSocket: ['websocket', 'websockets', 'socket.io'],

  // Бази даних
  PostgreSQL: ['postgresql', 'postgres', 'postgre', 'psql'],
  MySQL: ['mysql', 'mariadb'],
  MongoDB: ['mongodb', 'mongo'],
  Redis: ['redis'],
  Elasticsearch: ['elasticsearch', 'elastic'],
  SQLite: ['sqlite'],
  'Бази даних': ['бази даних', 'база даних', 'databases', 'database design', 'субд'],

  // DevOps та інфраструктура
  Docker: ['docker', 'docker-compose'],
  Kubernetes: ['kubernetes', 'k8s'],
  'CI/CD': ['ci/cd', 'cicd', 'ci-cd', 'github actions', 'gitlab ci'],
  Git: ['git', 'github', 'gitlab', 'bitbucket'],
  Linux: ['linux', 'ubuntu', 'debian'],
  AWS: ['aws', 'amazon web services'],
  Azure: ['azure'],
  GCP: ['gcp', 'google cloud'],
  Terraform: ['terraform'],
  Ansible: ['ansible'],
  Jenkins: ['jenkins'],
  Nginx: ['nginx'],
  Prometheus: ['prometheus', 'grafana'],

  // Дані та ML
  'Machine Learning': ['machine learning', 'ml', 'машинне навчання', 'машинного навчання'],
  'Deep Learning': ['deep learning', 'глибоке навчання', 'нейронні мережі', 'neural networks'],
  NLP: ['nlp', 'natural language processing', 'обробка природної мови', 'обробка природної мови'],
  PyTorch: ['pytorch'],
  TensorFlow: ['tensorflow', 'keras'],
  Pandas: ['pandas'],
  NumPy: ['numpy'],
  'scikit-learn': ['scikit-learn', 'sklearn'],
  'Power BI': ['power bi', 'powerbi'],
  Tableau: ['tableau'],
  Excel: ['excel', 'google sheets'],
  'Аналіз даних': ['data analysis', 'data analytics', 'аналіз даних', 'аналітика даних', 'data science'],
  ETL: ['etl', 'data pipelines'],
  Spark: ['spark', 'pyspark', 'hadoop'],
  Statistics: ['statistics', 'статистика', 'статистичний'],

  // Тестування
  'Ручне тестування': ['manual testing', 'ручне тестування', 'мануальне тестування', 'test cases', 'тест-кейси', 'тест-кейс'],
  'Автотестування': ['automation testing', 'test automation', 'автотестування', 'автоматизоване тестування', 'автотести'],
  Selenium: ['selenium'],
  Cypress: ['cypress'],
  Playwright: ['playwright'],
  Jest: ['jest', 'mocha', 'vitest'],
  Postman: ['postman', 'swagger'],

  // Дизайн та продукт
  Figma: ['figma'],
  'UI/UX': ['ui/ux', 'ux/ui', 'ux', 'ui design', 'ux design', 'user experience', 'веб-дизайн', 'web design'],
  Photoshop: ['photoshop', 'illustrator', 'adobe'],
  Agile: ['agile'],
  Scrum: ['scrum', 'kanban'],
  Jira: ['jira', 'confluence'],
  'Product Management': ['product management', 'product manager', 'продакт', 'управління продуктом'],
  'Project Management': ['project management', 'project manager', 'управління проєктами', 'управління проектами'],
  Roadmap: ['roadmap', 'роадмап'],

  // Загальне
  OOP: ['oop', 'ооп', "об'єктно-орієнтоване", 'объектно-ориентированное'],
  'Алгоритми': ['algorithms', 'data structures', 'алгоритми', 'структури даних'],
  'Кібербезпека': ['cybersecurity', 'information security', 'кібербезпека', 'інформаційна безпека', 'owasp', 'pentest'],
  'Мобільна розробка': ['android', 'ios', 'react native', 'flutter', 'мобільна розробка'],

  // Мови та soft skills
  'Англійська мова': ['english', 'англійська', 'англійської', 'англійською'],
  'Німецька мова': ['german', 'deutsch', 'німецька', 'німецької', 'німецькою'],
  Комунікація: ['communication', 'комунікація', 'комунікабельність', 'комунікативні'],
  'Командна робота': ['teamwork', 'командна робота', 'командної роботи', 'team player'],
  Лідерство: ['leadership', 'лідерство', 'керування командою', 'team lead'],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function compileAlias(alias) {
  const body = escapeRegex(alias).replace(/ /g, '[\\s-]+');
  return new RegExp(`(?<![\\p{L}\\p{N}+#.])${body}(?![\\p{L}\\p{N}+#])`, 'iu');
}

const COMPILED = Object.entries(DICTIONARY).map(([name, aliases]) => ({
  name,
  patterns: aliases.map(compileAlias),
}));

const CANONICAL = Object.keys(DICTIONARY);
const CANONICAL_LOWER = new Map(CANONICAL.map((n) => [n.toLowerCase(), n]));

/** Знаходить усі навички зі словника в довільному тексті */
function extractSkills(text) {
  const src = String(text || '').replace(/[’`ʼ]/g, "'");
  const found = [];
  for (const { name, patterns } of COMPILED) {
    if (patterns.some((re) => re.test(src))) found.push(name);
  }
  return found;
}

/** Приводить введені користувачем назви до канонічних (або залишає як є) */
function normalizeSkillNames(list) {
  const out = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const name = String(raw || '').trim().slice(0, 80);
    if (!name) continue;
    const canon = CANONICAL_LOWER.get(name.toLowerCase());
    if (canon) {
      out.add(canon);
      continue;
    }
    const viaAlias = extractSkills(name);
    out.add(viaAlias.length === 1 ? viaAlias[0] : name);
  }
  return [...out];
}

module.exports = { extractSkills, normalizeSkillNames, CANONICAL };
