import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Check, ChevronDown,
  Eye, EyeOff, FileText, House, LockKeyhole, Mail,
  MapPin, Phone, ShieldCheck, Store, UserRound, UsersRound,
} from 'lucide-react';
import CaterConnectPolicyDialog from './CaterConnectPolicyDialog';
import { POLICY_VERSION, type PolicyRole } from './CaterConnectPolicies';
import './Register.css';
import { signUp } from '../lib/auth';
import { supabase } from '../lib/supabase';

export type CaterConnectRegistrationValues = {
  role: PolicyRole;
  fullName: string;
  email: string;
  password: string;
  phone: string;
  address?: string;
  businessName?: string;
  city?: string;
  agreedToTerms: true;
  policyVersion: typeof POLICY_VERSION;
};

type RegisterProps = {
  loginPath?: string;
  homePath?: string;
};

const emailIsValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const phoneIsValid = (phone: string) => /^09\d{9}$/.test(phone);

function FormField({ label, icon, children, error }: {
  label: string; icon: ReactNode; children: ReactNode; error?: string;
}) {
  return (
    <label className="cc-reg-field">
      <span className="cc-reg-label">{label}</span>
      <span className={`cc-reg-input-shell${error ? ' cc-reg-input-error' : ''}`}>
        <span className="cc-reg-field-icon" aria-hidden="true">{icon}</span>
        {children}
      </span>
      {error && <span className="cc-reg-field-error" role="alert">{error}</span>}
    </label>
  );
}

export default function Register({
  loginPath = '/login',
  homePath = '/',
}: RegisterProps) {
  const [role, setRole] = useState<PolicyRole>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedCustomer, setAgreedCustomer] = useState(false);
  const [agreedCaterer, setAgreedCaterer] = useState(false);
  const [openPolicy, setOpenPolicy] = useState<PolicyRole | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const agreed = role === 'customer' ? agreedCustomer : agreedCaterer;
  const setAgreed = role === 'customer' ? setAgreedCustomer : setAgreedCaterer;
  const emailError = submitted && !emailIsValid(email) ? 'Enter a valid email address.' : '';
  const phoneError = submitted && !phoneIsValid(phone) ? 'Use an 11-digit PH mobile number starting with 09.' : '';
  const passError = submitted && password.length < 8 ? 'Password must be at least 8 characters.' : '';
  const nameError = submitted && !fullName.trim() ? 'Full name is required.' : '';
  const addressError = submitted && role === 'customer' && !address.trim() ? 'Address is required.' : '';
  const businessError = submitted && role === 'caterer' && !businessName.trim() ? 'Business name is required.' : '';
  const cityError = submitted && role === 'caterer' && !city.trim() ? 'City / service area is required.' : '';

  const strength = [password.length >= 8, password.length >= 12, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

  const switchRole = (next: PolicyRole) => {
    if (loading || next === role) return;
    setRole(next);
    setError('');
    setSubmitted(false);
    // Shared inputs deliberately persist when switching roles, matching the mobile flow.
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setError('');
    if (!fullName.trim() || !emailIsValid(email) || !phoneIsValid(phone) || password.length < 8 ||
        (role === 'customer' && !address.trim()) ||
        (role === 'caterer' && (!businessName.trim() || !city.trim()))) return;
    if (!agreed) {
      setError(`Please read and accept the ${role === 'customer' ? 'Customer' : 'Caterer'} Terms before continuing.`);
      return;
    }
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await signUp(
        cleanEmail,
        password,
        fullName.trim(),
        role,
        phone,
        role === 'customer' ? address.trim() : undefined,
        role === 'caterer' ? businessName.trim() : undefined,
        role === 'caterer' ? city.trim() : undefined,
        agreed,
      );
      if (signUpError) throw signUpError;
      if (!data?.user) throw new Error('Your account could not be created. Please try again.');

      // Mirrors Mobile's intention not to log users into the app upon registration.
      // A session is normally null when email confirmation is required.
      if (data.session) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) console.warn('Post-registration sign-out failed:', signOutError.message);
      }
      setRegisteredEmail(cleanEmail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cc-reg-page">
      <div className="cc-reg-glow cc-reg-glow-one" aria-hidden="true" />
      <div className="cc-reg-glow cc-reg-glow-two" aria-hidden="true" />
      <div className="cc-reg-container">
        <a className="cc-reg-back" href={homePath}><ArrowLeft size={16} /> Back to home</a>
        <div className="cc-reg-brand">
          <span className="cc-reg-logo"><img src="/images/caterlogo.png" alt="" /></span>
          <div><strong>CATER<span>CONNECT</span></strong><small>Your Event. Your Food. Connected.</small></div>
        </div>

        {registeredEmail ? (
          <section className="cc-reg-card cc-reg-success" aria-labelledby="cc-reg-success-title">
            <span className="cc-reg-success-icon"><Mail size={30} /></span>
            <h1 id="cc-reg-success-title">Check your email</h1>
            <p>Your {role} registration request was received for <strong>{registeredEmail}</strong>.</p>
            <p>If your Supabase project requires email confirmation, open the verification email before trying to log in. Delivery and account activation depend on your project's email and database configuration.</p>
            <a className="cc-reg-success-link" href={loginPath}>Go to Login <ArrowRight size={17} /></a>
          </section>
        ) : (
        <section className="cc-reg-card" aria-labelledby="cc-reg-title">
          <div className="cc-reg-heading">
            <span className="cc-reg-kicker"><ShieldCheck size={14} /> JOIN CATERCONNECT</span>
            <h1 id="cc-reg-title">Create your account</h1>
            <p>Choose how you'll use CaterConnect, then complete your details.</p>
          </div>

          <div className="cc-reg-role-tabs" role="group" aria-label="Register as">
            <button type="button" className={`cc-reg-role ${role === 'customer' ? 'is-active' : ''}`} aria-pressed={role === 'customer'} onClick={() => switchRole('customer')}>
              <span className="cc-reg-role-icon"><UsersRound size={22} /></span>
              <span><strong>Customer</strong><small>Book catering services</small></span>
              {role === 'customer' && <Check size={17} className="cc-reg-role-check" />}
            </button>
            <button type="button" className={`cc-reg-role ${role === 'caterer' ? 'is-active' : ''}`} aria-pressed={role === 'caterer'} onClick={() => switchRole('caterer')}>
              <span className="cc-reg-role-icon"><Store size={22} /></span>
              <span><strong>Caterer</strong><small>Grow your business</small></span>
              {role === 'caterer' && <Check size={17} className="cc-reg-role-check" />}
            </button>
          </div>

          <div key={role} className={`cc-reg-form-transition cc-reg-${role}`}>
            <div className="cc-reg-role-heading"><span>{role === 'customer' ? <UsersRound size={16}/> : <BriefcaseBusiness size={16}/>}</span>{role === 'customer' ? 'Customer account' : 'Caterer account'}<ChevronDown size={15}/></div>
            <form onSubmit={submit} noValidate>
              <div className="cc-reg-fields">
                <FormField label="Full name" icon={<UserRound size={18}/>} error={nameError}>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" placeholder="e.g. Juan Dela Cruz" required/>
                </FormField>
                <FormField label="Email address" icon={<Mail size={18}/>} error={emailError}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" required/>
                </FormField>
                {role === 'caterer' && <FormField label="Business name" icon={<Store size={18}/>} error={businessError}>
                  <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Cebu Fiesta Catering" required/>
                </FormField>}
                <FormField label="Phone number" icon={<Phone size={18}/>} error={phoneError}>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0,11))} inputMode="numeric" autoComplete="tel" placeholder="09XXXXXXXXX" maxLength={11} required/>
                </FormField>
                {role === 'customer' ?
                  <FormField label="Address" icon={<House size={18}/>} error={addressError}>
                    <input value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" placeholder="e.g. Mandaue City, Cebu" required/>
                  </FormField> :
                  <FormField label="City / service area" icon={<MapPin size={18}/>} error={cityError}>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Lapu-Lapu City" required/>
                  </FormField>}
                <FormField label="Password" icon={<LockKeyhole size={18}/>} error={passError}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" required minLength={8}/>
                  <button type="button" className="cc-reg-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </FormField>
              </div>
              {password && <div className="cc-reg-strength" aria-label="Password strength"><div>{[1,2,3,4,5].map(n => <span key={n} className={n <= strength ? 'filled' : ''}/>)}</div><small>Strength: {strength <= 2 ? 'Weak' : strength === 3 ? 'Fair' : strength === 4 ? 'Good' : 'Strong'}</small></div>}

              <div className="cc-reg-terms">
                <button type="button" className="cc-reg-view-terms" onClick={() => setOpenPolicy(role)}><FileText size={17}/> <span className="cc-reg-terms-text">Read {role === 'customer' ? 'Customer' : 'Caterer'} Terms & Policies</span> <ArrowRight size={15}/></button>
                <label className="cc-reg-agreement"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}/><span>I have read and agree to the <button type="button" onClick={() => setOpenPolicy(role)}>{role === 'customer' ? 'Customer' : 'Caterer'} Terms</button> (version {POLICY_VERSION}).</span></label>
              </div>
              {role === 'caterer' && <p className="cc-reg-verification-note"><ShieldCheck size={16}/> Business verification documents are submitted after account creation through your caterer dashboard.</p>}
              {error && <p className="cc-reg-alert" role="alert">{error}</p>}
              <button className="cc-reg-submit" type="submit" disabled={loading}>{loading ? 'Creating account...' : `Create ${role} account`}<ArrowRight size={18}/></button>
            </form>
          </div>
          <p className="cc-reg-login">Already have an account? <a href={loginPath}>Log in</a></p>
        </section>
        )}
        <p className="cc-reg-footnote">© {new Date().getFullYear()} CATERCONNECT · Made for Cebu celebrations</p>
      </div>
      {openPolicy && <CaterConnectPolicyDialog initialRole={openPolicy} onClose={() => setOpenPolicy(null)} />}
    </main>
  );
}
