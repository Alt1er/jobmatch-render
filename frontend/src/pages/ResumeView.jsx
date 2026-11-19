import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, SkillTags, Spinner, formatDate, formatYears } from '../components/ui';

/** Перегляд резюме: роботодавцем (відкриті резюме / відгуки) або власником */
export default function ResumeView() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/resumes/${id}`)
      .then((d) => setResume(d.resume))
      .catch((e) => setError(e.message));
  }, [id]);

  const download = async () => {
    try {
      await downloadFile(`/resumes/${id}/file`, resume.file_name);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!resume) return <Spinner />;

  return (
    <article className="card resume-view">
      <button className="back-link linklike" onClick={() => navigate(-1)}>
        ← Назад
      </button>
      <div className="resume-head">
        <div>
          <h1>{resume.title}</h1>
          <p className="meta">
            <b>{resume.candidate_name}</b>
            {resume.candidate_email && <> · {resume.candidate_email}</>} · Досвід: {formatYears(resume.years_experience)} · Додано{' '}
            {formatDate(resume.created_at)}
          </p>
        </div>
        <button className="btn btn-outline" onClick={download}>
          Завантажити {resume.file_name.split('.').pop().toUpperCase()}
        </button>
      </div>
      {user?.role === 'employer' && !resume.candidate_email && (
        <p className="muted small">Контакти кандидата стануть доступні після того, як він відгукнеться на вашу вакансію.</p>
      )}
      <h2>Навички</h2>
      <SkillTags skills={resume.skills} max={40} />
      <h2>Текст резюме</h2>
      <pre className="resume-text">{resume.full_text}</pre>
      {user?.role === 'candidate' && (
        <Link className="btn btn-primary" to={`/cabinet/resumes/${resume.id}`}>
          Підібрати вакансії
        </Link>
      )}
    </article>
  );
}
