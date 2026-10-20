import { supabase } from './supabase';
import { isPublishedPackage, type PackagePublicationStatus } from './packagePublication';

export type CatererPackage = {
  id: string; tier: string; name: string;
  price: number; guest_capacity: number; max_guests: number;
  publication_status: PackagePublicationStatus;
  description: string | null; min_guests: number | null;
  food_inclusions: string[] | null; includes: string[] | null; event_types: string[] | null;
};

export type CatererWithPackages = {
  id: string;
  business_name: string;
  business_description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  verification_status: string;
  subscription_plan: string;
  downpayment_percent: number;
  packages: CatererPackage[];
};

export async function fetchApprovedCaterers(): Promise<CatererWithPackages[]> {
  const { data, error } = await supabase
    .from('caterers')
    .select(`
      id, business_name, business_description,
      logo_url, cover_photo_url,
      city, contact_phone, contact_email, address,
      verification_status, subscription_plan, downpayment_percent,
      packages(id, tier, name, price, guest_capacity, max_guests, description, min_guests, food_inclusions, includes, event_types, publication_status)
    `)
    .eq('verification_status', 'approved')
    .eq('packages.publication_status', 'published')
    .order('subscription_plan', { ascending: false });

  if (error) throw error;
  return ((data as unknown as CatererWithPackages[]) ?? []).map(caterer => ({
    ...caterer, packages: (caterer.packages ?? []).filter(isPublishedPackage),
  }));
}
export async function fetchCatererReviewSummaries(ids: string[]): Promise<Record<string, { avg: number; count: number }>> {
  const totals = new Map<string, { total: number; count: number }>();
  for (let batch = 0; batch < ids.length; batch += 100) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('reviews').select('id, caterer_id, overall')
        .in('caterer_id', ids.slice(batch, batch + 100)).order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const review of data ?? []) {
        const value = Number(review.overall);
        if (!Number.isFinite(value) || value < 1 || value > 5) continue;
        const summary = totals.get(review.caterer_id) ?? { total: 0, count: 0 };
        summary.total += value; summary.count++;
        totals.set(review.caterer_id, summary);
      }
      if (!data || data.length < 500) break;
    }
  }
  return Object.fromEntries(ids.map(id => {
    const summary = totals.get(id);
    return [id, summary ? { avg: summary.total / summary.count, count: summary.count } : { avg: 0, count: 0 }];
  }));
}
export function getLowestPricePerGuest(packages: CatererPackage[]): number | null {
  if (!packages?.length) return null;
  const prices = packages.filter(p => p.guest_capacity > 0).map(p => p.price / p.guest_capacity);
  return prices.length ? Math.min(...prices) : null;
}

export function getPlanBadge(plan: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    premium:  { bg: '#7C3AED', text: '#F5F3FF' },
    standard: { bg: '#D97706', text: '#FFF' },
    basic:    { bg: '#2563EB', text: '#FFF' },
    free:     { bg: '#6B7280', text: '#FFF' },
  };
  return map[plan] ?? map.free;
}
