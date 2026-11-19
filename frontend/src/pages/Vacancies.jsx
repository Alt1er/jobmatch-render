import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, PageHeader, ScoreRing, SkillTags, Spinner, formatDate, formatYears } from '../components/ui';

export default function Vacancies() {
  const { user } = useAuth();
  const [vacancies, setVacancies] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [skill, setSkill] = useState('');

  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState('');
  const [scores, setScores] = useState(null); // vacancy_id -> match

  useEffect(() => {
    api
      .get('/vacancies')
      .then((d) => setVacancies(d.vacancies))
      .catch((e) => setError(e.message));
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== 'candidate') return;
    api
      .get('/resumes')
      .then((d) => {
        setResumes(d.resumes);
        if (d.resumes[0]) setResumeId(String(d.resumes[0].id));
      })
      .catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!resumeId) {
      setScores(null);
      return;
    }
    api
      .get(`/resumes/${resumeId}/matches`)
      .then((d) => setScores(new Map(d.matches.map((m) => [m.vacancy.id, m]))))
      .catch(() => setScores(null));
  }, [resumeId]);

  const allSkills = useMemo(() => {
    const set = new Set();
    (vacancies || []).forEach((v) => v.skills.forEach((s) => set.add(s)));
    return [...set].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies]);

  const list = useMemo(() => {
    if (!vacancies) return [];
    const needle = q.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    let out = vacancies.filter(
      (v) =>
        (!needle || `${v.title} ${v.company_name} ${v.description} ${v.requirements}`.toLowerCase().includes(needle)) &&
        (!loc || v.location.toLowerCase().includes(loc)) &&
        (!skill || v.skills.includes(skill))
    );
    if (scores) out = [...out].sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0));
    return out;
  }, [vacancies, q, location, skill, scores]);

  return (
    <>
      <PageHeader title="Вакансії" subtitle="Знайдіть позицію за назвою, компанією, містом або навичкою" />

      <div className="card filters">
        <label className="field grow">
          <span>Пошук</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Наприклад: React, аналітик, Python" />
        </label>
        <label className="field">
          <span>Локація</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Київ, Віддалено…" />
        </label>
        <label className="field">
          <span>Навичка</span>
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Усі</option>
            {allSkills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {user?.role === 'candidate' && resumes.length > 0 && (
          <label className="field">
            <span>Відсоток збігу для резюме</span>
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {user?.role === 'candidate' && resumes.length === 0 && (
        <div className="alert alert-info">
          Щоб бачити відсоток збігу з кожною вакансією, <Link to="/cabinet">завантажте резюме</Link>.
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      {!vacancies && !error && <Spinner />}
      {vacancies && list.length === 0 && <Empty title="Нічого не знайдено">Спробуйте змінити параметри пошуку.</Empty>}

      <div className="stack">
        {list.map((v) => {
          const m = scores?.get(v.id);
          return (
            <article className="card vacancy-card" key={v.id}>
              <div className="vacancy-main">
                <h3>
                  <Link to={`/vacancies/${v.id}`}>{v.title}</Link>
                </h3>
                <p className="meta">
                  <b>{v.company_name}</b> · {v.location} · {v.employment}
                  {v.min_experience > 0 && <> · від {formatYears(v.min_experience)}</>}
                </p>
                <SkillTags skills={v.skills} matched={m?.matchedSkills || []} missing={m?.missingSkills || []} />
                <p className="muted small">Опубліковано {formatDate(v.created_at)}</p>
              </div>
              <div className="vacancy-side">
                {m && <ScoreRing score={m.score} />}
                {v.applied && <span className="badge st-invited">Ви відгукнулись</span>}
                <Link className="btn btn-outline btn-sm" to={`/vacancies/${v.id}`}>
                  Детальніше
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
