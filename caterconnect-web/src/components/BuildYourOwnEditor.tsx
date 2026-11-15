import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  newChoiceRules,
  type ChoiceRules,
  type CatererMenuItem,
  type GroupKey,
} from '../lib/buildYourOwn';

type Props = {
  catererId: string;
  rules: ChoiceRules;
  setRules: (rules: ChoiceRules) => void;
  onCatalog: (menu: CatererMenuItem[], error: string | null, loading: boolean) => void;
};

/** Caterer-only package configuration editor. Never modifies menu prices. */
export default function BuildYourOwnEditor({ catererId, rules, setRules, onCatalog }: Props) {
  const [items, setItems] = useState<CatererMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      onCatalog([], null, true);
      setLoading(true);
      const { data, error: lookupError } = await supabase
        .from('menu_items')
        .select('id, caterer_id, category, name')
        .eq('caterer_id', catererId)
        .order('name');
      if (!active) return;
      const nextItems = (data ?? []) as CatererMenuItem[];
      setItems(nextItems);
      setError(lookupError?.message ?? null);
      setLoading(false);
      onCatalog(nextItems, lookupError?.message ?? null, false);
    };
    void load();
    return () => { active = false; };
  }, [catererId]);

  const updateRequired = (key: GroupKey, count: number) =>
    setRules({
      ...rules,
      groups: rules.groups.map(g => g.key === key ? { ...g, required: count } : g),
    });

  const toggleEligible = (key: GroupKey, id: string) =>
    setRules({
      ...rules,
      groups: rules.groups.map(g => g.key === key
        ? { ...g, eligible_menu_item_ids: g.eligible_menu_item_ids.includes(id)
          ? g.eligible_menu_item_ids.filter(value => value !== id)
          : [...g.eligible_menu_item_ids, id] }
        : g),
    });

  if (!rules || !Array.isArray(rules.groups)) return <p>Invalid package selection settings.</p>;

  return (
    <section className="package-form-section">
      <h3>Included Buffet Choices</h3>
      <p style={{ color: '#64748b', fontSize: 13 }}>
        Choose which dishes Customers may select. These are included in the package price and are NOT paid add-ons.
        To offer rice, add it to Menu Management as a Main Course item first.
      </p>
      {loading && <p>Loading Caterer menu…</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>Menu loading failed: {error}</p>}
      {rules.groups.map(group => (
        <div key={group.key} style={{ margin: '12px 0', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 10 }}>
            {group.label} — required selections
            <input
              type="number" min="1" max="10" step="1" value={group.required}
              onChange={e => updateRequired(group.key, Number(e.currentTarget.value))}
              style={{ marginLeft: 12, width: 64 }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {items.filter(item => item.category === group.category).map(item => {
              const checked = group.eligible_menu_item_ids.includes(item.id);
              const usedElsewhere = rules.groups.some(g => g.key !== group.key && g.eligible_menu_item_ids.includes(item.id));
              return (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: usedElsewhere && !checked ? .5 : 1 }}>
                  <input type="checkbox" checked={checked} disabled={usedElsewhere && !checked}
                    onChange={() => toggleEligible(group.key, item.id)} />
                  {item.name}
                </label>
              );
            })}
          </div>
          <small style={{ color: '#64748b' }}>
            {group.eligible_menu_item_ids.length} eligible; Customer must choose {group.required}
          </small>
        </div>
      ))}
    </section>
  );
}
