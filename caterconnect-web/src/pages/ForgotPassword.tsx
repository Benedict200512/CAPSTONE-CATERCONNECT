import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, TriangleAlert } from 'lucide-react';
import { sendPasswordResetEmail } from '../lib/auth';
import './PasswordRecovery.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSent(false);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(cleanEmail);
      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card" aria-labelledby="forgot-title">
        <Link className="recovery-back" to="/login">
          <ArrowLeft size={16} /> Back to Login
        </Link>
        <div className="recovery-icon"><Mail size={25} /></div>
        <h1 id="forgot-title">Forgot Password?</h1>
        <p className="recovery-description">
          Enter the email address associated with your CaterConnect account.
          We’ll send you instructions to reset your password.
        </p>

        <form className="recovery-form" onSubmit={handleSubmit} noValidate>
          <label className="recovery-label" htmlFor="recovery-email">Email Address</label>
          <div className="recovery-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'recovery-error' : undefined}
            />
          </div>

          {error && (
            <div className="recovery-feedback" id="recovery-error" role="alert">
              <TriangleAlert size={16} /> <span>{error}</span>
            </div>
          )}
          {sent && (
            <div className="recovery-feedback success" role="status">
              <CheckCircle2 size={16} />
              <span>If your account is eligible for password recovery, you will receive an email with instructions to reset your password.</span>
            </div>
          )}

          <button className="recovery-submit" type="submit" disabled={loading}>
            {loading ? <><span>Sending reset link...</span><span className="recovery-spinner" /></> : 'Send Reset Link'}
          </button>
        </form>

        <p className="recovery-footer">
          Remember your password? <Link to="/login">Log In</Link>
        </p>
      </section>
    </main>
  );
}
