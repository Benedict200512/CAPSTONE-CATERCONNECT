import { supabase } from './supabase';

export type PackagePublicationStatus = 'published' | 'unpublished' | 'archived';
export const PACKAGE_PUBLICATION_STATUSES: PackagePublicationStatus[] = ['published', 'unpublished', 'archived'];
export const isPublicationStatus = (value: unknown): value is PackagePublicationStatus =>
  PACKAGE_PUBLICATION_STATUSES.includes(value as PackagePublicationStatus);
export const isPublishedPackage = (pkg: { publication_status?: unknown }) => pkg.publication_status === 'published';

export function packagePublicationError(error: unknown): string {
  const failure = error as { code?: string; message?: string } | null;
  if (['42703', 'PGRST204'].includes(failure?.code ?? '') && /publication_status/.test(failure?.message ?? '')) {
    return 'Package publishing setup is required. Please contact platform support.';
  }
  return failure?.message || 'Unable to update package availability. Please refresh and try again.';
}

export async function setPackagePublication(packageId: string, catererId: string, userId: string,
  previous: PackagePublicationStatus, next: PackagePublicationStatus): Promise<void> {
  if (!isPublicationStatus(previous) || !isPublicationStatus(next)) throw new Error('Unknown package status. Refresh and try again.');
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!userId || data.session?.user.id !== userId) throw new Error('Your account changed. Reopen package management.');
  const { data: owner, error: ownerError } = await supabase.from('caterers').select('id')
    .eq('id', catererId).eq('user_id', userId).single();
  if (ownerError) throw ownerError;
  if (!owner) throw new Error('Caterer account unavailable.');
  // RLS remains authoritative; match the observed status to reject stale actions.
  const { data: rows, error } = await supabase.from('packages').update({ publication_status: next })
    .eq('id', packageId).eq('caterer_id', catererId).eq('publication_status', previous).select('id');
  if (error) throw error;
  if (rows?.length !== 1) throw new Error('Package changed or permission was denied. Refresh and try again.');
}

export async function requirePublishedPackage(packageId: string, catererId: string): Promise<void> {
  const { data, error } = await supabase.from('packages').select('id, publication_status')
    .eq('id', packageId).eq('caterer_id', catererId).eq('publication_status', 'published').maybeSingle();
  if (error) throw new Error(packagePublicationError(error));
  if (!data || !isPublishedPackage(data)) {
    throw new Error('This package is no longer available for new bookings. Please choose another published package.');
  }
  // This is feedback only. The database must lock and recheck at INSERT/confirmation.
}
