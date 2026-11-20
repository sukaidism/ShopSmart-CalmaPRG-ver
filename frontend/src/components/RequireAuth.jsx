import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth.js';
export default function RequireAuth({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Checking your session...</p>;
  if (error) return <p role="alert">Unable to check your session: {error} Refresh to retry.</p>;
  if (!user) return <Navigate to="/account" state={{ from: location.pathname }} replace />;
  return children;
}
