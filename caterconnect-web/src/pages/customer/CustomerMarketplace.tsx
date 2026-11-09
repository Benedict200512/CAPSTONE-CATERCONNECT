import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Cake,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Compass,
  Heart,
  LayoutGrid,
  MapPin,
  ClipboardList,
  CreditCard,
  PartyPopper,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  UsersRound,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CustomerHeader from "./CustomerHeader";
import {
  fetchApprovedCaterers,
  fetchCatererReviewSummaries,
  getLowestPricePerGuest,
  type CatererWithPackages,
} from "../../lib/customerMarketplaceData";
import {
  filterCaterers,
  lowestPackageTotal,
  normalizeSearch,
  parseFilterNumbers,
  type CatererSort,
} from "../../lib/customerMarketplaceSearch";
import "./CustomerMarketplace.css";

const CATEGORIES = [
  { label: "All", Icon: LayoutGrid },
  { label: "Wedding", Icon: Heart },
  { label: "Birthday", Icon: Cake },
  { label: "Corporate", Icon: BriefcaseBusiness },
  { label: "Debut", Icon: Sparkles },
  { label: "Anniversary", Icon: PartyPopper },
] as const;
const SORT_OPTIONS: { value: CatererSort; text: string }[] = [
  { value: "priority", text: "Recommended" },
  { value: "price-asc", text: "Price: Low to High" },
  { value: "price-desc", text: "Price: High to Low" },
  { value: "name", text: "Name: A–Z" },
];
const peso = (value: number) =>
  value.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
const formatBudget = (value: string) => {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(
    /^0+(?=\d)/,
    "",
  );
  const decimals =
    dot === -1
      ? ""
      : "." +
        cleaned
          .slice(dot + 1)
          .replace(/\./g, "")
          .slice(0, 2);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + decimals;
};

type Draft = {
  minimum: string;
  maximum: string;
  guests: string;
  city: string;
  event: string;
  sort: CatererSort;
};
const emptyNumbers = { minBudget: null, maxBudget: null, guests: null };

export default function CustomerMarketplace() {
  const { session, profile } = useAuth();
  const [caterers, setCaterers] = useState<CatererWithPackages[]>([]);
  const [reviews, setReviews] = useState<
    Record<string, { avg: number; count: number }>
  >({});
  const [ratingsUnavailable, setRatingsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<CatererSort>("priority");
  const [budget, setBudget] = useState("");
  const [guests, setGuests] = useState("");
  const [minimum, setMinimum] = useState("");
  const [searched, setSearched] = useState(false);
  const [matcherMode, setMatcherMode] = useState(false);
  const [applied, setApplied] =
    useState<ReturnType<typeof parseFilterNumbers>>(emptyNumbers);
  const [matcherError, setMatcherError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    minimum: "",
    maximum: "",
    guests: "",
    city: "",
    event: "All",
    sort: "priority",
  });
  const [filterError, setFilterError] = useState("");
  const [showAllFeatured, setShowAllFeatured] = useState(false);
  const version = useRef(0);
  const browseRef = useRef<HTMLElement>(null);

  const reload = useCallback(async (first = false) => {
    const request = ++version.current;
    if (first) setLoading(true);
    else setRefreshing(true);
    setLoadError("");
    try {
      const results = await fetchApprovedCaterers();
      if (request !== version.current) return;
      setCaterers(results);
      try {
        const summaries = await fetchCatererReviewSummaries(
          results.map((c) => c.id),
        );
        if (request === version.current) {
          setReviews(summaries);
          setRatingsUnavailable(false);
        }
      } catch {
        if (request === version.current) {
          setReviews({});
          setRatingsUnavailable(true);
        }
      }
    } catch {
      if (request === version.current)
        setLoadError("Could not load caterers. Please retry.");
    } finally {
      if (request === version.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload(true);
    return () => {
      version.current++;
    };
  }, [reload, session?.user.id]);

  useEffect(() => {
    if (!showFilters) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowFilters(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [showFilters]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          caterers.map((c) => c.city?.trim()).filter((v): v is string => !!v),
        ),
      ].sort(),
    [caterers],
  );
  const eventTypes = useMemo(
    () =>
      [
        ...new Set(
          [
            "All",
            ...CATEGORIES.map((c) => c.label),
            ...caterers.flatMap((c) =>
              c.packages.flatMap((p) => p.event_types ?? []),
            ),
          ]
            .map(normalizeSearch)
            .filter(Boolean),
        ),
      ].map((v) => (v === "all" ? "All" : v[0].toUpperCase() + v.slice(1))),
    [caterers],
  );
  const visible = useMemo(
    () =>
      filterCaterers(caterers, {
        query,
        city,
        eventType: category,
        sort,
        ...(searched ? applied : emptyNumbers),
        mode: searched && matcherMode ? "starting-price" : "package-total",
      }),
    [caterers, query, city, category, sort, searched, matcherMode, applied],
  );
  const featured = useMemo(
    () =>
      visible
        .filter((c) => ["premium", "standard"].includes(c.subscription_plan))
        .sort(
          (a, b) =>
            (a.subscription_plan === "premium" ? 0 : 1) -
              (b.subscription_plan === "premium" ? 0 : 1) ||
            a.business_name.localeCompare(b.business_name),
        ),
    [visible],
  );
  const budgetPerGuest = useMemo(() => {
    try {
      const v = parseFilterNumbers("", budget, guests);
      return v.maxBudget !== null && v.guests !== null
        ? v.maxBudget / v.guests
        : null;
    } catch {
      return null;
    }
  }, [budget, guests]);
  const filtersActive =
    !!query.trim() ||
    category !== "All" ||
    !!budget ||
    !!guests ||
    !!minimum ||
    !!city ||
    sort !== "priority";

  const clearAll = () => {
    setQuery("");
    setCategory("All");
    setCity("");
    setSort("priority");
    setBudget("");
    setMinimum("");
    setGuests("");
    setSearched(false);
    setMatcherMode(false);
    setApplied(emptyNumbers);
    setMatcherError("");
    setFilterError("");
    setDraft({
      minimum: "",
      maximum: "",
      guests: "",
      city: "",
      event: "All",
      sort: "priority",
    });
    setShowFilters(false);
  };
  const openAdvanced = () => {
    setDraft({ minimum, maximum: budget, guests, city, event: category, sort });
    setFilterError("");
    setShowFilters(true);
  };
  const applyAdvanced = (event: FormEvent) => {
    event.preventDefault();
    try {
      const numbers = parseFilterNumbers(
        draft.minimum,
        draft.maximum,
        draft.guests,
      );
      setApplied(numbers);
      setSearched(Object.values(numbers).some((n) => n !== null));
      setMatcherMode(false);
      setMinimum(draft.minimum);
      setBudget(draft.maximum);
      setGuests(draft.guests);
      setCity(draft.city);
      setCategory(draft.event);
      setSort(draft.sort);
      setFilterError("");
      setMatcherError("");
      setShowFilters(false);
    } catch (error) {
      setFilterError(
        error instanceof Error ? error.message : "Check your filter values.",
      );
    }
  };
  const runMatcher = (event: FormEvent) => {
    event.preventDefault();
    try {
      const numbers = parseFilterNumbers("", budget, guests);
      if (numbers.maxBudget === null || numbers.guests === null)
        throw new Error(
          "Enter your total budget and a positive whole number of guests.",
        );
      setApplied(numbers);
      setSearched(true);
      setMatcherMode(true);
      setMatcherError("");
      setMinimum("");
      setCity("");
      setCategory("All");
      setQuery("");
      setSort("priority");
      browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setMatcherError(
        error instanceof Error
          ? error.message
          : "Check your budget and guests.",
      );
    }
  };
  const rating = (caterer: CatererWithPackages) => {
    const summary = reviews[caterer.id];
    if (ratingsUnavailable) return "Ratings unavailable";
    return summary?.count
      ? `${summary.avg.toFixed(1)} (${summary.count} reviews)`
      : "New · No reviews";
  };

  return (
    <div className="cc-market">
      <CustomerHeader activePage="marketplace" />

      <main className="cc-market-main" id="marketplace">
        <div className="cc-market-intro">
          <div>
            <span className="cc-market-eyebrow">
              <Sparkles size={13} /> CUSTOMER MARKETPLACE
            </span>
            <h1>Find the perfect caterer for your next celebration.</h1>
            <p>
              Explore verified catering businesses and published packages across
              Cebu.
            </p>
          </div>
          <div className="cc-market-greeting">
            Welcome
            {profile?.full_name
              ? `, ${profile.full_name.split(" ")[0]}`
              : ""}! <span>Discover something delicious today.</span>
          </div>
        </div>
        <div className="cc-market-search">
          <Search size={20} aria-hidden="true" />
          <input
            aria-label="Search caterers, dishes, or events"
            placeholder="Search caterers, dishes, or events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={17} />
            </button>
          )}
          <button
            type="button"
            className="cc-market-filter-button"
            onClick={openAdvanced}
          >
            <SlidersHorizontal size={17} /> <span>Filters</span>
          </button>
        </div>

        <section className="cc-market-hero">
          <div className="cc-market-hero-content">
            <span className="cc-market-hero-pill">
              <Sparkles size={14} /> CATERING MADE EASY
            </span>
            <h2>
              Book the <em>perfect</em>
              <br /> caterer for your special occasion.
            </h2>
            <p>Weddings · Birthdays · Corporate · And more</p>
            <button
              type="button"
              onClick={() =>
                browseRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              Browse caterers <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section className="cc-market-section">
          <div className="cc-market-section-heading">
            <h2>Explore by occasion</h2>
            <span>What are you celebrating?</span>
          </div>
          <div className="cc-market-categories">
            {CATEGORIES.map(({ label, Icon }) => (
              <button
                type="button"
                key={label}
                onClick={() => setCategory(label)}
                className={
                  category === label
                    ? "cc-market-category chosen"
                    : "cc-market-category"
                }
                aria-pressed={category === label}
              >
                <span>
                  <Icon size={22} />
                </span>
                <b>{label}</b>
              </button>
            ))}
          </div>
        </section>

        {loadError && (
          <div className="cc-market-alert" role="alert">
            {loadError}{" "}
            <button onClick={() => void reload()} type="button">
              Try again
            </button>
          </div>
        )}
        {ratingsUnavailable && (
          <div className="cc-market-soft-alert" role="status">
            Ratings are temporarily unavailable. Refresh to retry.
          </div>
        )}
        {loading && (
          <div className="cc-market-loading" role="status">
            <RefreshCw className="cc-market-spin" size={20} /> Loading approved
            caterers…
          </div>
        )}
        {!loading && featured.length > 0 && (
          <section className="cc-market-section">
            <div className="cc-market-section-heading">
              <h2>
                <Sparkles size={20} /> Featured Caterers
              </h2>
              <button
                type="button"
                className="cc-market-text-link"
                onClick={() => setShowAllFeatured((v) => !v)}
              >
                {showAllFeatured ? "Show less" : "See all"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="cc-market-featured-grid">
              {featured.slice(0, showAllFeatured ? undefined : 3).map((c) => (
                <article className="cc-market-featured" key={c.id}>
                  <div className="cc-market-cover">
                    {c.cover_photo_url ? (
                      <img src={c.cover_photo_url} alt="" loading="lazy" />
                    ) : (
                      <div className="cc-market-photo-placeholder">
                        <UtensilsCrossed size={35} />
                      </div>
                    )}
                    <span
                      className={`cc-market-plan cc-market-plan-${c.subscription_plan.toLowerCase()}`}
                    >
                      {c.subscription_plan.toUpperCase()}
                    </span>
                    <span className="cc-market-verified">
                      <ShieldCheck size={13} /> Verified
                    </span>
                  </div>
                  <div className="cc-market-featured-floating-logo" aria-hidden="true">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" loading="lazy" />
                    ) : (
                      <span className="cc-market-fallback-logo">
                        <Store size={22} />
                      </span>
                    )}
                  </div>
                  <div className="cc-market-featured-body">
                    <div className="cc-market-featured-title">
                      <h3>{c.business_name}</h3>
                    </div>
                    <div className="cc-market-meta">
                      {c.city && (
                        <span>
                          <MapPin size={14} />
                          {c.city}
                        </span>
                      )}
                      <span>
                        <Star size={14} />
                        {rating(c)}
                      </span>
                    </div>
                    <div className="cc-market-featured-bottom">
                      <span>
                        {getLowestPricePerGuest(c.packages) !== null ? (
                          <>
                            <b>{peso(getLowestPricePerGuest(c.packages)!)}</b>
                            <small> / guest (starting)</small>
                          </>
                        ) : (
                          <small>Packages available on request</small>
                        )}
                      </span>
                      <Link
                        to={`/customer/caterer/${encodeURIComponent(c.id)}`}
                      >
                        View details <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="cc-market-matcher">
          <div className="cc-market-matcher-title">
            <span className="cc-market-matcher-icon">
              <Zap size={25} />
            </span>
            <div>
              <h2>Smart Budget Matcher</h2>
              <p>
                Find caterers based on your total budget and expected number of
                guests.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cc-market-help"
            aria-expanded={showHelp}
            onClick={() => setShowHelp((v) => !v)}
          >
            <CircleHelp size={16} /> How does this work?{" "}
            <ChevronDown size={16} />
          </button>
          {showHelp && (
            <p className="cc-market-help-body">
              Enter your total event budget and expected number of guests.
              CaterConnect will automatically suggest catering packages based on
              how much you can spend per guest.{" "}
              <strong>
                Please note that these are suggested matches only. Final
                pricing, additional guest charges, and guest capacity will be
                confirmed during the booking process.
              </strong>
            </p>
          )}
          <form className="cc-market-matcher-form" onSubmit={runMatcher}>
            <label>
              Total budget (₱)
              <span>
                <b>₱</b>
                <input
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => {
                    setBudget(formatBudget(e.target.value));
                    setSearched(false);
                    setMatcherMode(false);
                    setMatcherError("");
                  }}
                  placeholder="e.g. 50,000"
                />
              </span>
            </label>
            <label>
              Number of guests
              <span>
                <UsersRound size={18} />
                <input
                  inputMode="numeric"
                  value={guests}
                  onChange={(e) => {
                    setGuests(e.target.value.replace(/\D/g, "").slice(0, 9));
                    setSearched(false);
                    setMatcherMode(false);
                    setMatcherError("");
                  }}
                  placeholder="e.g. 100"
                />
              </span>
            </label>
            <button type="submit">
              Find matching caterers <ArrowRight size={17} />
            </button>
          </form>
          {budgetPerGuest !== null && (
            <p className="cc-market-budget-result">
              Your budget per guest: <strong>{peso(budgetPerGuest)}</strong>
            </p>
          )}
          {matcherError && (
            <p className="cc-market-input-error" role="alert">
              {matcherError}
            </p>
          )}
        </section>

        <section className="cc-market-section" id="browse" ref={browseRef}>
          <div className="cc-market-section-heading">
            <div>
              <h2>
                {searched
                  ? `Matched Caterers (${visible.length})`
                  : `Browse All (${visible.length})`}
              </h2>
              <span>Only verified caterers are displayed</span>
            </div>
            <div className="cc-market-heading-actions">
              {filtersActive && (
                <button
                  type="button"
                  className="cc-market-text-link"
                  onClick={clearAll}
                >
                  Clear filters <X size={15} />
                </button>
              )}
              <button
                type="button"
                className="cc-market-refresh"
                onClick={() => void reload()}
                disabled={loading || refreshing}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "cc-market-spin" : ""}
                />{" "}
                Refresh
              </button>
            </div>
          </div>
          {!loading && (
            <>
              {visible.length === 0 ? (
                <div className="cc-market-empty">
                  <Store size={40} />
                  <h3>No caterers found</h3>
                  <p>
                    {searched && matcherMode
                      ? "No published package matches your starting per-guest budget. Try a higher budget."
                      : "Try changing your search, location, or event category."}
                  </p>
                  <button type="button" onClick={clearAll}>
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="cc-market-list-grid">
                  {visible.map((c) => {
                    const price = getLowestPricePerGuest(c.packages);
                    const total = lowestPackageTotal(
                      c.packages,
                      searched ? applied.guests : null,
                    );
                    return (
                      <article className="cc-market-list-card" key={c.id}>
                        <div className="cc-market-list-image">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" loading="lazy" />
                          ) : (
                            <UtensilsCrossed size={35} />
                          )}
                          <span
                            className={`cc-market-plan cc-market-plan-${c.subscription_plan.toLowerCase()}`}
                          >
                            {c.subscription_plan.toUpperCase()}
                          </span>
                        </div>
                        <div className="cc-market-list-details">
                          <div className="cc-market-name-row">
                            <h3>{c.business_name}</h3>
                            <span className="cc-market-mini-verified">
                              <CheckCircle2 size={14} /> Verified
                            </span>
                          </div>
                          <div className="cc-market-meta">
                            {c.city && (
                              <span>
                                <MapPin size={14} />
                                {c.city}
                              </span>
                            )}
                            <span>
                              <Star size={14} />
                              {rating(c)}
                            </span>
                          </div>
                          {c.business_description && (
                            <p className="cc-market-description">
                              {c.business_description}
                            </p>
                          )}
                          {!matcherMode &&
                            (searched ||
                              sort === "price-asc" ||
                              sort === "price-desc") &&
                            total !== null && (
                              <p className="cc-market-total">
                                Matching base package total from {peso(total)}
                              </p>
                            )}
                          <div className="cc-market-list-bottom">
                            <span>
                              {price === null ? (
                                "View packages for details"
                              ) : (
                                <>
                                  <b>{peso(price)}</b>
                                  <small> starting / guest</small>
                                </>
                              )}
                            </span>
                            <Link
                              to={`/customer/caterer/${encodeURIComponent(c.id)}`}
                            >
                              View details <ArrowRight size={15} />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <section className="cc-market-how" aria-labelledby="cc-market-how-title">
          <h2 id="cc-market-how-title">How CaterConnect Works</h2>
          <div className="cc-market-how-grid">
            {[
              {
                Icon: Compass,
                title: "Browse & Compare",
                text: "Find verified caterers in Cebu tailored to your needs.",
              },
              {
                Icon: ClipboardList,
                title: "Customize Package",
                text: "Select a package and tailor it to your guest list.",
              },
              {
                Icon: CreditCard,
                title: "Secure Payment",
                text: "Pay downpayments easily and safely via online payments.",
              },
              {
                Icon: PartyPopper,
                title: "Enjoy the Event",
                text: "Relax and let the professionals handle the feast.",
              },
            ].map(({ Icon, title, text }, index) => (
              <div className="cc-market-how-card" key={title}>
                <span className="cc-market-how-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <small>STEP {index + 1}</small>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showFilters && (
        <div
          className="cc-market-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowFilters(false);
          }}
        >
          <section
            className="cc-market-dialog cc-market-filter-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search filters"
          >
            <div className="cc-market-dialog-header">
              <h2>Search Filters</h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
              >
                <X />
              </button>
            </div>
            <form onSubmit={applyAdvanced}>
              <p className="cc-market-filter-note">
                Budgets are calculated from fixed package prices and extra-guest
                charges. Optional menu additions are not included.
              </p>
              <div className="cc-market-filter-fields">
                <label>
                  Minimum budget (₱)
                  <input
                    value={draft.minimum}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        minimum: formatBudget(e.target.value),
                      }))
                    }
                    placeholder="No minimum"
                  />
                </label>
                <label>
                  Maximum budget (₱)
                  <input
                    value={draft.maximum}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        maximum: formatBudget(e.target.value),
                      }))
                    }
                    placeholder="No maximum"
                  />
                </label>
                <label>
                  Guests
                  <input
                    inputMode="numeric"
                    value={draft.guests}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        guests: e.target.value.replace(/\D/g, "").slice(0, 9),
                      }))
                    }
                    placeholder="Any guest count"
                  />
                </label>
                <label>
                  Caterer city
                  <select
                    value={draft.city}
                    onChange={(e) =>
                      setDraft((v) => ({ ...v, city: e.target.value }))
                    }
                  >
                    <option value="">All listed cities</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Event type
                  <select
                    value={draft.event}
                    onChange={(e) =>
                      setDraft((v) => ({ ...v, event: e.target.value }))
                    }
                  >
                    {eventTypes.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    value={draft.sort}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        sort: e.target.value as CatererSort,
                      }))
                    }
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="cc-market-filter-note">
                City matches the listed business city, not its delivery
                coverage. The matcher uses a different per-guest discovery rule.
              </p>
              {filterError && (
                <p className="cc-market-input-error" role="alert">
                  {filterError}
                </p>
              )}
              <div className="cc-market-dialog-footer">
                <button
                  type="button"
                  className="cc-market-reset"
                  onClick={clearAll}
                >
                  Reset all
                </button>
                <button type="submit" className="cc-market-apply">
                  Apply filters <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
