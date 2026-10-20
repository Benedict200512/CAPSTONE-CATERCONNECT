import { supabase } from './supabase';
import { isPublishedPackage, type PackagePublicationStatus } from './packagePublication';

export type PackageBookmark = { package_id: string; created_at: string };
export type SavedPackage = PackageBookmark & {
  package: {
    id: string; caterer_id: string; name: string; image_url: string | null;
    price: number; guest_capacity: number; max_guests: number; business_name: string;
    publication_status: PackagePublicationStatus;
  } | null;
};

export function bookmarkError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Unable to update saved packages. Please try again.';
}

async function requireAccount(customerId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!customerId || data.session?.user.id !== customerId) {
    throw new Error('Your account changed. Please reopen this screen.');
  }
}

export async function loadPackageBookmarks(customerId: string): Promise<PackageBookmark[]> {
  await requireAccount(customerId);
  const rows: PackageBookmark[] = [];
  // Do not silently truncate the saved count at the API's default row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('package_bookmarks')
      .select('package_id, created_at').eq('customer_id', customerId)
      .order('created_at', { ascending: false }).order('package_id')
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

// Serialize opposite operations and coalesce duplicate operations across screens.
const requests = new Map<string, { save: boolean; promise: Promise<void> }>();
function mutate(customerId: string, packageId: string, save: boolean): Promise<void> {
  const key = `${customerId}:${packageId}`;
  const previous = requests.get(key);
  if (previous?.save === save) return previous.promise;
  const promise = (async () => {
    if (previous) await previous.promise.catch(() => undefined);
    await requireAccount(customerId);
    if (save) {
      const { data, error } = await supabase.from('package_bookmarks')
        .insert({ customer_id: customerId, package_id: packageId }).select('package_id').single();
      if (error?.code === '23505') {
        const existing = await supabase.from('package_bookmarks').select('package_id')
          .eq('customer_id', customerId).eq('package_id', packageId).single();
        if (existing.error) throw existing.error;
        if (!existing.data) throw new Error('Could not confirm the saved package.');
      } else {
        if (error) throw error;
        if (!data) throw new Error('Could not confirm the saved package.');
      }
    } else {
      const { error } = await supabase.from('package_bookmarks').delete()
        .eq('customer_id', customerId).eq('package_id', packageId);
      if (error) throw error;
      const remaining = await supabase.from('package_bookmarks').select('package_id')
        .eq('customer_id', customerId).eq('package_id', packageId).maybeSingle();
      if (remaining.error) throw remaining.error;
      if (remaining.data) throw new Error('The package is still saved. Please try again.');
    }
  })();
  requests.set(key, { save, promise });
  void promise.finally(() => {
    if (requests.get(key)?.promise === promise) requests.delete(key);
  }).catch(() => undefined);
  return promise;
}

export const savePackageBookmark = (customerId: string, packageId: string) => mutate(customerId, packageId, true);
export const removePackageBookmark = (customerId: string, packageId: string) => mutate(customerId, packageId, false);

export async function loadSavedPackageDetails(bookmarks: PackageBookmark[]): Promise<SavedPackage[]> {
  const visible = new Map<string, NonNullable<SavedPackage['package']>>();
  for (let offset = 0; offset < bookmarks.length; offset += 100) {
    const ids = bookmarks.slice(offset, offset + 100).map(row => row.package_id);
    const packages = await supabase.from('packages')
      .select('id, caterer_id, name, image_url, price, guest_capacity, max_guests, publication_status').in('id', ids)
      .eq('publication_status', 'published');
    if (packages.error) throw packages.error;
    const catererIds = [...new Set((packages.data ?? []).map(pkg => String(pkg.caterer_id)))];
    if (!catererIds.length) continue;
    // No privileged reads or inner joins: unavailable bookmarks remain removable.
    const caterers = await supabase.from('caterers').select('id, business_name')
      .in('id', catererIds).eq('verification_status', 'approved');
    if (caterers.error) throw caterers.error;
    const names = new Map((caterers.data ?? []).map(cat => [cat.id, cat.business_name]));
    for (const pkg of packages.data ?? []) {
      if (isPublishedPackage(pkg) && names.has(pkg.caterer_id)) visible.set(pkg.id, { ...pkg, business_name: names.get(pkg.caterer_id)! });
    }
  }
  // RLS-hidden and deleted records cannot be distinguished safely by the client.
  return bookmarks.map(row => ({ ...row, package: visible.get(row.package_id) ?? null }));
}
