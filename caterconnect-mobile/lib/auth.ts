import { supabase } from './supabase';

export type AppRole = 'customer' | 'caterer';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: AppRole,
  phone?: string,
  address?: string,
  businessName?: string, // Added argument 7
  city?: string          // Added argument 8
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        phone_number: phone,
        address: address,
        business_name: businessName,
        city: city,
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error.message);
  }
}

export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  if (error) {
    throw error;
  }
}