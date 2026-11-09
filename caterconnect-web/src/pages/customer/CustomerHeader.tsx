import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Compass,
  Heart,
  MessageSquare,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import "./CustomerHeader.css";

// Shared customer navigation: reuse this header in future customer pages.
// Saved is now active. Bookings remains a placeholder until its Web flow is ready.
type CustomerHeaderProps = {
  activePage?: "marketplace" | "bookings" | "saved" | "messages" | "profile";
};

export default function CustomerHeader({
  activePage = "marketplace",
}: CustomerHeaderProps) {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setLogoutError(error.message);
        return;
      }
      setConfirmLogout(false);
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };
  const [mobileNav, setMobileNav] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const activeNotifications =
    window.location.pathname === "/customer/notifications";

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    setUnread(null);
    if (!userId)
      return () => {
        active = false;
      };
    const refresh = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (active && !error) setUnread(count ?? 0);
    };
    void refresh();
    window.addEventListener("cc:customer-notifications-changed", refresh);
    const channel = supabase
      .channel(`customer-header-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      active = false;
      window.removeEventListener("cc:customer-notifications-changed", refresh);
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!mobileNav) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [mobileNav]);

  return (
    <>
      <header className="cc-customer-header">
        <div className="cc-customer-header-inner">
          <Link
            className="cc-customer-brand"
            to="/customer"
            aria-label="CaterConnect Customer Home"
            onClick={() => setMobileNav(false)}
          >
            <span className="cc-customer-brand-logo">
              <img src="/images/caterlogo.png" alt="" />
            </span>
            <span>
              <strong>
                CATER<span>CONNECT</span>
              </strong>
              <small>Nasa screen pa lang, ramdam mo na ang sarap.</small>
            </span>
          </Link>
          <nav
            className={mobileNav ? "cc-customer-nav open" : "cc-customer-nav"}
            aria-label="Customer navigation"
          >
            <Link
              className={activePage === "marketplace" ? "active" : ""}
              to="/customer#browse"
              aria-current={activePage === "marketplace" ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <Compass size={17} /> Marketplace
            </Link>
            <Link
              className={activePage === "bookings" ? "active" : ""}
              to="/customer/bookings"
              aria-current={activePage === "bookings" ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <CalendarDays size={17} /> Bookings
            </Link>
            <Link
              className={activePage === "messages" ? "active" : ""}
              to="/customer/messages"
              aria-current={activePage === "messages" ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <MessageSquare size={17} /> Messages
            </Link>
            <Link
              className={activePage === "saved" ? "active" : ""}
              to="/customer/saved"
              aria-current={activePage === "saved" ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <Heart size={17} /> Saved
            </Link>
          </nav>
          <div className="cc-customer-top-actions">
            <Link
              className={`cc-customer-notif${activeNotifications ? " active" : ""}`}
              to="/customer/notifications"
              title="Notifications"
              aria-label={
                unread === null
                  ? "Open notifications"
                  : `Open notifications, ${unread} unread`
              }
              aria-current={activeNotifications ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <Bell size={20} />
              {unread !== null && unread > 0 && (
                <b>{unread > 9 ? "9+" : unread}</b>
              )}
            </Link>
            <Link
              className={`cc-customer-user${activePage === "profile" ? " active" : ""}`}
              to="/customer/profile"
              aria-label="Open customer profile"
              aria-current={activePage === "profile" ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <UserRound size={18} />
              )}
              <span>{profile?.full_name?.split(" ")[0] || "Customer"}</span>
            </Link>
            <button
              className="cc-customer-logout"
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={() => {
                setLogoutError("");
                setConfirmLogout(true);
                setMobileNav(false);
              }}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
            <button
              className="cc-customer-mobile-toggle"
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {confirmLogout && (
        <div
          className="cc-customer-logout-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loggingOut)
              setConfirmLogout(false);
          }}
        >
          <div
            className="cc-customer-logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-customer-logout-title"
          >
            <span className="cc-customer-logout-dialog-icon">
              <LogOut size={24} aria-hidden="true" />
            </span>
            <h2 id="cc-customer-logout-title">Log out of CaterConnect?</h2>
            <p>You can sign back in anytime with your account.</p>
            {logoutError && (
              <p className="cc-customer-logout-error" role="alert">
                {logoutError}
              </p>
            )}
            <div className="cc-customer-logout-dialog-actions">
              <button
                type="button"
                className="cc-customer-logout-cancel"
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-customer-logout-confirm"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                {loggingOut ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
