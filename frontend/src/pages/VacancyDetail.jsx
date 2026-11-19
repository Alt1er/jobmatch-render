import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  Breakdown,
  ErrorBox,
  ScoreRing,
  SkillTags,
  Spinner,
  SuccessBox,
  formatDate,
  formatYears,
  levelOf,
  levelText,
} from '../components/ui';

export default function VacancyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [vacancy, setVacancy] = useState(null);
  const [error, setError] = useState('');

  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState('');
  const [match, setMatch] = useState(null);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    setVacancy(null);
    api
      .get(`/vacancies/${id}`)
      .then((d) => setVacancy(d.vacancy))
      .catch((e) => setError(e.message));
  }, [id]);

  // для кандидата: резюме, відгуки
  useEffect(() => {
    if (user?.role !== 'candidate') return;
    api
      .get('/resumes')
      .then((d) => {
        setResumes(d.resumes);
        if (d.resumes[0]) setResumeId(String(d.resumes[0].id));
      })
      .catch(() => {});
    api
      .get('/applications/mine')
      .then((d) => setApplied(d.applications.some((a) => String(a.vacancy_id) === String(id))))
      .catch(() => {});
  }, [user?.id, user?.role, id]);

  useEffect(() => {
    if (!resumeId) {
      setMatch(null);
      return;
    }
    api
      .get(`/resumes/${resumeId}/matches`)
      .then((d) => setMatch(d.matches.find((m) => String(m.vacancy.id) === String(id)) || null))
      .catch(() => setMatch(null));
  }, [resumeId, id]);

  const apply = async () => {
    setApplyError('');
    setBusy(true);
    try {
      await api.post('/applications', { vacancy_id: Number(id), resume_id: Number(resumeId), message });
      setApplied(true);
      setNotice('Відгук надіслано! Роботодавець побачить ваше резюме та відсоток збігу.');
    } catch (e) {
      setApplyError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!vacancy) return <Spinner />;

  return (
    <div className="detail-layout">
      <article className="card detail-main">
        <Link to="/vacancies" className="back-link">
          ← До списку вакансій
        </Link>
        <h1>{vacancy.title}</h1>
        <p className="meta">
          <b>{vacancy.company_name}</b>
          {vacancy.industry && <> · {vacancy.industry}</>} · {vacancy.location} · {vacancy.employment}
        </p>
        {!vacancy.is_active && <div className="alert alert-info">Вакансію знято з публікації — її бачите лише ви.</div>}
        <div className="facts">
          <div>
            <span className="muted">Мінімальний досвід</span>
            <b>{vacancy.min_experience > 0 ? formatYears(vacancy.min_experience) : 'не потрібен'}</b>
          </div>
          <div>
            <span className="muted">Опубліковано</span>
            <b>{formatDate(vacancy.created_at)}</b>
          </div>
        </div>

        <h2>Про вакансію</h2>
        <p className="prewrap">{vacancy.description}</p>
        {vacancy.requirements && (
          <>
            <h2>Вимоги</h2>
            <p className="prewrap">{vacancy.requirements}</p>
          </>
        )}
        <h2>Ключові навички</h2>
        <SkillTags skills={vacancy.skills} matched={match?.matchedSkills || []} missing={match?.missingSkills || []} max={30} />
      </article>

      <aside className="detail-side">
        {!user && (
          <div className="card">
            <h3>Відгукнутися</h3>
            <p className="muted">Увійдіть як кандидат, щоб побачити відсоток збігу вашого резюме з цією вакансією.</p>
            <Link className="btn btn-primary btn-block" to="/login" state={{ from: `/vacancies/${id}` }}>
              Увійти
            </Link>
            <Link className="btn btn-ghost btn-block" to="/register?role=candidate">
              Створити акаунт
            </Link>
          </div>
        )}

        {user?.role === 'employer' && (
          <div className="card">
            <h3>Для роботодавця</h3>
            <p className="muted">Відсоток збігу показується кандидатам. Перегляньте рейтинг кандидатів у своєму кабінеті.</p>
            <Link className="btn btn-outline btn-block" to="/employer">
              До моїх вакансій
            </Link>
          </div>
        )}

        {user?.role === 'candidate' && (
          <div className="card">
            <h3>Ваш збіг</h3>
            {resumes.length === 0 ? (
              <>
                <p className="muted">Завантажте резюме, щоб побачити збіг із цією вакансією.</p>
                <Link className="btn btn-primary btn-block" to="/cabinet">
                  Завантажити резюме
                </Link>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Резюме</span>
                  <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                {match && (
                  <>
                    <div className="match-head">
                      <ScoreRing score={match.score} size={80} />
                      <div>
                        <b>{levelText[levelOf(match.score)]}</b>
                        <p className="muted small">
                          Закрито навичок: {match.matchedSkills.length} з {vacancy.skills.length}
                        </p>
                      </div>
                    </div>
                    <Breakdown breakdown={match.breakdown} />
                    {match.missingSkills.length > 0 && (
                      <p className="muted small">
                        Щоб підвищити збіг, додайте до резюме досвід з: <b>{match.missingSkills.join(', ')}</b>.
                      </p>
                    )}
                  </>
                )}

                <hr />
                <SuccessBox>{notice}</SuccessBox>
                <ErrorBox>{applyError}</ErrorBox>
                {applied ? (
                  <>
                    <span className="badge st-invited">Ви вже відгукнулись</span>
                    <Link className="btn btn-ghost btn-block" to="/cabinet/applications">
                      Мої відгуки
                    </Link>
                  </>
                ) : (
                  vacancy.is_active && (
                    <>
                      <label className="field">
                        <span>Супровідний лист (необовʼязково)</span>
                        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
                      </label>
                      <button className="btn btn-primary btn-block" onClick={apply} disabled={busy || !resumeId}>
                        {busy ? 'Надсилаємо…' : 'Відгукнутися'}
                      </button>
                    </>
                  )
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
