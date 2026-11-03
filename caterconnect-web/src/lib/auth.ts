
import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { data, error, suspended: false, suspensionReason: null };
  }

  if (data.user) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: profileError,
        suspended: false,
        suspensionReason: null,
      };
    }

    if (profileData?.status === 'suspended') {
      const { data: monitoringData, error: monitoringError } = await supabase
        .from('account_monitoring_cases')
        .select('reason')
        .eq('user_id', data.user.id)
        .maybeSingle();

      return {
        data,
        error: null,
        suspended: true,
        role: profileData.role,
        suspensionReason: monitoringError
          ? null
          : monitoringData?.reason ?? null,
      };
    }

    return {
      data,
      error: null,
      suspended: false,
      suspensionReason: null,
    };
  }

  return { data, error, suspended: false, suspensionReason: null };
}

export async function signOut() {
  await supabase.auth.signOut();
}
