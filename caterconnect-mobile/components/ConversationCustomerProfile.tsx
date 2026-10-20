import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Mail, MapPin, Phone, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Props = {
  visible: boolean;
  bookingId: string;
  customerId: string;
  onClose: () => void;
};

type CustomerDetails = {
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  avatar: string | null;
};

function valueOf(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function DetailRow({ Icon, title, value }: {
  Icon: typeof Phone;
  title: string;
  value: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon size={19} color={Colors.orangeDark} strokeWidth={1.9} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text selectable style={[styles.infoValue, !value && styles.missing]}>
          {value || 'Not provided'}
        </Text>
      </View>
    </View>
  );
}

export default function ConversationCustomerProfile({ visible, bookingId, customerId, onClose }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!visible) {
      setDetails(null);
      setError(null);
      return;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setDetails(null);
      try {
        if (!userId || !bookingId || !customerId) throw new Error('Profile unavailable.');
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('customer_id, caterers(user_id)')
          .eq('id', bookingId)
          .maybeSingle();
        if (bookingError || !booking || booking.customer_id !== customerId) {
          throw new Error('Customer profile is unavailable for this booking.');
        }
        const caterer = Array.isArray(booking.caterers) ? booking.caterers[0] : booking.caterers;
        if (caterer?.user_id !== userId && booking.customer_id !== userId) {
          throw new Error('Only conversation participants can view this profile.');
        }
        // Supabase RLS must independently authorize access to personal details.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();
        if (profileError || !profile) throw new Error('Customer details could not be loaded.');
        const row = profile as Record<string, unknown>;
        const first = valueOf(row, 'first_name', 'firstname');
        const last = valueOf(row, 'last_name', 'lastname');
        const name = valueOf(row, 'full_name', 'name') || [first, last].filter(Boolean).join(' ') || 'Customer';
        const addressParts = [
          valueOf(row, 'address', 'street_address'), valueOf(row, 'city'), valueOf(row, 'province'),
        ].filter((part, index, parts) => part && parts.indexOf(part) === index);
        if (active) setDetails({
          name,
          phone: valueOf(row, 'phone_number', 'phone', 'contact_number', 'contact'),
          address: addressParts.join(', ') || null,
          email: valueOf(row, 'email'),
          avatar: valueOf(row, 'avatar_url', 'profile_picture', 'profile_image', 'image_url'),
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load customer profile.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [visible, bookingId, customerId, userId, retryCount]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <View style={styles.topBarText}>
              <Text style={styles.eyebrow}>CATERCONNECT</Text>
              <Text style={styles.heading}>Customer Profile</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close customer profile"
              onPress={onClose}
              style={styles.close}
              activeOpacity={0.75}
            >
              <X size={21} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={Colors.orange} />
              <Text style={styles.loadingText}>Loading customer details...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setRetryCount(n => n + 1)} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : details ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {/* Wide portrait / cover section rather than a small round avatar. */}
              <View style={styles.hero}>
                {details.avatar ? (
                  <Image source={{ uri: details.avatar }} style={styles.heroPhoto} resizeMode="cover" />
                ) : (
                  <View style={styles.heroFallback}>
                    <View style={styles.initialBadge}>
                      <Text style={styles.initialText}>{details.name.trim().charAt(0).toUpperCase() || 'C'}</Text>
                    </View>
                    <Text style={styles.fallbackHint}>Customer photo</Text>
                  </View>
                )}
              </View>
              <View style={styles.identity}>
                <Text style={styles.name}>{details.name}</Text>
                <Text style={styles.subtitle}>CaterConnect Customer</Text>
              </View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Contact information</Text>
                <Text style={styles.sectionHint}>Booking contact details</Text>
              </View>
              <View style={styles.infoCard}>
                <DetailRow Icon={Phone} title="Phone number" value={details.phone} />
                <View style={styles.separator} />
                <DetailRow Icon={MapPin} title="Address" value={details.address} />
                <View style={styles.separator} />
                <DetailRow Icon={Mail} title="Email address" value={details.email} />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.48)',
    justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 30,
  },
  sheet: {
    backgroundColor: Colors.white, borderRadius: 26, overflow: 'hidden',
    maxHeight: '86%',
  },
  topBar: {
    paddingLeft: 20, paddingRight: 14, paddingTop: 18, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topBarText: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '800', color: Colors.orangeDark, marginBottom: 4 },
  heading: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary },
  close: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingBlock: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  content: { paddingHorizontal: 18, paddingBottom: 26 },
  hero: { height: 194, width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.orangeLight },
  heroPhoto: { width: '100%', height: '100%' },
  heroFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF2DF', gap: 10,
  },
  initialBadge: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FED7AA',
  },
  initialText: { fontSize: 42, fontWeight: '800', color: Colors.orangeDark },
  fallbackHint: { fontSize: 12, color: Colors.orangeDark, fontWeight: '600' },
  identity: { alignItems: 'center', paddingTop: 18, paddingBottom: 21 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 5 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 12, gap: 10,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sectionHint: { color: Colors.textSecondary, fontSize: 11, textAlign: 'right' },
  infoCard: {
    backgroundColor: '#FAFAFA', borderRadius: 18, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoRow: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 15 },
  infoIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  infoValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 4, lineHeight: 20 },
  missing: { fontWeight: '500', fontStyle: 'italic', color: Colors.textSecondary },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 57 },
  errorBlock: { padding: 30, alignItems: 'center', gap: 14 },
  errorText: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  retry: { backgroundColor: Colors.orangeLight, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryText: { color: Colors.orangeDark, fontWeight: '800' },
});
