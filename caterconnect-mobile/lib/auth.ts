
import { supabase } from './supabase';
import { POLICY_VERSION } from '../constants/registrationPolicies';

export type AppRole = 'customer' | 'caterer';

// ==========================================
// CUSTOMER & CATERER REGISTRATION
// ==========================================

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: AppRole,
  phone?: string,
  address?: string,
  businessName?: string,
  city?: string,
  acceptedTerms: boolean = false
) {
  // Require agreement to CaterConnect registration policies
  if (!acceptedTerms) {
    return {
      data: null,
      error: new Error(
        'Please accept the CaterConnect registration policies.'
      ),
    };
  }

  // Validate required registration information
  if (
    !email.trim() ||
    !password ||
    !fullName.trim()
  ) {
    return {
      data: null,
      error: new Error(
        'Please complete all required registration fields.'
      ),
    };
  }

  // Register customer or caterer using Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role,
        phone_number: phone?.trim() || null,
        address: address?.trim() || null,
        business_name: businessName?.trim() || null,
        city: city?.trim() || null,

        // Registration policy acceptance
        accepted_terms: true,
        policy_version: POLICY_VERSION,
      },
    },
  });

  return { data, error };
}

// ==========================================
// GET ACCOUNT SUSPENSION REASON
// ==========================================

async function getSuspensionReason(
  userId: string
): Promise<string | null> {
  try {
    // Look for the latest recorded suspension action
    const { data, error } = await supabase
      .from('account_monitoring_events')
      .select('reason')
      .eq('user_id', userId)
      .eq('action', 'suspend')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        'Unable to retrieve suspension reason:',
        error.message
      );
      return null;
    }

    return data?.reason?.trim() || null;
  } catch (error) {
    console.error(
      'Error retrieving suspension reason:',
      error
    );
    return null;
  }
}

// ==========================================
// USER LOGIN & SUSPENSION CHECK
// ==========================================

export async function signIn(
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  // Return Supabase authentication errors
  if (error) {
    return { data, error };
  }

  if (!data.user) {
    return {
      data: null,
      error: new Error(
        'Unable to verify your account. Please try again.'
      ),
    };
  }

  // Retrieve the user's account status
  const { data: profileData, error: profileError } =
    await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', data.user.id)
      .maybeSingle();

  // Prevent access if account status cannot be verified
  if (profileError || !profileData) {
    await supabase.auth.signOut();

    return {
      data: null,
      error: new Error(
        'Unable to verify your account status. Please try again or contact CaterConnect support.'
      ),
    };
  }

  // ========================================
  // SUSPENDED ACCOUNT
  // ========================================

  if (profileData.status === 'suspended') {
    // Retrieve the latest suspension reason
    const suspensionReason = await getSuspensionReason(
      data.user.id
    );

    // Sign out to prevent access to the platform
    await supabase.auth.signOut();

    const accountType =
      profileData.role === 'caterer'
        ? 'caterer'
        : profileData.role === 'customer'
        ? 'customer'
        : 'user';

    const reasonText = suspensionReason
      ? `Reason: ${suspensionReason}`
      : 'Reason: Please contact CaterConnect support for details about your account suspension.';

    const errorMessage =
      `Your CaterConnect ${accountType} account has been suspended.\n\n` +
      `${reasonText}\n\n` +
      'You cannot access the platform while your account is suspended. ' +
      'Please contact CaterConnect support if you need assistance or wish to request a review.';

    return {
      data: null,
      error: new Error(errorMessage),
    };
  }

  // Login successful
  return { data, error };
}

// ==========================================
// SIGN OUT
// ==========================================

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  return { error };
}

// ==========================================
// LOGOUT USER
// ==========================================

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error.message);
  }
}

// ==========================================
// RESEND EMAIL VERIFICATION
// ==========================================

export async function resendVerificationEmail(
  email: string
) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (error) {
    throw error;
  }
}
