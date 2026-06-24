import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import EveryonePage from './pages/EveryonePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';

// Wrap an authenticated page in the shared shell (top navigation).
function Shell({ children, adminOnly }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Shell><CalendarPage /></Shell>} />
      <Route path="/everyone" element={<Shell><EveryonePage /></Shell>} />
      <Route path="/profile" element={<Shell><ProfilePage /></Shell>} />
      <Route path="/admin" element={<Shell adminOnly><AdminPage /></Shell>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
