import { supabase } from './supabase';

export type AppRole = 'customer' | 'caterer';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: AppRole,
  phone?: string,
  address?: string,
  businessName?: string, 
  city?: string 
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

  if (error) {
    return { data, error };
  }

  // Check if the account has been suspended
  if (data.user) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profileError && profileData?.status === 'suspended') {
      // Force sign out immediately
      await supabase.auth.signOut();

      let balanceText = '';

      // If the user is a caterer, calculate their exact outstanding balance
      if (profileData.role === 'caterer') {
        const { data: catererData } = await supabase
          .from('caterers')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (catererData) {
          // Fetch processed refund bookings associated with this caterer
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('downpayment_amount, refund_amount')
            .eq('caterer_id', catererData.id)
            .eq('refund_status', 'processed');

          // Sum up the total balance owed
          const totalBalance = bookingData?.reduce(
            (sum, b) => sum + Number(b.refund_amount || b.downpayment_amount || 0),
            0
          ) || 0;

          if (totalBalance > 0) {
            balanceText = ` Your total outstanding balance is ₱${totalBalance.toLocaleString()}.`;
          }
        }
      }

      // Tailor the error message dynamically
      const errorMessage = profileData.role === 'caterer'
        ? `Your caterer account has been suspended due to an unpaid balance.${balanceText} Please send your payment via GCash to 0917-XXX-XXXX (CaterConnect Hub) and email your reference screenshot to support@caterconnect.com to restore your account.`
        : 'Your account has been suspended. Please contact support.';

      return { 
        data: null, 
        error: new Error(errorMessage) 
      };
    }
  }

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