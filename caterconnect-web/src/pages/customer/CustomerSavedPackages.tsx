import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  LoaderCircle,
  Package,
  RefreshCw,
  Scale,
  Trash2,
  X,
  AlertCircle,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchCustomerSavedPackages,
  removeCustomerSavedPackage,
  fetchSavedComparison,
  type CustomerSavedRow,
  type SavedCompareRow,
} from "../../lib/customerSavedPackages";
import CustomerHeader from "./CustomerHeader";
import "./CustomerSavedPackages.css";

const peso = (amount: number) =>
  Number(amount).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });

function SavedImage({ src, label }: { src: string | null; label: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    <img
      className="cc-saved-photo"
      src={src}
      alt={label}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  ) : (
    <div className="cc-saved-photo cc-saved-placeholder">
      <Package size={38} />
      <span>No package image</span>
    </div>
  );
}

export default function CustomerSavedPackages() {
  const { session, profile } = useAuth();
  const customerId =
    session?.user?.id &&
    profile?.id === session.user.id &&
    profile.role === "customer"
      ? session.user.id
      : null;
  const identity = useRef(customerId);
  identity.current = customerId;
  const generation = useRef(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerSavedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const locks = useRef(new Set<string>());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareRows, setCompareRows] = useState<SavedCompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!customerId || identity.current !== customerId) return;
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const saved = await fetchCustomerSavedPackages(customerId);
      if (request !== generation.current || identity.current !== customerId)
        return;
      setOwner(customerId);
      setRows(saved);
      setCompareIds((previous) =>
        previous.filter((id) =>
          saved.some((item) => item.package_id === id && item.package),
        ),
      );
    } catch (cause) {
      if (request !== generation.current || identity.current !== customerId)
        return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load saved packages.",
      );
    } finally {
      if (request === generation.current && identity.current === customerId)
        setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    generation.current++;
    locks.current.clear();
    setOwner(null);
    setRows([]);
    setError("");
    setActionError("");
    setPending(new Set());
    setCompareIds([]);
    setCompareOpen(false);
    setCompareRows([]);
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);

  useEffect(() => {
    if (!compareOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompareOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compareOpen]);

  const removeSaved = async (packageId: string) => {
    if (!customerId || locks.current.has(packageId)) return;
    const account = customerId;
    locks.current.add(packageId);
    setPending((old) => new Set(old).add(packageId));
    setActionError("");
    try {
      await removeCustomerSavedPackage(account, packageId);
      if (identity.current !== account) return;
      generation.current++; // Never let an older refresh restore the removed row.
      setRows((old) => old.filter((item) => item.package_id !== packageId));
      setCompareIds((old) => old.filter((id) => id !== packageId));
    } catch (cause) {
      if (identity.current === account)
        setActionError(
          cause instanceof Error
            ? cause.message
            : "Could not remove saved package.",
        );
    } finally {
      locks.current.delete(packageId);
      if (identity.current === account)
        setPending((old) => {
          const next = new Set(old);
          next.delete(packageId);
          return next;
        });
    }
  };

  const toggleCompare = (id: string) => {
    setActionError("");
    setCompareIds((previous) => {
      if (previous.includes(id))
        return previous.filter((value) => value !== id);
      if (previous.length >= 3) {
        setActionError(
          "You can compare up to 3 saved packages. Remove one first.",
        );
        return previous;
      }
      return [...previous, id];
    });
  };

  const showCompare = async () => {
    if (!customerId || compareIds.length < 2 || compareLoading) return;
    const account = customerId;
    setCompareLoading(true);
    setActionError("");
    try {
      const data = await fetchSavedComparison(account, compareIds);
      if (identity.current !== account) return;
      setCompareRows(data);
      setCompareOpen(true);
    } catch (cause) {
      if (identity.current === account)
        setActionError(
          cause instanceof Error
            ? cause.message
            : "Could not compare these packages.",
        );
    } finally {
      if (identity.current === account) setCompareLoading(false);
    }
  };

  const visibleRows = owner === customerId ? rows : [];
  return (
    <div className="cc-saved-page">
      <CustomerHeader activePage="saved" />
      <main className="cc-saved-main">
        <Link className="cc-saved-back" to="/customer">
          <ArrowLeft size={17} /> Back to Marketplace
        </Link>
        <div className="cc-saved-heading">
          <div>
            <span className="cc-saved-eyebrow">
              <Heart size={15} /> YOUR FAVORITES
            </span>
            <h1>Saved Packages</h1>
            <p>
              Keep your favorite catering packages in one place and compare them
              before booking.
            </p>
          </div>
          <button
            className="cc-saved-refresh"
            type="button"
            disabled={loading || !customerId}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={18}
              className={loading ? "cc-saved-spinning" : ""}
            />{" "}
            Refresh
          </button>
        </div>

        {!customerId && (
          <div className="cc-saved-notice">
            <AlertCircle size={21} /> Sign in with a Customer account to view
            saved packages.
          </div>
        )}
        {error && (
          <div className="cc-saved-notice" role="alert">
            <AlertCircle size={21} /> <span>{error}</span>
            <button type="button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        )}
        {actionError && (
          <div className="cc-saved-notice" role="alert">
            <AlertCircle size={21} />
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")}>
              Dismiss
            </button>
          </div>
        )}
        {customerId && loading && owner !== customerId && (
          <div className="cc-saved-loading">
            <LoaderCircle className="cc-saved-spinning" size={25} /> Loading
            your saved packages...
          </div>
        )}
        {customerId && !loading && !error && visibleRows.length === 0 && (
          <div className="cc-saved-empty">
            <Heart size={52} />
            <h2>No saved packages yet</h2>
            <p>
              Tap the heart on a caterer's package to save it here for later.
            </p>
            <Link to="/customer">
              Explore Caterers <ArrowRight size={18} />
            </Link>
          </div>
        )}
        {visibleRows.length > 0 && (
          <>
            <div className="cc-saved-count">
              <strong>
                {visibleRows.length} saved{" "}
                {visibleRows.length === 1 ? "package" : "packages"}
              </strong>
              <span>Select 2–3 available packages to compare.</span>
            </div>
            <div className="cc-saved-grid">
              {visibleRows.map((row) => {
                const pkg = row.package;
                const removing = pending.has(row.package_id);
                const selected = compareIds.includes(row.package_id);
                return (
                  <article className="cc-saved-card" key={row.package_id}>
                    {pkg ? (
                      <>
                        <Link
                          className="cc-saved-card-image-link"
                          to={`/customer/caterer/${encodeURIComponent(pkg.caterer_id)}?packageId=${encodeURIComponent(pkg.id)}`}
                          aria-label={`Open ${pkg.name}`}
                        >
                          <SavedImage src={pkg.image_url} label={pkg.name} />
                        </Link>
                        <div className="cc-saved-card-body">
                          <span className="cc-saved-caterer">
                            <Store size={15} /> {pkg.business_name}
                          </span>
                          <h2>{pkg.name}</h2>
                          <strong className="cc-saved-price">
                            {peso(pkg.price)}
                          </strong>
                          <p className="cc-saved-capacity">
                            <Users size={17} /> {pkg.guest_capacity} guests
                            included · maximum {pkg.max_guests}
                          </p>
                          <Link
                            className="cc-saved-view"
                            to={`/customer/caterer/${encodeURIComponent(pkg.caterer_id)}?packageId=${encodeURIComponent(pkg.id)}`}
                          >
                            View Package <ArrowRight size={17} />
                          </Link>
                          <button
                            className={`cc-saved-select ${selected ? "selected" : ""}`}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleCompare(pkg.id)}
                          >
                            {selected ? (
                              <CheckCircle2 size={18} />
                            ) : (
                              <Scale size={18} />
                            )}
                            {selected
                              ? "Selected to Compare"
                              : "Select to Compare"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="cc-saved-card-body cc-saved-unavailable">
                        <Package size={34} />
                        <h2>Package unavailable</h2>
                        <p>
                          This package may have been removed, unpublished, or is
                          no longer accessible.
                        </p>
                      </div>
                    )}
                    <button
                      className="cc-saved-remove"
                      type="button"
                      disabled={removing}
                      onClick={() => void removeSaved(row.package_id)}
                      aria-label={
                        pkg
                          ? `Remove ${pkg.name} from saved`
                          : "Remove unavailable saved package"
                      }
                    >
                      {removing ? (
                        <LoaderCircle size={17} className="cc-saved-spinning" />
                      ) : (
                        <Trash2 size={17} />
                      )}
                      {removing ? "Removing..." : "Remove from Saved"}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
      {compareIds.length > 0 && (
        <div
          className="cc-saved-compare-tray"
          role="region"
          aria-label="Selected packages for comparison"
        >
          <div>
            <Scale size={21} />
            <strong>{compareIds.length} of 3 selected</strong>
            <span>Compare your favorite packages</span>
          </div>
          <button
            type="button"
            className="cc-saved-clear"
            onClick={() => setCompareIds([])}
          >
            Clear
          </button>
          <button
            type="button"
            className="cc-saved-compare-action"
            disabled={compareIds.length < 2 || compareLoading}
            onClick={() => void showCompare()}
          >
            {compareLoading ? (
              <LoaderCircle size={18} className="cc-saved-spinning" />
            ) : (
              <Scale size={18} />
            )}
            Compare Selected
          </button>
        </div>
      )}
      {compareOpen && (
        <div
          className="cc-saved-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCompareOpen(false);
          }}
        >
          <section
            className="cc-saved-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-saved-compare-title"
          >
            <header>
              <div>
                <h2 id="cc-saved-compare-title">Compare Saved Packages</h2>
                <p>
                  Compare prices, capacity, and inclusions before choosing a
                  package.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close comparison"
                onClick={() => setCompareOpen(false)}
              >
                <X size={22} />
              </button>
            </header>
            <div className="cc-saved-table-scroller">
              <table className="cc-saved-table">
                <thead>
                  <tr>
                    <th scope="col">Details</th>
                    {compareRows.map((p) => (
                      <th scope="col" key={p.id}>
                        {p.name}
                        <small>{p.business_name}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Price", (p: SavedCompareRow) => peso(p.price)],
                    [
                      "Included guests",
                      (p: SavedCompareRow) => String(p.guest_capacity),
                    ],
                    [
                      "Minimum guests",
                      (p: SavedCompareRow) =>
                        p.min_guests == null
                          ? "Not specified"
                          : String(p.min_guests),
                    ],
                    [
                      "Maximum guests",
                      (p: SavedCompareRow) => String(p.max_guests),
                    ],
                    [
                      "Package tier",
                      (p: SavedCompareRow) => p.tier || "Not specified",
                    ],
                    [
                      "Description",
                      (p: SavedCompareRow) => p.description || "Not specified",
                    ],
                    [
                      "Food inclusions",
                      (p: SavedCompareRow) =>
                        p.food_inclusions?.join(" • ") || "Not specified",
                    ],
                    [
                      "Other inclusions",
                      (p: SavedCompareRow) =>
                        p.includes?.join(" • ") || "Not specified",
                    ],
                    [
                      "Event types",
                      (p: SavedCompareRow) =>
                        p.event_types?.join(" • ") || "Not specified",
                    ],
                  ].map(([label, format]) => (
                    <tr key={label as string}>
                      <th scope="row">{label as string}</th>
                      {compareRows.map((p) => (
                        <td key={p.id}>
                          {(format as (value: SavedCompareRow) => string)(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <button type="button" onClick={() => setCompareOpen(false)}>
                Close Comparison
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
