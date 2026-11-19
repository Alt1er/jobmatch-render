import { Link, Route, Routes } from 'react-router-dom';
import { RequireAuth, Shell } from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Vacancies from './pages/Vacancies';
import VacancyDetail from './pages/VacancyDetail';
import ResumeView from './pages/ResumeView';
import CandidateResumes from './pages/candidate/Resumes';
import CandidateMatches from './pages/candidate/Matches';
import CandidateApplications from './pages/candidate/Applications';
import EmployerVacancies from './pages/employer/MyVacancies';
import VacancyForm from './pages/employer/VacancyForm';
import VacancyCandidates from './pages/employer/VacancyCandidates';
import Feedback from './pages/Feedback';
import AdminPanel from './pages/admin/AdminPanel';

function NotFound() {
  return (
    <div className="empty">
      <h3>Сторінку не знайдено</h3>
      <p>Можливо, посилання застаріло або містить помилку.</p>
      <Link className="btn btn-primary" to="/">
        На головну
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="vacancies" element={<Vacancies />} />
        <Route path="vacancies/:id" element={<VacancyDetail />} />
        <Route
          path="resumes/:id"
          element={
            <RequireAuth>
              <ResumeView />
            </RequireAuth>
          }
        />

        <Route
          path="cabinet"
          element={
            <RequireAuth role="candidate">
              <CandidateResumes />
            </RequireAuth>
          }
        />
        <Route
          path="cabinet/resumes/:id"
          element={
            <RequireAuth role="candidate">
              <CandidateMatches />
            </RequireAuth>
          }
        />
        <Route
          path="cabinet/applications"
          element={
            <RequireAuth role="candidate">
              <CandidateApplications />
            </RequireAuth>
          }
        />

        <Route
          path="employer"
          element={
            <RequireAuth role="employer">
              <EmployerVacancies />
            </RequireAuth>
          }
        />
        <Route
          path="employer/vacancies/new"
          element={
            <RequireAuth role="employer">
              <VacancyForm />
            </RequireAuth>
          }
        />
        <Route
          path="employer/vacancies/:id/edit"
          element={
            <RequireAuth role="employer">
              <VacancyForm />
            </RequireAuth>
          }
        />
        <Route
          path="employer/vacancies/:id"
          element={
            <RequireAuth role="employer">
              <VacancyCandidates />
            </RequireAuth>
          }
        />
        <Route path="feedback" element={<Feedback />} />
        <Route
          path="admin"
          element={
            <RequireAuth role="admin">
              <AdminPanel />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
