import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Heart,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Scale,
  ShieldCheck,
  Soup,
  Star,
  Store,
  UtensilsCrossed,
  Cake,
  Wine,
  MessageSquareText,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchCustomerCatererDetails,
  loadCustomerBookmarkIds,
  setCustomerPackageSaved,
  type DetailData,
  type DetailPackage,
} from "../../lib/customerCatererDetails";
import CustomerHeader from "./CustomerHeader";
import "./customerCatererDetails.css";

type Tab = "packages" | "menu" | "reviews";
const money = (n: number) =>
  Number(n).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
const tiers: Record<string, { background: string; color: string }> = {
  bronze: { background: "#FEF3C7", color: "#B45309" },
  silver: { background: "#F3F4F6", color: "#4B5563" },
  gold: { background: "#FEF08A", color: "#9A6700" },
  premium: { background: "#EDE9FE", color: "#6D28D9" },
};
const categories = [
  { key: "main_course", label: "Main Course", Icon: UtensilsCrossed },
  { key: "appetizer", label: "Appetizer", Icon: Soup },
  { key: "dessert", label: "Dessert", Icon: Cake },
  { key: "drink", label: "Drink", Icon: Wine },
];
function Stars({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value) || value < 1 || value > 5)
    return <span className="cc-detail-muted">Not rated</span>;
  return (
    <span
      className="cc-detail-stars"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={15}
          fill={i <= Math.round(value) ? "#F59E0B" : "none"}
          color={i <= Math.round(value) ? "#F59E0B" : "#D1D5DB"}
        />
      ))}
    </span>
  );
}
export default function CustomerCatererDetails() {
  const navigate = useNavigate();
  const { catererId } = useParams<{ catererId: string }>();
  const [searchParams] = useSearchParams();
  const focusPackageId = searchParams.get("packageId");
  const { session, profile } = useAuth();
  const customerId =
    session?.user?.id &&
    profile?.role === "customer" &&
    profile.id === session.user.id
      ? session.user.id
      : null;
  const [details, setDetails] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("packages");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkError, setBookmarkError] = useState("");
  const [bookmarkLoading, setBookmarkLoading] = useState(true);
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const version = useRef(0);
  const bookmarkVersion = useRef(0);

  const reload = useCallback(async () => {
    const id = catererId;
    if (!id) return;
    const request = ++version.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetchCustomerCatererDetails(id);
      if (request === version.current) {
        setDetails(response);
        setCompareIds([]);
        setShowComparison(false);
      }
    } catch (cause) {
      if (request === version.current)
        setError(
          cause instanceof Error ? cause.message : "Could not load caterer.",
        );
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [catererId]);
  useEffect(() => {
    void reload();
    return () => {
      version.current++;
    };
  }, [reload]);

  const refreshBookmarks = useCallback(async () => {
    const request = ++bookmarkVersion.current;
    setBookmarkError("");
    setBookmarkLoading(true);
    if (!customerId) {
      setBookmarks(new Set());
      setBookmarkLoading(false);
      return;
    }
    try {
      const ids = await loadCustomerBookmarkIds(customerId);
      if (request === bookmarkVersion.current) setBookmarks(ids);
    } catch (cause) {
      if (request === bookmarkVersion.current)
        setBookmarkError(
          cause instanceof Error
            ? cause.message
            : "Saved packages unavailable.",
        );
    } finally {
      if (request === bookmarkVersion.current) setBookmarkLoading(false);
    }
  }, [customerId]);
  useEffect(() => {
    setBookmarks(new Set());
    void refreshBookmarks();
    return () => {
      bookmarkVersion.current++;
    };
  }, [refreshBookmarks]);

  const toggleSave = async (pkg: DetailPackage) => {
    if (!customerId || mutating.has(pkg.id) || bookmarkLoading || bookmarkError)
      return;
    const save = !bookmarks.has(pkg.id);
    setMutating((prev) => new Set(prev).add(pkg.id));
    try {
      await setCustomerPackageSaved(customerId, pkg.id, save);
      const current = await import("../../lib/supabase").then(({ supabase }) =>
        supabase.auth.getUser(),
      );
      if (current.data.user?.id === customerId)
        setBookmarks((prev) => {
          const copy = new Set(prev);
          if (save) copy.add(pkg.id);
          else copy.delete(pkg.id);
          return copy;
        });
      setBookmarkError("");
    } catch (cause) {
      setBookmarkError(
        cause instanceof Error
          ? cause.message
          : "Could not update saved package.",
      );
    } finally {
      setMutating((prev) => {
        const copy = new Set(prev);
        copy.delete(pkg.id);
        return copy;
      });
    }
  };
  const toggleCompare = (id: string) => {
    setCompareError("");
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length === 3) {
        setCompareError("You can compare up to 3 packages. Remove one first.");
        return prev;
      }
      return [...prev, id];
    });
  };
  const packages = details?.packages ?? [];
  const compared = useMemo(
    () => packages.filter((pkg) => compareIds.includes(pkg.id)),
    [packages, compareIds],
  );
  const validRatings = useMemo(
    () =>
      (details?.reviews ?? [])
        .map((r) => Number(r.overall))
        .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5),
    [details?.reviews],
  );
  const displayedRating = validRatings.length
    ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
    : null;
  const lowest = packages
    .map((p) =>
      p.guest_capacity > 0 ? Number(p.price) / p.guest_capacity : NaN,
    )
    .filter(Number.isFinite);
  const lowestPrice = lowest.length ? Math.min(...lowest) : null;

  return (
    <div className="cc-detail">
      <CustomerHeader activePage="marketplace" />
      <main className="cc-detail-main">
        <Link className="cc-detail-breadcrumb" to="/customer">
          <ArrowLeft size={17} /> Back to Marketplace
        </Link>
        {loading && (
          <div className="cc-detail-state">
            <RefreshCw className="cc-detail-spin" size={27} /> Loading caterer
            details...
          </div>
        )}
        {!loading && error && (
          <div className="cc-detail-state" role="alert">
            <AlertCircle size={24} />
            <p>{error}</p>
            <button onClick={() => void reload()}>Try again</button>
          </div>
        )}
        {!loading && !error && !details && (
          <div className="cc-detail-state">
            <Store size={36} />
            <h2>Caterer not found</h2>
            <p>This business may be unavailable or is no longer verified.</p>
            <Link to="/customer">Browse caterers</Link>
          </div>
        )}
        {!loading && !error && details && (
          <>
            <section className="cc-detail-cover">
              {details.caterer.cover_photo_url ? (
                <img src={details.caterer.cover_photo_url} alt="" />
              ) : (
                <div className="cc-detail-cover-placeholder">
                  <Store size={68} />
                </div>
              )}
              <span className="cc-detail-plan">
                {details.caterer.subscription_plan.toUpperCase()} PLAN
              </span>
            </section>
            <section className="cc-detail-profile">
              <div className="cc-detail-logo">
                {details.caterer.logo_url ? (
                  <img src={details.caterer.logo_url} alt="" />
                ) : (
                  <Store size={30} />
                )}
              </div>
              <div className="cc-detail-profile-body">
                <div className="cc-detail-title-row">
                  <h1>{details.caterer.business_name}</h1>
                  <span className="cc-detail-verified">
                    <ShieldCheck size={15} /> Verified
                  </span>
                </div>
                <div className="cc-detail-meta">
                  {details.caterer.city && (
                    <span>
                      <MapPin size={16} />
                      {details.caterer.city}
                    </span>
                  )}
                  <span>
                    <Stars value={displayedRating} />
                    {displayedRating === null
                      ? "No reviews yet"
                      : `${displayedRating.toFixed(1)} (recent reviews)`}
                  </span>
                </div>
              </div>
            </section>
            <section className="cc-detail-stats">
              <div>
                <strong>{packages.length}</strong>
                <small>Published Packages</small>
              </div>
              <div>
                <strong>{details.menu.length}</strong>
                <small>Menu Items</small>
              </div>
              <div>
                <strong>{Number(details.caterer.downpayment_percent)}%</strong>
                <small>Downpayment</small>
              </div>
            </section>
            <div className="cc-detail-cols">
              <div>
                {details.caterer.business_description && (
                  <section className="cc-detail-section">
                    <h2>About</h2>
                    <p className="cc-detail-paragraph">
                      {details.caterer.business_description}
                    </p>
                  </section>
                )}
                <section className="cc-detail-section">
                  <h2>Packages, Menu & Reviews</h2>
                  <div
                    className="cc-detail-tabs"
                    role="tablist"
                    aria-label="Caterer details"
                  >
                    {(["packages", "menu", "reviews"] as const).map((value) => (
                      <button
                        key={value}
                        id={`cc-detail-tab-${value}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        aria-controls={`cc-detail-panel-${value}`}
                        className={tab === value ? "active" : ""}
                        onClick={() => setTab(value)}
                      >
                        {value === "packages" ? (
                          <Package size={17} />
                        ) : value === "menu" ? (
                          <UtensilsCrossed size={17} />
                        ) : (
                          <Star size={17} />
                        )}{" "}
                        {value === "packages"
                          ? "Packages"
                          : value === "menu"
                            ? "Menu"
                            : "Reviews"}
                      </button>
                    ))}
                  </div>
                  <div
                    id={`cc-detail-panel-${tab}`}
                    role="tabpanel"
                    aria-labelledby={`cc-detail-tab-${tab}`}
                  >
                    {tab === "packages" && (
                      <>
                        {bookmarkError && (
                          <div className="cc-detail-warning" role="alert">
                            Saved packages: {bookmarkError}{" "}
                            <button onClick={() => void refreshBookmarks()}>
                              Retry
                            </button>
                          </div>
                        )}
                        {!packages.length && (
                          <div className="cc-detail-empty">
                            <Package size={32} /> No published packages are
                            currently available.
                          </div>
                        )}
                        <div className="cc-detail-packages">
                          {packages.map((pkg) => (
                            <article
                              className={`cc-detail-package ${pkg.id === focusPackageId ? "cc-detail-highlight" : ""}`}
                              key={pkg.id}
                            >
                              {pkg.image_url ? (
                                <img
                                  className="cc-detail-package-image"
                                  src={pkg.image_url}
                                  alt={pkg.name}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="cc-detail-package-image cc-detail-package-fallback">
                                  <UtensilsCrossed size={37} />
                                </div>
                              )}
                              <div className="cc-detail-package-content">
                                <div className="cc-detail-package-actions">
                                  <span
                                    className="cc-detail-tier"
                                    style={
                                      tiers[pkg.tier.toLowerCase()] ??
                                      tiers.bronze
                                    }
                                  >
                                    {pkg.tier}
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      className={
                                        compareIds.includes(pkg.id)
                                          ? "cc-detail-icon-button chosen"
                                          : "cc-detail-icon-button"
                                      }
                                      aria-pressed={compareIds.includes(pkg.id)}
                                      onClick={() => toggleCompare(pkg.id)}
                                      title="Compare package"
                                    >
                                      <Scale size={17} />{" "}
                                      {compareIds.includes(pkg.id)
                                        ? "Selected"
                                        : "Compare"}
                                    </button>
                                    <button
                                      type="button"
                                      className="cc-detail-icon-button"
                                      disabled={
                                        !customerId ||
                                        bookmarkLoading ||
                                        mutating.has(pkg.id) ||
                                        !!bookmarkError
                                      }
                                      aria-pressed={bookmarks.has(pkg.id)}
                                      aria-label={
                                        bookmarks.has(pkg.id)
                                          ? `Remove ${pkg.name} from saved packages`
                                          : `Save ${pkg.name}`
                                      }
                                      title={
                                        bookmarks.has(pkg.id)
                                          ? "Remove saved package"
                                          : "Save package"
                                      }
                                      onClick={() => void toggleSave(pkg)}
                                    >
                                      <Heart
                                        size={18}
                                        color="#F97316"
                                        fill={
                                          bookmarks.has(pkg.id)
                                            ? "#F97316"
                                            : "none"
                                        }
                                      />
                                    </button>
                                  </div>
                                </div>
                                <div className="cc-detail-package-title">
                                  <div>
                                    <h3>{pkg.name}</h3>
                                    <p>
                                      {pkg.guest_capacity} guests included · up
                                      to {pkg.max_guests} guests
                                      {pkg.min_guests
                                        ? ` · minimum ${pkg.min_guests}`
                                        : ""}
                                    </p>
                                  </div>
                                  <div className="cc-detail-price">
                                    <strong>{money(Number(pkg.price))}</strong>
                                    {pkg.guest_capacity > 0 && (
                                      <small>
                                        ≈{" "}
                                        {money(
                                          Number(pkg.price) /
                                            pkg.guest_capacity,
                                        )}{" "}
                                        / guest
                                      </small>
                                    )}
                                  </div>
                                </div>
                                {pkg.description && (
                                  <p className="cc-detail-paragraph">
                                    {pkg.description}
                                  </p>
                                )}
                                {pkg.food_inclusions?.length ? (
                                  <div className="cc-detail-inclusions">
                                    <b>FOOD INCLUSIONS</b>
                                    {pkg.food_inclusions.map((item, i) => (
                                      <span key={i}>
                                        <UtensilsCrossed size={14} />
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {pkg.includes?.length ? (
                                  <div className="cc-detail-inclusions">
                                    <b>PACKAGE INCLUSIONS</b>
                                    {pkg.includes.map((item, i) => (
                                      <span key={i}>
                                        <CheckCircle2 size={14} />
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {pkg.event_types?.length ? (
                                  <div className="cc-detail-event-types">
                                    <b>SUITABLE FOR</b>
                                    <div>
                                      {pkg.event_types.map((event, i) => (
                                        <span key={i}>{event}</span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                <button
                                  className="cc-detail-book"
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/customer/book/${encodeURIComponent(catererId ?? "")}?packageId=${encodeURIComponent(pkg.id)}`,
                                    )
                                  }
                                >
                                  Book This Package <ChevronRight size={17} />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                        {compareError && (
                          <p className="cc-detail-warning" role="alert">
                            {compareError}
                          </p>
                        )}
                        {compareIds.length > 0 && (
                          <div className="cc-detail-compare-bar">
                            <div>
                              <Scale size={18} />
                              <strong>
                                {compareIds.length} of 3 packages selected
                              </strong>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCompareIds([]);
                                  setShowComparison(false);
                                }}
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                disabled={compareIds.length < 2}
                                onClick={() => setShowComparison(true)}
                              >
                                Compare Selected <ArrowRight size={17} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {tab === "menu" && (
                      <>
                        {details.menuWarning && (
                          <p className="cc-detail-warning">
                            Menu items could not be loaded. Refresh to try
                            again.
                          </p>
                        )}
                        {!details.menu.length && !details.menuWarning && (
                          <div className="cc-detail-empty">
                            <UtensilsCrossed size={30} /> No menu items added
                            yet.
                          </div>
                        )}
                        {categories.map(({ key, label, Icon }) => {
                          const items = details.menu.filter(
                            (item) => item.category === key,
                          );
                          return items.length ? (
                            <section className="cc-detail-menu-group" key={key}>
                              <h3>
                                <Icon size={20} />
                                {label}
                                <small>{items.length}</small>
                              </h3>
                              <div className="cc-detail-menu-grid">
                                {items.map((item) => (
                                  <article
                                    className="cc-detail-menu-item"
                                    key={item.id}
                                  >
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt=""
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="cc-detail-menu-placeholder">
                                        <Icon size={26} />
                                      </div>
                                    )}
                                    <div>
                                      <div className="cc-detail-menu-title">
                                        <strong>{item.name}</strong>
                                        <b>
                                          {money(Number(item.price_per_guest))}
                                        </b>
                                      </div>
                                      {item.description && (
                                        <p>{item.description}</p>
                                      )}
                                      <small>
                                        Per guest
                                        {item.serving_size || item.serving_unit
                                          ? ` · ${item.serving_size ?? ""} ${item.serving_unit ?? ""}`
                                          : ""}
                                      </small>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </section>
                          ) : null;
                        })}
                      </>
                    )}
                    {tab === "reviews" && (
                      <>
                        {details.reviewsWarning && (
                          <p className="cc-detail-warning">
                            Reviews could not be loaded. Refresh to try again.
                          </p>
                        )}
                        {!details.reviews.length && !details.reviewsWarning && (
                          <div className="cc-detail-empty">
                            <Star size={32} /> No reviews yet.
                          </div>
                        )}
                        {details.reviews.map((review) => (
                          <article className="cc-detail-review" key={review.id}>
                            <div className="cc-detail-review-head">
                              <div className="cc-detail-avatar">
                                {review.profiles?.avatar_url ? (
                                  <img
                                    src={review.profiles.avatar_url}
                                    alt=""
                                  />
                                ) : (
                                  review.profiles?.full_name?.[0] || "C"
                                )}
                              </div>
                              <div>
                                <b>
                                  {review.profiles?.full_name || "Customer"}
                                </b>
                                <small>
                                  {new Date(
                                    review.created_at,
                                  ).toLocaleDateString("en-PH", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </small>
                              </div>
                              <div className="cc-detail-review-score">
                                <Stars value={review.overall} />
                              </div>
                            </div>
                            <div className="cc-detail-breakdown">
                              {[
                                { label: "Food", value: review.food_quality },
                                {
                                  label: "Service",
                                  value: review.service_quality,
                                },
                                {
                                  label: "Timeliness",
                                  value: review.timeliness,
                                },
                              ].map((s) => (
                                <span key={s.label}>
                                  {s.label}:{" "}
                                  {s.value === null
                                    ? "—"
                                    : Number(s.value).toFixed(1)}
                                </span>
                              ))}
                            </div>
                            {review.comment && <p>{review.comment}</p>}
                            {review.caterer_reply && (
                              <div className="cc-detail-reply">
                                <b>
                                  <MessageSquareText size={14} /> Caterer
                                  response
                                </b>
                                <p>{review.caterer_reply}</p>
                              </div>
                            )}
                          </article>
                        ))}
                      </>
                    )}
                  </div>
                </section>
              </div>
              <aside className="cc-detail-aside">
                <section className="cc-detail-sidecard">
                  <h2>Contact & Location</h2>
                  {details.caterer.city && (
                    <p>
                      <MapPin size={17} />
                      {details.caterer.city}
                    </p>
                  )}
                  {details.caterer.address && (
                    <p>
                      <MapPin size={17} />
                      {details.caterer.address}
                    </p>
                  )}
                  {details.caterer.contact_phone && (
                    <p>
                      <Phone size={17} />
                      {details.caterer.contact_phone}
                    </p>
                  )}
                  {details.caterer.contact_email && (
                    <p>
                      <Mail size={17} />
                      {details.caterer.contact_email}
                    </p>
                  )}
                  {!details.caterer.address &&
                    !details.caterer.contact_phone &&
                    !details.caterer.contact_email && (
                      <p>No contact details provided.</p>
                    )}
                </section>
                <section className="cc-detail-sidecard cc-detail-book-panel">
                  <span>Starting at</span>
                  <strong>
                    {lowestPrice === null
                      ? "On request"
                      : `${money(lowestPrice)} / guest`}
                  </strong>
                  <small>
                    Published starting price only. Total depends on guest count
                    and customizations.
                  </small>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/customer/book/${encodeURIComponent(catererId ?? "")}`,
                      )
                    }
                  >
                    Book Now <ArrowRight size={17} />
                  </button>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      {showComparison && (
        <div
          className="cc-detail-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowComparison(false);
          }}
        >
          <section
            className="cc-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Compare selected catering packages"
          >
            <div className="cc-detail-modal-head">
              <h2>Compare Packages</h2>
              <button
                onClick={() => setShowComparison(false)}
                aria-label="Close comparison"
              >
                ×
              </button>
            </div>
            <div className="cc-detail-compare-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    {compared.map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Price", (p: DetailPackage) => money(Number(p.price))],
                    ["Tier", (p: DetailPackage) => p.tier],
                    [
                      "Included Guests",
                      (p: DetailPackage) => String(p.guest_capacity),
                    ],
                    [
                      "Minimum Guests",
                      (p: DetailPackage) =>
                        String(p.min_guests ?? "Not specified"),
                    ],
                    [
                      "Maximum Guests",
                      (p: DetailPackage) => String(p.max_guests),
                    ],
                    [
                      "Food Inclusions",
                      (p: DetailPackage) =>
                        p.food_inclusions?.join(", ") || "Not specified",
                    ],
                    [
                      "Package Inclusions",
                      (p: DetailPackage) =>
                        p.includes?.join(", ") || "Not specified",
                    ],
                    [
                      "Event Types",
                      (p: DetailPackage) =>
                        p.event_types?.join(", ") || "Not specified",
                    ],
                  ].map(([name, getter]) => (
                    <tr key={name as string}>
                      <th>{name as string}</th>
                      {compared.map((pkg) => (
                        <td key={pkg.id}>
                          {(getter as (p: DetailPackage) => string)(pkg)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
