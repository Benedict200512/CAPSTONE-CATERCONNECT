import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { signIn } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'admin') navigate('/admin', { replace: true });
      else if (profile.role === 'staff') navigate('/staff', { replace: true });
    }
  }, [profile, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await signIn(email, password);

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Read role from profiles table — not from user_metadata
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data?.user?.id)
      .single();

    setLoading(false);

    if (profileError || !profileData) {
      setError('Could not load your profile. Please try again.');
      return;
    }

    const role = profileData.role;
    if (role === 'admin') navigate('/admin');
    else if (role === 'staff') navigate('/staff');
    else setError('Access denied. This portal is for staff and admin only.');
  };

  return (
    <div style={styles.page}>
      {/* Left panel */}
      <div style={styles.leftPanel}>
        <div style={styles.leftContent}>
          <div style={styles.brand}>
            <span style={{ color: 'white' }}>CATER</span>
            <span style={{ color: '#F97316' }}>CONNECT</span>
          </div>
          <h1 style={styles.leftTitle}>Operations Portal</h1>
          <p style={styles.leftSub}>
            Manage caterer verifications, handle consultations, monitor bookings, and oversee platform health.
          </p>
          <div style={styles.featureList}>
            {[
              { icon: '✅', text: 'Verify caterer applications & documents' },
              { icon: '💬', text: 'Handle customer & caterer consultations' },
              { icon: '⚠️', text: 'Resolve complaints & disputes' },
              { icon: '📊', text: 'Monitor bookings & platform revenue' },
            ].map((f) => (
              <div key={f.text} style={styles.featureItem}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <div style={styles.formLogo}>🔐</div>
            <h2 style={styles.formTitle}>Staff Login</h2>
            <p style={styles.formSub}>Sign in to access the operations portal</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>✉️</span>
              <input
                style={styles.input}
                type="email"
                placeholder="staff@caterconnect.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <label style={styles.label}>PASSWORD</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              style={styles.submitBtn}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={styles.roleInfo}>
            <p style={styles.roleInfoText}>
              🔒 This portal is restricted to{' '}
              <strong>Platform Staff</strong> and{' '}
              <strong>System Administrators</strong> only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh' },
  leftPanel: {
    flex: 1,
    background: '#111111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  leftContent: { maxWidth: 420 },
  brand: { fontSize: 28, fontWeight: 900, letterSpacing: 3, marginBottom: 24 },
  leftTitle: {
    fontSize: 36, fontWeight: 900, color: 'white',
    lineHeight: 1.2, marginBottom: 16,
  },
  leftSub: {
    fontSize: 15, color: '#9CA3AF',
    lineHeight: 1.7, marginBottom: 36,
  },
  featureList: { display: 'flex', flexDirection: 'column', gap: 14 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 14 },
  featureIcon: {
    fontSize: 22, width: 40, height: 40,
    background: 'rgba(249,115,22,0.15)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { fontSize: 14, color: '#D1D5DB' },
  rightPanel: {
    width: 480,
    background: '#FAF8F5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },
  formCard: {
    width: '100%',
    background: 'white',
    borderRadius: 24,
    padding: '36px 32px',
    border: '1px solid #E8E4DE',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
  },
  formHeader: { textAlign: 'center', marginBottom: 28 },
  formLogo: { fontSize: 40, marginBottom: 12 },
  formTitle: { fontSize: 24, fontWeight: 900, color: '#111', marginBottom: 6 },
  formSub: { fontSize: 13, color: '#6B7280' },
  form: { display: 'flex', flexDirection: 'column', gap: 0 },
  label: {
    fontSize: 10, fontWeight: 800, color: '#6B7280',
    letterSpacing: 1.5, marginBottom: 8, display: 'block',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#F5F3F0', borderRadius: 12,
    border: '1px solid #E8E4DE', padding: '0 14px',
    marginBottom: 16,
  },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1, border: 'none', background: 'transparent',
    padding: '14px 0', fontSize: 15, color: '#1A1A1A', outline: 'none',
  },
  eyeBtn: {
    background: 'none', border: 'none',
    fontSize: 18, cursor: 'pointer', padding: '4px',
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#FEE2E2', borderRadius: 10,
    padding: '10px 14px', marginBottom: 16,
    fontSize: 13, color: '#991B1B',
  },
  submitBtn: {
    background: '#111111', color: 'white',
    border: 'none', borderRadius: 50,
    padding: '15px 24px', fontSize: 15, fontWeight: 900,
    cursor: 'pointer', marginTop: 4, marginBottom: 20,
    letterSpacing: 0.5, transition: 'opacity 0.15s',
    width: '100%',
  },
  roleInfo: {
    background: '#FFF7ED', borderRadius: 12,
    padding: '12px 16px', border: '1px solid #FFB26B',
  },
  roleInfoText: {
    fontSize: 12, color: '#92400E',
    textAlign: 'center', lineHeight: 1.6, margin: 0,
  },
};