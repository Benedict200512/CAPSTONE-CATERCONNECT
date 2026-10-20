import { supabase } from './supabase';

export async function createStaffAccount(fullName: string, email: string, password: string) {
  const { data, error } = await supabase.functions.invoke('create-staff-account', {
    body: { fullName: fullName.trim(), email: email.trim().toLowerCase(), password },
  });
  if (error) {
    // FunctionsHttpError carries the safe endpoint response, not just "non-2xx".
    const response = error.context;
    if (response instanceof Response) {
      let payload;
      try { payload = await response.json(); } catch { /* Generic setup error below. */ }
      if (typeof payload?.error === 'string') throw new Error(payload.error);
    }
    throw new Error('Staff provisioning is unavailable. Contact the project administrator.');
  }
  if (data?.ok !== true || data?.role !== 'staff' || typeof data?.id !== 'string') {
    throw new Error('Staff creation could not be confirmed. Check the account list before trying again.');
  }
  return data as { ok: true; role: 'staff'; id: string };
}
