import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';

const EMPLOYMENT = ['Повна зайнятість', 'Часткова зайнятість', 'Стажування', 'Контракт'];

export default function VacancyForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [allSkills, setAllSkills] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    location: 'Віддалено',
    employment: EMPLOYMENT[0],
    min_experience: '0',
    skills: '',
    is_active: true,
  });

  useEffect(() => {
    api
      .get('/skills')
      .then((d) => setAllSkills(d.skills))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/vacancies/${id}`)
      .then(({ vacancy: v }) => {
        setForm({
          title: v.title,
          description: v.description,
          requirements: v.requirements,
          location: v.location,
          employment: v.employment,
          min_experience: String(v.min_experience),
          skills: v.skills.join(', '),
          is_active: v.is_active,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      ...form,
      min_experience: form.min_experience === '' ? 0 : form.min_experience,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing) await api.put(`/vacancies/${id}`, payload);
      else await api.post('/vacancies', payload);
      navigate('/employer');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title={editing ? 'Редагування вакансії' : 'Нова вакансія'}
        actions={
          <Link className="btn btn-ghost" to="/employer">
            ← Скасувати
          </Link>
        }
      />
      <form className="card form-card" onSubmit={submit}>
        <ErrorBox>{error}</ErrorBox>
        <label className="field">
          <span>Назва посади</span>
          <input value={form.title} onChange={set('title')} required minLength={3} maxLength={200} placeholder="Наприклад: Middle React Developer" />
        </label>
        <div className="form-row">
          <label className="field grow">
            <span>Локація</span>
            <input value={form.location} onChange={set('location')} maxLength={120} />
          </label>
          <label className="field grow">
            <span>Тип зайнятості</span>
            <select value={form.employment} onChange={set('employment')}>
              {EMPLOYMENT.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="field narrow">
            <span>Мін. досвід, років</span>
            <input type="number" min="0" max="40" step="0.5" value={form.min_experience} onChange={set('min_experience')} />
          </label>
        </div>
        <label className="field">
          <span>Опис вакансії</span>
          <textarea rows={6} value={form.description} onChange={set('description')} required minLength={20} placeholder="Чим займатиметься кандидат, про команду та продукт" />
        </label>
        <label className="field">
          <span>Вимоги до кандидата</span>
          <textarea rows={5} value={form.requirements} onChange={set('requirements')} placeholder="Технології, досвід, мови — навички з цього тексту буде розпізнано автоматично" />
        </label>
        <label className="field">
          <span>Додаткові навички (через кому, необовʼязково)</span>
          <input value={form.skills} onChange={set('skills')} list="skill-options" placeholder="React, PostgreSQL, Docker" />
          <datalist id="skill-options">
            {allSkills.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <small className="muted">Навички з назви та вимог система додає сама — тут можна доповнити список.</small>
        </label>
        {editing && (
          <label className="check">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            <span>Вакансія опублікована</span>
          </label>
        )}
        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Зберігаємо…' : editing ? 'Зберегти зміни' : 'Опублікувати вакансію'}
          </button>
        </div>
      </form>
    </>
  );
}
