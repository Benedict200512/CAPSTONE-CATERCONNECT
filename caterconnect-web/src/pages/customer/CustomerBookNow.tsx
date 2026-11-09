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
  ClipboardCheck,
  MapPin,
  RefreshCw,
  Users,
  Plus,
  Minus,
  UtensilsCrossed,
  Soup,
  Cake,
  Wine,
  CalendarDays,
  Package as PackageIcon,
  CreditCard,
  Sparkles,
  Info,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  fetchCustomerCatererDetails,
  type DetailData,
  type DetailMenuItem,
} from "../../lib/customerCatererDetails";
import {
  calculatePackagePricing,
  packageGuestBounds,
} from "../../lib/packagePricing";
import { fetchUnavailableDates, manilaToday } from "../../lib/availability";
import { requirePublishedPackage } from "../../lib/packagePublication";
import CustomerHeader from "./CustomerHeader";
import CustomerAvailabilityCalendar from "./CustomerAvailabilityCalendar";
import CustomerVenueMapPicker from "./CustomerVenueMapPicker";
import "./CustomerBookNow.css";
import "./CustomerBookingCustomization.css";

const EVENTS = [
  "Wedding",
  "Birthday",
  "Debut",
  "Corporate",
  "Anniversary",
  "Party",
  "Other",
];
const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );
const steps = ["Package", "Event Details", "Customize", "Review"];
const MENU_CATEGORIES = [
  { key: "main_course", label: "Main Course", Icon: UtensilsCrossed },
  { key: "appetizer", label: "Appetizer", Icon: Soup },
  { key: "dessert", label: "Dessert", Icon: Cake },
  { key: "drink", label: "Drink", Icon: Wine },
] as const;
type CustomSelection = { id: string; quantity: number };
const MAX_ADD_ON_ITEMS = 100;
const MAX_ITEM_QUANTITY = 999999999;

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Unable to complete this request.";

export default function CustomerBookNow() {
  const { catererId = "" } = useParams<{ catererId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const [data, setData] = useState<DetailData | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [guests, setGuests] = useState("");
  const [guestCountTouched, setGuestCountTouched] = useState(false);
  const [eventType, setEventType] = useState("");
  const [otherEventType, setOtherEventType] = useState("");
  const [venue, setVenue] = useState("");
  const [venueMapOpen, setVenueMapOpen] = useState(false);
  const [requests, setRequests] = useState("");
  const [customItems, setCustomItems] = useState<CustomSelection[]>([]);

  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [customizationSyncWarning, setCustomizationSyncWarning] = useState("");
  const lock = useRef(false);
  const submittedId = useRef<string | null>(null);
  const loadVersion = useRef(0);
  const availabilityVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      if (!catererId) throw new Error("Missing caterer.");
      const response = await fetchCustomerCatererDetails(catererId);
      if (!response)
        throw new Error("This caterer is not available for booking.");
      if (version !== loadVersion.current) return;
      setData(response);
      setCustomItems([]);
      const requested = params.get("packageId");
      const preferred = response.packages.find((p) => p.id === requested);
      setSelectedId(preferred?.id ?? "");
      if (preferred) {
        setGuests(String(preferred.guest_capacity));
        setStep(1);
      }
    } catch (err) {
      if (version === loadVersion.current) setError(errorText(err));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [catererId, params]);

  const refreshAvailability = useCallback(async () => {
    const version = ++availabilityVersion.current;
    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const dates = await fetchUnavailableDates(catererId);
      if (version === availabilityVersion.current) setBlockedDates(dates);
    } catch (err) {
      if (version === availabilityVersion.current)
        setAvailabilityError(
          `Could not verify date availability: ${errorText(err)}`,
        );
    } finally {
      if (version === availabilityVersion.current)
        setAvailabilityLoading(false);
    }
  }, [catererId]);

  useEffect(() => {
    void reload();
    return () => {
      loadVersion.current++;
    };
  }, [reload]);
  useEffect(() => {
    void refreshAvailability();
    return () => {
      availabilityVersion.current++;
    };
  }, [refreshAvailability]);

  const selected = useMemo(
    () => data?.packages.find((p) => p.id === selectedId) ?? null,
    [data, selectedId],
  );
  const guestNumber = /^\d+$/.test(guests) ? Number(guests) : 0;
  // Give immediate guest-count feedback without changing booking/pricing rules.
  const guestCountError = useMemo(() => {
    if (!selected || !guestCountTouched) return "";
    const minimum = selected.min_guests ?? 1;
    const maximum = selected.max_guests;
    if (!guests.trim()) return "Please enter the number of guests.";
    if (!/^\d+$/.test(guests) || !Number.isSafeInteger(Number(guests)) || Number(guests) < 1) {
      return "Enter a valid positive whole number of guests.";
    }
    const count = Number(guests);
    if (count < minimum) return `This package requires at least ${minimum} guests. Please increase your guest count.`;
    if (count > maximum) return `This package allows up to ${maximum} guests. Please reduce your guest count or choose another package.`;
    return "";
  }, [selected, guests, guestCountTouched]);
  const selectedAddOns = useMemo(() => {
    const items = new Map((data?.menu ?? []).map(item => [item.id, item]));
    return customItems.map(({ id, quantity }) => ({ menuItem: items.get(id), quantity }));
  }, [customItems, data]);
  const addOnsValid = selectedAddOns.every(item => item.menuItem !== undefined) &&
    customItems.length <= MAX_ADD_ON_ITEMS &&
    customItems.every(item => Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= MAX_ITEM_QUANTITY);
  const adjustAddOn = (id: string, direction: 1 | -1) => {
    setCustomItems(previous => {
      const existing = previous.find(item => item.id === id);
      if (!existing) return direction === 1 && previous.length < MAX_ADD_ON_ITEMS
        ? [...previous, { id, quantity: 1 }] : previous;
      const quantity = existing.quantity + direction;
      if (quantity <= 0) return previous.filter(item => item.id !== id);
      if (quantity > MAX_ITEM_QUANTITY) return previous;
      return previous.map(item => item.id === id ? { ...item, quantity } : item);
    });
    setValidationError("");
  };
  const pricing = useMemo(() => {
    if (!selected || !data) return { quote: null, error: "" };
    if (!addOnsValid) return { quote: null, error: "Menu selection has changed. Remove unavailable items and retry." };
    try {
      return {
        quote: calculatePackagePricing(
          selected,
          guestNumber,
          selectedAddOns.map(({ menuItem, quantity }) => ({
            price_per_guest: menuItem!.price_per_guest, quantity,
          })),
          data.caterer.downpayment_percent,
        ),
        error: "",
      };
    } catch (err) {
      return { quote: null, error: errorText(err) };
    }
  }, [selected, data, guestNumber, selectedAddOns, addOnsValid]);
  const eventLabel = eventType === "Other" ? otherEventType.trim() : eventType;
  const today = manilaToday();
  const validateDetails = () => {
    if (!selected) return "Choose a published catering package.";
    if (pricing.error) return pricing.error;
    if (availabilityLoading || availabilityError)
      return availabilityError || "Date availability is still loading.";
    if (!eventDate || eventDate < today)
      return "Choose today or a future event date.";
    if (blockedDates.includes(eventDate))
      return "This date is blocked or fully booked. Please choose another date.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime))
      return "Enter a valid event time.";
    if (!eventType) return "Choose the event type.";
    if (
      eventType === "Other" &&
      (eventLabel.length < 2 || eventLabel.length > 80)
    )
      return "Enter an event type between 2 and 80 characters.";
    if (!venue.trim()) return "Enter the event venue or address.";
    return "";
  };
  const [validationError, setValidationError] = useState("");
  const advance = () => {
    setValidationError("");
    if (step === 0) {
      if (!selected) {
        setValidationError("Choose a package first.");
        return;
      }
      setGuests(String(selected.guest_capacity));
      setStep(1);
      return;
    }
    const message = validateDetails();
    if (message) {
      setValidationError(message);
      return;
    }
    if (step === 1) { setStep(2); return; }
    if (step === 2 && !addOnsValid) {
      setValidationError("One or more selected menu items are no longer available.");
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    if (lock.current || submitting || submittedId.current) return;
    const message = validateDetails();
    if (message) {
      setValidationError(message);
      setStep(1);
      return;
    }
    if (
      !userId ||
      profile?.role !== "customer" ||
      profile.id !== userId ||
      !data ||
      !selected ||
      !pricing.quote
    ) {
      setValidationError(
        "You must be signed in as a Customer to request a booking.",
      );
      return;
    }
    lock.current = true;
    setSubmitting(true);
    setValidationError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId)
        throw new Error("Your session changed. Please sign in again.");
      await requirePublishedPackage(selected.id, data.caterer.id);
      // Fresh server values prevent a stale package price or limits from being submitted.
      const { data: packageRow, error: packageError } = await supabase
        .from("packages")
        .select(
          "id,price,min_guests,guest_capacity,max_guests,publication_status",
        )
        .eq("id", selected.id)
        .eq("caterer_id", data.caterer.id)
        .eq("publication_status", "published")
        .maybeSingle();
      if (packageError) throw packageError;
      if (!packageRow)
        throw new Error(
          "This package is no longer published. Refresh and choose another package.",
        );
      packageGuestBounds(packageRow);
      const { data: catererRow, error: catererError } = await supabase
        .from("caterers")
        .select("id,downpayment_percent,verification_status")
        .eq("id", data.caterer.id)
        .eq("verification_status", "approved")
        .maybeSingle();
      if (catererError) throw catererError;
      if (!catererRow) throw new Error("This caterer is no longer available.");
      // Refresh selected menu prices and ownership before persisting any quote.
      // Never trust the prices cached in the browser.
      const latestMenu: DetailMenuItem[] = [];
      if (customItems.length) {
        if (!addOnsValid) throw new Error("Invalid menu selection. Refresh and try again.");
        const ids = customItems.map(item => item.id);
        const { data: menuRows, error: menuError } = await supabase.from("menu_items")
          .select("id,name,category,description,price_per_guest,serving_size,serving_unit,image_url")
          .eq("caterer_id", data.caterer.id).in("id", ids);
        if (menuError) throw menuError;
        latestMenu.push(...((menuRows ?? []) as DetailMenuItem[]));
        if (latestMenu.length !== ids.length || new Set(latestMenu.map(item => item.id)).size !== ids.length)
          throw new Error("Some add-ons are no longer offered. Refresh the booking page and review your menu.");
      }
      const latestById = new Map(latestMenu.map(item => [item.id, item]));
      const latestSelected = customItems.map(item => ({
        menuItem: latestById.get(item.id)!, quantity: item.quantity,
      }));
      const latestQuote = calculatePackagePricing(
        packageRow,
        guestNumber,
        latestSelected.map(({ menuItem, quantity }) => ({ price_per_guest: menuItem.price_per_guest, quantity })),
        catererRow.downpayment_percent,
      );
      if (
        latestQuote.total !== pricing.quote.total ||
        latestQuote.downpayment !== pricing.quote.downpayment
      ) {
        throw new Error(
          "The package price has changed. Refresh the page and review your quote before continuing.",
        );
      }
      if (eventDate < manilaToday())
        throw new Error("Choose today or a future event date.");
      let unavailable: string[];
      try {
        unavailable = await fetchUnavailableDates(data.caterer.id);
      } catch {
        setAvailabilityError("Unable to verify current date availability.");
        throw new Error("Could not verify date availability. Please retry.");
      }
      setBlockedDates(unavailable);
      if (unavailable.includes(eventDate))
        throw new Error("That date is now unavailable. Choose another date.");
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: created, error: insertError } = await supabase
        .from("bookings")
        .insert({
          customer_id: userId,
          caterer_id: data.caterer.id,
          package_id: selected.id,
          event_date: eventDate,
          event_time: eventTime,
          guest_count: guestNumber,
          total_cost: latestQuote.total,
          downpayment_amount: latestQuote.downpayment,
          downpayment_deadline: deadline,
          status: "pending",
          event_type: eventLabel,
          venue: venue.trim(),
          special_requests: requests.trim() || null,
          customized_items: latestSelected.length ? latestSelected.map(({ menuItem, quantity }) => ({
            menu_item_id: menuItem.id,
            name: menuItem.name,
            quantity,
            price_per_guest: menuItem.price_per_guest,
          })) : null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      if (!created)
        throw new Error(
          "No booking confirmation was returned. Check My Bookings before retrying.",
        );
      // The booking already exists. Lock out retries before the second (non-atomic)
      // write; otherwise a customization sync error could create duplicates.
      submittedId.current = created.id;
      setSuccessId(created.id);
      if (latestSelected.length) {
        const { error: detailError } = await supabase.from("booking_customizations").insert(
          latestSelected.map(({ menuItem, quantity }) => ({
            booking_id: created.id,
            menu_item_id: menuItem.id,
            quantity,
            price_per_guest: menuItem.price_per_guest,
            is_added: true,
          })),
        );
        if (detailError) {
          setCustomizationSyncWarning(`Your booking was created (ID: ${created.id}), but its menu detail rows could not be saved. Do not submit again. Contact support with this booking ID.`);
        }
      }
      // DB booking trigger handles caterer notification. Never send a duplicate.
    } catch (err) {
      const failure = err as { code?: string };
      if (failure.code === "23514") void refreshAvailability();
      setValidationError(errorText(err));
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="cc-book-page">
      <CustomerHeader activePage="bookings" />
      <main className="cc-book-main">
        <Link className="cc-book-back" to={`/customer/caterer/${catererId}`}>
          <ArrowLeft size={17} /> Back to Caterer
        </Link>
        <div className="cc-book-title">
          <span>PLAN YOUR CELEBRATION</span>
          <h1>Book Catering Service</h1>
          <p>
            Choose a package, enter event details, customize your menu, and review your request.
          </p>
        </div>
        {successId ? (
          <section className="cc-book-card cc-book-complete" role="status">
            <CheckCircle2 size={48} />
            <h2>Booking Request Submitted!</h2>
            <p>
              Your request was saved. The caterer will review it, usually within
              24 hours.
            </p>
            <p className="cc-book-ref">Booking ID: {successId}</p>
            {customizationSyncWarning && (
              <p className="cc-book-error-banner" role="alert">{customizationSyncWarning}</p>
            )}
            <button
              type="button"
              onClick={() => navigate("/customer/bookings")}
            >
              View My Bookings <ArrowRight size={18} />
            </button>
          </section>
        ) : loading ? (
          <div className="cc-book-card cc-book-center">
            <RefreshCw className="cc-book-spin" /> Loading packages...
          </div>
        ) : error || !data ? (
          <div className="cc-book-card cc-book-center cc-book-error">
            {error || "Caterer not found."}
            <button type="button" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="cc-book-steps">
              {steps.map((name, i) => (
                <div
                  key={name}
                  className={i === step ? "active" : i < step ? "done" : ""}
                >
                  <span>{i < step ? <CheckCircle2 size={18} /> : i + 1}</span>
                  {name}
                </div>
              ))}
            </div>
            <div className="cc-book-layout">
              <div className="cc-book-primary">
                {step === 0 && (
                  <section className="cc-book-card">
                    <h2>Choose your package</h2>
                    <p>
                      {data.caterer.business_name} · Published packages only
                    </p>
                    {data.packages.length === 0 ? (
                      <p>No packages are available for booking.</p>
                    ) : (
                      <div className="cc-book-packages">
                        {data.packages.map((pkg) => (
                          <button
                            type="button"
                            key={pkg.id}
                            className={`cc-book-package ${selectedId === pkg.id ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedId(pkg.id);
                              setValidationError("");
                            }}
                          >
                            <span>
                              <strong>{pkg.name}</strong>
                              <small>
                                {pkg.tier} · {pkg.min_guests ?? 1}–
                                {pkg.max_guests} guests · Includes{" "}
                                {pkg.guest_capacity}
                              </small>
                            </span>
                            <b>{peso(pkg.price)}</b>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {step === 1 && (
                  <section className="cc-book-card">
                    <h2>Event Details</h2>
                    <p>
                      Enter the information the caterer will need to review your
                      request.
                    </p>
                    <div className="cc-book-fields">
                      <CustomerAvailabilityCalendar
                        selected={eventDate}
                        blockedDates={blockedDates}
                        loading={availabilityLoading}
                        error={availabilityError}
                        onSelect={(date) => {
                          setEventDate(date);
                          setValidationError("");
                        }}
                        onRefresh={() => void refreshAvailability()}
                      />
                      <label>
                        Event time{" "}
                        <input
                          type="time"
                          required
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                        />
                      </label>
                      <label>
                        Number of guests{" "}
                        <input
                          type="number"
                          required
                          min={selected?.min_guests ?? 1}
                          max={selected?.max_guests}
                          step="1"
                          value={guests}
                          aria-invalid={!!guestCountError}
                          aria-describedby={guestCountError ? "cc-book-guests-error" : undefined}
                          onChange={(e) => {
                            setGuests(e.target.value);
                            setGuestCountTouched(true);
                          }}
                        />
                        {guestCountError && (
                          <span id="cc-book-guests-error" className="cc-book-guests-error" role="alert">
                            {guestCountError}
                          </span>
                        )}
                      </label>
                      <label>
                        Event type{" "}
                        <select
                          required
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value)}
                        >
                          <option value="">Select event type</option>
                          {EVENTS.map((event) => (
                            <option key={event} value={event}>
                              {event}
                            </option>
                          ))}
                        </select>
                      </label>
                      {eventType === "Other" && (
                        <label className="wide">
                          Specify event type{" "}
                          <input
                            maxLength={80}
                            value={otherEventType}
                            onChange={(e) => setOtherEventType(e.target.value)}
                            placeholder="e.g. Graduation"
                          />
                        </label>
                      )}
                      <div className="wide">
                        <div className="cc-book-venue-heading">
                          <label htmlFor="cc-book-venue-input">Venue / location *</label>
                          <button type="button" className="cc-book-venue-pin" onClick={() => setVenueMapOpen(true)}>
                            <MapPin size={15} /> Pin on Map
                          </button>
                        </div>
                        <input
                          id="cc-book-venue-input"
                          required
                          maxLength={500}
                          value={venue}
                          onChange={(e) => setVenue(e.target.value)}
                          placeholder="Venue name, street, barangay, city"
                        />
                        <button type="button" className="cc-book-venue-preview" onClick={() => setVenueMapOpen(true)}>
                          <MapPin size={20} />
                          <span><strong>Interactive Venue Mapper</strong>
                            <small>{venue ? `Selected: ${venue}` : "Search an address or click the map to drop a venue pin."}</small>
                          </span>
                        </button>
                      </div>
                      <label className="wide">
                        Special requests (optional){" "}
                        <textarea
                          value={requests}
                          onChange={(e) => setRequests(e.target.value)}
                          rows={4}
                          placeholder="Tell the caterer about your event requirements"
                        />
                      </label>
                    </div>
                    <div className="cc-book-availability">
                      <CalendarDays size={17} />
                      {availabilityLoading
                        ? "Checking available dates..."
                        : availabilityError
                          ? availabilityError
                          : blockedDates.includes(eventDate)
                            ? "Selected date is fully booked or blocked."
                            : "Date availability checked. Final verification occurs when you submit."}
                      <button
                        type="button"
                        disabled={availabilityLoading}
                        onClick={() => void refreshAvailability()}
                      >
                        <RefreshCw size={15} /> Refresh
                      </button>
                    </div>
                    <p className="cc-book-hint">
                      <MapPin size={16} /> You can type the full address or pin it on the map.
                      The venue field is saved with your booking.
                    </p>
                  </section>
                )}
                {step === 2 && (
                  <section className="cc-book-card cc-book-customize">
                    <h2>Customize Your Menu</h2>
                    <p>Optionally add dishes or drinks to your selected package. Each quantity is charged per guest.</p>
                    {data.menuWarning && <p role="alert" className="cc-book-error-banner">Menu could not be loaded. Refresh this page before choosing add-ons.</p>}
                    {!data.menuWarning && data.menu.length === 0 && <p>No additional menu items are currently offered by this caterer. You can continue without add-ons.</p>}
                    {customItems.length > 0 && pricing.quote && (
                      <div className="cc-book-customize-total">
                        <span>Selected add-ons ({customItems.length})</span>
                        <strong>+{peso(pricing.quote.addOnTotal)}</strong>
                      </div>
                    )}
                    {MENU_CATEGORIES.map(({ key, label, Icon }) => {
                      const items = data.menu.filter(item => item.category === key);
                      if (!items.length) return null;
                      return (
                        <div className="cc-book-menu-category" key={key}>
                          <h3><Icon size={19} /> {label}</h3>
                          <div className="cc-book-menu-list">
                            {items.map(item => {
                              const quantity = customItems.find(entry => entry.id === item.id)?.quantity ?? 0;
                              return (
                                <article className="cc-book-menu-item" key={item.id}>
                                  {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <div className="cc-book-menu-placeholder"><Icon size={23} /></div>}
                                  <div className="cc-book-menu-info">
                                    <strong>{item.name}</strong>
                                    {item.description && <p>{item.description}</p>}
                                    <small>{peso(Number(item.price_per_guest))} / guest{item.serving_unit ? ` · ${item.serving_size ?? ""} ${item.serving_unit}` : ""}</small>
                                  </div>
                                  <div className="cc-book-menu-qty" aria-label={`Quantity for ${item.name}`}>
                                    <button type="button" onClick={() => adjustAddOn(item.id, -1)} disabled={!quantity} aria-label={`Remove one ${item.name}`}><Minus size={15}/></button>
                                    <output aria-label={`${item.name} quantity`}>{quantity}</output>
                                    <button type="button" onClick={() => adjustAddOn(item.id, 1)} disabled={quantity >= MAX_ITEM_QUANTITY || (quantity === 0 && customItems.length >= MAX_ADD_ON_ITEMS)} aria-label={`Add one ${item.name}`}><Plus size={15}/></button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}
                {step === 3 && selected && (
                  <section className="cc-book-card cc-book-review-screen">
                    <h2>Review &amp; Confirm</h2>
                    <p>Please review your booking details before submitting.</p>

                    <section className="cc-book-review-section" aria-label="Caterer information">
                      <h3><UtensilsCrossed size={18} /> Caterer</h3>
                      <div className="cc-book-review-caterer">
                        {data.caterer.logo_url ? (
                          <img src={data.caterer.logo_url} alt="" />
                        ) : (
                          <div className="cc-book-review-logo-placeholder"><UtensilsCrossed size={24} /></div>
                        )}
                        <div>
                          <strong>{data.caterer.business_name}</strong>
                          {data.caterer.city && <small><MapPin size={13} /> {data.caterer.city}</small>}
                        </div>
                      </div>
                    </section>

                    <section className="cc-book-review-section" aria-label="Package and inclusions">
                      <h3><PackageIcon size={18} /> Package &amp; Inclusions</h3>
                      <div className="cc-book-review-panel">
                        <span className="cc-book-review-tier">{selected.tier}</span>
                        <h4>{selected.name}</h4>
                        {selected.description && <p>{selected.description}</p>}
                        {selected.food_inclusions && selected.food_inclusions.length > 0 && (
                          <div className="cc-book-review-inclusions">
                            <b>FOOD INCLUSIONS</b>
                            {selected.food_inclusions.map((item, index) => <span key={index}><UtensilsCrossed size={14} /> {item}</span>)}
                          </div>
                        )}
                        {selected.includes && selected.includes.length > 0 && (
                          <div className="cc-book-review-inclusions">
                            <b>PACKAGE INCLUSIONS</b>
                            {selected.includes.map((item, index) => <span key={index}><CheckCircle2 size={14} /> {item}</span>)}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="cc-book-review-section" aria-label="Event details">
                      <h3><ClipboardCheck size={18} /> Event Details</h3>
                      <div className="cc-book-review-panel cc-book-review-table">
                        {[
                          { label: "Date", value: eventDate },
                          { label: "Time", value: eventTime },
                          { label: "Guests", value: `${guestNumber} guests` },
                          { label: "Event Type", value: eventLabel },
                          { label: "Venue", value: venue },
                          ...(requests.trim() ? [{ label: "Special Requests", value: requests.trim() }] : []),
                        ].map(({ label, value }) => (
                          <div className="cc-book-review-row" key={label}>
                            <span>{label}</span><strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    {selectedAddOns.some(({ menuItem }) => !!menuItem) && (
                      <section className="cc-book-review-section" aria-label="Menu add-ons">
                        <h3><Sparkles size={18} /> Add-ons</h3>
                        <div className="cc-book-review-panel cc-book-review-table">
                          {selectedAddOns.map(({ menuItem, quantity }) => menuItem && (
                            <div className="cc-book-review-row" key={menuItem.id}>
                              <span>{menuItem.name} × {quantity}</span>
                              <strong>+{peso(Number(menuItem.price_per_guest) * guestNumber * quantity)}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="cc-book-review-section" aria-label="Cost breakdown">
                      <h3><CreditCard size={18} /> Cost Breakdown</h3>
                      <div className="cc-book-review-panel cc-book-review-table">
                        <div className="cc-book-review-row"><span>Fixed package price</span><strong>{peso(pricing.quote?.fixedPrice ?? 0)}</strong></div>
                        {(pricing.quote?.extraGuests ?? 0) > 0 && (
                          <div className="cc-book-review-row"><span>Extra guests ({pricing.quote?.extraGuests})</span><strong>+{peso(pricing.quote?.extraGuestTotal ?? 0)}</strong></div>
                        )}
                        {(pricing.quote?.addOnTotal ?? 0) > 0 && (
                          <div className="cc-book-review-row"><span>Menu add-ons</span><strong>+{peso(pricing.quote?.addOnTotal ?? 0)}</strong></div>
                        )}
                        <div className="cc-book-review-row cc-book-review-grandtotal"><span>TOTAL</span><strong>{peso(pricing.quote?.total ?? 0)}</strong></div>
                        <div className="cc-book-review-downpayment">
                          <div><strong>Downpayment Required ({data.caterer.downpayment_percent}%)</strong>
                            <small>Payment instructions and deadline must be verified against the booking status.</small>
                          </div>
                          <strong>{peso(pricing.quote?.downpayment ?? 0)}</strong>
                        </div>
                      </div>
                    </section>
                    <div className="cc-book-review-note"><Info size={18} /> <span>Submitting creates a pending booking request. No payment is collected now. The caterer must review the request.</span></div>
                  </section>
                )}
                {validationError && (
                  <div role="alert" className="cc-book-error-banner">
                    {validationError}
                  </div>
                )}
                <div className="cc-book-navigation">
                  {step > 0 && (
                    <button
                      type="button"
                      className="cc-book-secondary"
                      onClick={() => {
                        setValidationError("");
                        setStep(step - 1);
                      }}
                      disabled={submitting}
                    >
                      <ArrowLeft size={17} /> Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="cc-book-primary-button"
                    disabled={
                      submitting || (step === 0 && data.packages.length === 0)
                    }
                    onClick={step === 3 ? () => void submit() : advance}
                  >
                    {submitting
                      ? "Submitting..."
                      : step === 3
                        ? "Submit Booking Request"
                        : "Continue"}{" "}
                    {submitting ? (
                      <RefreshCw className="cc-book-spin" size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </button>
                </div>
              </div>
              <aside className="cc-book-sidebar">
                <section className="cc-book-card">
                  <h2>Booking Summary</h2>
                  <p>{data.caterer.business_name}</p>
                  {selected ? (
                    <>
                      <div className="cc-book-summary-line">
                        <span>Package</span>
                        <strong>{selected.name}</strong>
                      </div>
                      <div className="cc-book-summary-line">
                        <span>Included guests</span>
                        <strong>{selected.guest_capacity}</strong>
                      </div>
                      <div className="cc-book-summary-line">
                        <span>Selected guests</span>
                        <strong>
                          <Users size={15} /> {guests || "—"}
                        </strong>
                      </div>
                      {pricing.quote ? (
                        <>
                          <div className="cc-book-summary-line">
                            <span>Base package + extra guests</span>
                            <strong>{peso(pricing.quote.baseTotal)}</strong>
                          </div>
                          {pricing.quote.addOnTotal > 0 && (
                            <div className="cc-book-summary-line">
                              <span>Menu add-ons</span>
                              <strong>+{peso(pricing.quote.addOnTotal)}</strong>
                            </div>
                          )}
                          <div className="cc-book-summary-line cc-book-total">
                            <span>Estimated total</span>
                            <strong>{peso(pricing.quote.total)}</strong>
                          </div>
                          <div className="cc-book-summary-line">
                            <span>Required downpayment</span>
                            <strong>{peso(pricing.quote.downpayment)}</strong>
                          </div>
                        </>
                      ) : (
                        <p className="cc-book-hint">
                          {pricing.error ||
                            "Enter the number of guests for a quote."}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>Select a package to see a quote.</p>
                  )}
                  <p className="cc-book-hint">
                    Add-ons are optional and priced per guest. No payment is collected when requesting a booking.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <CustomerVenueMapPicker
        open={venueMapOpen}
        currentVenue={venue}
        onClose={() => setVenueMapOpen(false)}
        onConfirm={(selectedVenue) => {
          setVenue(selectedVenue);
          setVenueMapOpen(false);
          setValidationError("");
        }}
      />
    </div>
  );
}
