import { supabase } from './supabase';
import { validateBuffetConfig, type BuffetConfig, type BuffetMenuItem } from './buildYourOwn';

export const BUFFET_BACKEND_PENDING = 'Build Your Own package saving is awaiting setup. You can review your configuration here.';
export const BUFFET_BOOKING_PENDING = 'Build Your Own booking is temporarily unavailable. Please choose a Standard Package or contact the caterer.';
export async function getBuffetCapabilities(): Promise<{ version: number; booking_enabled: boolean }> {
  try {
    const { data, error } = await supabase.rpc('cc_byo1_capabilities');
    if (error || data?.version !== 1) return { version: 0, booking_enabled: false };
    return { version: 1, booking_enabled: data.booking_enabled === true };
  } catch {
    return { version: 0, booking_enabled: false };
  }
}
export async function requireBuffetBackend(booking = false) {
  const capabilities = await getBuffetCapabilities();
  if (capabilities.version !== 1) throw new Error(BUFFET_BACKEND_PENDING);
  if (booking && !capabilities.booking_enabled) throw new Error(BUFFET_BOOKING_PENDING);
}

// Explicit booking projections remain compatible before the migration is installed.
export async function withPackageSnapshot(projection: string): Promise<string> {
  const capabilities = await getBuffetCapabilities();
  return capabilities.version === 1 ? projection + ',package_selection_snapshot' : projection;
}

export async function loadBuffetMenu(catererId: string): Promise<BuffetMenuItem[]> {
  const menu: BuffetMenuItem[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('menu_items').select('id,name,category,caterer_id')
      .eq('caterer_id', catererId).order('id').range(offset, offset + 499);
    if (error) throw error;
    menu.push(...(data ?? []));
    if (!data || data.length < 500) return menu;
  }
}

export async function validateBuffetCatalog(config: BuffetConfig | null, catererId: string, requireComplete = true): Promise<void> {
  await requireBuffetBackend();
  const menu = config ? await loadBuffetMenu(catererId) : [];
  const error = validateBuffetConfig(config, menu, catererId, requireComplete);
  if (error) throw new Error(error);
}
