import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, TriangleAlert } from 'lucide-react';
import { signOut, updateUserPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
import './PasswordRecovery.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verifyRecoveryLink() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const callbackError = hashParams.get('error_description') ?? params.get('error_description');

        if (callbackError) {
          throw new Error(callbackError.replace(/\+/g, ' '));
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error('This password reset link is invalid or has expired. Please request another link.');
        }

        if (mounted) setRecoveryReady(true);
      } catch (verificationError) {
        if (mounted) {
          setLinkError(
            verificationError instanceof Error
              ? verificationError.message
              : 'This password reset link is invalid or has expired.'
          );
        }
      } finally {
        if (mounted) setVerifying(false);
      }
    }

    void verifyRecoveryLink();
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please complete both password fields.');
      return;
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await updateUserPassword(password);
      setUpdated(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReturnToLogin() {
    await signOut();
    navigate('/login', { replace: true });
  }

  if (verifying) {
    return (
      <main className="recovery-page">
        <section className="recovery-card recovery-centered" aria-live="polite">
          <div className="recovery-icon"><Lock size={25} /></div>
          <h1>Verifying reset link</h1>
          <p className="recovery-description">Please wait while we verify your password reset link.</p>
          <span className="recovery-spinner" aria-label="Loading" />
        </section>
      </main>
    );
  }

  if (!recoveryReady) {
    return (
      <main className="recovery-page">
        <section className="recovery-card recovery-centered">
          <div className="recovery-icon"><TriangleAlert size={25} /></div>
          <h1>Invalid Reset Link</h1>
          <p className="recovery-description">{linkError || 'Your password reset link could not be verified.'}</p>
          <Link className="recovery-submit" to="/forgot-password">Request Another Link</Link>
          <p className="recovery-footer"><Link to="/login">Return to Login</Link></p>
        </section>
      </main>
    );
  }

  if (updated) {
    return (
      <main className="recovery-page">
        <section className="recovery-card recovery-centered">
          <div className="recovery-icon"><CheckCircle2 size={25} /></div>
          <h1>Password Updated</h1>
          <p className="recovery-description">Your CaterConnect password has been successfully changed. You can now log in using your new password.</p>
          <button className="recovery-submit" type="button" onClick={() => void handleReturnToLogin()}>Go to Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card" aria-labelledby="reset-title">
        <div className="recovery-icon"><Lock size={25} /></div>
        <h1 id="reset-title">Create New Password</h1>
        <p className="recovery-description">Choose a strong password for your CaterConnect account.</p>

        <form className="recovery-form" onSubmit={handleSubmit}>
          <label className="recovery-label" htmlFor="new-password">New Password</label>
          <input
            className="recovery-password-input"
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="recovery-hint">Password must contain at least 8 characters.</p>

          <label className="recovery-label recovery-password-field" htmlFor="confirm-password">Confirm New Password</label>
          <input
            className="recovery-password-input"
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {error && (
            <div className="recovery-feedback" role="alert">
              <TriangleAlert size={16} /> <span>{error}</span>
            </div>
          )}

          <button className="recovery-submit" type="submit" disabled={saving}>
            {saving ? <><span>Updating password...</span><span className="recovery-spinner" /></> : 'Update Password'}
          </button>
        </form>

        <p className="recovery-footer"><Link to="/login">Return to Login</Link></p>
      </section>
    </main>
  );
}
