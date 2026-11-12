import { useState } from "react";
import {
  ArrowUpRight,
  ChefHat,
  Check,
  CirclePlay,
  Download,
  Heart,
  CalendarDays,
  MessageCircle,
  Smartphone,
  Store,
  UtensilsCrossed,
  Search,
  ShieldCheck,
  MapPin,
  Menu,
  Sparkles,
  X,
  Bell,
  LayoutGrid,
  House,
  UserRound,
  SlidersHorizontal,
  CakeSlice,
  BriefcaseBusiness,
  Package,
  Clock3,
  CircleCheck,
  CreditCard,
  ArrowRight,
  ChevronRight,
  Wifi,
  Signal,
  BatteryFull,
  Star,
} from "lucide-react";
import "./CaterConnectLanding.css";
import CaterConnectPolicyDialog from "./CaterConnectPolicyDialog";

import type { PolicyRole } from "./CaterConnectPolicies";

/**
 * Public homepage for CATERCONNECT.
 * Change loginPath/registerPath to match the routes in your current App.tsx.
 * No Supabase calls, authentication changes, or booking logic are included.
 */
type CaterConnectLandingProps = {
  loginPath?: string;
  registerPath?: string;
};

export default function CaterConnectLanding({
  loginPath = "/login",
  registerPath = "/register",
}: CaterConnectLandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPolicy, setOpenPolicy] = useState<PolicyRole | null>(null);

  return (
    <div className="caterconnect-landing">
      <header className="site-header" id="top">
        <div className="shell header-inner">
          <a className="brand" href="#top" aria-label="CaterConnect home">
            <span className="brand-mark">
              <img className="brand-logo" src="/images/caterlogo.png" alt="" />
            </span>
            <span>
              CATER<span className="brand-accent">CONNECT</span>
            </span>
          </a>
          <nav
            className="nav-links"
            id="primary-nav"
            aria-label="Main navigation"
          >
            <a href="#explore">Explore Caterers</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#about">About Us</a>
            <a href="#android-app">Android App</a>
          </nav>
          <div className="header-actions">
            <a className="login-link" href={loginPath}>
              Log In
            </a>
            <a className="btn btn-primary header-register" href={registerPath}>
              Get Started <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <button
            className="menu-toggle"
            id="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="mobile-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <nav
          className="mobile-nav"
          id="mobile-nav"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
          onClick={() => setMenuOpen(false)}
        >
          <a href="#explore">Explore Caterers</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About Us</a>
          <a href="#android-app">Android App</a>
          <a href={loginPath}>Log In</a>
          <a className="mobile-register" href={registerPath}>
            Create an Account
          </a>
        </nav>
      </header>
      <main>
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot"></span> YOUR EVENT, MADE EASIER{" "}
              <span className="eyebrow-line"></span> CEBU, PHILIPPINES
            </div>
            <h1 id="hero-title">
              Find the right caterer
              <br />
              for every <span>special occasion.</span>
            </h1>
            <p className="hero-description">
              From Cebu City to neighboring communities, discover local catering
              options, compare menus and packages, and plan your celebration
              with ease.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary btn-lg" href="#explore">
                Explore Caterers <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <a className="btn btn-outline btn-lg" href="#how-it-works">
                <CirclePlay size={19} aria-hidden="true" /> How It Works
              </a>
            </div>
            <div className="hero-trust">
              <div className="avatar-stack" aria-hidden="true">
                <span>A</span>
                <span>D</span>
                <span>C</span>
                <span>K</span>
              </div>
              <div>
                <strong>Made for every celebration</strong>
                <small>Weddings · Birthdays · Corporate events</small>
              </div>
            </div>
          </div>
          <div
            className="hero-visual"
            role="img"
            aria-label="Elegant catering and event food arrangement"
          >
            <div className="hero-photo"></div>
            <div className="hero-photo-overlay"></div>
            <div className="photo-caption">
              <span className="caption-symbol">
                <ChefHat size={28} />
              </span>
              <div>
                <b>Cebu celebrations, made memorable.</b>
                <small>Local food, meaningful moments</small>
              </div>
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <MapPin size={22} />
              </span>
              <div>
                <strong>One place. More choices.</strong>
                <small>Discover the right catering fit.</small>
              </div>
            </div>
            <span className="corner-sparkle sparkle-one">
              <Sparkles size={27} />
            </span>
            <span className="corner-sparkle sparkle-two">
              <Sparkles size={32} />
            </span>
          </div>
        </section>
        <div className="feature-strip">
          <div className="shell strip-inner">
            <span>
              <i>
                <Check size={17} />
              </i>{" "}
              Discover local caterers
            </span>
            <span>
              <i>
                <Check size={17} />
              </i>{" "}
              Compare packages
            </span>
            <span>
              <i>
                <Check size={17} />
              </i>{" "}
              Plan your event
            </span>
            <span>
              <i>
                <Check size={17} />
              </i>{" "}
              Manage bookings
            </span>
          </div>
        </div>
        <section
          className="section shell explore"
          id="explore"
          aria-labelledby="explore-heading"
        >
          <div className="section-head">
            <div>
              <div className="section-kicker">
                FIND YOUR PERFECT MATCH <span></span>
              </div>
              <h2 id="explore-heading">
                A taste of <em>Cebu celebrations.</em>
              </h2>
              <p>
                Explore catering for weddings, fiestas, birthdays, and company
                gatherings across Cebu.
              </p>
            </div>
            <a className="text-link" href={loginPath}>
              Explore catering services{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="occasion-grid">
            <a className="occasion-card occasion-wedding" href={loginPath}>
              <div className="occasion-img"></div>
              <div className="occasion-shade"></div>
              <span className="occasion-arrow">
                <ArrowUpRight size={17} />
              </span>
              <div className="occasion-copy">
                <span>THE BIG DAY</span>
                <h3>Weddings</h3>
                <p>Cebu celebrations with local flavor.</p>
              </div>
            </a>
            <a className="occasion-card occasion-birthday" href={loginPath}>
              <div className="occasion-img"></div>
              <div className="occasion-shade"></div>
              <span className="occasion-arrow">
                <ArrowUpRight size={17} />
              </span>
              <div className="occasion-copy">
                <span>LET'S CELEBRATE</span>
                <h3>Birthdays & Parties</h3>
                <p>From birthdays to family fiestas.</p>
              </div>
            </a>
            <a className="occasion-card occasion-corporate" href={loginPath}>
              <div className="occasion-img"></div>
              <div className="occasion-shade"></div>
              <span className="occasion-arrow">
                <ArrowUpRight size={17} />
              </span>
              <div className="occasion-copy">
                <span>GATHER TOGETHER</span>
                <h3>Corporate Events</h3>
                <p>Food for teams and special events.</p>
              </div>
            </a>
          </div>
          <div className="explore-notice">
            <span className="notice-icon">
              <Sparkles size={22} />
            </span>
            <span>
              Looking for something specific? CATERCONNECT helps you explore
              catering services by budget, event type, and menu preferences.
            </span>
            <a href={registerPath}>Create your account</a>
          </div>
        </section>
        <section
          className="how-section"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="shell">
            <div className="center-heading">
              <div className="section-kicker centered">
                SIMPLE FROM START TO FINISH
              </div>
              <h2 id="how-heading">
                How CATERCONNECT <em>works.</em>
              </h2>
              <p>
                Three simple steps to making your next event a little less
                stressful.
              </p>
            </div>
            <div className="steps-grid">
              <div className="step">
                <span className="step-number">01</span>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="10.7" cy="10.7" r="6.5" />
                    <path d="m16 16 5 5" />
                  </svg>
                </div>
                <h3>Explore & Discover</h3>
                <p>
                  Explore catering services and find options that match your
                  location, occasion, and budget.
                </p>
              </div>
              <div className="step">
                <span className="step-number">02</span>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 4h18v16H3zM3 9h18M8 2v4M16 2v4M8 13h3M8 16h8" />
                  </svg>
                </div>
                <h3>Compare & Book</h3>
                <p>
                  Review menus and packages, check availability, and submit your
                  booking request.
                </p>
              </div>
              <div className="step">
                <span className="step-number">03</span>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m4 13 5 5L20 7" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <h3>Celebrate & Enjoy</h3>
                <p>
                  Stay updated on your booking and focus on making memories with
                  your guests.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          className="about-section shell"
          id="about"
          aria-labelledby="about-heading"
        >
          <div className="about-visual">
            <div className="about-photo"></div>
            <div className="about-label">
              <span>OUR PURPOSE</span>
              <b>Connecting people through food.</b>
            </div>
          </div>
          <div className="about-copy">
            <div className="section-kicker">
              A LITTLE ABOUT US <span></span>
            </div>
            <h2 id="about-heading">
              Bringing people and <em>caterers together.</em>
            </h2>
            <p>
              CATERCONNECT is an online marketplace built to make discovering
              and booking catering services easier for customers while helping
              local catering businesses grow their online presence.
            </p>
            <p>
              We believe planning a celebration should feel exciting—not
              overwhelming. That's why we're creating a more organized way to
              explore packages, communicate with caterers, and manage
              reservations.
            </p>
            <div className="about-values">
              <div>
                <span className="value-check">
                  <Check size={15} />
                </span>
                <span>Made for Cebu customers and local caterers</span>
              </div>
              <div>
                <span className="value-check">
                  <Check size={15} />
                </span>
                <span>Clearer package information</span>
              </div>
              <div>
                <span className="value-check">
                  <Check size={15} />
                </span>
                <span>More organized booking experience</span>
              </div>
            </div>
            <a className="text-link" href={registerPath}>
              Join CATERCONNECT <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
        {/* CaterConnect original code-drawn Android previews: no image assets required. */}
        <section
          className="cc-app-showcase"
          id="android-app"
          aria-labelledby="cc-app-showcase-title"
        >
          <div className="shell cc-app-shell">
            <div className="cc-app-intro">
              <div className="cc-app-overline">
                <Smartphone size={16} aria-hidden="true" />
                CATERCONNECT MOBILE
                <span className="cc-app-overline-divider" aria-hidden="true" />
                ANDROID
              </div>
              <h2 id="cc-app-showcase-title">
                One app. <em>Two ways to connect.</em>
              </h2>
              <p>
                Planning an occasion or managing a catering business?
                CaterConnect brings both experiences together wherever you go.
              </p>
            </div>

            <div className="cc-app-role-grid">
              <article className="cc-app-role-card cc-app-role-card--customer">
                <div className="cc-app-role-content">
                  <div className="cc-app-role-eyebrow">
                    <span className="cc-app-role-symbol"><Heart size={19} aria-hidden="true" /></span>
                    <span>01 &nbsp; / &nbsp; FOR CUSTOMERS</span>
                  </div>
                  <h3>Find it. Save it.<br /><span>Celebrate it.</span></h3>
                  <p>
                    Discover Cebu caterers, find packages that fit your event,
                    and manage reservations without the back-and-forth.
                  </p>
                  <ul className="cc-app-role-benefits">
                    <li><Search size={16} aria-hidden="true" /><span>Explore caterers and packages</span></li>
                    <li><Heart size={16} aria-hidden="true" /><span>Save favorite options</span></li>
                    <li><CalendarDays size={16} aria-hidden="true" /><span>Book and track your events</span></li>
                  </ul>
                  <span className="cc-app-role-caption">YOUR EVENT, MADE EASIER</span>
                </div>
                <div className="cc-app-device-stage">
                  <span className="cc-app-stage-orbit" aria-hidden="true" />
                  {/* Static illustrative app UI. Drawn with HTML and CSS, not a screenshot. */}
                  <div className="cc-app-device" role="img" aria-label="Illustration of CaterConnect customer mobile app with caterer search, categories, favorite packages and navigation">
                    <div className="cc-app-screen cc-app-screen--customer">
                      <div className="cc-app-mobile-status">
                        <strong>9:41</strong>
                        <span className="cc-app-mobile-signal"><Signal size={9} /><Wifi size={9} /><BatteryFull size={12} /></span>
                      </div>
                      <div className="cc-app-mobile-customer-header">
                        <div className="cc-app-mobile-header-row">
                          <div className="cc-app-mobile-wordmark"><ChefHat size={17} /><b>CATER<span>CONNECT</span></b></div>
                          <span className="cc-app-mobile-round-icon"><Bell size={12}/></span>
                        </div>
                        <small>Discover catering made easy.</small>
                      </div>
                      <div className="cc-app-mobile-customer-body">
                        <div className="cc-app-mobile-search"><Search size={12}/><span>Search caterers or events...</span><SlidersHorizontal size={12}/></div>
                        <div className="cc-app-mobile-promo">
                          <small>CEBU CELEBRATIONS</small>
                          <b>Find the perfect caterer for your event.</b>
                          <span className="cc-app-mobile-mini-pill">Explore now <ArrowRight size={10}/></span>
                          <span className="cc-app-mobile-promo-decoration" aria-hidden="true"><UtensilsCrossed size={55}/></span>
                        </div>
                        <div className="cc-app-mobile-section-label"><b>Categories</b><span>See all</span></div>
                        <div className="cc-app-mobile-categories">
                          <div><span><LayoutGrid size={14}/></span><b>All</b></div>
                          <div><span><Heart size={14}/></span><b>Wedding</b></div>
                          <div><span><CakeSlice size={14}/></span><b>Birthday</b></div>
                          <div><span><BriefcaseBusiness size={14}/></span><b>Corporate</b></div>
                        </div>
                        <div className="cc-app-mobile-section-label"><b>Featured caterers</b><span>See all <ChevronRight size={10}/></span></div>
                        <div className="cc-app-mobile-featured">
                          <div className="cc-app-mobile-food-art"><UtensilsCrossed size={24}/><span>POPULAR</span></div>
                          <div className="cc-app-mobile-featured-details"><strong>Local Cebu Catering</strong><span>Event packages from ₱150/guest</span><small><Star size={9} fill="currentColor"/> Discover packages <ChevronRight size={10}/></small></div>
                        </div>
                      </div>
                      <div className="cc-app-mobile-tabbar cc-app-mobile-customer-tabbar">
                        <span className="is-active"><House size={15}/><small>Home</small></span>
                        <span><CalendarDays size={15}/><small>Bookings</small></span>
                        <span><Heart size={15}/><small>Favorite</small></span>
                        <span><MessageCircle size={15}/><small>Messages</small></span>
                        <span><UserRound size={15}/><small>Profile</small></span>
                      </div>
                    </div>
                  </div>
                  <span className="cc-app-device-label"><Heart size={13} aria-hidden="true" /> CUSTOMER VIEW</span>
                </div>
              </article>

              <article className="cc-app-role-card cc-app-role-card--caterer">
                <div className="cc-app-role-content">
                  <div className="cc-app-role-eyebrow">
                    <span className="cc-app-role-symbol"><Store size={19} aria-hidden="true" /></span>
                    <span>02 &nbsp; / &nbsp; FOR CATERERS</span>
                  </div>
                  <h3>Your business.<br /><span>In your pocket.</span></h3>
                  <p>
                    Stay on top of bookings, update packages and menus,
                    and reply to customers directly from your phone.
                  </p>
                  <ul className="cc-app-role-benefits">
                    <li><CalendarDays size={16} aria-hidden="true" /><span>Monitor booking requests</span></li>
                    <li><UtensilsCrossed size={16} aria-hidden="true" /><span>Manage menus and packages</span></li>
                    <li><MessageCircle size={16} aria-hidden="true" /><span>Stay connected with customers</span></li>
                  </ul>
                  <span className="cc-app-role-caption">YOUR BUSINESS, ON THE GO</span>
                </div>
                <div className="cc-app-device-stage">
                  <span className="cc-app-stage-orbit" aria-hidden="true" />
                  {/* Static illustrative app UI. Drawn with HTML and CSS, not a screenshot. */}
                  <div className="cc-app-device" role="img" aria-label="Illustration of CaterConnect caterer mobile app with dashboard, booking statistics, premium plan and availability">
                    <div className="cc-app-screen cc-app-screen--caterer">
                      <div className="cc-app-mobile-status">
                        <strong>9:41</strong>
                        <span className="cc-app-mobile-signal"><Signal size={9}/><Wifi size={9}/><BatteryFull size={12}/></span>
                      </div>
                      <div className="cc-app-mobile-caterer-header">
                        <div className="cc-app-mobile-header-row"><small>CATERCONNECT BUSINESS</small><span className="cc-app-mobile-round-icon"><Bell size={12}/></span></div>
                        <span>Welcome back,</span>
                        <strong>Your catering dashboard</strong>
                      </div>
                      <div className="cc-app-mobile-caterer-body">
                        <div className="cc-app-mobile-stat-grid">
                          <div className="cc-app-mobile-stat"><span><CalendarDays size={15}/></span><small>Total bookings</small><strong>3</strong></div>
                          <div className="cc-app-mobile-stat"><span><CircleCheck size={15}/></span><small>Completed</small><strong>3</strong></div>
                          <div className="cc-app-mobile-stat"><span><Clock3 size={15}/></span><small>Pending</small><strong>0</strong></div>
                          <div className="cc-app-mobile-stat"><span><CreditCard size={15}/></span><small>Your plan</small><strong>Premium</strong></div>
                        </div>
                        <div className="cc-app-mobile-plan"><span><Star size={12} fill="currentColor"/></span><div><small>YOUR SUBSCRIPTION</small><strong>Premium Plan</strong></div><b>ACTIVE</b></div>
                        <div className="cc-app-mobile-calendar">
                          <small>CALENDAR OVERVIEW</small>
                          <strong>Monthly availability</strong>
                          <div className="cc-app-mobile-calendar-month"><span>‹</span><b>November 2026</b><span>›</span></div>
                          <div className="cc-app-mobile-calendar-week"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
                          <div className="cc-app-mobile-calendar-days"><span>9</span><span>10</span><span>11</span><span>12</span><span className="selected">13</span><span>14</span><span>15</span></div>
                          <div className="cc-app-mobile-calendar-link">Check availability <ChevronRight size={10}/></div>
                        </div>
                      </div>
                      <div className="cc-app-mobile-tabbar cc-app-mobile-caterer-tabbar">
                        <span className="is-active"><LayoutGrid size={13}/><small>Home</small></span>
                        <span><Package size={13}/><small>Packages</small></span>
                        <span><UtensilsCrossed size={13}/><small>Menu</small></span>
                        <span><CalendarDays size={13}/><small>Bookings</small></span>
                        <span><MessageCircle size={13}/><small>Chat</small></span>
                        <span><Store size={13}/><small>Business</small></span>
                      </div>
                    </div>
                  </div>
                  <span className="cc-app-device-label"><Store size={13} aria-hidden="true" /> CATERER VIEW</span>
                </div>
              </article>
            </div>

            <div className="cc-app-download-panel">
              <div className="cc-app-download-copy">
                <span className="cc-app-download-symbol"><Smartphone size={23} aria-hidden="true" /></span>
                <div>
                  <strong>One download. Both CaterConnect experiences.</strong>
                  <span>Install CaterConnect on your Android device.</span>
                </div>
              </div>
              <a
                className="cc-app-download-action"
                href="https://expo.dev/accounts/benedictoo/projects/caterconnect-mobile/builds/131917a7-583e-4133-98b3-ec6f36d77565"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get the Android APK from the official CaterConnect Expo build page (opens in a new tab)"
              >
                <Download size={19} aria-hidden="true" />
                Get the Android APK
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="cc-app-install-note">
              <ShieldCheck size={16} aria-hidden="true" />
              The button opens the official Expo build page. Select Download there
              to get the Android APK. Android may ask you to allow installation
              from your browser.
            </p>
          </div>
        </section>
        <section className="cta-section shell">
          <div className="cta-content">
            <div className="cta-kicker">YOUR NEXT CELEBRATION STARTS HERE</div>
            <h2>
              Good food. Great memories.
              <br />
              <span>Let's make it happen.</span>
            </h2>
            <p>
              Create your account to explore caterers, compare packages, and
              start planning.
            </p>
            <div className="cta-actions">
              <a className="btn btn-dark" href={registerPath}>
                Create an Account
              </a>
              <a className="btn btn-light" href={loginPath}>
                Already a member? Log In
              </a>
            </div>
          </div>
          <div className="cta-decoration" aria-hidden="true">
            <span className="circle-one"></span>
            <span className="circle-two"></span>
            <span className="decoration-sparkle">
              <Sparkles size={100} />
            </span>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell">
          <div className="footer-top">
            <div>
              <a className="brand" href="#top">
                <span className="brand-mark">
                  <img
                    className="brand-logo"
                    src="/images/caterlogo.png"
                    alt=""
                  />
                </span>
                <span>
                  CATER<span className="brand-accent">CONNECT</span>
                </span>
              </a>
              <p>Making every occasion worth celebrating.</p>
            </div>
            <div className="footer-links">
              <a href="#explore">Explore Caterers</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#about">About Us</a>
              <a href="#android-app">Android App</a>
            
              <button type="button" className="footer-policy-link" onClick={() => setOpenPolicy("customer")}>
                Customer Terms
              </button>
              <button type="button" className="footer-policy-link" onClick={() => setOpenPolicy("caterer")}>
                Caterer Terms
              </button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © <span>{new Date().getFullYear()}</span> CATERCONNECT. All rights
              reserved.
            </span>
            <span className="footer-message">Made for Cebu celebrations.</span>
          </div>
        </div>
      </footer>
      {openPolicy && (
        <CaterConnectPolicyDialog
          initialRole={openPolicy}
          onClose={() => setOpenPolicy(null)}
        />
      )}
    </div>
  );
}
