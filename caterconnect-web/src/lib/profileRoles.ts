import { supabase } from './supabase';

// Proposed profiles_role_protection migration supplies this narrow RPC.
// Never fall back to direct profiles.role UPDATE if setup/authorization fails.
export async function assignStaffRole(userId: string, role: string) {
  if (!['staff', 'admin'].includes(role)) throw new Error('Choose staff or admin.');
  const { data, error } = await supabase.rpc('cc_profile_role1_assign_staff_role', {
    p_profile_id: userId, p_role: role,
  }).single();
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Secure role management is not installed yet. Contact the project administrator.');
    }
    throw error;
  }
  const result = data as { id?: string; role?: string } | null;
  if (!result || result.id !== userId || result.role !== role) {
    throw new Error('The requested role change could not be confirmed. Refresh and try again.');
  }
  return { id: userId, role };
}
