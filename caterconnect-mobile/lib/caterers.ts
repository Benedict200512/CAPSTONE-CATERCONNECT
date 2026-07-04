import { supabase } from './supabase';

export type CatererPackage = {
  id: string; tier: string; name: string;
  price: number; guest_capacity: number;
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
      packages(id, tier, name, price, guest_capacity)
    `)
    .eq('verification_status', 'approved')
    .order('subscription_plan', { ascending: false });

  if (error) throw error;
  return (data as any) ?? [];
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