import { supabase } from "./supabase";
import { POLICY_VERSION } from "../pages/CaterConnectPolicies";

export type AppRole = "customer" | "caterer";

/**
 * Same registration contract and Supabase Auth metadata as CaterConnect Mobile.
 * Profile and caterer row creation must be handled by existing database triggers / workflow.
 * Never insert privileged roles from a public registration page.
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: AppRole,
  phone?: string,
  address?: string,
  businessName?: string,
  city?: string,
  acceptedTerms: boolean = false,
) {
  if (role !== "customer" && role !== "caterer") {
    return { data: null, error: new Error("Invalid registration role.") };
  }

  if (!acceptedTerms) {
    return {
      data: null,
      error: new Error("Please accept the CaterConnect registration policies."),
    };
  }

  if (!email.trim() || !password || !fullName.trim()) {
    return {
      data: null,
      error: new Error("Please complete all required registration fields."),
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

export type SignInResult = {
  data:
    | Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"]
    | null;
  error: Error | null;
  suspended: boolean;
  suspensionReason: string | null;
  role?: string;
  userId?: string;
};

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error)
    return { data: null, error, suspended: false, suspensionReason: null };
  if (!data.user)
    return {
      data: null,
      error: new Error("Unable to verify your account."),
      suspended: false,
      suspensionReason: null,
    };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    await supabase.auth.signOut();
    return {
      data: null,
      error: new Error(
        "Unable to verify account status. Contact CaterConnect support.",
      ),
      suspended: false,
      suspensionReason: null,
    };
  }

  const suspended =
    String(profile.status ?? "")
      .trim()
      .toLowerCase() === "suspended";
  if (!suspended)
    return {
      data,
      error: null,
      suspended: false,
      suspensionReason: null,
      role: profile.role,
      userId: data.user.id,
    };

  // Staff/Admin suspended accounts never gain an appeal session through this route.
  if (profile.role !== "customer" && profile.role !== "caterer") {
    await supabase.auth.signOut();
    return {
      data: null,
      error: new Error("Your account has been suspended."),
      suspended: true,
      suspensionReason: null,
      role: profile.role,
    };
  }

  const { data: cases, error: caseError } = await supabase
    .from("account_monitoring_cases")
    .select("reason")
    .eq("user_id", data.user.id)
    .eq("suspended", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    data,
    error: null,
    suspended: true,
    suspensionReason: caseError ? null : cases?.reason?.trim() || null,
    role: profile.role,
    userId: data.user.id,
  };
}

export async function submitAccountAppeal(
  appealMessage: string,
  evidenceUrl?: string | null,
): Promise<{ data: string | null; error: Error | null }> {
  const message = appealMessage.trim();
  if (message.length < 10 || message.length > 5000)
    return {
      data: null,
      error: new Error("Your appeal must contain 10 to 5000 characters."),
    };
  const { data, error } = await supabase.rpc("submit_account_appeal", {
    p_appeal_message: message,
    p_evidence_url: evidenceUrl?.trim() || null,
  });
  return {
    data: error ? null : (data as string),
    error: error ? new Error(error.message) : null,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Please enter your email address.");
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updateUserPassword(password: string) {
  if (password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}
