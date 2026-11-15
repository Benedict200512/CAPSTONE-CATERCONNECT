/** Shared client contract for Caterer-configured, included buffet dishes.
 * The browser/app validates UX only. Supabase MUST validate submitted choices.
 * Included dish IDs must never be sent as paid booking.customized_items.
 */
export type MenuCategory = 'main_course' | 'appetizer' | 'dessert' | 'drink';
export type GroupKey = 'appetizer' | 'main_course' | 'dessert' | 'rice';
export type PackageType = 'standard' | 'build_your_own';

export type CatererMenuItem = {
  id: string;
  caterer_id: string;
  category: MenuCategory;
  name: string;
};

export type ChoiceGroup = {
  key: GroupKey;
  label: string;
  category: MenuCategory;
  required: number;
  eligible_menu_item_ids: string[];
};

export type ChoiceRules = { version: 1; groups: ChoiceGroup[] };
export type SelectedChoices = Record<GroupKey, string[]>;
export type SelectionRequest = { version: 1; selected: SelectedChoices };

export const DEFAULT_GROUPS: ReadonlyArray<{
  key: GroupKey; label: string; category: MenuCategory; required: number
}> = [
  { key: 'appetizer', label: 'Appetizer / Salad', category: 'appetizer', required: 1 },
  { key: 'main_course', label: 'Main Dishes / Entrées', category: 'main_course', required: 5 },
  { key: 'dessert', label: 'Dessert', category: 'dessert', required: 1 },
  { key: 'rice', label: 'Rice', category: 'main_course', required: 1 },
];

export function newChoiceRules(): ChoiceRules {
  return { version: 1, groups: DEFAULT_GROUPS.map(g => ({ ...g, eligible_menu_item_ids: [] })) };
}

export function emptyChoices(): SelectedChoices {
  return { appetizer: [], main_course: [], dessert: [], rice: [] };
}

/** Client-side configuration checks; publication still requires trusted DB checks. */
export function validateChoiceRules(
  rules: ChoiceRules,
  menu: CatererMenuItem[],
  catererId: string,
): string[] {
  if (!rules || rules.version !== 1 || !Array.isArray(rules.groups) || rules.groups.length !== 4) {
    return ['Exactly four dish groups are required.'];
  }
  const errors: string[] = [];
  const lookup = new Map(menu.map(m => [m.id, m]));
  const keys = new Set<GroupKey>();
  const used = new Set<string>();
  for (const group of rules.groups) {
    const defined = DEFAULT_GROUPS.find(g => g.key === group.key);
    if (!defined || keys.has(group.key) || group.category !== defined.category) {
      errors.push('Invalid or repeated dish group.');
      continue;
    }
    keys.add(group.key);
    if (!Number.isInteger(group.required) || group.required < 1 || group.required > 10) {
      errors.push(`${group.label}: choose a requirement between 1 and 10.`);
    }
    if (!Array.isArray(group.eligible_menu_item_ids) || group.eligible_menu_item_ids.length < group.required) {
      errors.push(`${group.label}: not enough eligible dishes.`);
      continue;
    }
    for (const id of group.eligible_menu_item_ids) {
      if (used.has(id)) errors.push('A dish cannot belong to multiple selection groups.');
      used.add(id);
      const item = lookup.get(id);
      if (!item || item.caterer_id !== catererId || item.category !== group.category) {
        errors.push(`${group.label}: dish must belong to this Caterer and category.`);
      }
    }
  }
  if (keys.size !== 4) errors.push('All four selection groups are required.');
  return errors;
}

/** Client-side selection feedback; Supabase must repeat all checks atomically. */
export function validateChoices(rules: ChoiceRules, chosen: SelectedChoices): string[] {
  if (!rules || !Array.isArray(rules.groups) || rules.groups.length !== 4 || !chosen) {
    return ['Invalid package selection rules.'];
  }
  const errors: string[] = [];
  const used = new Set<string>();
  for (const group of rules.groups) {
    const ids = chosen[group.key];
    if (!Array.isArray(ids) || ids.length !== group.required) {
      errors.push(`${group.label}: choose exactly ${group.required}.`);
      continue;
    }
    const allowed = new Set(group.eligible_menu_item_ids);
    for (const id of ids) {
      if (!allowed.has(id)) errors.push(`${group.label}: a selected dish is unavailable.`);
      if (used.has(id)) errors.push('A dish cannot be selected in two groups.');
      used.add(id);
    }
  }
  return errors;
}

export function makeSelectionRequest(rules: ChoiceRules, selected: SelectedChoices): SelectionRequest {
  const errors = validateChoices(rules, selected);
  if (errors.length) throw new Error(errors.join(' '));
  return { version: 1, selected: {
    appetizer: [...selected.appetizer],
    main_course: [...selected.main_course],
    dessert: [...selected.dessert],
    rice: [...selected.rice],
  } };
}
