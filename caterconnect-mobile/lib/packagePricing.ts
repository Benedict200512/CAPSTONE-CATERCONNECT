
export type FixedPackage = {
  price: number | string;
  guest_capacity: number;
  min_guests?: number | null;
  max_guests: number;
};

export type PricingAddOn = {
  price_per_guest: number | string;
  quantity: number;
};

// Keep ample precision for JSON number transport and
// two-decimal rendering, using exact integer cents.
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER) / 100n;

const roundRatio = (
  numerator: bigint,
  denominator: bigint
) => (numerator * 2n + denominator) / (2n * denominator);

// Convert a peso amount into exact integer cents.
export function moneyCents(value: number | string): bigint {
  const raw = String(value);

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error(
      'Please enter a valid amount with no more than two decimal places.'
    );
  }

  const [whole, fraction = ''] = raw.split('.');

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));

  if (cents > MAX_CENTS) {
    throw new Error('Amount exceeds supported precision.');
  }

  return cents;
}

function pesos(cents: bigint): number {
  if (cents > MAX_CENTS || cents < 0n) {
    throw new Error('Amount exceeds supported precision.');
  }

  return Number(cents) / 100;
}

// Validate package guest limits.
export function packageGuestBounds(pkg: FixedPackage) {
  const included = pkg.guest_capacity;
  const minimum = pkg.min_guests ?? 1;
  const maximum = pkg.max_guests;

  if (
    !Number.isSafeInteger(included) ||
    included < 1 ||
    !Number.isSafeInteger(minimum) ||
    minimum < 1 ||
    minimum > included ||
    !Number.isSafeInteger(maximum) ||
    maximum < included ||
    maximum > 2147483647
  ) {
    throw new Error(
      'Package guest limits need setup: minimum ≤ included capacity ≤ maximum.'
    );
  }

  return {
    minimum,
    included,
    maximum,
  };
}

// Calculate the package price, add-ons, and downpayment.
export function calculatePackagePricing(
  pkg: FixedPackage,
  guests: number,
  addOns: PricingAddOn[] = [],
  percent: number | string = 0
) {
  const { minimum, included, maximum } = packageGuestBounds(pkg);


if (!Number.isSafeInteger(guests) || guests <= 0) {
  throw new Error(
    'Invalid Guest Count\n' +
    'Please enter a valid positive whole number of guests. ' +
    `This package accommodates ${minimum} to ${maximum} guests.`
  );
}

if (guests > maximum) {
  throw new Error(
    'Maximum Guest Capacity Exceeded\n' +
    `You entered ${guests} guests, but this package can only accommodate up to ${maximum} guests. ` +
    'Please reduce your guest count or choose another package.\n' +
    'Note: Guest limits help ensure proper catering service for your event.'
  );
}

if (guests < minimum) {
  throw new Error(
    'Minimum Guest Requirement Not Met\n' +
    `You entered ${guests} guests, but this package requires at least ${minimum} guests. ` +
    'Please increase your guest count or choose another package.\n' +
    'Note: Each package has a minimum guest requirement.'
  );
}


  // Existing package pricing calculation.
  const fixed = moneyCents(pkg.price);

  if (fixed <= 0n) {
    throw new Error('Package price must be greater than zero.');
  }

  // Calculate charges for extra guests.
  const extraGuests = Math.max(0, guests - included);

  const extra = roundRatio(
    fixed * BigInt(extraGuests),
    BigInt(included)
  );

  // Maximum of 100 selected add-on menu items.
  if (addOns.length > 100) {
    throw new Error('Select at most 100 menu items.');
  }

  // Calculate additional menu item charges.
  const addOnCents = addOns.reduce((sum, item) => {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999999999
    ) {
      throw new Error(
        'Choose a positive whole menu quantity.'
      );
    }

    return (
      sum +
      moneyCents(item.price_per_guest) *
        BigInt(guests) *
        BigInt(item.quantity)
    );
  }, 0n);

  // Calculate total package cost.
  const total = fixed + extra + addOnCents;

  // Calculate downpayment.
  const percentBasis = moneyCents(percent);

  if (percentBasis > 10000n) {
    throw new Error(
      'Downpayment percentage must be between 0 and 100.'
    );
  }

  // Return the calculated pricing details.
  return {
    fixedPrice: pesos(fixed),

    pricePerGuest: pesos(
      roundRatio(fixed, BigInt(included))
    ),

    extraGuests,

    extraGuestTotal: pesos(extra),

    baseTotal: pesos(fixed + extra),

    addOnTotal: pesos(addOnCents),

    total: pesos(total),

    downpayment: pesos(
      roundRatio(total * percentBasis, 10000n)
    ),
  };
}

// Display amounts in Philippine peso format.
export const formatPricingMoney = (value: number) =>
  value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
