import { supabase } from "./supabase";

export type CustomerSavedRow = {
  package_id: string;
  created_at: string;
  package: null | {
    id: string;
    caterer_id: string;
    name: string;
    image_url: string | null;
    price: number;
    guest_capacity: number;
    max_guests: number;
    business_name: string;
  };
};

async function assertCustomer(customerId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!customerId || data.session?.user.id !== customerId) {
    throw new Error("Your account changed. Please sign in again.");
  }
}

export async function fetchCustomerSavedPackages(
  customerId: string,
): Promise<CustomerSavedRow[]> {
  await assertCustomer(customerId);
  const bookmarks: { package_id: string; created_at: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("package_bookmarks")
      .select("package_id,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .order("package_id")
      .range(offset, offset + 499);
    if (error) throw error;
    bookmarks.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const details = new Map<string, NonNullable<CustomerSavedRow["package"]>>();
  for (let i = 0; i < bookmarks.length; i += 100) {
    const ids = bookmarks.slice(i, i + 100).map((row) => row.package_id);
    const { data: packages, error: packageError } = await supabase
      .from("packages")
      .select(
        "id,caterer_id,name,image_url,price,guest_capacity,max_guests,publication_status",
      )
      .in("id", ids)
      .eq("publication_status", "published");
    if (packageError) throw packageError;
    const catererIds = [...new Set((packages ?? []).map((p) => p.caterer_id))];
    if (!catererIds.length) continue;
    const { data: caterers, error: catererError } = await supabase
      .from("caterers")
      .select("id,business_name")
      .in("id", catererIds)
      .eq("verification_status", "approved");
    if (catererError) throw catererError;
    const names = new Map((caterers ?? []).map((c) => [c.id, c.business_name]));
    for (const pkg of packages ?? []) {
      const businessName = names.get(pkg.caterer_id);
      if (pkg.publication_status === "published" && businessName) {
        details.set(pkg.id, {
          id: pkg.id,
          caterer_id: pkg.caterer_id,
          name: pkg.name,
          image_url: pkg.image_url,
          price: Number(pkg.price),
          guest_capacity: Number(pkg.guest_capacity),
          max_guests: Number(pkg.max_guests),
          business_name: businessName,
        });
      }
    }
  }
  return bookmarks.map((row) => ({
    ...row,
    package: details.get(row.package_id) ?? null,
  }));
}

export async function removeCustomerSavedPackage(
  customerId: string,
  packageId: string,
) {
  await assertCustomer(customerId);
  const { error } = await supabase
    .from("package_bookmarks")
    .delete()
    .eq("customer_id", customerId)
    .eq("package_id", packageId);
  if (error) throw error;
  const { data, error: confirmationError } = await supabase
    .from("package_bookmarks")
    .select("package_id")
    .eq("customer_id", customerId)
    .eq("package_id", packageId)
    .maybeSingle();
  if (confirmationError) throw confirmationError;
  if (data)
    throw new Error("Bookmark removal could not be confirmed. Please retry.");
}

export type SavedCompareRow = {
  id: string;
  name: string;
  business_name: string;
  price: number;
  guest_capacity: number;
  min_guests: number | null;
  max_guests: number;
  tier: string | null;
  description: string | null;
  includes: string[] | null;
  food_inclusions: string[] | null;
  event_types: string[] | null;
};

export async function fetchSavedComparison(
  customerId: string,
  ids: string[],
): Promise<SavedCompareRow[]> {
  await assertCustomer(customerId);
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.length > 3)
    throw new Error("Select 2 or 3 packages to compare.");
  const { data: saved, error: savedError } = await supabase
    .from("package_bookmarks")
    .select("package_id")
    .eq("customer_id", customerId)
    .in("package_id", unique);
  if (savedError) throw savedError;
  if (saved?.length !== unique.length)
    throw new Error(
      "A selected package is no longer saved. Refresh and retry.",
    );
  const { data: packages, error } = await supabase
    .from("packages")
    .select(
      "id,caterer_id,name,price,guest_capacity,min_guests,max_guests,tier,description,includes,food_inclusions,event_types,publication_status",
    )
    .in("id", unique)
    .eq("publication_status", "published");
  if (error) throw error;
  const catererIds = [...new Set((packages ?? []).map((p) => p.caterer_id))];
  if (!catererIds.length)
    throw new Error("Selected packages are no longer available.");
  const { data: caterers, error: caterersError } = await supabase
    .from("caterers")
    .select("id,business_name")
    .in("id", catererIds)
    .eq("verification_status", "approved");
  if (caterersError) throw caterersError;
  const names = new Map((caterers ?? []).map((c) => [c.id, c.business_name]));
  const mapped = new Map(
    (packages ?? [])
      .filter((p) => names.has(p.caterer_id))
      .map((p) => [
        p.id,
        {
          ...p,
          business_name: names.get(p.caterer_id)!,
          price: Number(p.price),
        },
      ]),
  );
  if (unique.some((id) => !mapped.has(id)))
    throw new Error(
      "A selected package is no longer published or its caterer is unavailable.",
    );
  return unique.map((id) => mapped.get(id)!) as SavedCompareRow[];
}
