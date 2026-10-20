import { supabase } from './supabase';
import { isPublishedPackage, type PackagePublicationStatus } from './packagePublication';

export type ComparisonPackage = {
  id: string; caterer_id: string; name: string | null; business_name: string;
  image_url: string | null; price: number | null; guest_capacity: number | null; max_guests: number | null;
  publication_status: PackagePublicationStatus;
  min_guests: number | null; tier: string | null; description: string | null;
  food_inclusions: string[] | null; includes: string[] | null; event_types: string[] | null;
};
export type ComparisonItem = { id: string; package: ComparisonPackage | null };

export function toggleComparisonPackage(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter(value => value !== id);
  if (ids.length >= 3) throw new Error('You can compare up to 3 packages. Remove one or clear your selection first.');
  return [...ids, id];
}

export async function loadComparisonPackages(ids: string[]): Promise<ComparisonItem[]> {
  const selected = [...new Set(ids)];
  if (selected.length > 3) throw new Error('Select up to 3 packages.');
  if (!selected.length) return [];
  const packages = await supabase.from('packages')
    .select('id, caterer_id, name, image_url, price, guest_capacity, max_guests, min_guests, tier, description, food_inclusions, includes, event_types, publication_status')
    .in('id', selected).eq('publication_status', 'published');
  if (packages.error) throw packages.error;
  const catererIds = [...new Set((packages.data ?? []).map(pkg => String(pkg.caterer_id)))];
  const visible = new Map<string, ComparisonPackage>();
  if (catererIds.length) {
    const caterers = await supabase.from('caterers').select('id, business_name')
      .in('id', catererIds).eq('verification_status', 'approved');
    if (caterers.error) throw caterers.error;
    const names = new Map((caterers.data ?? []).map(cat => [cat.id, cat.business_name]));
    for (const pkg of packages.data ?? []) {
      if (isPublishedPackage(pkg) && names.has(pkg.caterer_id)) visible.set(pkg.id, { ...pkg, business_name: names.get(pkg.caterer_id)! });
    }
  }
  // Never reveal details of missing, RLS-hidden or unapproved listings.
  return selected.map(id => ({ id, package: visible.get(id) ?? null }));
}
