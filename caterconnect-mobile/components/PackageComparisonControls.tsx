import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Check, Scale } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { usePackageComparison } from '../context/PackageComparisonContext';

export function ComparePackageButton({ packageId }: { packageId: string }) {
  const comparison = usePackageComparison();
  if (!comparison.customerId) return null;
  const selected = comparison.selectedIds.includes(packageId);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={selected ? 'Remove package from comparison' : 'Add package to comparison'}
    accessibilityState={{ selected }} style={[styles.select, selected && styles.selected]}
    onPress={() => {
      try { comparison.toggle(packageId); }
      catch (error) { Alert.alert('Package comparison', error instanceof Error ? error.message : 'Please try again.'); }
    }}>
    {selected ? <Check size={18} color={Colors.white} /> : <Scale size={18} color={Colors.orange} />}
    <Text style={[styles.selectText, selected && { color: Colors.white }]}>{selected ? 'Selected for comparison' : 'Compare'}</Text>
  </TouchableOpacity>;
}

export function useComparisonBarVisible() {
  const { selectedIds } = usePackageComparison();
  const path = usePathname();
  const browsing = path === '/' || path === '/index' || path.endsWith('/saved-packages') || path.includes('/caterer/');
  return selectedIds.length > 0 && browsing;
}

export function PackageComparisonBar() {
  const { selectedIds, clear } = usePackageComparison();
  const router = useRouter();
  const visible = useComparisonBarVisible();
  if (!visible) return null;
  return <View style={styles.bar}>
    <Text style={styles.count}>{selectedIds.length} of 3 selected</Text>
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" onPress={clear} style={styles.clear}><Text style={styles.selectText}>Clear</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={selectedIds.length < 2}
        accessibilityState={{ disabled: selectedIds.length < 2 }}
        onPress={() => { if (selectedIds.length >= 2) router.push('/(tabs)/package-comparison'); }}
        style={[styles.compare, selectedIds.length < 2 && { opacity: 0.45 }]}>
        <Scale size={17} color={Colors.white} /><Text style={styles.actionText}>Compare Now</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.orange, backgroundColor: Colors.orangeLight, marginVertical: 8 },
  selected: { backgroundColor: Colors.orange },
  selectText: { fontSize: 13, fontWeight: '700', color: Colors.orange },
  bar: { position: 'absolute', bottom: Platform.OS === 'ios' ? 96 : 80, left: 16, right: 16, padding: 12, borderRadius: 16, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.orange, elevation: 6, shadowColor: Colors.black, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  count: { fontSize: 13, color: Colors.textPrimary, fontWeight: '800', marginBottom: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  clear: { padding: 10 },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, backgroundColor: Colors.orange, borderRadius: 10 },
  actionText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
});
