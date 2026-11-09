import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import "./AccountAppeal.css";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  UserPlus,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { signIn } from "../lib/auth";
import { useAuth } from "../context/AuthContext";

const caterLogo = "/images/caterlogo.png";
function roleHome(role: string): string | null {
  switch (role) {
    case "customer":
      return "/customer";
    case "caterer":
      return "/caterer";
    case "staff":
      return "/staff";
    case "admin":
      return "/admin";
    default:
      return null;
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspension, setSuspension] = useState<{
    reason: string | null;
  } | null>(null);
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !session || !profile) return;
    const suspended =
      String(profile.status ?? "")
        .trim()
        .toLowerCase() === "suspended";
    if (suspended) {
      if (profile.role === "customer" || profile.role === "caterer") {
        setSuspension((prev) => prev ?? { reason: null });
      } else {
        void supabase.auth.signOut();
      }
      return;
    }
    const destination = roleHome(profile.role);
    if (destination) navigate(destination, { replace: true });
  }, [session, profile, authLoading, navigate]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuspension(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.suspended) {
        // Preserve authenticated session for the isolated appeal page.
        setSuspension({ reason: result.suspensionReason ?? null });
        return;
      }
      const userId = result.data?.user?.id;
      if (!userId) {
        setError("Could not verify your account. Please try again.");
        return;
      }
      const { data: account, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", userId)
        .single();
      if (profileError || !account) {
        await supabase.auth.signOut();
        setError("Could not load your profile. Please try again.");
        return;
      }
      if (
        String(account.status ?? "")
          .trim()
          .toLowerCase() === "suspended"
      ) {
        if (account.role === "customer" || account.role === "caterer") {
          setSuspension({ reason: null });
        } else {
          await supabase.auth.signOut();
          setError("Your account has been suspended.");
        }
        return;
      }
      const destination = roleHome(account.role);
      if (!destination) {
        await supabase.auth.signOut();
        setError("Access denied. Invalid portal credentials.");
        return;
      }
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cc-login-page">
      <div className="cc-login-glow cc-login-glow-one" aria-hidden="true" />
      <div className="cc-login-glow cc-login-glow-two" aria-hidden="true" />
      <div className="cc-login-container">
        <header className="cc-login-topbar">
          <a href="/" className="cc-login-back">
            <ArrowLeft size={17} /> Back to home
          </a>
          <div className="cc-login-brand">
            <span className="cc-login-logo">
              <img src={caterLogo} alt="" />
            </span>
            <span>
              CATER<span className="cc-login-brand-orange">CONNECT</span>
            </span>
          </div>
        </header>
        <section className="cc-login-card" aria-labelledby="cc-login-title">
          <div className="cc-login-icon">
            <Lock size={25} />
          </div>
          <p className="cc-login-eyebrow">YOUR CATERING MARKETPLACE</p>
          <h1 id="cc-login-title">Welcome Back!</h1>
          <p className="cc-login-subtitle">
            Sign in to your CATERCONNECT account and continue where you left
            off.
          </p>
          {suspension && (
            <div className="cc-appeal-login-notice" role="alert">
              <div className="cc-appeal-notice-heading">
                <AlertTriangle size={20} /> Account Temporarily Suspended
              </div>
              <p>
                Your account is suspended. You cannot access the dashboard while
                suspended.
              </p>
              <strong>Reason for suspension</strong>
              <p>
                {suspension.reason ||
                  "No specific reason was provided. You can view or submit an appeal."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/account-appeal")}
                className="cc-appeal-primary"
              >
                Submit / View Appeal <ArrowRight size={17} />
              </button>
            </div>
          )}
          <form onSubmit={handleLogin} className="cc-login-form">
            <label htmlFor="cc-login-email">Email Address</label>
            <div className="cc-login-input-wrap">
              <Mail size={19} aria-hidden="true" />
              <input
                id="cc-login-email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="cc-login-field-header">
              <label htmlFor="cc-login-password">Password</label>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="cc-login-inline-link"
              >
                Forgot password?
              </button>
            </div>
            <div className="cc-login-input-wrap">
              <Lock size={19} aria-hidden="true" />
              <input
                id="cc-login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="cc-login-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {error && (
              <div className="cc-login-error" role="alert">
                <AlertTriangle size={19} />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="cc-login-submit"
            >
              {loading ? (
                <>
                  <span className="cc-login-spinner" /> Signing in...
                </>
              ) : (
                <>
                  Sign In to CATERCONNECT <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="cc-login-secure">
            <ShieldCheck size={17} /> Your account information is protected and
            secure.
          </div>
          <div className="cc-login-register">
            <p>New to CATERCONNECT?</p>
            <button type="button" onClick={() => navigate("/register")}>
              <UserPlus size={18} /> Create an Account <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <footer className="cc-login-footer">
          Your Event. Your Food. Connected.{" "}
          <span>© {new Date().getFullYear()} CATERCONNECT</span>
        </footer>
      </div>
    </main>
  );
}
