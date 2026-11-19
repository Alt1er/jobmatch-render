-- Схема бази даних JobMatch (відповідає ER-діаграмі з лабораторної роботи №2)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('candidate', 'employer')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(160) NOT NULL,
  industry   VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS resumes (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  full_text        TEXT NOT NULL,
  years_experience NUMERIC(4,1) NOT NULL DEFAULT 0,
  file_name        VARCHAR(255) NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  is_visible       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);

CREATE TABLE IF NOT EXISTS resume_skills (
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  skill_id  INTEGER NOT NULL REFERENCES skills(id)  ON DELETE CASCADE,
  PRIMARY KEY (resume_id, skill_id)
);

CREATE TABLE IF NOT EXISTS vacancies (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NOT NULL,
  requirements   TEXT NOT NULL DEFAULT '',
  location       VARCHAR(120) NOT NULL DEFAULT 'Віддалено',
  employment     VARCHAR(40)  NOT NULL DEFAULT 'Повна зайнятість',
  min_experience NUMERIC(4,1) NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vacancies_company ON vacancies(company_id);

CREATE TABLE IF NOT EXISTS vacancy_skills (
  vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills(id)    ON DELETE CASCADE,
  PRIMARY KEY (vacancy_id, skill_id)
);

-- Збережені результати зіставлення (кеш останнього розрахунку)
CREATE TABLE IF NOT EXISTS matches (
  id          SERIAL PRIMARY KEY,
  resume_id   INTEGER NOT NULL REFERENCES resumes(id)   ON DELETE CASCADE,
  vacancy_id  INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  breakdown   JSONB NOT NULL DEFAULT '{}',
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resume_id, vacancy_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id         SERIAL PRIMARY KEY,
  resume_id  INTEGER NOT NULL REFERENCES resumes(id)   ON DELETE CASCADE,
  vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  score      SMALLINT NOT NULL DEFAULT 0,
  message    TEXT NOT NULL DEFAULT '',
  status     VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'invited', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, vacancy_id)
);
