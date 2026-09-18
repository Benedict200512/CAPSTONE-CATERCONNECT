import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Props = {
  children: React.ReactNode;
  allowedRoles: string[];
};

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAF8F5' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={28} className="spin" style={{ color: '#F97316', marginBottom: 10 }} />
          <div style={{ color: '#6B7280', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (profile && !allowedRoles.includes(profile.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}