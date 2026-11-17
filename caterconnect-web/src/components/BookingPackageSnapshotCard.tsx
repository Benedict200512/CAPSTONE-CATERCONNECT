import {
  BadgeCheck,
  CakeSlice,
  CheckCircle2,
  Coffee,
  Package,
  Salad,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import type { PackageSelectionSnapshot } from '../lib/buildYourOwn';
import './BookingPackageSnapshotCard.css';

type SnapshotGroup = {
  id: string;
  label: string;
  category: string;
  dishes: string[];
};

type SnapshotPresentation = {
  packageName: string;
  services: string[];
  groups: SnapshotGroup[];
};

// Presentation only: read the server-authored, immutable booking snapshot.
// Never replace historical names with current catalog values.
function readSnapshot(
  snapshot: PackageSelectionSnapshot | null | undefined,
  fallbackName?: string | null,
  standardIncludes?: string[] | null,
): SnapshotPresentation {
  if (!snapshot) {
    return {
      packageName: fallbackName?.trim() || 'Package information unavailable',
      services: Array.isArray(standardIncludes)
        ? standardIncludes.filter((service): service is string => typeof service === 'string' && service.trim().length > 0)
        : [],
      groups: [],
    };
  }
  const raw = snapshot as unknown as Record<string, unknown>;
  const groups: SnapshotGroup[] = Array.isArray(raw.groups)
    ? raw.groups.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const group = value as Record<string, unknown>;
        const dishes = Array.isArray(group.items)
          ? group.items.flatMap((entry) => {
              if (typeof entry === 'string') return [entry];
              if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
              const name = (entry as Record<string, unknown>).name;
              return typeof name === 'string' && name.trim() ? [name] : [];
            })
          : [];
        return [{
          id: typeof group.id === 'string' ? group.id : String(index),
          label: typeof group.label === 'string' && group.label.trim() ? group.label : 'Buffet selection',
          category: typeof group.category === 'string' ? group.category : '',
          dishes,
        }];
      })
    : [];
  const services = Array.isArray(raw.includes)
    ? raw.includes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  return {
    packageName: typeof raw.package_name === 'string' && raw.package_name.trim()
      ? raw.package_name
      : 'Package information',
    services,
    groups,
  };
}

function GroupIcon({ category, label }: { category: string; label: string }) {
  const key = `${category} ${label}`.toLowerCase();
  if (key.includes('appetizer') || key.includes('salad')) return <Salad size={18} aria-hidden />;
  if (key.includes('dessert') || key.includes('sweet')) return <CakeSlice size={18} aria-hidden />;
  if (key.includes('drink') || key.includes('beverage')) return <Coffee size={18} aria-hidden />;
  return <Utensils size={18} aria-hidden />;
}

export default function BookingPackageSnapshotCard({
  snapshot,
  tier,
  packageName,
  standardIncludes,
}: {
  snapshot?: PackageSelectionSnapshot | null;
  tier?: string | null;
  packageName?: string | null;
  standardIncludes?: string[] | null;
}) {
  const details = readSnapshot(snapshot, packageName, standardIncludes);

  return (
    <section className="cc-snapshot" aria-label="Saved package and inclusions">
      <div className="cc-snapshot__heading">
        <span className="cc-snapshot__heading-icon"><Package size={19} aria-hidden /></span>
        <h3>Package &amp; Inclusions</h3>
      </div>

      <div className="cc-snapshot__overview">
        <div className="cc-snapshot__badges">
          {tier && <span className="cc-snapshot__badge cc-snapshot__badge--tier">{tier}</span>}
          <span className="cc-snapshot__badge cc-snapshot__badge--type">{snapshot ? 'Build Your Own' : 'Standard Package'}</span>
        </div>
        <p className="cc-snapshot__package-name">{details.packageName}</p>
        <p className="cc-snapshot__package-caption">{snapshot ? 'Customer’s saved package selections' : 'Package details'}</p>
      </div>

      {snapshot && <>
      <div className="cc-snapshot__section-heading">
        <UtensilsCrossed size={18} aria-hidden />
        <h4>Included Buffet Choices</h4>
      </div>
      <div className="cc-snapshot__groups">
        {details.groups.map((group, index) => (
          <div className="cc-snapshot__group" key={`${group.id}-${index}`}>
            <div className="cc-snapshot__group-heading">
              <span className="cc-snapshot__group-icon"><GroupIcon category={group.category} label={group.label} /></span>
              <span className="cc-snapshot__group-title">{group.label}</span>
              <span className="cc-snapshot__group-count">{group.dishes.length} selected</span>
            </div>
            <div className="cc-snapshot__dish-list">
              {group.dishes.map((dish, dishIndex) => (
                <div className="cc-snapshot__dish" key={`${dish}-${dishIndex}`}>
                  <CheckCircle2 size={16} aria-hidden />
                  <span>{dish}</span>
                </div>
              ))}
              {group.dishes.length === 0 && <p className="cc-snapshot__muted">No saved dish names</p>}
            </div>
          </div>
        ))}
        {details.groups.length === 0 && <p className="cc-snapshot__muted">No saved buffet groups</p>}
      </div>
      </>}

      {details.services.length > 0 && (
        <div className={`cc-snapshot__services${snapshot ? '' : ' cc-snapshot__services--standard'}`}>
          <div className="cc-snapshot__section-heading">
            <BadgeCheck size={18} aria-hidden />
            <h4>Included Services</h4>
          </div>
          <div className="cc-snapshot__service-list">
            {details.services.map((service, index) => (
              <span className="cc-snapshot__service" key={`${service}-${index}`}>
                <CheckCircle2 size={15} aria-hidden /> {service}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
