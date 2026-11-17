export type BuffetCategory = string;

/** Canonical database key; never normalize stored package/catalog values implicitly. */
export function isMenuCategory(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 50 &&
    value === value.trim() && /^[a-z0-9]+(_[a-z0-9]+)*$/.test(value);
}

/** User input only. Unsupported characters are rejected, never removed. */
export function normalizeMenuCategory(value: string): string | null {
  const input = value.replace(/^ +| +$/g, '');
  if (!input || input.length > 50 || /[^A-Za-z0-9 _-]/.test(input)) return null;
  const key = input.toLowerCase().replace(/[ _-]+/g, '_');
  return isMenuCategory(key) ? key : null;
}

export function menuCategoryLabel(key: string): string {
  return key.split('_').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Other';
}

/** Only categories actually present in this catalog; legacy order stays unchanged. */
export function menuCategoryKeys(menu: readonly { category: string }[]): string[] {
  const legacy = ['main_course', 'appetizer', 'dessert', 'drink'];
  const keys = [...new Set(menu.map(item => item.category))];
  return [...legacy.filter(key => keys.includes(key)),
    ...keys.filter(key => !legacy.includes(key)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)];
}
export type BuffetGroup = {
  id: string;
  label: string;
  category: BuffetCategory;
  required_count: number;
  menu_item_ids: string[];
};
export type BuffetConfig = { version: 1; groups: BuffetGroup[] };
export type BuffetMenuItem = { id: string; name: string; category: string; caterer_id?: string };
export type BuffetSelections = Record<string, string[]>;
export type PackageSelectionSnapshot = {
  version: 1;
  package_type: 'standard' | 'build_your_own';
  package_name: string;
  includes: string[];
  food_inclusions?: string[];
  groups: { id: string; label: string; category: string; items: { menu_item_id: string; name: string }[] }[];
};
export function createBuffetConfig(): BuffetConfig {
  return { version: 1, groups: [
    { id: 'appetizer', label: 'Appetizer / Salad', category: 'appetizer', required_count: 1, menu_item_ids: [] },
    { id: 'main', label: 'Main Dishes', category: 'main_course', required_count: 5, menu_item_ids: [] },
    { id: 'dessert', label: 'Dessert', category: 'dessert', required_count: 1, menu_item_ids: [] },
    { id: 'rice', label: 'Rice', category: 'main_course', required_count: 1, menu_item_ids: [] },
  ] };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BUFFET_CATEGORIES: { value: BuffetCategory; label: string }[] = [
  { value: 'appetizer', label: 'Appetizer / Salad' },
  { value: 'main_course', label: 'Main Course' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
];

// Null is the only Standard representation. Malformed non-null data fails closed.
export function validateBuffetConfig(value: unknown, menu?: BuffetMenuItem[], catererId?: string, requireComplete = true): string {
  if (value === null || value === undefined) return '';
  const config = value as BuffetConfig;
  if (config.version !== 1 || !Array.isArray(config.groups) || (requireComplete && !config.groups.length) || config.groups.length > 20)
    return 'Add between 1 and 20 included buffet groups.';
  const groups = new Set<string>();
  const dishes = new Set<string>();
  for (const group of config.groups) {
    if (!group || typeof group.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(group.id) || groups.has(group.id))
      return 'Each buffet group must have a unique valid ID.';
    groups.add(group.id);
    if (typeof group.label !== 'string' || !group.label.trim() || group.label.length > 80 ||
      !isMenuCategory(group.category)) return 'Give each group a name and menu category.';
    if (!Number.isInteger(group.required_count) || group.required_count < 1 || group.required_count > 100 ||
      !Array.isArray(group.menu_item_ids) || (requireComplete && group.menu_item_ids.length < group.required_count) || group.menu_item_ids.length > 100)
      return `Add enough eligible dishes for ${group.label} and use a required count from 1 to 100.`;
    for (const id of group.menu_item_ids) {
      if (typeof id !== 'string' || !UUID.test(id) || dishes.has(id.toLowerCase())) return 'Eligible dishes must be valid and unique across groups.';
      dishes.add(id.toLowerCase());
      if (menu) {
        const item = menu.find(candidate => candidate.id === id);
        if (!item || item.category !== group.category || (catererId && item.caterer_id !== catererId))
          return `Refresh the menu catalog and check eligible dishes for ${group.label}.`;
      }
    }
  }
  return '';
}

export function buffetSelectedIds(selections: BuffetSelections, groupId: string): string[] {
  return Object.prototype.hasOwnProperty.call(selections, groupId) ? selections[groupId] : [];
}

export function validateBuffetSelections(config: BuffetConfig | null | undefined, selections: BuffetSelections): string {
  const error = validateBuffetConfig(config);
  if (error) return error;
  if (!config) return Object.values(selections).some(ids => ids.length) ? 'Choose a package again.' : '';
  if (Object.keys(selections).some(id => !config.groups.some(group => group.id === id))) return 'The buffet groups changed. Choose your dishes again.';
  const seen = new Set<string>();
  for (const group of config.groups) {
    const ids = buffetSelectedIds(selections, group.id);
    if (!Array.isArray(ids) || ids.length !== group.required_count) return `Choose exactly ${group.required_count} dishes for ${group.label}.`;
    for (const id of ids) {
      if (!group.menu_item_ids.includes(id) || seen.has(id)) return 'Choose unique eligible dishes from each buffet group.';
      seen.add(id);
    }
  }
  return '';
}

export function toggleBuffetDish(config: BuffetConfig, selections: BuffetSelections, groupId: string, id: string): BuffetSelections {
  const group = config.groups.find(candidate => candidate.id === groupId);
  if (!group || !group.menu_item_ids.includes(id)) return selections;
  const current = buffetSelectedIds(selections, groupId);
  if (current.includes(id)) return { ...selections, [groupId]: current.filter(item => item !== id) };
  if (current.length >= group.required_count || Object.values(selections).some(ids => ids.includes(id))) return selections;
  return { ...selections, [groupId]: [...current, id] };
}

export function buffetSelectionInput(config: BuffetConfig, selections: BuffetSelections) {
  const error = validateBuffetSelections(config, selections);
  if (error) throw new Error(error);
  return { version: 1, groups: config.groups.map(group => ({ id: group.id, menu_item_ids: buffetSelectedIds(selections, group.id) })) };
}

export function buffetReviewGroups(config: BuffetConfig | null | undefined, selections: BuffetSelections, menu: BuffetMenuItem[]) {
  return (config?.groups ?? []).map(group => ({ ...group,
    names: buffetSelectedIds(selections, group.id).map(id => menu.find(item => item.id === id)?.name ?? 'Unavailable dish'),
  }));
}
