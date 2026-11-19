import { Link } from 'react-router-dom';

export const levelOf = (score) => (score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low');
export const levelText = { high: 'Високий збіг', medium: 'Середній збіг', low: 'Низький збіг' };

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatYears(y) {
  const n = Number(y) || 0;
  if (n === 0) return 'без досвіду';
  const int = Math.floor(n);
  const word = int % 10 === 1 && int % 100 !== 11 ? 'рік' : [2, 3, 4].includes(int % 10) && ![12, 13, 14].includes(int % 100) ? 'роки' : 'років';
  return `${n % 1 ? n.toString().replace('.', ',') : int} ${n % 1 ? 'року' : word}`;
}

export function Spinner({ label = 'Завантаження…' }) {
  return (
    <div className="center-note" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-error" role="alert">
      {children}
    </div>
  );
}

export function SuccessBox({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-success" role="status">
      {children}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/** Кільцевий індикатор відсотка збігу */
export function ScoreRing({ score, size = 64 }) {
  const level = levelOf(score);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className={`score-ring ${level}`} style={{ width: size, height: size }} title={levelText[level]}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="ring-bg" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="ring-fg"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="ring-text" aria-label={`Збіг ${score} відсотків`}>
        {score}%
      </span>
    </div>
  );
}

const BAR_LABELS = [
  ['skills', 'Навички'],
  ['text', 'Схожість тексту'],
  ['title', 'Посада'],
  ['experience', 'Досвід'],
];

/** Розбивка оцінки за критеріями */
export function Breakdown({ breakdown }) {
  return (
    <div className="breakdown">
      {BAR_LABELS.filter(([k]) => breakdown[k] !== null && breakdown[k] !== undefined).map(([k, label]) => (
        <div className="bar-row" key={k}>
          <span>{label}</span>
          <div className="bar" role="progressbar" aria-valuenow={breakdown[k]} aria-valuemin={0} aria-valuemax={100}>
            <div className={`bar-fill ${levelOf(breakdown[k])}`} style={{ width: `${breakdown[k]}%` }} />
          </div>
          <b>{breakdown[k]}%</b>
        </div>
      ))}
    </div>
  );
}

/** Теги навичок: збіг (зелені), відсутні (червоні) або нейтральні */
export function SkillTags({ skills = [], matched = [], missing = [], max = 12 }) {
  const shown = (list) => list.slice(0, max);
  const hidden = (list) => Math.max(0, list.length - max);
  const hasMatchInfo = matched.length || missing.length;
  if (hasMatchInfo) {
    return (
      <div className="tags">
        {shown(matched).map((s) => (
          <span className="tag tag-good" key={`m-${s}`} title="Є у вашому резюме">
            ✓ {s}
          </span>
        ))}
        {hidden(matched) > 0 && <span className="tag">+{hidden(matched)}</span>}
        {shown(missing).map((s) => (
          <span className="tag tag-bad" key={`x-${s}`} title="Не знайдено в резюме">
            {s}
          </span>
        ))}
        {hidden(missing) > 0 && <span className="tag">+{hidden(missing)}</span>}
      </div>
    );
  }
  return (
    <div className="tags">
      {shown(skills).map((s) => (
        <span className="tag" key={s}>
          {s}
        </span>
      ))}
      {hidden(skills) > 0 && <span className="tag">+{hidden(skills)}</span>}
    </div>
  );
}

export const STATUS = {
  new: { label: 'Нова', cls: 'st-new' },
  viewed: { label: 'Переглянута', cls: 'st-viewed' },
  invited: { label: 'Запрошення', cls: 'st-invited' },
  rejected: { label: 'Відхилена', cls: 'st-rejected' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.new;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="JobMatch — на головну">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#2b5797" />
        <path d="M9 17l5 5 9-11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>JobMatch</span>
    </Link>
  );
}
