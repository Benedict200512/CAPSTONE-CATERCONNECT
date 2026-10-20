import { calculatePackagePricing } from './packagePricing';
import type { CatererPackage, CatererWithPackages } from './caterers';

export type CatererSort = 'priority' | 'price-asc' | 'price-desc' | 'name';
export type SearchFilters = {
  query: string; city: string; eventType: string; sort: CatererSort;
  minBudget: number | null; maxBudget: number | null; guests: number | null;
  // The approved UCN_CTC_006 matcher compares *starting price per guest*.
  // All other filters retain the existing fixed-package-total behavior.
  mode?: 'starting-price' | 'package-total';
};
export const normalizeSearch = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function parseFilterNumbers(minimum: string, maximum: string, guests: string) {
  const money = (value: string, allowZero = false): number | null => {
    const raw = value.trim();
    if (raw.includes(',') && !/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) throw new Error('Use commas only to separate thousands, for example 50,000.');
    const clean = raw.replace(/,/g, '');
    if (!clean) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(clean) || !Number.isFinite(Number(clean)) || (allowZero ? Number(clean) < 0 : Number(clean) <= 0)) {
      throw new Error('Enter a valid budget with up to two decimal places. Maximum budget must be greater than zero.');
    }
    return Number(clean);
  };
  const minBudget = money(minimum, true), maxBudget = money(maximum);
  const guestText = guests.trim();
  if (guestText && (!/^\d+$/.test(guestText) || !Number.isSafeInteger(Number(guestText)) || Number(guestText) <= 0)) {
    throw new Error('Enter a positive whole number of guests.');
  }
  if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) throw new Error('Minimum budget must not exceed maximum budget.');
  return { minBudget, maxBudget, guests: guestText ? Number(guestText) : null };
}

// Existing full-price quote remains the basis of normal advanced search and bookings.
export function packageTotal(pkg: CatererPackage, guests: number | null): number | null {
  try { return calculatePackagePricing(pkg, guests ?? pkg.guest_capacity).baseTotal; }
  catch { return null; }
}

const priority: Record<string, number> = { premium: 0, standard: 1, basic: 2, free: 3 };
export function lowestPackageTotal(packages: CatererPackage[], guests: number | null): number | null {
  const values = packages.map(pkg => packageTotal(pkg, guests)).filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : null;
}

export function filterCaterers(caterers: CatererWithPackages[], filters: SearchFilters): CatererWithPackages[] {
  const query = normalizeSearch(filters.query), event = normalizeSearch(filters.eventType);
  const numerical = filters.guests !== null || filters.minBudget !== null || filters.maxBudget !== null;
  const startingPriceMode = filters.mode === 'starting-price';
  const results: CatererWithPackages[] = [];
  for (const caterer of caterers) {
    if (filters.city && normalizeSearch(caterer.city) !== normalizeSearch(filters.city)) continue;
    const matchesBusiness = [caterer.business_name, caterer.city, caterer.business_description]
      .some(text => normalizeSearch(text).includes(query));
    const packages = (caterer.packages ?? []).filter(pkg => {
      const packageText = [pkg.name, pkg.description, ...(pkg.food_inclusions ?? []), ...(pkg.includes ?? []), ...(pkg.event_types ?? [])];
      if (query && !matchesBusiness && !packageText.some(text => normalizeSearch(text).includes(query))) return false;
      if (event && event !== 'all') {
        const tagged = (pkg.event_types ?? []).map(normalizeSearch).filter(Boolean);
        if (tagged.length ? !tagged.includes(event)
          : ![pkg.name, pkg.description].some(text => normalizeSearch(text).includes(event))) return false;
      }
      if (numerical) {
        if (startingPriceMode) {
          // Discovery only: guest limits and extra guest charges are checked later
          // by the booking wizard, not by approved UCN_CTC_006.
          const capacity = Number(pkg.guest_capacity);
          const basePrice = Number(pkg.price);
          if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(basePrice) || basePrice <= 0 ||
              filters.guests === null || filters.guests <= 0 || filters.maxBudget === null) return false;
          // Compare ratios without rounding the threshold to 2 decimals.
          const customerPerGuest = filters.maxBudget / filters.guests;
          const packagePerGuest = basePrice / capacity;
          if (packagePerGuest > customerPerGuest + 1e-9 ||
              (filters.minBudget !== null && packagePerGuest < filters.minBudget / filters.guests - 1e-9)) return false;
        } else {
          const total = packageTotal(pkg, filters.guests);
          if (total === null || (filters.minBudget !== null && total < filters.minBudget)
            || (filters.maxBudget !== null && total > filters.maxBudget)) return false;
        }
      }
      return true;
    });
    if ((query && !matchesBusiness) || (event && event !== 'all') || numerical) {
      if (!packages.length) continue;
    }
    results.push({ ...caterer, packages });
  }
  const prices = new Map(results.map(cat => [cat.id,
    startingPriceMode
      ? (() => { const p = cat.packages.filter(pkg => Number(pkg.guest_capacity) > 0).map(pkg => Number(pkg.price) / Number(pkg.guest_capacity)); return p.length ? Math.min(...p) : null; })()
      : lowestPackageTotal(cat.packages, filters.guests)]));
  return results.sort((a, b) => {
    if (filters.sort === 'name') return a.business_name.localeCompare(b.business_name);
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
      const pa = prices.get(a.id) ?? null, pb = prices.get(b.id) ?? null;
      if (pa === null || pb === null) return pa === pb ? a.business_name.localeCompare(b.business_name) : pa === null ? 1 : -1;
      return (filters.sort === 'price-asc' ? pa - pb : pb - pa) || a.business_name.localeCompare(b.business_name);
    }
    return (priority[a.subscription_plan] ?? 99) - (priority[b.subscription_plan] ?? 99)
      || a.business_name.localeCompare(b.business_name);
  });
}
