import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    return { data, error };
  }

  // Check if the account has been suspended
  if (data.user) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profileError && profileData?.status === 'suspended') {
      await supabase.auth.signOut(); // Force sign out immediately
      return { 
        data: null, 
        error: new Error('Your account has been suspended. Please contact support.') 
      };
    }
  }

  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}