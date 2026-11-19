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
  formatYears,
  levelOf,
  levelText,
} from '../../components/ui';

export default function CandidateMatches() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [min, setMin] = useState(0);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .get(`/resumes/${id}/matches`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const quickApply = async (vacancyId) => {
    setBusyId(vacancyId);
    setError('');
    try {
      await api.post('/applications', { vacancy_id: vacancyId, resume_id: Number(id) });
      setData((d) => ({ ...d, matches: d.matches.map((m) => (m.vacancy.id === vacancyId ? { ...m, applied: true } : m)) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (error && !data) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner label="Алгоритм підбирає вакансії…" />;

  const shown = data.matches.filter((m) => m.score >= min);
  const best = data.matches[0];

  return (
    <>
      <PageHeader
        title="Підібрані вакансії"
        subtitle={`Резюме: «${data.resume.title}» · досвід ${formatYears(data.resume.years_experience)} · розпізнано навичок: ${data.resume.skills.length}`}
        actions={
          <Link className="btn btn-ghost" to="/cabinet">
            ← До резюме
          </Link>
        }
      />
      <ErrorBox>{error}</ErrorBox>

      {best && (
        <div className="card summary-card">
          <ScoreRing score={best.score} size={72} />
          <div>
            <b>Найкращий збіг: {best.vacancy.title}</b>
            <p className="muted">
              {best.vacancy.company_name} · {levelText[levelOf(best.score)].toLowerCase()}. Всього вакансій у підборі: {data.matches.length}.
            </p>
          </div>
        </div>
      )}

      <div className="card slider-card">
        <label htmlFor="min">
          Показувати збіг від <b>{min}%</b>
        </label>
        <input id="min" type="range" min="0" max="90" step="5" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        <span className="muted small">
          Показано {shown.length} з {data.matches.length}
        </span>
      </div>

      {shown.length === 0 && <Empty title="Немає вакансій із таким збігом">Зменшіть мінімальний відсоток.</Empty>}

      <div className="stack">
        {shown.map((m) => (
          <article className="card match-card" key={m.vacancy.id}>
            <ScoreRing score={m.score} size={72} />
            <div className="match-body">
              <h3>
                <Link to={`/vacancies/${m.vacancy.id}`}>{m.vacancy.title}</Link>
              </h3>
              <p className="meta">
                <b>{m.vacancy.company_name}</b> · {m.vacancy.location} · {m.vacancy.employment}
                {m.vacancy.min_experience > 0 && <> · від {formatYears(m.vacancy.min_experience)}</>}
              </p>
              <SkillTags skills={m.vacancy.skills} matched={m.matchedSkills} missing={m.missingSkills} />
              {open === m.vacancy.id && <Breakdown breakdown={m.breakdown} />}
            </div>
            <div className="match-side">
              <span className={`level level-${m.level}`}>{levelText[m.level]}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === m.vacancy.id ? null : m.vacancy.id)}>
                {open === m.vacancy.id ? 'Сховати деталі' : 'Чому такий %?'}
              </button>
              {m.applied ? (
                <span className="badge st-invited">Ви відгукнулись</span>
              ) : (
                <button className="btn btn-primary btn-sm" disabled={busyId === m.vacancy.id} onClick={() => quickApply(m.vacancy.id)}>
                  Відгукнутися
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
