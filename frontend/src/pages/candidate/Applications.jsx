import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Empty, ErrorBox, PageHeader, ScoreRing, Spinner, StatusBadge, formatDate } from '../../components/ui';

export default function CandidateApplications() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/applications/mine')
      .then((d) => setList(d.applications))
      .catch((e) => setError(e.message));
  }, []);

  const withdraw = async (id) => {
    if (!window.confirm('Відкликати відгук?')) return;
    try {
      await api.del(`/applications/${id}`);
      setList((l) => l.filter((a) => a.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageHeader title="Мої відгуки" subtitle="Статус кожного відгуку оновлює роботодавець" />
      <ErrorBox>{error}</ErrorBox>
      {!list && !error && <Spinner />}
      {list && list.length === 0 && (
        <Empty
          title="Ви ще не відгукувались на вакансії"
          action={
            <Link className="btn btn-primary" to="/vacancies">
              Переглянути вакансії
            </Link>
          }
        />
      )}
      <div className="stack">
        {list?.map((a) => (
          <article className="card match-card" key={a.id}>
            <ScoreRing score={a.score} size={64} />
            <div className="match-body">
              <h3>
                <Link to={`/vacancies/${a.vacancy_id}`}>{a.vacancy_title}</Link>
              </h3>
              <p className="meta">
                <b>{a.company_name}</b> · резюме «{a.resume_title}» · {formatDate(a.created_at)}
                {!a.is_active && ' · вакансію закрито'}
              </p>
              {a.message && <p className="muted quote">{a.message}</p>}
            </div>
            <div className="match-side">
              <StatusBadge status={a.status} />
              <button className="btn btn-ghost btn-sm" onClick={() => withdraw(a.id)}>
                Відкликати
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
