import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Scale, Utensils, X } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { usePackageComparison } from '../../context/PackageComparisonContext';
import { loadComparisonPackages, type ComparisonItem, type ComparisonPackage } from '../../lib/packageComparison';

function PackageImage({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={styles.image} />
    : <View style={[styles.image, styles.placeholder]}><Utensils size={32} color={Colors.textMuted} /><Text style={styles.muted}>No image available</Text></View>;
}
const specified = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? 'Not specified' : String(value);
const list = (values: string[] | null) => values?.length ? values.map(value => `• ${value}`).join('\n') : 'Not specified';
const fields: { label: string; value: (pkg: ComparisonPackage) => string }[] = [
  { label: 'Caterer', value: pkg => specified(pkg.business_name) },
  { label: 'Package price', value: pkg => pkg.price === null || !Number.isFinite(Number(pkg.price)) ? 'Not specified'
    : Number(pkg.price).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) },
  { label: 'Maximum guests', value: pkg => pkg.max_guests == null ? 'Not specified' : `${pkg.max_guests} guests` },
  { label: 'Included guest capacity', value: pkg => pkg.guest_capacity === null ? 'Not specified' : `${pkg.guest_capacity} guests` },
  { label: 'Minimum guest count', value: pkg => pkg.min_guests === null ? 'Not specified' : `${pkg.min_guests} guests` },
  { label: 'Package tier', value: pkg => specified(pkg.tier) },
  { label: 'Description', value: pkg => specified(pkg.description) },
  { label: 'Food / menu inclusions', value: pkg => list(pkg.food_inclusions) },
  { label: 'Other package inclusions', value: pkg => list(pkg.includes) },
  { label: 'Supported event types', value: pkg => list(pkg.event_types) },
];

export default function PackageComparisonScreen() {
  const router = useRouter();
  const comparison = usePackageComparison();
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(290, Math.max(210, (width - 48) / 2));
  const key = `${comparison.customerId ?? ''}:${comparison.selectedIds.join(',')}`;
  const identity = useRef(key); identity.current = key;
  const request = useRef(0);
  const [state, setState] = useState<{ key: string; rows: ComparisonItem[]; loading: boolean; error: string | null }>({ key: '', rows: [], loading: false, error: null });
  const idsKey = comparison.selectedIds.join(',');
  const customerId = comparison.customerId;
  const refresh = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (!customerId || ids.length < 2 || identity.current !== key) return;
    const version = ++request.current;
    const current = () => identity.current === key && request.current === version;
    setState({ key, rows: [], loading: true, error: null });
    try {
      const rows = await loadComparisonPackages(ids);
      if (current()) setState({ key, rows, loading: false, error: null });
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : 'Please check your connection and try again.';
      if (current()) setState({ key, rows: [], loading: false, error: message });
    }
  }, [customerId, idsKey, key]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current++; };
  }, [refresh]));
  const own = state.key === key;
  const rows = own ? state.rows : [];
  const loading = !!customerId && comparison.selectedIds.length >= 2 && (!own || state.loading);
  const error = own ? state.error : null;
  const browse = () => router.replace('/(tabs)');
  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Go back"
        onPress={() => router.canGoBack() ? router.back() : browse()}><ChevronLeft size={24} color={Colors.orange} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Compare Packages</Text><Text style={styles.muted}>Find the right fit for your event</Text></View>
    </View>
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={Colors.orange} />}>
      {!customerId || comparison.selectedIds.length < 2 ? <View style={styles.empty}>
        <Scale size={44} color={Colors.orange} /><Text style={styles.name}>Select 2–3 packages</Text>
        <Text style={styles.muted}>{customerId ? `${comparison.selectedIds.length} selected. Add packages from caterer listings or Saved Packages.` : 'Sign in with a customer account to compare packages.'}</Text>
        <TouchableOpacity style={styles.button} onPress={browse}><Text style={styles.buttonText}>Return to Browsing</Text></TouchableOpacity>
      </View> : loading ? <View style={styles.empty}><ActivityIndicator color={Colors.orange} size="large" /><Text style={styles.muted}>Checking current package details…</Text></View>
        : error ? <View style={styles.notice}><Text style={styles.name}>Could not load comparison</Text><Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => void refresh()}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity></View> : <>
          <Text style={styles.hint}>Swipe horizontally to compare. Prices are package prices, not per-guest quotations.</Text>
          {rows.some(row => !row.package) && <Text style={styles.warning}>Some packages were removed or are no longer available. Remove them and choose another package.</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16 }}>
            <View style={styles.table}>
              <View style={styles.row}>{rows.map(row => <View key={row.id} style={[styles.cell, { width: columnWidth }]}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove package from comparison" style={styles.remove} onPress={() => comparison.remove(row.id)}><X size={20} color={Colors.orange} /><Text style={styles.link}>Remove</Text></TouchableOpacity>
                {row.package ? <PackageImage key={row.package.image_url} uri={row.package.image_url} /> : <View style={[styles.image, styles.placeholder]}><Scale color={Colors.textMuted} size={30} /></View>}
                <Text style={styles.name}>{row.package ? specified(row.package.name) : 'Package unavailable'}</Text>
              </View>)}</View>
              {fields.map(field => <View key={field.label}>
                <View style={styles.row}>{rows.map(row => <Text key={row.id} style={[styles.rowLabel, { width: columnWidth }]}>{field.label}</Text>)}</View>
                <View style={styles.row}>{rows.map(row => <View key={row.id} style={[styles.cell, { width: columnWidth }]}>
                  <Text style={styles.value}>{row.package ? field.value(row.package) : 'Unavailable'}</Text>
                </View>)}</View>
              </View>)}
              <View style={styles.row}>{rows.map(row => <View key={row.id} style={[styles.cell, { width: columnWidth }]}>
                {row.package && <TouchableOpacity accessibilityRole="button" style={styles.button}
                  onPress={() => router.push({ pathname: '/(tabs)/caterer/[catererId]', params: { catererId: row.package!.caterer_id, packageId: row.id } })}>
                  <Text style={styles.buttonText}>View Package</Text>
                </TouchableOpacity>}
              </View>)}</View>
            </View>
          </ScrollView>
          <TouchableOpacity onPress={browse} style={styles.browse}><Text style={styles.link}>Return to Browsing</Text></TouchableOpacity>
        </>}
      {!!customerId && comparison.selectedIds.length > 0 && <TouchableOpacity onPress={comparison.clear} style={styles.browse}><Text style={styles.link}>Clear Selection</Text></TouchableOpacity>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  back: { padding: 8, borderRadius: 12, backgroundColor: Colors.orangeLight },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  name: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  muted: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  hint: { marginHorizontal: 20, marginBottom: 16, color: Colors.textSecondary, lineHeight: 21 },
  warning: { marginHorizontal: 20, marginBottom: 16, padding: 12, backgroundColor: Colors.orangeLight, color: Colors.textPrimary, borderRadius: 12 },
  table: { borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { padding: 14, borderRightWidth: 1, borderRightColor: Colors.border },
  rowLabel: { backgroundColor: Colors.bgInput, paddingHorizontal: 14, paddingVertical: 10, color: Colors.textSecondary, fontSize: 12, fontWeight: '800' },
  value: { color: Colors.textPrimary, fontSize: 14, lineHeight: 22 },
  image: { width: '100%', height: 130, borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.bgInput },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingBottom: 12 },
  link: { color: Colors.orange, fontSize: 14, fontWeight: '700' },
  button: { backgroundColor: Colors.orange, padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 16, padding: 24, paddingVertical: 50 },
  notice: { margin: 20, padding: 18, gap: 12, backgroundColor: Colors.orangeLight, borderRadius: 14 },
  error: { color: Colors.error, lineHeight: 21 },
  browse: { alignItems: 'center', padding: 18 },
});
