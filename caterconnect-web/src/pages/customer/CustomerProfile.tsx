import { Link } from "react-router-dom";
import {
  ArrowRight,
  CircleHelp,
  Edit3,
  Headphones,
  ShieldCheck,
  UserRound,
  Mail,
  Info,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CustomerHeader from "./CustomerHeader";
import "./CustomerProfile.css";

export default function CustomerProfile() {
  const { session, profile } = useAuth();
  const name = profile?.full_name?.trim() || "Customer";
  const avatar = (profile as { avatar_url?: string | null } | null)?.avatar_url;
  return (
    <div className="cc-profile-shell">
      <CustomerHeader activePage="profile" />
      <main className="cc-profile-main">
        <div className="cc-profile-overline">
          <UserRound size={17} /> CUSTOMER ACCOUNT
        </div>
        <h1>My Profile</h1>
        <p className="cc-profile-subtitle">
          Manage your personal information and get help with CaterConnect.
        </p>
        <section className="cc-profile-identity">
          <div className="cc-profile-avatar">
            {avatar ? (
              <img src={avatar} alt="Your profile" />
            ) : (
              <span>{name[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="cc-profile-identity-details">
            <h2>{name}</h2>
            <p>
              <Mail size={16} /> {session?.user.email ?? "Email unavailable"}
            </p>
            <span className="cc-profile-verified">
              <ShieldCheck size={15} /> Customer Account
            </span>
          </div>
        </section>
        <h2 className="cc-profile-section-title">Account Settings</h2>
        <div className="cc-profile-settings-list">
          <Link className="cc-profile-option" to="/customer/profile/edit">
            <span className="cc-profile-option-icon">
              <Edit3 />
            </span>
            <span>
              <strong>Edit Profile</strong>
              <small>Update your name, phone number, address, and photo</small>
            </span>
            <ArrowRight className="cc-profile-option-arrow" />
          </Link>
          <Link className="cc-profile-option" to="/customer/faq">
            <span className="cc-profile-option-icon">
              <CircleHelp />
            </span>
            <span>
              <strong>Help Center / FAQ</strong>
              <small>Find answers to common customer questions</small>
            </span>
            <ArrowRight className="cc-profile-option-arrow" />
          </Link>
          <Link className="cc-profile-option" to="/customer/support">
            <span className="cc-profile-option-icon">
              <Headphones />
            </span>
            <span>
              <strong>Technical Support</strong>
              <small>Report platform issues and view your reports</small>
            </span>
            <ArrowRight className="cc-profile-option-arrow" />
          </Link>
        </div>
        <div className="cc-profile-note">
          <Info size={18} />
          <span>
            Bookings and notification pages will be added in later Customer Web
            phases.
          </span>
        </div>
      </main>
    </div>
  );
}
