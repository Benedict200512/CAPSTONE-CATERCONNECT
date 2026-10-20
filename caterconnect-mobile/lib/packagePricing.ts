export type FixedPackage = {
  price: number | string;
  guest_capacity: number;
  min_guests?: number | null;
  max_guests: number;
};
export type PricingAddOn = { price_per_guest: number | string; quantity: number };
// Keep ample precision for JSON number transport and two-decimal rendering,
// in addition to doing the arithmetic itself with exact integer cents.
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER) / 100n;
const roundRatio = (numerator: bigint, denominator: bigint) => (numerator * 2n + denominator) / (2n * denominator);
export function moneyCents(value: number | string): bigint {
  const raw = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Use a valid amount with at most two decimal places.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > MAX_CENTS) throw new Error('Amount exceeds supported precision.');
  return cents;
}
function pesos(cents: bigint) {
  if (cents > MAX_CENTS || cents < 0n) throw new Error('Amount exceeds supported precision.');
  return Number(cents) / 100;
}
export function packageGuestBounds(pkg: FixedPackage) {
  const included = pkg.guest_capacity, minimum = pkg.min_guests ?? 1, maximum = pkg.max_guests;
  if (!Number.isSafeInteger(included) || included < 1 || !Number.isSafeInteger(minimum) || minimum < 1
    || minimum > included || !Number.isSafeInteger(maximum) || maximum < included || maximum > 2147483647) {
    throw new Error('Package guest limits need setup: minimum ≤ included capacity ≤ maximum.');
  }
  return { minimum, included, maximum };
}
export function calculatePackagePricing(pkg: FixedPackage, guests: number, addOns: PricingAddOn[] = [], percent: number | string = 0) {
  const { minimum, included, maximum } = packageGuestBounds(pkg);
  if (!Number.isSafeInteger(guests) || guests < minimum || guests > maximum) {
    throw new Error(`Choose a whole number of guests from ${minimum} to ${maximum}.`);
  }
  const fixed = moneyCents(pkg.price);
  if (fixed <= 0n) throw new Error('Package price must be greater than zero.');
  const extraGuests = Math.max(0, guests - included);
  const extra = roundRatio(fixed * BigInt(extraGuests), BigInt(included));
  if (addOns.length > 100) throw new Error('Select at most 100 menu items.');
  const addOnCents = addOns.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999999999) throw new Error('Choose a positive whole menu quantity.');
    return sum + moneyCents(item.price_per_guest) * BigInt(guests) * BigInt(item.quantity);
  }, 0n);
  const total = fixed + extra + addOnCents;
  const percentBasis = moneyCents(percent);
  if (percentBasis > 10000n) throw new Error('Downpayment percentage must be between 0 and 100.');
  return {
    fixedPrice: pesos(fixed), pricePerGuest: pesos(roundRatio(fixed, BigInt(included))),
    extraGuests, extraGuestTotal: pesos(extra), baseTotal: pesos(fixed + extra),
    addOnTotal: pesos(addOnCents), total: pesos(total), downpayment: pesos(roundRatio(total * percentBasis, 10000n)),
  };
}
export const formatPricingMoney = (value: number) => value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
