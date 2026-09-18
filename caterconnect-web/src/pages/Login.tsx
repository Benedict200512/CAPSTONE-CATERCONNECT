import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, ShieldCheck,
  MessageCircle, BarChart3, ArrowRight, AlertTriangle, KeyRound, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signIn } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
const caterLogo = '/images/caterlogo.png';

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

  const features = [
    { Icon: ShieldCheck, title: 'Verify Caterers', desc: 'Review applications and documents' },
    { Icon: Calendar, title: 'Manage Bookings', desc: 'Track and update booking status' },
    { Icon: MessageCircle, title: 'Handle Complaints', desc: 'Provide quick and quality support' },
    { Icon: BarChart3, title: 'Generate Reports', desc: 'Monitor platform activity and growth' },
  ];

  return (
    <div style={styles.page}>
      {/* Left Banner Panel */}
      <div style={styles.leftPanel}>
        <div style={styles.imageOverlay} />
        <div style={styles.leftContent}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>
              <img src={caterLogo} alt="CaterConnect Logo" style={styles.logoImg} />
            </div>
            <div style={styles.brandTextContainer}>
              <div style={styles.brand}>
                <span style={{ color: '#111' }}>CATER</span>
                <span style={{ color: '#F97316' }}>CONNECT</span>
              </div>
              <span style={styles.brandSubText}>Cebu's Catering Marketplace</span>
            </div>
          </div>

          <div style={styles.badgePill}>
            <ShieldCheck size={14} color="#C2410C" />
            <span>Staff & Admin Portal</span>
          </div>

          <h1 style={styles.leftTitle}>
            Manage. Verify. Keep<br />
            <span style={{ color: '#F97316' }}>CaterConnect Running.</span>
          </h1>
          <p style={styles.leftSub}>
            Access your staff and admin dashboard to verify caterers, manage bookings, handle complaints, and ensure a smooth catering experience for everyone.
          </p>

          <div style={styles.featureList}>
            {features.map((f, idx) => (
              <div key={idx} style={styles.featureItem}>
                <div style={styles.featureIconWrap}>
                  <f.Icon size={18} color="#EA580C" />
                </div>
                <div>
                  <div style={styles.featureTitle}>{f.title}</div>
                  <div style={styles.featureDesc}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <div style={styles.formLogo}>
              <img src={caterLogo} alt="CaterConnect Logo" style={styles.logoImgSm} />
            </div>
            <h2 style={styles.formTitle}>Staff & Admin Login</h2>
            <p style={styles.formSub}>Sign in to access your dashboard and manage the platform.</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label} htmlFor="email">Email Address</label>
            <div style={styles.inputWrap}>
              <Mail size={17} color="#9CA3AF" style={{ flexShrink: 0 }} />
              <input
                id="email"
                style={styles.input}
                type="email"
                placeholder="admin@caterconnect.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={styles.passwordHeaderRow}>
              <label style={styles.label} htmlFor="password">Password</label>
              <a href="#forgot" onClick={(e) => e.preventDefault()} style={styles.forgotLink}>Forgot password?</a>
            </div>
            <div style={styles.inputWrap}>
              <Lock size={17} color="#9CA3AF" style={{ flexShrink: 0 }} />
              <input
                id="password"
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </button>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <AlertTriangle size={16} color="#991B1B" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              <span>{loading ? 'Signing in...' : 'Log In'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={styles.roleInfo}>
            <KeyRound size={16} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={styles.roleTitle}>Authorized personnel only</div>
              <div style={styles.roleInfoText}>CaterConnect Staff & Admin Portal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#FAF8F5' },

  leftPanel: {
    flex: 1,
    position: 'relative',
    background: 'linear-gradient(135deg, #FFF5EC 0%, #FFE4CC 100%), url("/images/background-cater.png")',
    backgroundBlendMode: 'overlay',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '56px 64px',
    overflow: 'hidden',
  },
  imageOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 245, 236, 0.95) 70%)',
    pointerEvents: 'none',
  },
  leftContent: { maxWidth: 500, position: 'relative', zIndex: 1 },

  brandRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  brandMark: {
    width: 48, height: 48, borderRadius: 14,
    background: 'white',
    boxShadow: '0 4px 12px rgba(249,115,22,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 6,
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  brandTextContainer: { display: 'flex', flexDirection: 'column' },
  brand: { fontSize: 20, fontWeight: 900, letterSpacing: 1.5, lineHeight: 1.1 },
  brandSubText: { fontSize: 11.5, color: '#78716C', fontWeight: 600, letterSpacing: 0.2, marginTop: 2 },

  badgePill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#FFEDD5', border: '1px solid #FED7AA',
    padding: '6px 14px', borderRadius: 20,
    fontSize: 12.5, fontWeight: 700, color: '#C2410C',
    marginBottom: 20,
  },

  leftTitle: {
    fontSize: 42, fontWeight: 900, color: '#111827',
    lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em',
  },
  leftSub: {
    fontSize: 15, color: '#4B5563',
    lineHeight: 1.65, marginBottom: 36, maxWidth: 460,
  },

  featureList: { display: 'flex', flexDirection: 'column', gap: 16 },
  featureItem: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  featureIconWrap: {
    width: 38, height: 38,
    background: 'white',
    border: '1px solid #FED7AA',
    borderRadius: 12,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  featureTitle: { fontSize: 14.5, fontWeight: 700, color: '#1F2937', marginBottom: 2 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 1.4 },

  rightPanel: {
    width: 520,
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
    padding: '44px 38px',
    border: '1px solid #E8E4DE',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
  },
  formHeader: { marginBottom: 28 },
  formLogo: {
    width: 52, height: 52, borderRadius: 14,
    background: '#FFF7ED', border: '1px solid #FED7AA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, padding: 8,
  },
  logoImgSm: { width: '100%', height: '100%', objectFit: 'contain' },
  formTitle: { fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 6, letterSpacing: '-0.01em' },
  formSub: { fontSize: 14, color: '#6B7280', lineHeight: 1.4 },

  form: { display: 'flex', flexDirection: 'column', gap: 0 },
  label: {
    fontSize: 13, fontWeight: 700, color: '#374151',
    marginBottom: 8, display: 'block',
  },
  passwordHeaderRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4,
  },
  forgotLink: {
    fontSize: 12.5, fontWeight: 600, color: '#F97316',
    textDecoration: 'none', marginBottom: 8,
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#F9FAFB', borderRadius: 12,
    border: '1px solid #E5E7EB', padding: '0 16px',
    marginBottom: 18,
    transition: 'all 0.2s',
  },
  input: {
    flex: 1, border: 'none', background: 'transparent',
    padding: '14px 0', fontSize: 14.5, color: '#1A1A1A', outline: 'none',
  },
  eyeBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  errorBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: '#FEF2F2', borderRadius: 12,
    border: '1px solid #FECACA',
    padding: '12px 16px', marginBottom: 18,
    fontSize: 13, color: '#991B1B', lineHeight: 1.4,
  },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', color: 'white',
    border: 'none', borderRadius: 14,
    padding: '15px 24px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 4, marginBottom: 20,
    width: '100%', boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
    transition: 'transform 0.1s, opacity 0.15s',
  },
  roleInfo: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#FFF7ED', borderRadius: 14,
    padding: '14px 16px', border: '1px solid #FED7AA',
  },
  roleTitle: { fontSize: 12, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: 0.5 },
  roleInfoText: {
    fontSize: 12.5, color: '#7C2D12',
    fontWeight: 600, marginTop: 1,
  },
};