import { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import SubscriptionScreen from '../../screens/auth/SubscriptionScreen';
import { 
  Hourglass, CheckCircle2, XCircle, FileEdit, 
  CreditCard, MessageCircle, 
  Bell, AlertTriangle, UtensilsCrossed, ChevronRight,
  LogOut, Camera, Edit3, Building2, MapPin, AlertCircle
} from 'lucide-react-native';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'unsubmitted' | null;

const VERIFICATION_DISPLAY: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pending Review', icon: Hourglass, color: Colors.orange },
  approved: { label: 'Verified Caterer', icon: CheckCircle2, color: Colors.success },
  rejected: { label: 'Rejected', icon: XCircle, color: Colors.error },
  unsubmitted: { label: 'Not Submitted', icon: FileEdit, color: Colors.textMuted },
};

export default function CatererProfile() {
  const { profile, session, catererData } = useAuth();
  const router = useRouter();

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!session?.user?.id) {
        setLoadingStatus(false);
        return;
      }

      const { data, error } = await supabase
        .from('caterers')
        .select('verification_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching verification status:', error.message);
      } else {
        setVerificationStatus((data?.verification_status as VerificationStatus) ?? 'unsubmitted');
      }
      setLoadingStatus(false);
    };

    fetchVerificationStatus();
  }, [session?.user?.id]);

  const verification = VERIFICATION_DISPLAY[verificationStatus ?? 'unsubmitted'];
  const isVerified = verificationStatus === 'approved';
  const needsProfileCompletion = !isVerified;
  
  const displayName = isVerified && catererData?.business_name 
    ? catererData.business_name 
    : profile?.full_name ?? 'No name';
  const initial = displayName.charAt(0).toUpperCase();

  const menuItems = [
    { 
      icon: CreditCard, 
      label: 'Subscription Plan', 
      sub: 'View and upgrade your current plan', 
      onPress: () => setShowSubscription(true) 
    },
    { 
      icon: MessageCircle, 
      label: 'Consultations', 
      sub: 'Get help from platform staff', 
      onPress: () => router.push('/(caterer)/consultation') 
    },
    { 
      icon: Bell, 
      label: 'Notifications', 
      sub: 'Manage notification preferences', 
      onPress: () => router.push('/(caterer)/notifications') 
    },
    { 
      icon: AlertTriangle, 
      label: 'File a Complaint', 
      sub: 'Report issues with customers or platform', 
      onPress: () => router.push('/(caterer)/complaints') 
    },
  ];

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Consistent Decorative Background Blobs */}
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobMid} />
      <View style={styles.backgroundBlobBottom} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60, zIndex: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <Modal visible={showSubscription} animationType="slide" presentationStyle="pageSheet">
          <SubscriptionScreen onClose={() => setShowSubscription(false)} />
        </Modal>

        {/* Header Title */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
          <Text style={styles.pageTitle}>Business Profile</Text>
        </View>

        {/* Cover Photo & Hero Section */}
        <View style={styles.mediaContainer}>
          <View style={styles.coverWrap}>
            {catererData?.cover_photo_url ? (
              <Image source={{ uri: catererData.cover_photo_url }} style={styles.coverPhoto} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <UtensilsCrossed size={32} color={Colors.textMuted} />
              </View>
            )}
            <TouchableOpacity 
              style={styles.coverEditBtn}
              onPress={() => router.push('/(caterer)/edit-profile')}
              activeOpacity={0.8}
            >
              <Camera size={14} color={Colors.white} />
              <Text style={styles.coverEditText}>Edit Cover</Text>
            </TouchableOpacity>
          </View>

          {/* Logo & Info Header */}
          <View style={styles.profileHeaderRow}>
            <View style={styles.logoWrap}>
              {catererData?.logo_url ? (
                <Image source={{ uri: catererData.logo_url }} style={styles.logoImage} />
              ) : (
                <Text style={styles.logoText}>{initial}</Text>
              )}
            </View>

            <View style={styles.profileInfoMeta}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              
              <View style={styles.badgeRow}>
                {!loadingStatus && <verification.icon size={14} color={verification.color} />}
                <Text style={[styles.badgeText, { color: verification.color }]}>
                  {loadingStatus ? 'Loading...' : verification.label}
                </Text>
              </View>

              <View style={styles.subMetaRow}>
                <MapPin size={13} color={Colors.textSecondary} />
                <Text style={styles.subMetaText} numberOfLines={1}>
                  {catererData?.city || catererData?.address || 'Cebu City, Cebu'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentBody}>
          {/* Action Required Banner for Unverified Caterers */}
          {needsProfileCompletion && (
            <TouchableOpacity 
              style={styles.actionBanner}
              onPress={() => router.push('/(caterer)/edit-profile')}
              activeOpacity={0.85}
            >
              <View style={styles.actionBannerIconWrap}>
                <AlertCircle size={22} color={Colors.orange} />
              </View>
              <View style={styles.actionBannerTextWrap}>
                <Text style={styles.actionBannerTitle}>Complete Your Business Profile</Text>
                <Text style={styles.actionBannerSub}>Submit your business details and required permits to get verified.</Text>
              </View>
              <ChevronRight size={18} color={Colors.orange} />
            </TouchableOpacity>
          )}

          {/* Business Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Building2 size={18} color={Colors.orange} />
                <Text style={styles.cardTitle}>Business Information</Text>
              </View>
              <TouchableOpacity 
                style={styles.editIconBtn}
                onPress={() => router.push('/(caterer)/edit-profile')}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color={Colors.orange} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {[
              { label: 'Business Name', value: displayName },
              { label: 'Owner Name', value: profile?.full_name ?? '—' },
              { label: 'Email', value: session?.user?.email ?? '—' },
              { label: 'Phone', value: catererData?.contact_phone ?? (profile as any)?.phone_number ?? '—' },
              { label: 'Location', value: catererData?.city ?? '—' },
              { label: 'Address', value: catererData?.address ?? '—' },
            ].map((row, idx, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
                </View>
                {idx < arr.length - 1 && <View style={styles.innerDivider} />}
              </View>
            ))}
          </View>

          {/* Business & Support Menu */}
          <Text style={styles.sectionLabel}>BUSINESS & SUPPORT</Text>
          <View style={styles.menuCard}>
            {menuItems.map((item, i) => (
              <View key={item.label}>
                <TouchableOpacity 
                  style={styles.menuRow} 
                  onPress={item.onPress} 
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <item.icon size={20} color={Colors.orange} />
                  </View>
                  <View style={styles.menuBody}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.sub}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                {i < menuItems.length - 1 && <View style={styles.innerDivider} />}
              </View>
            ))}
          </View>

          {/* Log Out Button */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setShowLogoutConfirm(true)}
            activeOpacity={0.8}
          >
            <View style={styles.logoutIconWrap}>
              <LogOut size={16} color={Colors.error} />
            </View>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Log Out?</Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to log out of your caterer account?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setShowLogoutConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogout}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmLogoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  
  // Consistent Decorative Background Blobs
  backgroundBlobTop: {
    position: 'absolute',
    top: -50,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#FED7AA',
    opacity: 0.4,
    zIndex: 0,
  },
  backgroundBlobMid: {
    position: 'absolute',
    top: 360,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FED7AA',
    opacity: 0.35,
    zIndex: 0,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: 50,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FED7AA',
    opacity: 0.3,
    zIndex: 0,
  },

  header: { paddingHorizontal: 24, paddingBottom: 16, backgroundColor: Colors.white },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },

  mediaContainer: { backgroundColor: Colors.white, paddingBottom: 20, marginBottom: 16 },
  coverWrap: { width: '100%', height: 160, position: 'relative', backgroundColor: '#E2E8F0' },
  coverPhoto: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverEditBtn: {
    position: 'absolute', bottom: 12, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  coverEditText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  profileHeaderRow: { 
    flexDirection: 'row', paddingHorizontal: 24, 
    alignItems: 'center', marginTop: 16, gap: 16 
  },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%', borderRadius: 36 },
  logoText: { color: Colors.white, fontSize: 32, fontWeight: '900' },

  profileInfoMeta: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 4, letterSpacing: -0.5 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  subMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subMetaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  contentBody: { paddingHorizontal: 20 },
  
  actionBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED',
    borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FED7AA',
    gap: 12, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2
  },
  actionBannerIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center' },
  actionBannerTextWrap: { flex: 1 },
  actionBannerTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412', marginBottom: 2 },
  actionBannerSub: { fontSize: 12, color: '#C2410C', lineHeight: 16 },

  card: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
    marginBottom: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.black },
  editIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 13, color: Colors.black, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  innerDivider: { height: 1, backgroundColor: '#F8FAFC', marginHorizontal: 18 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  menuCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
    marginBottom: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  menuIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
  },
  menuBody: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '700', color: Colors.black, marginBottom: 2 },
  menuSub: { fontSize: 12, color: Colors.textSecondary },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 14 },

  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999, paddingHorizontal: 24,
  },
  confirmBox: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 32, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 14,
  },
  confirmTitle: { fontSize: 22, fontWeight: '900', color: Colors.black, marginBottom: 12, letterSpacing: -0.5 },
  confirmSub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmCancel: {
    flex: 1, borderWidth: 2, borderColor: '#F1F5F9',
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  confirmCancelText: { color: Colors.black, fontWeight: '700', fontSize: 15 },
  confirmLogout: {
    flex: 1, backgroundColor: Colors.error,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  confirmLogoutText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
});