import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Empty, ErrorBox, PageHeader, SkillTags, Spinner, formatDate, formatYears } from '../../components/ui';

export default function EmployerVacancies() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/vacancies/mine')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const toggle = async (v) => {
    try {
      await api.patch(`/vacancies/${v.id}/active`, { is_active: !v.is_active });
      setData((d) => ({ ...d, vacancies: d.vacancies.map((x) => (x.id === v.id ? { ...x, is_active: !v.is_active } : x)) }));
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (v) => {
    if (!window.confirm(`Видалити вакансію «${v.title}» разом із відгуками?`)) return;
    try {
      await api.del(`/vacancies/${v.id}`);
      setData((d) => ({ ...d, vacancies: d.vacancies.filter((x) => x.id !== v.id) }));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageHeader
        title={data ? `Вакансії компанії ${data.company.name}` : 'Мої вакансії'}
        subtitle="Для кожної вакансії платформа автоматично будує рейтинг кандидатів"
        actions={
          <Link className="btn btn-primary" to="/employer/vacancies/new">
            + Нова вакансія
          </Link>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      {!data && !error && <Spinner />}
      {data && data.vacancies.length === 0 && (
        <Empty
          title="У вас ще немає вакансій"
          action={
            <Link className="btn btn-primary" to="/employer/vacancies/new">
              Створити першу вакансію
            </Link>
          }
        >
          Опублікуйте вакансію — і одразу побачите, які кандидати найкраще їй відповідають.
        </Empty>
      )}
      <div className="stack">
        {data?.vacancies.map((v) => (
          <article className={`card vacancy-card ${v.is_active ? '' : 'inactive'}`} key={v.id}>
            <div className="vacancy-main">
              <h3>
                <Link to={`/employer/vacancies/${v.id}`}>{v.title}</Link>{' '}
                {!v.is_active && <span className="badge st-viewed">Знято з публікації</span>}
              </h3>
              <p className="meta">
                {v.location} · {v.employment}
                {v.min_experience > 0 && <> · від {formatYears(v.min_experience)}</>} · {formatDate(v.created_at)}
              </p>
              <SkillTags skills={v.skills} max={10} />
            </div>
            <div className="vacancy-side">
              <div className="counter">
                <b>{v.applications_count}</b>
                <span className="muted small">відгуків{v.new_applications > 0 && ` (${v.new_applications} нових)`}</span>
              </div>
              <div className="row-actions">
                <Link className="btn btn-primary btn-sm" to={`/employer/vacancies/${v.id}`}>
                  Кандидати
                </Link>
                <Link className="btn btn-outline btn-sm" to={`/employer/vacancies/${v.id}/edit`}>
                  Редагувати
                </Link>
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(v)}>
                  {v.is_active ? 'Зняти з публікації' : 'Опублікувати'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(v)}>
                  Видалити
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
