import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, PageHeader, SuccessBox } from '../components/ui';
import { CATEGORY, FB_STATUS, PRIORITY, formatDateTime } from '../feedbackLabels';

const SECTIONS = [
  ['', 'Не стосується конкретної сторінки'],
  ['/vacancies', 'Каталог вакансій'],
  ['/cabinet', 'Мої резюме / підбір вакансій'],
  ['/cabinet/applications', 'Мої відгуки'],
  ['/employer', 'Кабінет роботодавця'],
  ['/login', 'Вхід / реєстрація'],
];

const EMPTY = { category: 'bug', priority: 'normal', page: '', message: '', rating: 0, name: '', email: '' };

export function FeedbackItem({ f }) {
  const st = FB_STATUS[f.status] || FB_STATUS.new;
  const cat = CATEGORY[f.category] || CATEGORY.other;
  return (
    <article className="card fb-card">
      <div className="fb-head">
        <span className="fb-cat">
          {cat.icon} {cat.label}
        </span>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <p className="prewrap fb-msg">{f.message}</p>
      <p className="meta">
        {formatDateTime(f.created_at)}
        {f.page && ` · розділ ${f.page}`}
        {f.rating && ` · оцінка ${'★'.repeat(f.rating)}`}
      </p>
      {f.admin_reply && (
        <div className="fb-reply">
          <b>Відповідь команди JobMatch:</b>
          <p className="prewrap">{f.admin_reply}</p>
        </div>
      )}
    </article>
  );
}

export default function Feedback() {
  const { user } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ ...EMPTY, page: location.state?.from || '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(null);

  const loadMine = () =>
    api
      .get('/feedback/mine')
      .then((d) => setMine(d.feedback))
      .catch(() => setMine([]));

  useEffect(() => {
    if (user) loadMine();
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      await api.post('/feedback', { ...form, rating: form.rating || null });
      setForm({ ...EMPTY });
      setDone('Дякуємо! Звернення зареєстровано — ми розглянемо його найближчим часом.');
      if (user) loadMine();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Зворотний зв'язок"
        subtitle="Повідомте про помилку, запропонуйте покращення або поставте питання — кожне звернення отримує статус і відповідь"
      />
      <div className="two-col">
        <form className="card" onSubmit={onSubmit}>
          <h2 className="mt0">Нове звернення</h2>
          <ErrorBox>{error}</ErrorBox>
          <SuccessBox>{done}</SuccessBox>

          <div className="field">
            <span>Тип звернення</span>
            <div className="seg">
              {Object.entries(CATEGORY).map(([k, c]) => (
                <button
                  type="button"
                  key={k}
                  className={form.category === k ? 'active' : ''}
                  onClick={() => setForm((f) => ({ ...f, category: k }))}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="field grow">
              <span>Розділ сайту</span>
              <select value={form.page} onChange={set('page')}>
                {SECTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {form.category === 'bug' && (
              <label className="field narrow">
                <span>Наскільки заважає</span>
                <select value={form.priority} onChange={set('priority')}>
                  {Object.entries(PRIORITY).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="field">
            <span>Опис</span>
            <textarea
              rows={5}
              value={form.message}
              onChange={set('message')}
              required
              minLength={10}
              maxLength={3000}
              placeholder={
                form.category === 'bug'
                  ? 'Що ви робили, що очікували побачити і що сталося насправді?'
                  : 'Опишіть вашу ідею або питання'
              }
            />
          </label>

          <div className="field">
            <span>Оцініть сервіс (необов'язково)</span>
            <div className="stars" role="radiogroup" aria-label="Оцінка">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={form.rating === n}
                  aria-label={`${n} з 5`}
                  className={n <= form.rating ? 'on' : ''}
                  onClick={() => setForm((f) => ({ ...f, rating: f.rating === n ? 0 : n }))}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {!user && (
            <div className="form-row">
              <label className="field grow">
                <span>Ім'я</span>
                <input value={form.name} onChange={set('name')} maxLength={120} />
              </label>
              <label className="field grow">
                <span>Пошта для відповіді</span>
                <input type="email" value={form.email} onChange={set('email')} />
              </label>
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Надсилаємо…' : 'Надіслати'}
          </button>
        </form>

        <div>
          <h2 className="mt0">Мої звернення</h2>
          {!user && (
            <Empty title="Увійдіть, щоб бачити статус звернень">
              Звернення можна надіслати й без входу, але тоді статус і відповідь команди не відображатимуться на сайті.
            </Empty>
          )}
          {user && mine && mine.length === 0 && <Empty title="Звернень поки немає" />}
          <div className="stack">
            {mine?.map((f) => (
              <FeedbackItem key={f.id} f={f} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
