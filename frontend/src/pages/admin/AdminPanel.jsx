import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { CATEGORY, FB_STATUS, PRIORITY, formatDateTime } from '../../feedbackLabels';

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} д ${h} год` : h ? `${h} год ${m} хв` : `${m} хв`;
}

function Stat({ label, value, hint, tone }) {
  return (
    <div className={`card stat ${tone || ''}`}>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

function FeedbackRow({ f, onSaved }) {
  const [reply, setReply] = useState(f.admin_reply);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cat = CATEGORY[f.category] || CATEGORY.other;

  const save = async (patch) => {
    setBusy(true);
    setError('');
    try {
      const d = await api.patch(`/feedback/${f.id}`, patch);
      onSaved(d.feedback);
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`card fb-card pr-${f.priority}`}>
      <div className="fb-head">
        <span className="fb-cat">
          {cat.icon} {cat.label} <span className="muted">#{f.id}</span>
        </span>
        <div className="fb-controls">
          {f.category === 'bug' && (
            <select
              aria-label="Пріоритет"
              value={f.priority}
              disabled={busy}
              onChange={(e) => save({ priority: e.target.value })}
            >
              {Object.entries(PRIORITY).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Статус" value={f.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
            {Object.entries(FB_STATUS).map(([v, s]) => (
              <option key={v} value={v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="prewrap fb-msg">{f.message}</p>
      <p className="meta">
        <b>{f.name || 'Анонім'}</b>
        {f.email && ` · ${f.email}`}
        {f.user_role && ` · ${f.user_role === 'employer' ? 'роботодавець' : f.user_role === 'candidate' ? 'кандидат' : f.user_role}`}
        {' · '}
        {formatDateTime(f.created_at)}
        {f.page && ` · ${f.page}`}
        {f.rating && ` · ${'★'.repeat(f.rating)}`}
      </p>
      <ErrorBox>{error}</ErrorBox>
      {f.admin_reply && !open && (
        <div className="fb-reply">
          <b>Відповідь:</b>
          <p className="prewrap">{f.admin_reply}</p>
        </div>
      )}
      {open ? (
        <div className="edit-box">
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Відповідь користувачу" />
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save({ reply, status: 'resolved' })}>
              Відповісти й закрити
            </button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => save({ reply, status: 'in_progress' })}>
              Відповісти, взяти в роботу
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            {f.admin_reply ? 'Змінити відповідь' : 'Відповісти'}
          </button>
        </div>
      )}
    </article>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [errors, setErrors] = useState([]);
  const [filter, setFilter] = useState({ status: '', category: '' });
  const [error, setError] = useState('');

  const loadStats = useCallback(() => {
    api.get('/admin/stats').then(setStats).catch((e) => setError(e.message));
    api.get('/admin/errors').then((d) => setErrors(d.errors)).catch(() => {});
  }, []);

  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
    setList(null);
    api
      .get('/feedback' + (q ? `?${q}` : ''))
      .then((d) => setList(d.feedback))
      .catch((e) => setError(e.message));
  }, [filter]);

  const onSaved = (f) => {
    setList((l) => l.map((x) => (x.id === f.id ? { ...x, ...f } : x)));
    loadStats();
  };

  const fb = stats?.feedback;
  const open = fb ? (fb.byStatus.new || 0) + (fb.byStatus.in_progress || 0) : 0;

  return (
    <>
      <PageHeader
        title="Адмін-панель"
        subtitle="Технічне обслуговування: стан системи, звернення користувачів і журнал помилок"
        actions={
          <button className="btn btn-outline btn-sm" onClick={loadStats}>
            Оновити
          </button>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      {!stats && !error && <Spinner />}
      {stats && (
        <>
          <div className="stats-grid">
            <Stat label="Стан сервера" value="● Працює" tone="good" hint={`v${stats.system.version} · ${stats.system.node}`} />
            <Stat label="Час роботи" value={formatUptime(stats.system.uptimeSec)} hint={`пам'ять ${stats.system.memoryMb} МБ`} />
            <Stat label="Відгук бази" value={`${stats.system.dbLatencyMs} мс`} hint={stats.system.database} />
            <Stat
              label="Помилки за 24 год"
              value={stats.errors24h}
              tone={stats.errors24h ? 'bad' : 'good'}
              hint="серверні (HTTP 500)"
            />
            <Stat
              label="Користувачі"
              value={(stats.users.candidate || 0) + (stats.users.employer || 0)}
              hint={`${stats.users.candidate || 0} кандидатів · ${stats.users.employer || 0} роботодавців`}
            />
            <Stat label="Вакансії" value={stats.vacancies.active} hint={`активних з ${stats.vacancies.total}`} />
            <Stat label="Резюме / відгуки" value={`${stats.resumes} / ${stats.applications}`} />
            <Stat
              label="Відкриті звернення"
              value={open}
              tone={open ? 'warn' : 'good'}
              hint={fb.avgRating ? `середня оцінка ${fb.avgRating} ★ (${fb.ratings})` : 'оцінок ще немає'}
            />
          </div>
        </>
      )}

      <h2>Звернення користувачів</h2>
      <div className="filters">
        <label className="field">
          <span>Статус</span>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Усі</option>
            {Object.entries(FB_STATUS).map(([v, s]) => (
              <option key={v} value={v}>
                {s.label} {fb?.byStatus[v] ? `(${fb.byStatus[v]})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Тип</span>
          <select value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}>
            <option value="">Усі</option>
            {Object.entries(CATEGORY).map(([v, c]) => (
              <option key={v} value={v}>
                {c.label} {fb?.byCategory[v] ? `(${fb.byCategory[v]})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!list && <Spinner />}
      {list && list.length === 0 && <div className="empty">Звернень за цим фільтром немає</div>}
      <div className="stack">
        {list?.map((f) => (
          <FeedbackRow key={f.id} f={f} onSaved={onSaved} />
        ))}
      </div>

      <h2>Журнал серверних помилок</h2>
      {errors.length === 0 ? (
        <div className="empty">Помилок не зафіксовано 🎉</div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Час</th>
                <th>Запит</th>
                <th>Повідомлення</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.created_at)}</td>
                  <td>
                    <code>
                      {e.method} {e.path}
                    </code>
                  </td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
