import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../../api';
import { Empty, ErrorBox, PageHeader, SkillTags, Spinner, SuccessBox, formatDate, formatYears } from '../../components/ui';

const MAX_MB = 5;

function UploadCard({ onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [years, setYears] = useState('');
  const [visible, setVisible] = useState(true);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (f) => {
    setError('');
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) return setError('Підтримуються лише файли PDF та DOCX');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Файл завеликий (максимум ${MAX_MB} МБ)`);
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Оберіть файл резюме');
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (title.trim()) form.append('title', title.trim());
      if (years !== '') form.append('years_experience', years);
      form.append('is_visible', visible ? 'true' : 'false');
      const { resume } = await api.upload('/resumes', form);
      setFile(null);
      setTitle('');
      setYears('');
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(resume);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card upload-card" onSubmit={submit}>
      <h2>Завантажити резюме</h2>
      <ErrorBox>{error}</ErrorBox>
      <div
        className={`dropzone ${drag ? 'drag' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx" hidden onChange={(e) => pick(e.target.files[0])} />
        {file ? (
          <>
            <b>{file.name}</b>
            <span className="muted">{(file.size / 1024).toFixed(0)} КБ · натисніть, щоб обрати інший файл</span>
          </>
        ) : (
          <>
            <b>Перетягніть файл сюди або натисніть для вибору</b>
            <span className="muted">PDF або DOCX, до {MAX_MB} МБ. Текст має бути виділюваним (не скан).</span>
          </>
        )}
      </div>

      <div className="form-row">
        <label className="field grow">
          <span>Назва резюме (необовʼязково)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Визначимо з тексту автоматично" maxLength={200} />
        </label>
        <label className="field narrow">
          <span>Досвід, років</span>
          <input type="number" min="0" max="60" step="0.5" value={years} onChange={(e) => setYears(e.target.value)} placeholder="авто" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        <span>Дозволити роботодавцям знаходити це резюме в рейтингу кандидатів</span>
      </label>
      <button className="btn btn-primary" disabled={busy || !file}>
        {busy ? 'Аналізуємо резюме…' : 'Завантажити та проаналізувати'}
      </button>
    </form>
  );
}

function ResumeCard({ resume, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const [years, setYears] = useState(String(resume.years_experience));
  const [skills, setSkills] = useState(resume.skills.join(', '));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { resume: updated } = await api.patch(`/resumes/${resume.id}`, {
        title,
        years_experience: years === '' ? 0 : years,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onChanged(updated);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async () => {
    try {
      const { resume: updated } = await api.patch(`/resumes/${resume.id}`, { is_visible: !resume.is_visible });
      onChanged(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Видалити резюме «${resume.title}»? Відгуки, подані з нього, також буде видалено.`)) return;
    try {
      await api.del(`/resumes/${resume.id}`);
      onDeleted(resume.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const download = async () => {
    try {
      await downloadFile(`/resumes/${resume.id}/file`, resume.file_name);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <article className="card resume-card">
      <div className="resume-card-head">
        <div>
          <h3>{resume.title}</h3>
          <p className="meta">
            {resume.file_name} · Досвід: {formatYears(resume.years_experience)} · {formatDate(resume.created_at)}
          </p>
        </div>
        <span className={`badge ${resume.is_visible ? 'st-invited' : 'st-viewed'}`}>
          {resume.is_visible ? 'Видиме роботодавцям' : 'Приховане'}
        </span>
      </div>
      <ErrorBox>{error}</ErrorBox>

      {editing ? (
        <div className="edit-box">
          <label className="field">
            <span>Назва</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <label className="field">
            <span>Досвід, років</span>
            <input type="number" min="0" max="60" step="0.5" value={years} onChange={(e) => setYears(e.target.value)} />
          </label>
          <label className="field">
            <span>Навички (через кому) — вплив на підбір</span>
            <textarea rows={3} value={skills} onChange={(e) => setSkills(e.target.value)} />
          </label>
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              Зберегти
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted">Розпізнані навички ({resume.skills.length}):</p>
          {resume.skills.length ? <SkillTags skills={resume.skills} max={20} /> : <p className="muted small">Навичок не знайдено — додайте їх вручну.</p>}
        </>
      )}

      <div className="row-actions">
        <Link className="btn btn-primary btn-sm" to={`/cabinet/resumes/${resume.id}`}>
          Підібрати вакансії
        </Link>
        <Link className="btn btn-outline btn-sm" to={`/resumes/${resume.id}`}>
          Переглянути текст
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
          Редагувати
        </button>
        <button className="btn btn-ghost btn-sm" onClick={toggleVisible}>
          {resume.is_visible ? 'Приховати' : 'Показати'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={download}>
          Файл
        </button>
        <button className="btn btn-danger btn-sm" onClick={remove}>
          Видалити
        </button>
      </div>
    </article>
  );
}

export default function CandidateResumes() {
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api
      .get('/resumes')
      .then((d) => setResumes(d.resumes))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Мої резюме" subtitle="Завантажте резюме — алгоритм підбере найбільш схожі вакансії та покаже відсоток збігу" />
      <ErrorBox>{error}</ErrorBox>
      <SuccessBox>{notice}</SuccessBox>

      <div className="two-col">
        <UploadCard
          onUploaded={(r) => {
            setNotice(`Резюме «${r.title}» завантажено. Розпізнано навичок: ${r.skills.length}, досвід: ${formatYears(r.years_experience)}.`);
            setResumes((list) => [r, ...(list || [])]);
          }}
        />
        <div className="stack">
          {!resumes && !error && <Spinner />}
          {resumes && resumes.length === 0 && (
            <Empty title="Резюме ще немає">Завантажте перше резюме — і ми одразу покажемо найкращі вакансії.</Empty>
          )}
          {resumes?.map((r) => (
            <ResumeCard
              key={r.id}
              resume={r}
              onChanged={(u) => setResumes((list) => list.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => setResumes((list) => list.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      </div>
    </>
  );
}
