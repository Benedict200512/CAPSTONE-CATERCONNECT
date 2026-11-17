import { useEffect, useId, useState } from 'react';
import { BadgeCheck, CakeSlice, CalendarDays, ChefHat, CheckCircle2, Circle, Clock3, GlassWater, MapPin, Package, Salad, Users, Utensils, UtensilsCrossed } from 'lucide-react';
import './BookingSummary.css';
import './BuffetDishPicker.css';
import { BUFFET_CATEGORIES, createBuffetConfig, buffetSelectedIds, buffetReviewGroups, toggleBuffetDish, validateBuffetConfig,
  type BuffetConfig, type BuffetMenuItem, type BuffetSelections, type PackageSelectionSnapshot } from '../lib/buildYourOwn';
import { BUFFET_BACKEND_PENDING, getBuffetCapabilities, loadBuffetMenu } from '../lib/buildYourOwnBackend';
import { catererCategoryOptions, isDefaultMenuCategory, CUSTOM_MENU_CATEGORY_WRITES_ENABLED, CUSTOM_CATEGORY_SETUP_MESSAGE } from '../lib/menuCategoryManagement';

export function BuffetConfigEditor({ value, onChange, catererId, published, showTypeSelector = true }: {
  value: BuffetConfig | null; onChange: (value: BuffetConfig | null) => void; catererId: string; published: boolean; showTypeSelector?: boolean;
}) {
  const [menu, setMenu] = useState<BuffetMenuItem[]>([]);
  const [message, setMessage] = useState('Loading menu catalog…');
  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ data, error }, capabilities] = await Promise.all([
        loadBuffetMenu(catererId).then(data => ({ data, error: false }), () => ({ data: [], error: true })),
        getBuffetCapabilities(),
      ]);
      if (!active) return;
      setMenu(error ? [] : data ?? []);
      setMessage(error ? 'Unable to load menu catalog. Reopen this form to retry.' : capabilities.version === 1 ? '' : BUFFET_BACKEND_PENDING);
    })();
    return () => { active = false; };
  }, [catererId]);
  const update = (index: number, patch: Partial<BuffetConfig['groups'][number]>) =>
    onChange({ version: 1, groups: value!.groups.map((group, i) => i === index ? { ...group, ...patch } : group) });
  return <section className="package-form-section">
    {showTypeSelector && <div className="package-field"><label>Package type</label>
      <select value={value ? 'build_your_own' : 'standard'} disabled={published}
        onChange={event => onChange(event.target.value === 'standard' ? null : createBuffetConfig())}>
        <option value="standard">Standard Package</option><option value="build_your_own">Build Your Own Package</option>
      </select>
      {published && <small>Unpublish this package before changing its type.</small>}
    </div>}
    {value && <>
      <h3>Included Buffet Choices</h3><p>Customers choose these dishes within the fixed package price.</p>
      {message && <p role="status">{message}</p>}
      {value.groups.map((group, index) => <fieldset key={group.id} className="package-buffet-group">
        <legend>{group.label || 'Selection group'}</legend>
        <div className="package-field"><label>Group name<input maxLength={80} value={group.label} onChange={event => update(index, { label: event.target.value })} /></label></div>
        <div className="package-field"><label>Menu category<select value={group.category} onChange={event => update(index, { category: event.target.value as typeof group.category, menu_item_ids: [] })}>
          {catererCategoryOptions(menu, group.category).map(category => <option key={category.key} value={category.key}
            disabled={!CUSTOM_MENU_CATEGORY_WRITES_ENABLED && !isDefaultMenuCategory(category.key)}>
            {BUFFET_CATEGORIES.find(item => item.value === category.key)?.label ?? category.label}</option>)}
        </select></label></div>
        <small>Choose eligible dishes from this category. Existing Rice groups can continue using Main Course.</small>
        {!CUSTOM_MENU_CATEGORY_WRITES_ENABLED && <small>{CUSTOM_CATEGORY_SETUP_MESSAGE}</small>}
        <div className="package-field"><label>Required choices<input type="number" min={1} max={100} step={1} value={group.required_count} onChange={event => update(index, { required_count: Number(event.target.value) })} /></label></div>
        <div className="package-chips">{menu.filter(item => item.category === group.category).map(item => {
          const checked = group.menu_item_ids.includes(item.id);
          const used = value.groups.some(other => other.id !== group.id && other.menu_item_ids.includes(item.id));
          return <label key={item.id} className="package-added-chip"><input type="checkbox" checked={checked} disabled={used}
            onChange={() => update(index, { menu_item_ids: checked ? group.menu_item_ids.filter(id => id !== item.id) : [...group.menu_item_ids, item.id] })} />{item.name}</label>;
        })}</div>
        <p>{group.menu_item_ids.length} eligible · Choose {group.required_count}</p>
        <button className="package-secondary-button" type="button" onClick={() => onChange({ ...value, groups: value.groups.filter(item => item.id !== group.id) })}>Remove group</button>
      </fieldset>)}
      <button className="package-secondary-button" type="button" disabled={value.groups.length >= 20} onClick={() => onChange({ version: 1, groups: [...value.groups, {
        id: crypto.randomUUID(), label: '', category: 'main_course', required_count: 1, menu_item_ids: [],
      }] })}>Add selection group</button>
      {validateBuffetConfig(value, menu, catererId) && <p role="status">{validateBuffetConfig(value, menu, catererId)}</p>}
    </>}
  </section>;
}

export function BuffetDishPicker({ config, selections, menu, onChange }: {
  config: BuffetConfig; selections: BuffetSelections; menu: BuffetMenuItem[]; onChange: (value: BuffetSelections) => void;
}) {
  const pickerId = useId();
  const error = validateBuffetConfig(config, menu);
  return <section className="cc-buffet-picker" aria-labelledby={`${pickerId}-title`}>
    <header className="cc-buffet-picker-header"><span className="cc-buffet-picker-icon"><UtensilsCrossed size={21} aria-hidden="true" /></span>
      <div><h2 id={`${pickerId}-title`}>Included Buffet Choices</h2><p>Choose your favorite dishes. These selections are already included in your package price.</p></div>
    </header>
    {error ? <p className="cc-buffet-picker-error" role="alert">{error}</p> : config.groups.map((group, index) => {
      const count = buffetSelectedIds(selections, group.id).length;
      const categoryLabel = BUFFET_CATEGORIES.find(category => category.value === group.category)?.label;
      const GroupIcon = group.label.trim().toLowerCase() === categoryLabel?.toLowerCase()
        ? new Map([['appetizer', Salad], ['main_course', ChefHat], ['dessert', CakeSlice], ['drink', GlassWater]]).get(group.category) ?? Utensils : Utensils;
      return <div className="cc-buffet-group-card" role="group" aria-labelledby={`${pickerId}-${index}-title`} aria-describedby={`${pickerId}-${index}-instruction`} key={group.id}>
        <div className="cc-buffet-group-header"><h3 id={`${pickerId}-${index}-title`}><GroupIcon size={18} aria-hidden="true" />{group.label}</h3>
          <div className="cc-buffet-group-meta"><span id={`${pickerId}-${index}-instruction`}>Choose {group.required_count}</span>
            <span className={`cc-buffet-counter${count === group.required_count ? ' is-complete' : ''}`} role="status" aria-live="polite" aria-atomic="true">{count}/{group.required_count} selected</span></div>
        </div>
        <div className="cc-buffet-dish-list">{group.menu_item_ids.map(id => {
          const item = menu.find(candidate => candidate.id === id)!;
          const checked = buffetSelectedIds(selections, group.id).includes(id);
          return <label className="cc-buffet-dish" key={id}>
            <input type="checkbox" checked={checked}
              disabled={!checked && buffetSelectedIds(selections, group.id).length >= group.required_count}
              onChange={() => onChange(toggleBuffetDish(config, selections, group.id, id))} />
            <span className="cc-buffet-dish-surface"><span className="cc-buffet-dish-name">{item.name}</span>
              {checked ? <CheckCircle2 size={21} aria-hidden="true" /> : <Circle size={21} aria-hidden="true" />}
            </span>
          </label>;
        })}</div>
      </div>;
    })}
  </section>;
}

export function BuffetSelectionReview({ config, selections, menu }: { config: BuffetConfig | null | undefined; selections: BuffetSelections; menu: BuffetMenuItem[] }) {
  if (!config) return null;
  return <BuffetSummaryGroups groups={buffetReviewGroups(config, selections, menu)} />;
}

export function PackageOverview({ name, tier, packageType = 'Build Your Own Package', showHeading = true }: {
  name: string; tier?: string | null; packageType?: string; showHeading?: boolean;
}) {
  return <section className={`cc-byo-overview${showHeading ? ' cc-byo-card' : ''}`}>
    {showHeading && <h3 className="cc-byo-section-title"><Package size={18} aria-hidden="true" />Package Overview</h3>}
    <div className="cc-byo-badges"><span className="cc-byo-badge"><UtensilsCrossed size={13} aria-hidden="true" />{packageType}</span>
      {tier && <span className="cc-byo-badge cc-byo-badge-tier">{tier}</span>}</div>
    <h4 className="cc-byo-package-name">{name}</h4>
  </section>;
}

function BuffetSummaryGroups({ groups }: { groups: { id: string; label: string; names: string[] }[] }) {
  return <section className="cc-byo-card"><h3 className="cc-byo-section-title"><UtensilsCrossed size={18} aria-hidden="true" />Included Buffet Choices</h3>
    <p className="cc-byo-helper">Included in the package price</p>
    <div className="cc-byo-groups">{groups.map(group => <div className="cc-byo-group" key={group.id}>
      <div className="cc-byo-group-label"><UtensilsCrossed size={15} aria-hidden="true" /><h4>{group.label}</h4></div>
      <div className="cc-byo-dishes">{group.names.map((name, index) => <div className="cc-byo-dish" key={index}><CheckCircle2 size={14} aria-hidden="true" /><span>{name}</span></div>)}</div>
    </div>)}</div>
  </section>;
}

export function IncludedServices({ items, title = 'Included Services' }: { items: string[]; title?: string }) {
  if (!items.length) return null;
  return <section className="cc-byo-card"><h3 className="cc-byo-section-title"><BadgeCheck size={18} aria-hidden="true" />{title}</h3>
    <div className="cc-byo-services">{items.map((item, index) => <div className="cc-byo-service" key={index}><BadgeCheck size={16} aria-hidden="true" /><span>{item}</span></div>)}</div>
  </section>;
}

export function BookingDetailRows({ rows }: { rows: { label: string; value: string | number; icon: 'event' | 'date' | 'time' | 'guests' | 'venue' }[] }) {
  const icons = { event: UtensilsCrossed, date: CalendarDays, time: Clock3, guests: Users, venue: MapPin };
  return <dl className="cc-byo-detail-rows">{rows.map(row => { const Icon = icons[row.icon]; return <div key={row.label}>
    <dt><Icon size={16} aria-hidden="true" />{row.label}</dt><dd>{row.value}</dd>
  </div>; })}</dl>;
}

export function PackageSnapshotDetails({ snapshot, standardIncludes, tier }: { snapshot?: PackageSelectionSnapshot | null; standardIncludes?: string[] | null; tier?: string | null }) {
  if (!snapshot) return <section><p>Standard Package</p>{!!standardIncludes?.length && <><h4>Included services</h4><ul>{standardIncludes.map((item, index) => <li key={index}>{item}</li>)}</ul></>}</section>;
  return <section className="cc-byo-summary">
    <PackageOverview name={snapshot.package_name} tier={tier} packageType={snapshot.package_type === 'build_your_own' ? 'Build Your Own Package' : 'Standard Package'} />
    {snapshot.groups.length > 0 && <BuffetSummaryGroups groups={snapshot.groups.map(group => ({ ...group, names: group.items.map(item => item.name) }))} />}
    {!!snapshot.food_inclusions?.length && <IncludedServices items={snapshot.food_inclusions} title="Food Inclusions" />}
    <IncludedServices items={snapshot.includes} />
  </section>;
}
