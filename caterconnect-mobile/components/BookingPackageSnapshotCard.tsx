import { StyleSheet, Text, View } from 'react-native';
import {
  BadgeCheck,
  CakeSlice,
  CheckCircle2,
  Coffee,
  Package,
  Salad,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import type { PackageSelectionSnapshot } from '../lib/buildYourOwn';

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

// Presentation only: display the immutable snapshot saved at booking creation.
// Do not reconstruct historical dish/service names from today's menu catalog.
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
  if (key.includes('appetizer') || key.includes('salad')) return <Salad size={18} color={Colors.orange} />;
  if (key.includes('dessert') || key.includes('sweet')) return <CakeSlice size={18} color={Colors.orange} />;
  if (key.includes('drink') || key.includes('beverage')) return <Coffee size={18} color={Colors.orange} />;
  return <Utensils size={18} color={Colors.orange} />;
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
    <View style={styles.card} accessibilityLabel="Saved package and inclusions">
      <View style={styles.heading}>
        <View style={styles.headingIcon}><Package size={19} color={Colors.orange} /></View>
        <Text style={styles.headingText}>Package &amp; Inclusions</Text>
      </View>

      <View style={styles.overview}>
        <View style={styles.badges}>
          {tier ? <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View> : null}
          <View style={styles.typeBadge}><Text style={styles.typeText}>{snapshot ? 'Build Your Own' : 'Standard Package'}</Text></View>
        </View>
        <Text style={styles.packageName}>{details.packageName}</Text>
        <Text style={styles.caption}>{snapshot ? 'Customer’s saved package selections' : 'Package details'}</Text>
      </View>

      {snapshot ? <>
      <View style={styles.sectionHeading}>
        <UtensilsCrossed size={18} color={Colors.orange} />
        <Text style={styles.sectionTitle}>Included Buffet Choices</Text>
      </View>
      <View style={styles.groups}>
        {details.groups.map((group, index) => (
          <View style={styles.groupCard} key={`${group.id}-${index}`}>
            <View style={styles.groupHeading}>
              <View style={styles.groupIcon}><GroupIcon category={group.category} label={group.label} /></View>
              <Text style={styles.groupTitle}>{group.label}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{group.dishes.length} selected</Text></View>
            </View>
            <View style={styles.dishes}>
              {group.dishes.map((dish, dishIndex) => (
                <View style={styles.dishRow} key={`${dish}-${dishIndex}`}>
                  <CheckCircle2 size={16} color={Colors.orange} />
                  <Text style={styles.dishName}>{dish}</Text>
                </View>
              ))}
              {group.dishes.length === 0 ? <Text style={styles.muted}>No saved dish names</Text> : null}
            </View>
          </View>
        ))}
        {details.groups.length === 0 ? <Text style={styles.muted}>No saved buffet groups</Text> : null}
      </View>
      </> : null}

      {details.services.length > 0 ? (
        <View style={[styles.services, !snapshot && styles.standardServices]}>
          <View style={styles.sectionHeading}>
            <BadgeCheck size={18} color={Colors.orange} />
            <Text style={styles.sectionTitle}>Included Services</Text>
          </View>
          <View style={styles.serviceList}>
            {details.services.map((service, index) => (
              <View style={styles.serviceRow} key={`${service}-${index}`}>
                <CheckCircle2 size={15} color={Colors.orange} />
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  headingIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF4E9',
    alignItems: 'center', justifyContent: 'center',
  },
  headingText: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: Colors.black, flexShrink: 1 },
  overview: {
    backgroundColor: '#FFFAF5', borderColor: '#FFEDD5', borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 18,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 9 },
  tierBadge: { backgroundColor: '#FFEDD5', borderRadius: 40, paddingHorizontal: 10, paddingVertical: 5 },
  tierText: { fontSize: 11, fontWeight: '700', color: '#9A3412', textTransform: 'capitalize' },
  typeBadge: {
    backgroundColor: Colors.white, borderColor: '#FED7AA', borderWidth: 1,
    borderRadius: 40, paddingHorizontal: 10, paddingVertical: 4,
  },
  typeText: { fontSize: 11, fontWeight: '700', color: '#9A3412' },
  packageName: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: Colors.black },
  caption: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.black, flexShrink: 1 },
  groups: { gap: 11 },
  groupCard: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: Colors.white, borderRadius: 12, padding: 12 },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupIcon: {
    width: 31, height: 31, borderRadius: 9, backgroundColor: '#FFF4E9',
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: { flex: 1, flexShrink: 1, color: '#1F2937', fontSize: 14, fontWeight: '700' },
  countBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 30, backgroundColor: '#F8FAFC' },
  countText: { fontSize: 11, color: '#64748B' },
  dishes: { gap: 7 },
  dishRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#F8FAFC', borderRadius: 9 },
  dishName: { fontSize: 14, lineHeight: 20, color: '#334155', flex: 1, flexShrink: 1 },
  services: { marginTop: 17, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  standardServices: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  serviceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', maxWidth: '100%' },
  serviceText: { color: '#334155', fontSize: 12, flexShrink: 1 },
  muted: { color: Colors.textSecondary, fontSize: 12 },
});
