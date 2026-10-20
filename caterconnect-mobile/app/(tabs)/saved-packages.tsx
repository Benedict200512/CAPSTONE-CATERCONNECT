import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Heart, Package } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { usePackageBookmarks } from '../../hooks/usePackageBookmarks';
import { ComparePackageButton } from '../../components/PackageComparisonControls';

function PackageImage({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed
    ? <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
    : <View style={[styles.image, styles.placeholder]}><Package size={36} color={Colors.textMuted} /></View>;
}

export default function SavedPackagesScreen() {
  const router = useRouter();
  const saved = usePackageBookmarks(true);
  const remove = async (id: string) => {
    try { await saved.unsave(id); }
    catch (error) { Alert.alert('Could not remove package', error instanceof Error ? error.message : 'Please try again.'); }
  };
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={Colors.orange} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Packages</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={saved.loading} onRefresh={() => void saved.refresh()} tintColor={Colors.orange} />}>
        {!saved.customerId ? <Text style={styles.message}>Sign in with a customer account to view saved packages.</Text>
          : saved.error ? <View style={styles.notice}>
            <Text style={styles.error}>{saved.error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void saved.refresh()}><Text style={styles.link}>Try again</Text></TouchableOpacity>
          </View>
          : saved.loading && !saved.bookmarks.length ? <ActivityIndicator color={Colors.orange} />
          : !saved.bookmarks.length ? <View style={styles.empty}>
            <Heart size={42} color={Colors.orange} />
            <Text style={styles.title}>No saved packages yet</Text>
            <Text style={styles.message}>Tap the heart on a catering package to find it here later.</Text>
          </View> : null}
        {saved.savedPackages.map(row => {
          const pkg = row.package;
          const pending = saved.pending.has(row.package_id);
          return (
            <View key={row.package_id} style={styles.card}>
              {pkg ? <>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${pkg.name}`}
                  onPress={() => router.push({ pathname: '/(tabs)/caterer/[catererId]', params: { catererId: pkg.caterer_id, packageId: pkg.id } })}>
                  <PackageImage key={pkg.image_url} uri={pkg.image_url} />
                  <View style={styles.body}>
                    <Text style={styles.name}>{pkg.name}</Text>
                    <Text style={styles.message}>{pkg.business_name}</Text>
                    <Text style={styles.price}>₱{Number(pkg.price).toLocaleString('en-PH')}</Text>
                    <Text style={styles.message}>{pkg.guest_capacity} guests included · maximum {pkg.max_guests}</Text>
                    <Text style={styles.link}>View package →</Text>
                  </View>
                </TouchableOpacity>
              </> : <View style={styles.body}>
                <Text style={styles.name}>Package unavailable</Text>
                <Text style={styles.message}>This package may have been removed or is no longer available to view.</Text>
              </View>}
              {pkg && <View style={{ paddingHorizontal: 18 }}><ComparePackageButton packageId={pkg.id} /></View>}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={pkg ? `Remove ${pkg.name} from saved packages` : 'Remove unavailable package'}
                disabled={pending} onPress={() => void remove(row.package_id)} style={[styles.remove, pending && { opacity: 0.5 }]}>
                {pending ? <ActivityIndicator size="small" color={Colors.orange} /> : <Heart size={18} color={Colors.orange} fill={Colors.orange} />}
                <Text style={styles.link}>{pending ? 'Removing…' : 'Remove from saved'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  back: { padding: 8, borderRadius: 12, backgroundColor: Colors.orangeLight },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 18 },
  image: { width: '100%', height: 165, backgroundColor: Colors.bgInput },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 8 },
  name: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  message: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  price: { fontSize: 20, fontWeight: '800', color: Colors.orange },
  link: { color: Colors.orange, fontSize: 14, fontWeight: '700', paddingVertical: 5 },
  remove: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 50 },
  notice: { padding: 16, borderRadius: 12, backgroundColor: Colors.orangeLight, marginBottom: 16 },
  error: { color: Colors.error, lineHeight: 21 },
});
