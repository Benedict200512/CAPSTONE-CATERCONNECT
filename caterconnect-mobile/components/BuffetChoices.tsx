import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BadgeCheck, CakeSlice, CalendarDays, ChefHat, Check, CheckCircle2, Circle, Clock3, GlassWater, MapPin, Package, Plus, Salad, Trash2, Users, Utensils, UtensilsCrossed } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { BUFFET_CATEGORIES, createBuffetConfig, buffetSelectedIds, buffetReviewGroups, toggleBuffetDish, validateBuffetConfig,
  type BuffetConfig, type BuffetMenuItem, type BuffetSelections, type PackageSelectionSnapshot } from '../lib/buildYourOwn';
import { BUFFET_BACKEND_PENDING, getBuffetCapabilities, loadBuffetMenu } from '../lib/buildYourOwnBackend';
import { catererCategoryOptions, isDefaultMenuCategory, CUSTOM_MENU_CATEGORY_WRITES_ENABLED, CUSTOM_CATEGORY_SETUP_MESSAGE } from '../lib/menuCategoryManagement';

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
    {selected && <Check size={16} color={Colors.orange} />}<Text style={styles.choiceText}>{label}</Text>
  </TouchableOpacity>;
}

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
  return <View style={styles.section}>
    {showTypeSelector && <><Text style={styles.heading}>Package type</Text>
    <View style={styles.wrap}>
      <Choice label="Standard Package" selected={!value} disabled={published} onPress={() => onChange(null)} />
      <Choice label="Build Your Own Package" selected={!!value} disabled={published} onPress={() => { if (!value) onChange(createBuffetConfig()); }} />
    </View>
    {published && <Text style={styles.hint}>Unpublish this package before changing its type.</Text>}</>}
    {value && <>
      <Text style={styles.heading}>Included Buffet Choices</Text><Text style={styles.hint}>Customers choose these dishes within the fixed package price.</Text>
      {!!message && <Text style={styles.hint}>{message}</Text>}
      {value.groups.map((group, index) => <View key={group.id} style={styles.group}>
        <Text style={styles.label}>Group name</Text>
        <TextInput style={styles.input} maxLength={80} value={group.label} onChangeText={label => update(index, { label })} accessibilityLabel="Buffet group name" />
        <Text style={styles.label}>Menu category</Text><View style={styles.wrap}>{catererCategoryOptions(menu, group.category).map(category =>
          <Choice key={category.key} label={BUFFET_CATEGORIES.find(item => item.value === category.key)?.label ?? category.label}
            selected={group.category === category.key} disabled={!CUSTOM_MENU_CATEGORY_WRITES_ENABLED && !isDefaultMenuCategory(category.key)}
            onPress={() => { if (group.category !== category.key) update(index, { category: category.key, menu_item_ids: [] }); }} />)}</View>
        <Text style={styles.hint}>Choose eligible dishes from this category. Existing Rice groups can continue using Main Course.</Text>
        {!CUSTOM_MENU_CATEGORY_WRITES_ENABLED && <Text style={styles.hint}>{CUSTOM_CATEGORY_SETUP_MESSAGE}</Text>}
        <Text style={styles.label}>Required choices</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={String(group.required_count)} onChangeText={count => update(index, { required_count: Number(count) })} accessibilityLabel={`Required choices for ${group.label}`} />
        <View style={styles.wrap}>{menu.filter(item => item.category === group.category).map(item => {
          const selected = group.menu_item_ids.includes(item.id);
          const used = value.groups.some(other => other.id !== group.id && other.menu_item_ids.includes(item.id));
          return <Choice key={item.id} label={item.name} selected={selected} disabled={used} onPress={() => update(index, { menu_item_ids: selected ? group.menu_item_ids.filter(id => id !== item.id) : [...group.menu_item_ids, item.id] })} />;
        })}</View>
        <Text style={styles.hint}>{group.menu_item_ids.length} eligible · Choose {group.required_count}</Text>
        <TouchableOpacity style={styles.choice} accessibilityLabel={`Remove ${group.label} group`} onPress={() => onChange({ ...value, groups: value.groups.filter(item => item.id !== group.id) })}>
          <Trash2 size={16} color={Colors.error} /><Text style={styles.choiceText}>Remove group</Text>
        </TouchableOpacity>
      </View>)}
      <TouchableOpacity style={styles.choice} disabled={value.groups.length >= 20} onPress={() => onChange({ version: 1, groups: [...value.groups, {
        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, label: '', category: 'main_course', required_count: 1, menu_item_ids: [],
      }] })}><Plus size={16} color={Colors.orange} /><Text style={styles.choiceText}>Add selection group</Text></TouchableOpacity>
      {!!validateBuffetConfig(value, menu, catererId) && <Text style={styles.hint}>{validateBuffetConfig(value, menu, catererId)}</Text>}
    </>}
  </View>;
}

export function BuffetDishPicker({ config, selections, menu, onChange }: {
  config: BuffetConfig; selections: BuffetSelections; menu: BuffetMenuItem[]; onChange: (value: BuffetSelections) => void;
}) {
  // React Native Web's checkbox-role Pressable handles Enter, but not Space.
  // Route Space through its existing click/onPress path exactly once.
  const webCheckboxKeys = Platform.OS === 'web' ? {
    onKeyDownCapture: (event: { key: string; preventDefault(): void; stopPropagation(): void }) => {
      if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); event.stopPropagation(); }
    },
    onKeyUpCapture: (event: { key: string; preventDefault(): void; stopPropagation(): void; currentTarget: { click(): void } }) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault(); event.stopPropagation(); event.currentTarget.click();
      }
    },
  } : {};
  const error = validateBuffetConfig(config, menu);
  return <View style={pickerStyles.section}>
    <View style={pickerStyles.header}><View style={pickerStyles.headerIcon}><UtensilsCrossed size={21} color={Colors.orange} accessible={false} /></View>
      <View style={pickerStyles.headerText}><Text accessibilityRole="header" style={pickerStyles.heading}>Included Buffet Choices</Text>
        <Text style={pickerStyles.helper}>Choose your favorite dishes. These selections are already included in your package price.</Text></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={pickerStyles.error}>{error}</Text> : config.groups.map(group => {
      const count = buffetSelectedIds(selections, group.id).length;
      const categoryLabel = BUFFET_CATEGORIES.find(category => category.value === group.category)?.label;
      const GroupIcon = group.label.trim().toLowerCase() === categoryLabel?.toLowerCase()
        ? new Map([['appetizer', Salad], ['main_course', ChefHat], ['dessert', CakeSlice], ['drink', GlassWater]]).get(group.category) ?? Utensils : Utensils;
      return <View key={group.id} style={pickerStyles.card}>
        <View style={pickerStyles.groupTitleRow}><GroupIcon size={18} color={Colors.orange} accessible={false} /><Text accessibilityRole="header" style={pickerStyles.groupTitle}>{group.label}</Text></View>
        <View style={pickerStyles.meta}><Text style={pickerStyles.instruction}>Choose {group.required_count}</Text>
          <View style={[pickerStyles.counter, count === group.required_count && pickerStyles.counterComplete]}><Text accessibilityLiveRegion="polite" accessibilityLabel={`${count} of ${group.required_count} selected for ${group.label}`} style={pickerStyles.counterText}>{count}/{group.required_count} selected</Text></View>
        </View>
        <View style={pickerStyles.dishes}>{group.menu_item_ids.map(id => {
          const selected = buffetSelectedIds(selections, group.id).includes(id);
          const disabled = !selected && buffetSelectedIds(selections, group.id).length >= group.required_count;
          const item = menu.find(candidate => candidate.id === id)!;
          return <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={item.name}
            {...webCheckboxKeys}
            aria-checked={selected}
            accessibilityHint={`Choose ${group.required_count} dishes for ${group.label}`}
            accessibilityState={{ checked: selected, disabled }} focusable={!disabled} disabled={disabled}
            onPress={() => onChange(toggleBuffetDish(config, selections, group.id, id))}
            style={({ pressed }) => [pickerStyles.dish, selected && pickerStyles.dishSelected, disabled && pickerStyles.dishDisabled, pressed && !disabled && pickerStyles.dishPressed]}>
            <Text style={[pickerStyles.dishName, selected && pickerStyles.dishNameSelected]}>{item.name}</Text>
            {selected ? <CheckCircle2 size={21} color={Colors.orangeDark} accessible={false} /> : <Circle size={21} color={Colors.textSecondary} accessible={false} />}
          </Pressable>;
        })}</View>
      </View>;
    })}
  </View>;
}

const pickerStyles = StyleSheet.create({
  section: { gap: 14, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minWidth: 0 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.orangeLight, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0, gap: 5 },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: '700', color: Colors.black },
  helper: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  card: { padding: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 15, backgroundColor: Colors.bgCard, gap: 12, minWidth: 0 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
  groupTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 23, fontWeight: '600', color: Colors.textPrimary },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 0 },
  instruction: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  counter: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: Colors.bgInput },
  counterComplete: { backgroundColor: Colors.orangeLight },
  counterText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: Colors.textPrimary },
  dishes: { gap: 10, minWidth: 0 },
  dish: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, backgroundColor: Colors.bgCard, minWidth: 0 },
  dishSelected: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  dishDisabled: { backgroundColor: Colors.bg },
  dishPressed: { opacity: 0.8 },
  dishName: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
  dishNameSelected: { fontWeight: '600' },
  error: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.error, color: Colors.error, fontSize: 14, lineHeight: 21, backgroundColor: Colors.bgCard },
});

export function BuffetSelectionReview({ config, selections, menu }: { config: BuffetConfig | null | undefined; selections: BuffetSelections; menu: BuffetMenuItem[] }) {
  if (!config) return null;
  return <BuffetSummaryGroups groups={buffetReviewGroups(config, selections, menu)} />;
}

export function PackageOverview({ name, tier, packageType = 'Build Your Own Package', showHeading = true }: {
  name: string; tier?: string | null; packageType?: string; showHeading?: boolean;
}) {
  return <View style={[showHeading && summaryStyles.card, summaryStyles.overview]}>
    {showHeading && <View style={summaryStyles.titleRow}><Package size={18} color={Colors.orange} /><Text accessibilityRole="header" style={summaryStyles.title}>Package Overview</Text></View>}
    <View style={summaryStyles.badges}><View style={summaryStyles.badge}><UtensilsCrossed size={13} color={Colors.orangeDark} /><Text style={summaryStyles.badgeText}>{packageType}</Text></View>
      {tier ? <View style={[summaryStyles.badge, summaryStyles.tierBadge]}><Text style={summaryStyles.tierText}>{tier}</Text></View> : null}</View>
    <Text style={summaryStyles.packageName}>{name}</Text>
  </View>;
}

function BuffetSummaryGroups({ groups }: { groups: { id: string; label: string; names: string[] }[] }) {
  return <View style={summaryStyles.card}><View style={summaryStyles.titleRow}><UtensilsCrossed size={18} color={Colors.orange} /><Text accessibilityRole="header" style={summaryStyles.title}>Included Buffet Choices</Text></View>
    <Text style={summaryStyles.helper}>Included in the package price</Text>
    {groups.map(group => <View key={group.id} style={summaryStyles.group}>
      <View style={summaryStyles.titleRow}><UtensilsCrossed size={15} color={Colors.orangeDark} /><Text style={summaryStyles.groupLabel}>{group.label}</Text></View>
      {group.names.map((name, index) => <View key={index} style={summaryStyles.itemRow}><CheckCircle2 size={14} color={Colors.textSecondary} /><Text style={summaryStyles.value}>{name}</Text></View>)}
    </View>)}
  </View>;
}

export function IncludedServices({ items, title = 'Included Services' }: { items: string[]; title?: string }) {
  if (!items.length) return null;
  return <View style={summaryStyles.card}><View style={summaryStyles.titleRow}><BadgeCheck size={18} color={Colors.orange} /><Text accessibilityRole="header" style={summaryStyles.title}>{title}</Text></View>
    {items.map((item, index) => <View key={index} style={summaryStyles.itemRow}><BadgeCheck size={16} color={Colors.success} /><Text style={summaryStyles.value}>{item}</Text></View>)}
  </View>;
}

export function BookingDetailRows({ rows }: { rows: { label: string; value: string | number; icon: 'event' | 'date' | 'time' | 'guests' | 'venue' }[] }) {
  const icons = { event: UtensilsCrossed, date: CalendarDays, time: Clock3, guests: Users, venue: MapPin };
  return <View>{rows.map(row => { const Icon = icons[row.icon]; return <View key={row.label} style={summaryStyles.detailRow}>
    <View style={summaryStyles.detailLabel}><Icon size={16} color={Colors.orange} /><Text style={summaryStyles.label}>{row.label}</Text></View>
    <Text selectable style={summaryStyles.detailValue}>{row.value}</Text>
  </View>; })}</View>;
}

export function PackageSnapshotDetails({ snapshot, standardIncludes, tier }: { snapshot?: PackageSelectionSnapshot | null; standardIncludes?: string[] | null; tier?: string | null }) {
  if (!snapshot) return <View style={styles.section}><Text style={styles.label}>Standard Package</Text>{!!standardIncludes?.length && <><Text style={styles.label}>Included services</Text>{standardIncludes.map((item, index) => <Text key={index} style={styles.hint}>{item}</Text>)}</>}</View>;
  return <View style={summaryStyles.stack}>
    <PackageOverview name={snapshot.package_name} tier={tier} packageType={snapshot.package_type === 'build_your_own' ? 'Build Your Own Package' : 'Standard Package'} />
    {snapshot.groups.length > 0 && <BuffetSummaryGroups groups={snapshot.groups.map(group => ({ ...group, names: group.items.map(item => item.name) }))} />}
    {!!snapshot.food_inclusions?.length && <IncludedServices items={snapshot.food_inclusions} title="Food Inclusions" />}
    <IncludedServices items={snapshot.includes} />
  </View>;
}

const summaryStyles = StyleSheet.create({
  stack: { gap: 14, minWidth: 0, marginBottom: 14 },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, backgroundColor: Colors.bgCard, gap: 12, minWidth: 0 },
  overview: { gap: 12, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  title: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700', color: Colors.black },
  packageName: { fontSize: 20, lineHeight: 27, fontWeight: '800', color: Colors.black, flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, minWidth: 0 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.orangeLight, maxWidth: '100%' },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  tierBadge: { backgroundColor: Colors.bgInput },
  tierText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: Colors.textSecondary, textTransform: 'capitalize', flexShrink: 1 },
  helper: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  group: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, padding: 12, gap: 10, minWidth: 0 },
  groupLabel: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '700', color: Colors.textSecondary },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
  value: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
  label: { flex: 1, fontSize: 13, lineHeight: 21, color: Colors.textSecondary },
  detailValue: { flex: 1.2, minWidth: 0, fontSize: 14, lineHeight: 21, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
});

const styles = StyleSheet.create({
  section: { gap: 10, paddingVertical: 16 },
  heading: { fontSize: 17, fontWeight: '800', color: Colors.black },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  hint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  group: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, gap: 10 },
  input: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.textPrimary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, padding: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bgCard },
  choiceText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flexShrink: 1 },
  selected: { backgroundColor: Colors.orangeLight, borderColor: Colors.orange },
  disabled: { opacity: 0.45 },
});
