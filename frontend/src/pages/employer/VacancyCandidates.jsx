import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import {
  Breakdown,
  Empty,
  ErrorBox,
  PageHeader,
  ScoreRing,
  SkillTags,
  Spinner,
  StatusBadge,
  STATUS,
  formatDate,
  formatYears,
  levelText,
} from '../../components/ui';

function Candidates({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [min, setMin] = useState(30);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api
      .get(`/vacancies/${id}/candidates`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner label="Алгоритм ранжує кандидатів…" />;

  const shown = data.candidates.filter((c) => c.score >= min || c.application);

  return (
    <>
      <div className="card slider-card">
        <label htmlFor="min">
          Показувати збіг від <b>{min}%</b>
        </label>
        <input id="min" type="range" min="0" max="90" step="5" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        <span className="muted small">
          Показано {shown.length} з {data.candidates.length}
        </span>
      </div>
      {shown.length === 0 && (
        <Empty title="Кандидатів із таким збігом поки немає">Зменште мінімальний відсоток або зачекайте на нові резюме.</Empty>
      )}
      <div className="stack">
        {shown.map((c) => (
          <article className="card match-card" key={c.resume.id}>
            <ScoreRing score={c.score} size={72} />
            <div className="match-body">
              <h3>
                <Link to={`/resumes/${c.resume.id}`}>{c.resume.title}</Link>
              </h3>
              <p className="meta">
                <b>{c.resume.candidate_name}</b>
                {c.resume.candidate_email && <> · {c.resume.candidate_email}</>} · досвід {formatYears(c.resume.years_experience)}
              </p>
              <p className="muted small excerpt">{c.resume.excerpt}…</p>
              <SkillTags skills={c.resume.skills} matched={c.matchedSkills} missing={c.missingSkills} />
              {open === c.resume.id && <Breakdown breakdown={c.breakdown} />}
            </div>
            <div className="match-side">
              <span className={`level level-${c.level}`}>{levelText[c.level]}</span>
              {c.application && <StatusBadge status={c.application.status} />}
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === c.resume.id ? null : c.resume.id)}>
                {open === c.resume.id ? 'Сховати деталі' : 'Чому такий %?'}
              </button>
              <Link className="btn btn-outline btn-sm" to={`/resumes/${c.resume.id}`}>
                Резюме
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Applications({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/vacancies/${id}/applications`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const setStatus = async (appId, status) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status });
      setData((d) => ({ ...d, applications: d.applications.map((a) => (a.id === appId ? { ...a, status } : a)) }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  if (data.applications.length === 0) return <Empty title="Відгуків поки немає">Кандидати з’являться тут, щойно відгукнуться на вакансію.</Empty>;

  return (
    <div className="stack">
      {data.applications.map((a) => (
        <article className="card match-card" key={a.id}>
          <ScoreRing score={a.score} size={64} />
          <div className="match-body">
            <h3>
              <Link to={`/resumes/${a.resume_id}`}>{a.candidate_name}</Link>
            </h3>
            <p className="meta">
              {a.candidate_email} · резюме «{a.resume_title}» · досвід {formatYears(a.years_experience)} · {formatDate(a.created_at)}
            </p>
            {a.message && <p className="muted quote">{a.message}</p>}
          </div>
          <div className="match-side">
            <StatusBadge status={a.status} />
            <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} aria-label="Змінити статус відгуку">
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function VacancyCandidates() {
  const { id } = useParams();
  const [tab, setTab] = useState('candidates');
  const [vacancy, setVacancy] = useState(null);

  useEffect(() => {
    api
      .get(`/vacancies/${id}`)
      .then((d) => setVacancy(d.vacancy))
      .catch(() => {});
  }, [id]);

  return (
    <>
      <PageHeader
        title={vacancy ? vacancy.title : 'Вакансія'}
        subtitle={vacancy ? `${vacancy.location} · ${vacancy.employment} · навички: ${vacancy.skills.join(', ') || '—'}` : ''}
        actions={
          <>
            <Link className="btn btn-ghost" to="/employer">
              ← Усі вакансії
            </Link>
            <Link className="btn btn-outline" to={`/employer/vacancies/${id}/edit`}>
              Редагувати
            </Link>
          </>
        }
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'candidates'} className={tab === 'candidates' ? 'active' : ''} onClick={() => setTab('candidates')}>
          Рейтинг кандидатів
        </button>
        <button role="tab" aria-selected={tab === 'applications'} className={tab === 'applications' ? 'active' : ''} onClick={() => setTab('applications')}>
          Відгуки
        </button>
      </div>
      {tab === 'candidates' ? <Candidates id={id} /> : <Applications id={id} />}
    </>
  );
}
