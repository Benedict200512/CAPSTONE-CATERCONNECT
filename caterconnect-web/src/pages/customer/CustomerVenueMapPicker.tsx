import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPin, Search, X } from "lucide-react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CustomerVenueMapPicker.css";

type Coordinates = { latitude: number; longitude: number };
type Result = { lat: string; lon: string; display_name: string };
type Props = {
  open: boolean;
  currentVenue: string;
  onClose: () => void;
  onConfirm: (venue: string) => void;
};

// A map center is not a selected venue. No location is saved until the customer
// explicitly clicks the map or chooses a geocoding result.
const CEBU_CENTER: Coordinates = { latitude: 10.3157, longitude: 123.8854 };

function validPoint(p: Coordinates) {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    p.longitude >= -180 &&
    p.longitude <= 180
  );
}

function MapCanvas({
  point,
  onSelect,
}: {
  point: Coordinates | null;
  onSelect: (point: Coordinates) => void;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!root.current || map.current) return;
    const instance = L.map(root.current, { zoomControl: true }).setView(
      [CEBU_CENTER.latitude, CEBU_CENTER.longitude],
      12,
    );
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      maxZoom: 19,
    }).addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => {
      selectRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });
    // The modal becomes visible on mount: invalidate layout after the browser paints.
    const frame = requestAnimationFrame(() => instance.invalidateSize());
    return () => {
      cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!point) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const latlng: L.LatLngExpression = [point.latitude, point.longitude];
    if (!marker.current) {
      const icon = L.divIcon({
        className: "cc-venue-leaflet-icon",
        html: '<span aria-hidden="true">📍</span>',
        iconSize: [32, 40],
        iconAnchor: [16, 38],
      });
      marker.current = L.marker(latlng, { icon }).addTo(instance);
    } else marker.current.setLatLng(latlng);
    if (!instance.getBounds().contains(latlng)) instance.setView(latlng, 16);
  }, [point]);

  return (
    <div
      ref={root}
      className="cc-venue-map"
      aria-label="Interactive venue location map. Click to place a pin."
    />
  );
}

function formatPinnedVenue(label: string, point: Coordinates) {
  const suffix = `(${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})`;
  return `${label.trim() || "Pinned Location"} ${suffix}`;
}

export default function CustomerVenueMapPicker({
  open,
  currentVenue,
  onClose,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [pointLabel, setPointLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const searchTimeRef = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setQuery(currentVenue);
    setPoint(null);
    setPointLabel("");
    setError("");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [open]);

  const selectMapPoint = useCallback((selected: Coordinates) => {
    if (!validPoint(selected)) return;
    setPoint(selected);
    // A manual map click must not reuse the name from a previous search result.
    setPointLabel("Pinned Location");
    setError("");
  }, []);

  const search = async () => {
    const text = query.trim();
    if (busy || !text) return;
    // Nominatim public search is explicitly user-triggered, never autocomplete.
    if (Date.now() - searchTimeRef.current < 1100) {
      setError("Please allow a moment between location searches.");
      return;
    }
    searchTimeRef.current = Date.now();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", text);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("addressdetails", "0");
      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "Location search is unavailable. You can still enter a venue manually.",
        );
      const results = (await response.json()) as Result[];
      const best = results[0];
      if (!best)
        throw new Error(
          "Venue not found. Try including a barangay and city, or enter the address manually.",
        );
      const selected = {
        latitude: Number(best.lat),
        longitude: Number(best.lon),
      };
      if (!validPoint(selected))
        throw new Error("Invalid coordinates returned by location search.");
      setPoint(selected);
      setPointLabel(best.display_name);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Location search failed. Enter the venue manually.",
        );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  };

  if (!open) return null;
  return (
    <div className="cc-venue-overlay" role="presentation">
      <section
        className="cc-venue-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-venue-title"
      >
        <div className="cc-venue-heading">
          <div>
            <h2 id="cc-venue-title">Search & Pin Venue</h2>
            <p>
              Search for your event location or click the map to place a pin.
            </p>
          </div>
          <button
            type="button"
            className="cc-venue-close"
            onClick={onClose}
            aria-label="Close venue map"
          >
            <X size={20} />
          </button>
        </div>
        <form
          className="cc-venue-search"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label className="cc-venue-sr-only" htmlFor="cc-venue-search-input">
            Search venue or address
          </label>
          <input
            id="cc-venue-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={180}
            placeholder="Venue, landmark, barangay, city"
          />
          <button type="submit" disabled={busy || !query.trim()}>
            <Search size={17} /> {busy ? "Searching…" : "Search"}
          </button>
        </form>
        {error && (
          <p role="alert" className="cc-venue-error">
            {error}
          </p>
        )}
        <MapCanvas point={point} onSelect={selectMapPoint} />
        <div className="cc-venue-footer">
          <div className="cc-venue-selected">
            <MapPin size={18} />
            <span>
              {point
                ? `${pointLabel || "Pinned Location"} · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
                : "No location pinned yet. Search or click the map."}
            </span>
          </div>
          <div className="cc-venue-actions">
            <button type="button" className="cc-venue-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="cc-venue-confirm"
              disabled={!point || busy}
              onClick={() => {
                if (point) onConfirm(formatPinnedVenue(pointLabel, point));
              }}
            >
              <CheckCircle2 size={17} /> Confirm Venue Pin
            </button>
          </div>
          <small>
            Map data © OpenStreetMap contributors. Search uses the public
            Nominatim service. You can enter a venue address without a map pin.
          </small>
        </div>
      </section>
    </div>
  );
}
