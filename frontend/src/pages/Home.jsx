import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth, homeFor } from '../auth';
import { ScoreRing } from '../components/ui';

const STEPS = [
  {
    n: '1',
    title: 'Завантажте резюме',
    text: 'Додайте файл у форматі PDF або DOCX. Платформа сама розпізнає навички, досвід і посаду.',
  },
  {
    n: '2',
    title: 'Алгоритм порівнює',
    text: 'Резюме зіставляється з кожною відкритою вакансією за навичками, змістом тексту, посадою та стажем.',
  },
  {
    n: '3',
    title: 'Отримайте рейтинг',
    text: 'Бачите відсоток збігу, які навички вже закривають вимоги і чого бракує — і відгукуєтесь в один клік.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const [count, setCount] = useState(null);

  useEffect(() => {
    api
      .get('/vacancies')
      .then((d) => setCount(d.vacancies.length))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Інтелектуальне зіставлення</span>
          <h1>Знаходьте роботу та кандидатів, які справді підходять одне одному</h1>
          <p className="lead">
            JobMatch аналізує зміст резюме та вакансій, а не лише ключові слова, і показує, наскільки кандидат
            відповідає вимогам — з поясненням, чому саме так.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link className="btn btn-primary btn-lg" to={homeFor(user)}>
                Перейти до кабінету
              </Link>
            ) : (
              <>
                <Link className="btn btn-primary btn-lg" to="/register?role=candidate">
                  Я шукаю роботу
                </Link>
                <Link className="btn btn-outline btn-lg" to="/register?role=employer">
                  Я роботодавець
                </Link>
              </>
            )}
          </div>
          {count !== null && (
            <p className="muted hero-note">
              Зараз на платформі <b>{count}</b> відкритих вакансій —{' '}
              <Link to="/vacancies">переглянути</Link>
            </p>
          )}
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="demo-match">
            <ScoreRing score={92} size={76} />
            <div>
              <b>Junior Frontend розробник</b>
              <span className="muted">TechNova · Віддалено</span>
            </div>
          </div>
          <div className="tags">
            <span className="tag tag-good">✓ React</span>
            <span className="tag tag-good">✓ JavaScript</span>
            <span className="tag tag-good">✓ Git</span>
            <span className="tag tag-good">✓ REST API</span>
            <span className="tag tag-bad">Redux</span>
          </div>
          <div className="breakdown">
            {[
              ['Навички', 83],
              ['Схожість тексту', 74],
              ['Посада', 100],
              ['Досвід', 100],
            ].map(([l, v]) => (
              <div className="bar-row" key={l}>
                <span>{l}</span>
                <div className="bar">
                  <div className={`bar-fill ${v >= 75 ? 'high' : 'medium'}`} style={{ width: `${v}%` }} />
                </div>
                <b>{v}%</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Як це працює</h2>
        <div className="grid-3">
          {STEPS.map((s) => (
            <div className="card step" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p className="muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid-2 audience">
        <div className="card">
          <h3>Кандидатам</h3>
          <ul className="check-list">
            <li>Рейтинг вакансій саме під ваше резюме</li>
            <li>Підказки, яких навичок не вистачає</li>
            <li>Кілька резюме для різних напрямків</li>
            <li>Можна приховати резюме від пошуку</li>
          </ul>
        </div>
        <div className="card">
          <h3>Роботодавцям</h3>
          <ul className="check-list">
            <li>Автоматичний рейтинг кандидатів на кожну вакансію</li>
            <li>Прозоре пояснення відсотка збігу</li>
            <li>Керування відгуками: запросити або відхилити</li>
            <li>Менше часу на ручний перегляд сотень резюме</li>
          </ul>
        </div>
      </section>
    </>
  );
}
