import { isMenuCategory, menuCategoryKeys, menuCategoryLabel, normalizeMenuCategory } from './buildYourOwn';

// Enabled locally for the approved migrated backend and compatible category clients.
// Keep Web and Mobile activation flags synchronized.
export const CUSTOM_MENU_CATEGORY_WRITES_ENABLED: boolean = true;
export const CUSTOM_CATEGORY_SETUP_MESSAGE = 'Custom category saving is awaiting the approved database migration. You can preview a category here; the four existing categories remain available.';
const DEFAULT_KEYS = ['main_course', 'appetizer', 'dessert', 'drink'];

export function isDefaultMenuCategory(key: string): boolean {
  return DEFAULT_KEYS.includes(key);
}

export function catererCategoryOptions(menu: readonly { category: string }[], currentCategory?: string) {
  return menuCategoryKeys([
    ...DEFAULT_KEYS.map(category => ({ category })), ...menu,
    ...(currentCategory ? [{ category: currentCategory }] : []),
  ]).map(key => ({ key, label: menuCategoryLabel(key) }));
}

/** New input is normalized; existing stored values are validated without rewriting. */
export function resolveMenuCategory(newName: string | null, existingKey: string,
  writesEnabled = CUSTOM_MENU_CATEGORY_WRITES_ENABLED): { key: string | null; error: string } {
  const key = newName === null ? existingKey : normalizeMenuCategory(newName);
  if (!isMenuCategory(key)) return { key: null, error: 'Use 1–50 English letters or numbers, with spaces, hyphens or underscores between words.' };
  if (!writesEnabled && !isDefaultMenuCategory(key)) return { key: null, error: CUSTOM_CATEGORY_SETUP_MESSAGE };
  return { key, error: '' };
}
