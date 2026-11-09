import { supabase } from './supabase';

export type CustomerCaterer = {
  id: string; business_name: string; business_description: string | null;
  logo_url: string | null; cover_photo_url: string | null; city: string | null;
  address: string | null; contact_phone: string | null; contact_email: string | null;
  downpayment_percent: number; subscription_plan: string; verification_status: string;
};
export type DetailPackage = {
  id: string; caterer_id: string; publication_status: 'published';
  name: string; tier: string; description: string | null; price: number;
  min_guests: number | null; guest_capacity: number; max_guests: number;
  includes: string[] | null; food_inclusions: string[] | null;
  event_types: string[] | null; image_url: string | null;
};
export type DetailMenuItem = {
  id: string; category: string; name: string; description: string | null;
  price_per_guest: number; serving_size: number | null;
  serving_unit: string | null; image_url: string | null;
};
export type DetailReview = {
  id: string; food_quality: number | null; service_quality: number | null;
  timeliness: number | null; overall: number | null; comment: string | null;
  caterer_reply: string | null; created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};
export type DetailData = {
  caterer: CustomerCaterer; packages: DetailPackage[]; menu: DetailMenuItem[];
  reviews: DetailReview[]; reviewsWarning: boolean; menuWarning: boolean;
};

export async function fetchCustomerCatererDetails(id: string): Promise<DetailData | null> {
  // Do not disclose details for an unapproved or hidden caterer.
  const { data: caterer, error: catererError } = await supabase.from('caterers')
    .select('id,business_name,business_description,logo_url,cover_photo_url,city,address,contact_phone,contact_email,downpayment_percent,subscription_plan,verification_status')
    .eq('id', id).eq('verification_status', 'approved').maybeSingle();
  if (catererError) throw catererError;
  if (!caterer) return null;

  const [packageResult, menuResult, reviewResult] = await Promise.all([
    supabase.from('packages')
      .select('id,caterer_id,publication_status,name,tier,description,price,min_guests,guest_capacity,max_guests,includes,food_inclusions,event_types,image_url')
      .eq('caterer_id', id).eq('publication_status', 'published').order('price', { ascending: true }),
    supabase.from('menu_items')
      .select('id,category,name,description,price_per_guest,serving_size,serving_unit,image_url')
      .eq('caterer_id', id).order('category'),
    supabase.from('reviews')
      .select('id,food_quality,service_quality,timeliness,overall,comment,caterer_reply,created_at,profiles(full_name,avatar_url)')
      .eq('caterer_id', id).order('created_at', { ascending: false }).limit(10),
  ]);
  if (packageResult.error) throw packageResult.error;
  return {
    caterer: caterer as CustomerCaterer,
    packages: ((packageResult.data ?? []) as DetailPackage[]).filter(p => p.publication_status === 'published'),
    menu: (menuResult.error ? [] : menuResult.data ?? []) as DetailMenuItem[],
    reviews: (reviewResult.error ? [] : reviewResult.data ?? []) as unknown as DetailReview[],
    menuWarning: !!menuResult.error,
    reviewsWarning: !!reviewResult.error,
  };
}

export async function loadCustomerBookmarkIds(customerId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('package_bookmarks')
      .select('package_id').eq('customer_id', customerId)
      .order('package_id').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) ids.add(row.package_id);
    if (!data || data.length < 500) return ids;
  }
}

const pending = new Map<string, Promise<void>>();
export async function setCustomerPackageSaved(customerId: string, packageId: string, save: boolean): Promise<void> {
  const key = `${customerId}:${packageId}`;
  const before = pending.get(key);
  const op = (async () => {
    if (before) await before.catch(() => undefined);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || auth.user?.id !== customerId) throw new Error('Your account changed. Please sign in again.');
    // RLS remains authoritative; only published packages of approved caterers are rendered.
    if (save) {
      const { error } = await supabase.from('package_bookmarks')
        .insert({ customer_id: customerId, package_id: packageId });
      if (error && error.code !== '23505') throw error;
      const result = await supabase.from('package_bookmarks').select('package_id')
        .eq('customer_id', customerId).eq('package_id', packageId).maybeSingle();
      if (result.error || !result.data) throw result.error ?? new Error('Could not confirm saved package.');
    } else {
      const { error } = await supabase.from('package_bookmarks').delete()
        .eq('customer_id', customerId).eq('package_id', packageId);
      if (error) throw error;
      const result = await supabase.from('package_bookmarks').select('package_id')
        .eq('customer_id', customerId).eq('package_id', packageId).maybeSingle();
      if (result.error || result.data) throw result.error ?? new Error('Could not confirm removal.');
    }
  })();
  pending.set(key, op);
  try { await op; } finally { if (pending.get(key) === op) pending.delete(key); }
}
