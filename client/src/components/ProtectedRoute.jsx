import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Gate for authenticated pages. Redirects to /login when signed out, to the
 * forced password-change screen when required, and to / when an admin-only
 * page is opened by a normal user.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}
