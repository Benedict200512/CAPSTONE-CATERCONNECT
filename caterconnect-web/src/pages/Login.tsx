
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Search,
  Utensils,
  CalendarCheck,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  ChefHat,
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
      if ((profile as any).status === 'suspended') {
        supabase.auth.signOut();
        return;
      }

      if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (profile.role === 'staff') {
        navigate('/staff', { replace: true });
      } else if (profile.role === 'caterer') {
        navigate('/caterer', { replace: true });
      }
    }
  }, [profile, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data?.user?.id)
      .single();

    if (profileError || !profileData) {
      setLoading(false);
      setError('Could not load your profile. Please try again.');
      return;
    }

    if (profileData.status === 'suspended') {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Your account has been suspended. Please contact support.');
      return;
    }

    setLoading(false);

    const role = profileData.role;

    if (role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (role === 'staff') {
      navigate('/staff', { replace: true });
    } else if (role === 'caterer') {
      navigate('/caterer', { replace: true });
    } else {
      await supabase.auth.signOut();
      setError('Access denied. Invalid portal credentials.');
    }
  };

  const benefits = [
    {
      Icon: Search,
      title: 'Discover Catering Services',
      description:
        'Explore catering providers, menus, and packages for your next event.',
    },
    {
      Icon: CalendarCheck,
      title: 'Simplify Event Planning',
      description:
        'Find packages that fit your event needs, guest count, and budget.',
    },
    {
      Icon: Utensils,
      title: 'Connect With Caterers',
      description:
        'Bring customers and catering professionals together in one place.',
    },
  ];

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="login-intro-overlay" />

        <div className="login-intro-content">
          <div className="login-brand">
            <div className="login-brand-logo">
              <img src={caterLogo} alt="CaterConnect" />
            </div>

            <div>
              <div className="login-brand-name">
                <span>CATER</span>
                <span>CONNECT</span>
              </div>
              <p>Your Event. Your Food. Connected.</p>
            </div>
          </div>

          <div className="login-hero">
            <div className="login-eyebrow">
              <Sparkles size={15} />
              <span>YOUR CATERING MARKETPLACE</span>
            </div>

            <h1>
              Find the right
              <br />
              caterer for every
              <br />
              <span>special occasion.</span>
            </h1>

            <p className="login-hero-description">
              CaterConnect brings customers and catering professionals
              together. Discover catering services, explore food packages,
              and make planning your next event easier.
            </p>

            <div className="login-benefits">
              {benefits.map(({ Icon, title, description }) => (
                <div className="login-benefit" key={title}>
                  <div className="login-benefit-icon">
                    <Icon size={20} />
                  </div>

                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="login-intro-footer">
            <ChefHat size={17} />
            <span>Making every celebration more memorable.</span>
          </div>
        </div>
      </section>

      <section className="login-form-section">
        <div className="login-form-card">
          <div className="login-mobile-brand">
            <img src={caterLogo} alt="CaterConnect" />
            <span>
              CATER<span>CONNECT</span>
            </span>
          </div>

          <div className="login-form-heading">
            <div className="login-form-icon">
              <Lock size={23} />
            </div>

            <h2>Welcome Back!</h2>
            <p>
              Sign in to your CaterConnect account and continue where you left
              off.
            </p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email Address</label>

              <div className="login-input-wrap">
                <Mail size={18} />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-password-heading">
                <label htmlFor="password">Password</label>
                <button
                  type="button"
                  className="login-forgot-link"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>

              <div className="login-input-wrap">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="login-eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span>Signing in...</span>
                  <span className="login-spinner" />
                </>
              ) : (
                <>
                  <span>Sign In to CaterConnect</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-security-note">
            <Lock size={15} />
            <span>Your account information is protected and secure.</span>
          </div>

          <div className="login-form-footer">
            <p>
              Connecting people through great food and memorable events.
            </p>
            <span>© {new Date().getFullYear()} CaterConnect</span>
          </div>
        </div>
      </section>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', system-ui, sans-serif;
          background: #FAF8F5;
          color: #171717;
        }

        .login-intro {
          flex: 1;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          padding: 48px clamp(32px, 6vw, 90px);
          background:
            linear-gradient(135deg, rgba(255,247,237,.96), rgba(255,228,204,.91)),
            url('/images/background-cater.png') center/cover;
        }

        .login-intro-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 85% 15%, rgba(249,115,22,.13), transparent 35%),
            radial-gradient(circle at 10% 90%, rgba(255,255,255,.8), transparent 40%);
        }

        .login-intro-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 610px;
          margin: auto;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 75px;
        }

        .login-brand-logo {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7px;
          background: white;
          border-radius: 15px;
          box-shadow: 0 5px 18px rgba(249,115,22,.12);
        }

        .login-brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .login-brand-name {
          display: flex;
          gap: 4px;
          font-size: 21px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .login-brand-name span:last-child {
          color: #F97316;
        }

        .login-brand p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #78716C;
          font-weight: 600;
        }

        .login-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          background: rgba(249,115,22,.09);
          border: 1px solid rgba(249,115,22,.18);
          color: #C2410C;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 22px;
        }

        .login-hero h1 {
          font-size: clamp(38px, 4.3vw, 59px);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -2px;
          color: #171717;
          margin: 0 0 20px;
        }

        .login-hero h1 span {
          color: #F97316;
        }

        .login-hero-description {
          max-width: 500px;
          font-size: 15px;
          line-height: 1.8;
          color: #57534E;
          margin: 0 0 38px;
        }

        .login-benefits {
          display: flex;
          flex-direction: column;
          gap: 23px;
        }

        .login-benefit {
          display: flex;
          align-items: flex-start;
          gap: 15px;
        }

        .login-benefit-icon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #EA580C;
          background: white;
          border: 1px solid #FED7AA;
          border-radius: 13px;
          box-shadow: 0 3px 9px rgba(0,0,0,.035);
        }

        .login-benefit h3 {
          margin: 1px 0 4px;
          color: #292524;
          font-size: 14px;
          font-weight: 800;
        }

        .login-benefit p {
          margin: 0;
          color: #78716C;
          font-size: 12.5px;
          line-height: 1.6;
          max-width: 400px;
        }

        .login-intro-footer {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #A16207;
          font-size: 12px;
          font-weight: 600;
          margin-top: 55px;
        }

        .login-form-section {
          width: 490px;
          flex-shrink: 0;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 45px;
          background: #FAF8F5;
        }

        .login-form-card {
          width: 100%;
          max-width: 390px;
        }

        .login-mobile-brand {
          display: none;
        }

        .login-form-heading {
          margin-bottom: 35px;
        }

        .login-form-icon {
          width: 53px;
          height: 53px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FFF1E6;
          color: #EA580C;
          border: 1px solid #FED7AA;
          border-radius: 15px;
          margin-bottom: 22px;
        }

        .login-form-heading h2 {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -1px;
          margin: 0 0 9px;
          color: #171717;
        }

        .login-form-heading p {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.7;
          color: #78716C;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 21px;
        }

        .login-field label {
          display: block;
          margin-bottom: 9px;
          color: #292524;
          font-size: 13px;
          font-weight: 750;
        }

        .login-password-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .login-password-heading label {
          margin-bottom: 9px;
        }

        .login-forgot-link {
          margin: 0 0 9px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #C2410C;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-forgot-link:hover {
          color: #EA580C;
          text-decoration: underline;
        }

        .login-input-wrap {
          min-height: 51px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 15px;
          border: 1px solid #E7E5E4;
          border-radius: 12px;
          background: white;
          color: #A8A29E;
          transition: border-color .2s, box-shadow .2s;
        }

        .login-input-wrap:focus-within {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,.10);
        }

        .login-input-wrap input {
          min-width: 0;
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #171717;
          font-family: inherit;
          font-size: 13.5px;
          padding: 15px 0;
        }

        .login-input-wrap input::placeholder {
          color: #A8A29E;
        }

        .login-eye-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px;
          border: none;
          background: transparent;
          color: #78716C;
          cursor: pointer;
        }

        .login-eye-button:hover {
          color: #EA580C;
        }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 12px 14px;
          border: 1px solid #FECACA;
          border-radius: 11px;
          background: #FEF2F2;
          color: #991B1B;
          font-size: 12.5px;
          line-height: 1.5;
        }

        .login-error svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .login-submit {
          width: 100%;
          min-height: 53px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 3px;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #F97316, #EA580C);
          color: white;
          font-family: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(249,115,22,.22);
          transition: transform .2s, box-shadow .2s, opacity .2s;
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(249,115,22,.28);
        }

        .login-submit:disabled {
          opacity: .7;
          cursor: not-allowed;
        }

        .login-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,.4);
          border-top-color: white;
          border-radius: 50%;
          animation: loginSpin .7s linear infinite;
        }

        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }

        .login-security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 25px;
          color: #78716C;
          font-size: 11.5px;
        }

        .login-security-note svg {
          color: #16A34A;
        }

        .login-form-footer {
          border-top: 1px solid #E7E5E4;
          margin-top: 40px;
          padding-top: 20px;
          text-align: center;
        }

        .login-form-footer p {
          color: #78716C;
          font-size: 11.5px;
          margin: 0 0 9px;
        }

        .login-form-footer span {
          color: #A8A29E;
          font-size: 11px;
        }

        @media (max-width: 1000px) {
          .login-form-section {
            width: 420px;
            padding: 35px;
          }

          .login-intro {
            padding: 40px;
          }

          .login-brand {
            margin-bottom: 55px;
          }

          .login-hero h1 {
            font-size: 43px;
          }
        }

        @media (max-width: 760px) {
          .login-page {
            flex-direction: column;
          }

          .login-intro {
            min-height: auto;
            padding: 35px 25px;
          }

          .login-brand {
            margin-bottom: 42px;
          }

          .login-hero h1 {
            font-size: 39px;
          }

          .login-hero-description {
            margin-bottom: 28px;
          }

          .login-benefits {
            gap: 17px;
          }

          .login-intro-footer {
            margin-top: 32px;
          }

          .login-form-section {
            width: 100%;
            min-height: auto;
            padding: 45px 25px;
          }

          .login-form-card {
            max-width: 450px;
          }

          .login-form-heading h2 {
            font-size: 27px;
          }
        }

        @media (max-width: 420px) {
          .login-intro {
            padding: 28px 20px;
          }

          .login-hero h1 {
            font-size: 34px;
          }

          .login-hero-description {
            font-size: 13.5px;
          }

          .login-form-section {
            padding: 38px 20px;
          }

          .login-form-heading h2 {
            font-size: 25px;
          }
        }
      `}</style>
    </div>
  );
}
