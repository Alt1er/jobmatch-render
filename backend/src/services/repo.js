/**
 * Робота з БД: вибірки резюме/вакансій з навичками та збереження результатів зіставлення.
 */
const pool = require('../db/pool');
const matcher = require('./matcher');

const RESUME_SELECT = `
  SELECT r.id, r.user_id, r.title, r.full_text,
         r.years_experience::float8 AS years_experience,
         r.file_name, r.is_visible, r.created_at,
         u.name AS candidate_name, u.email AS candidate_email,
         COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills
    FROM resumes r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN resume_skills rs ON rs.resume_id = r.id
    LEFT JOIN skills s ON s.id = rs.skill_id`;

const VACANCY_SELECT = `
  SELECT v.id, v.company_id, c.name AS company_name, c.industry,
         v.title, v.description, v.requirements, v.location, v.employment,
         v.min_experience::float8 AS min_experience, v.is_active, v.created_at,
         COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills
    FROM vacancies v
    JOIN companies c ON c.id = v.company_id
    LEFT JOIN vacancy_skills vs ON vs.vacancy_id = v.id
    LEFT JOIN skills s ON s.id = vs.skill_id`;

async function getResume(id, db = pool) {
  const { rows } = await db.query(`${RESUME_SELECT} WHERE r.id = $1 GROUP BY r.id, u.id`, [id]);
  return rows[0] || null;
}

async function listResumesByUser(userId) {
  const { rows } = await pool.query(
    `${RESUME_SELECT} WHERE r.user_id = $1 GROUP BY r.id, u.id ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows;
}

/** Резюме, доступні роботодавцю: відкриті + ті, що подали відгук на вакансію */
async function listResumesForVacancy(vacancyId) {
  const { rows } = await pool.query(
    `${RESUME_SELECT}
      WHERE r.is_visible = TRUE
         OR EXISTS (SELECT 1 FROM applications a WHERE a.resume_id = r.id AND a.vacancy_id = $1)
      GROUP BY r.id, u.id`,
    [vacancyId]
  );
  return rows;
}

async function getVacancy(id, db = pool) {
  const { rows } = await db.query(`${VACANCY_SELECT} WHERE v.id = $1 GROUP BY v.id, c.id`, [id]);
  return rows[0] || null;
}

async function listActiveVacancies() {
  const { rows } = await pool.query(
    `${VACANCY_SELECT} WHERE v.is_active = TRUE GROUP BY v.id, c.id ORDER BY v.created_at DESC`
  );
  return rows;
}

async function listVacanciesByCompany(companyId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.title, v.location, v.employment, v.min_experience::float8 AS min_experience,
            v.is_active, v.created_at,
            COALESCE((SELECT array_agg(s.name ORDER BY s.name)
                        FROM vacancy_skills vs JOIN skills s ON s.id = vs.skill_id
                       WHERE vs.vacancy_id = v.id), '{}') AS skills,
            (SELECT COUNT(*)::int FROM applications a WHERE a.vacancy_id = v.id) AS applications_count,
            (SELECT COUNT(*)::int FROM applications a WHERE a.vacancy_id = v.id AND a.status = 'new') AS new_applications
       FROM vacancies v
      WHERE v.company_id = $1
      ORDER BY v.created_at DESC`,
    [companyId]
  );
  return rows;
}

/** Замінює набір навичок у таблиці-зв'язку (resume_skills / vacancy_skills) */
async function setSkills(client, table, idColumn, id, names) {
  await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
  if (!names.length) return;
  await client.query(
    'INSERT INTO skills (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING',
    [names]
  );
  await client.query(
    `INSERT INTO ${table} (${idColumn}, skill_id)
     SELECT $1, id FROM skills WHERE name = ANY($2::text[])`,
    [id, names]
  );
}

async function saveMatches(pairs) {
  if (!pairs.length) return;
  try {
    await pool.query(
      `INSERT INTO matches (resume_id, vacancy_id, score, breakdown)
       SELECT x.rid, x.vid, x.score, x.bd::jsonb
         FROM unnest($1::int[], $2::int[], $3::int[], $4::text[]) AS x(rid, vid, score, bd)
       ON CONFLICT (resume_id, vacancy_id)
       DO UPDATE SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown, matched_at = now()`,
      [
        pairs.map((p) => p.resumeId),
        pairs.map((p) => p.vacancyId),
        pairs.map((p) => p.score),
        pairs.map((p) => JSON.stringify(p.breakdown)),
      ]
    );
  } catch (err) {
    console.error('Не вдалося зберегти результати зіставлення:', err.message);
  }
}

/** Підбір вакансій для резюме (рейтинг за відсотком) */
async function matchVacanciesForResume(resume) {
  const vacancies = await listActiveVacancies();
  const ranked = matcher.rankVacanciesForResume(resume, vacancies);
  await saveMatches(
    ranked.map((m) => ({
      resumeId: resume.id,
      vacancyId: m.vacancy.id,
      score: m.score,
      breakdown: m.breakdown,
    }))
  );
  return ranked;
}

/** Підбір кандидатів для вакансії */
async function matchResumesForVacancy(vacancy) {
  const resumes = await listResumesForVacancy(vacancy.id);
  const ranked = matcher.rankResumesForVacancy(vacancy, resumes);
  await saveMatches(
    ranked.map((m) => ({
      resumeId: m.resume.id,
      vacancyId: vacancy.id,
      score: m.score,
      breakdown: m.breakdown,
    }))
  );
  return ranked;
}

module.exports = {
  getResume,
  listResumesByUser,
  getVacancy,
  listActiveVacancies,
  listVacanciesByCompany,
  setSkills,
  matchVacanciesForResume,
  matchResumesForVacancy,
};
