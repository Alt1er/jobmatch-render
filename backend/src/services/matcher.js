/**
 * Алгоритм зіставлення резюме та вакансій.
 *
 * Підсумкова оцінка (0–100 %) складається з чотирьох показників:
 *   • навички   (55 %) — частка вимог вакансії, які закриває резюме;
 *   • текст     (30 %) — косинусна подібність TF-IDF векторів повних текстів;
 *   • посада    (15 %) — збіг назви вакансії з назвою/заголовком резюме;
 *   • досвід    — множник 0.85…1.00 залежно від відповідності мінімальному стажу.
 *
 *   score = (0.55·навички + 0.30·текст + 0.15·посада) · (0.85 + 0.15·досвід)
 *
 * Якщо у вакансії не вказано жодної навички, вага «навичок» перерозподіляється
 * між текстом (75 %) та посадою (25 %).
 *
 * Модуль не залежить від БД, тому легко тестується й замінюється
 * (наприклад, на модель embeddings) без змін в API.
 */
const { tokenize, titleTokens } = require('./text');

const WEIGHTS = { skills: 0.55, text: 0.3, title: 0.15 };
const WEIGHTS_NO_SKILLS = { text: 0.75, title: 0.25 };
const TEXT_SCALE = 1.8; // сирий косинус для двох релевантних текстів рідко перевищує 0.5

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function buildIdf(tokenLists) {
  const n = tokenLists.length;
  const df = new Map();
  for (const tokens of tokenLists) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
  return idf;
}

function vectorize(tokens, idf) {
  const vec = new Map();
  let sum = 0;
  for (const [t, c] of termFreq(tokens)) {
    const w = (1 + Math.log(c)) * (idf.get(t) || 1);
    vec.set(t, w);
    sum += w * w;
  }
  return { vec, norm: Math.sqrt(sum) };
}

function cosine(a, b) {
  if (!a.norm || !b.norm) return 0;
  const [small, large] = a.vec.size < b.vec.size ? [a.vec, b.vec] : [b.vec, a.vec];
  let dot = 0;
  for (const [t, w] of small) {
    const o = large.get(t);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}

function level(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function resumeTokens(r) {
  return tokenize(`${r.title} ${r.title} ${r.full_text}`);
}

function vacancyTokens(v) {
  return tokenize(`${v.title} ${v.title} ${v.requirements || ''} ${v.description || ''}`);
}

function prepareResume(r, idf) {
  const tokens = resumeTokens(r);
  return {
    src: r,
    skills: new Set((r.skills || []).map((s) => s.toLowerCase())),
    skillList: r.skills || [],
    years: Number(r.years_experience) || 0,
    headline: new Set([...titleTokens(r.title), ...titleTokens(String(r.full_text).slice(0, 300))]),
    tokens,
    vector: vectorize(tokens, idf),
  };
}

function prepareVacancy(v, idf) {
  const tokens = vacancyTokens(v);
  return {
    src: v,
    skillList: v.skills || [],
    minExp: Number(v.min_experience) || 0,
    titleSet: new Set(titleTokens(v.title)),
    tokens,
    vector: vectorize(tokens, idf),
  };
}

function scorePair(r, v) {
  // навички
  const matched = [];
  const missing = [];
  for (const s of v.skillList) (r.skills.has(s.toLowerCase()) ? matched : missing).push(s);
  const vacancySkillSet = new Set(v.skillList.map((s) => s.toLowerCase()));
  const extra = r.skillList.filter((s) => !vacancySkillSet.has(s.toLowerCase()));
  const skillScore = v.skillList.length ? matched.length / v.skillList.length : null;

  // текст
  const textScore = Math.min(1, cosine(r.vector, v.vector) * TEXT_SCALE);

  // посада
  let titleScore = 0.5;
  if (v.titleSet.size) {
    let hit = 0;
    for (const t of v.titleSet) if (r.headline.has(t)) hit += 1;
    titleScore = hit / v.titleSet.size;
  }

  // досвід
  const expScore = v.minExp <= 0 ? 1 : Math.min(1, r.years / v.minExp);

  const w = skillScore === null ? WEIGHTS_NO_SKILLS : WEIGHTS;
  const base =
    (skillScore === null ? 0 : w.skills * skillScore) + w.text * textScore + w.title * titleScore;
  const raw = base * (0.85 + 0.15 * expScore);
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

  const pct = (x) => (x === null ? null : Math.round(x * 100));
  return {
    score,
    level: level(score),
    breakdown: {
      skills: pct(skillScore),
      text: pct(textScore),
      title: pct(titleScore),
      experience: pct(expScore),
    },
    matchedSkills: matched,
    missingSkills: missing,
    extraSkills: extra.slice(0, 12),
  };
}

/** Рейтинг вакансій для одного резюме */
function rankVacanciesForResume(resume, vacancies) {
  const idf = buildIdf([...vacancies.map(vacancyTokens), resumeTokens(resume)]);
  const r = prepareResume(resume, idf);
  return vacancies
    .map((v) => ({ vacancy: v, ...scorePair(r, prepareVacancy(v, idf)) }))
    .sort((a, b) => b.score - a.score || b.vacancy.id - a.vacancy.id);
}

/** Рейтинг резюме для однієї вакансії */
function rankResumesForVacancy(vacancy, resumes) {
  const idf = buildIdf([...resumes.map(resumeTokens), vacancyTokens(vacancy)]);
  const v = prepareVacancy(vacancy, idf);
  return resumes
    .map((r) => ({ resume: r, ...scorePair(prepareResume(r, idf), v) }))
    .sort((a, b) => b.score - a.score || b.resume.id - a.resume.id);
}

module.exports = { rankVacanciesForResume, rankResumesForVacancy, scorePair };
