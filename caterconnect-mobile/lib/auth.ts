
import { supabase } from './supabase';
import { POLICY_VERSION } from '../constants/registrationPolicies';
import * as Linking from 'expo-linking';

export type AppRole = 'customer' | 'caterer';

export type SignInResult = {
  data: any | null;
  error: Error | null;
  suspended?: boolean;
  suspensionReason?: string | null;
  userId?: string;
  role?: string;
};

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
  if (!acceptedTerms) {
    return {
      data: null,
      error: new Error(
        'Please accept the CaterConnect registration policies.'
      ),
    };
  }

  if (!email.trim() || !password || !fullName.trim()) {
    return {
      data: null,
      error: new Error(
        'Please complete all required registration fields.'
      ),
    };
  }

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
    const { data, error } = await supabase
      .from('account_monitoring_cases')
      .select('reason')
      .eq('user_id', userId)
      .eq('suspended', true)
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
    console.error('Error retrieving suspension reason:', error);
    return null;
  }
}

// ==========================================
// USER LOGIN & SUSPENSION CHECK
// ==========================================

export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { data: null, error };
  }

  if (!data.user) {
    return {
      data: null,
      error: new Error(
        'Unable to verify your account. Please try again.'
      ),
    };
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', data.user.id)
      .maybeSingle();

  if (profileError || !profileData) {
    await supabase.auth.signOut();

    return {
      data: null,
      error: new Error(
        'Unable to verify your account status. Please try again or contact CaterConnect support.'
      ),
    };
  }

  // Suspended account
  if (
    String(profileData.status || '').toLowerCase().trim() ===
    'suspended'
  ) {
    const suspensionReason = await getSuspensionReason(data.user.id);

    if (
      profileData.role === 'customer' ||
      profileData.role === 'caterer'
    ) {
      return {
        data,
        error: null,
        suspended: true,
        suspensionReason,
        userId: data.user.id,
        role: profileData.role,
      };
    }

    await supabase.auth.signOut();

    return {
      data: null,
      error: new Error('Your account has been suspended.'),
      suspended: true,
      suspensionReason,
      userId: data.user.id,
      role: profileData.role,
    };
  }

  return {
    data,
    error: null,
    suspended: false,
    userId: data.user.id,
    role: profileData.role,
  };
}

// ==========================================
// SUBMIT ACCOUNT APPEAL
// ==========================================

export async function submitAccountAppeal(
  appealMessage: string,
  evidenceUrl?: string | null
): Promise<{ data: string | null; error: Error | null }> {
  const message = appealMessage.trim();

  if (message.length < 10) {
    return {
      data: null,
      error: new Error(
        'Your appeal must contain at least 10 characters.'
      ),
    };
  }

  if (message.length > 5000) {
    return {
      data: null,
      error: new Error(
        'Your appeal cannot exceed 5000 characters.'
      ),
    };
  }

  const { data, error } = await supabase.rpc(
    'submit_account_appeal',
    {
      p_appeal_message: message,
      p_evidence_url: evidenceUrl?.trim() || null,
    }
  );

  if (error) {
    return {
      data: null,
      error: new Error(error.message),
    };
  }

  return {
    data: data as string,
    error: null,
  };
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

export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (error) {
    throw error;
  }
}

// ==========================================
// SEND PASSWORD RESET EMAIL
// EXPO GO
// ==========================================

export async function sendPasswordResetEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error('Please enter your email address.');
  }

  // Temporary diagnostic test for Expo Go
  const redirectTo =
    'exp://192.168.254.102:8081/--/reset-password';

  console.log('RESET EMAIL:', cleanEmail);
  console.log('RESET REDIRECT:', redirectTo);

  const { error } = await supabase.auth.resetPasswordForEmail(
    cleanEmail,
    { redirectTo }
  );

  if (error) {
    console.error('PASSWORD RESET ERROR:', error.message);
    throw error;
  }
}

// ==========================================
// UPDATE USER PASSWORD
// ==========================================

export async function updateUserPassword(password: string) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

// ==========================================
// CHECK EMAIL VERIFICATION
// ==========================================

export function isEmailVerified(
  emailConfirmedAt?: string | null
): boolean {
  return Boolean(emailConfirmedAt);
}
