import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import SubscriptionScreen from '@/screens/auth/SubscriptionScreen';

const ICONS = {
  hourglass: require('../../assets/icons/hourglass.png'),
  checkSuccess: require('../../assets/icons/check_success.png'),
  rejected: require('../../assets/icons/rejected.png'),
  draft: require('../../assets/icons/draft.png'),
  pencil: require('../../assets/icons/pencil.png'),
  card: require('../../assets/icons/card.png'),
  chat: require('../../assets/icons/chat.png'),
  bell: require('../../assets/icons/bell.png'),
  siren: require('../../assets/icons/siren.png'),
  plate: require('../../assets/icons/plate.png'),
  chevronRight: require('../../assets/icons/chevron_right.png'),
};

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'unsubmitted' | null;

const VERIFICATION_DISPLAY: Record<string, { label: string; icon: any }> = {
  pending: { label: 'Pending Review', icon: ICONS.hourglass },
  approved: { label: 'Verified', icon: ICONS.checkSuccess },
  rejected: { label: 'Rejected', icon: ICONS.rejected },
  unsubmitted: { label: 'Not Submitted', icon: ICONS.draft },
};

export default function CatererProfile() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const initial = (profile?.full_name ?? 'C').charAt(0).toUpperCase();

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showSubscription, setShowSubscription] = useState(false);
  const [logoutPressed, setLogoutPressed] = useState(false);
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

  const menuItems = [
    { icon: ICONS.pencil, label: 'Complete Business Profile', sub: 'Add logo, description, contact info', onPress: () => router.push('/(caterer)/edit-profile') },
    { icon: ICONS.card, label: 'Subscription Plan', sub: 'View and upgrade your current plan', onPress: () => setShowSubscription(true) },
    { icon: ICONS.chat, label: 'Consultations', sub: 'Get help from platform staff', onPress: () => router.push('/(caterer)/consultation') },
    { icon: ICONS.bell, label: 'Notifications', sub: 'Manage notification preferences', onPress: () => router.push('/(caterer)/notifications') },
    { icon: ICONS.siren, label: 'File a Complaint', sub: 'Report issues with customers or platform', onPress: () => router.push('/(caterer)/complaints') },
  ];

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Modal visible={showSubscription} animationType="slide" presentationStyle="pageSheet">
          <SubscriptionScreen onClose={() => setShowSubscription(false)} />
        </Modal>

        <Text style={styles.pageTitle}>Business Profile</Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? 'No name'}</Text>
          <Text style={styles.email}>{session?.user?.email}</Text>
          <View style={styles.roleBadge}>
            <Image source={ICONS.plate} style={styles.iconRoleBadge} />
            <Text style={styles.roleText}>Caterer Account</Text>
          </View>
        </View>

        <View style={styles.card}>
          {[
            { label: 'Full Name', value: profile?.full_name ?? '—' },
            { label: 'Email', value: session?.user?.email ?? '—' },
            { label: 'Role', value: 'Caterer' },
          ].map((row) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
              </View>
              <View style={styles.divider} />
            </View>
          ))}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Verification</Text>
            <View style={styles.verificationValueRow}>
              {!loadingStatus && <Image source={verification.icon} style={styles.iconVerification} />}
              <Text style={styles.verificationValueText} numberOfLines={1}>
                {loadingStatus ? 'Loading…' : verification.label}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>BUSINESS & SUPPORT</Text>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity style={styles.menuRow} onPress={item.onPress} activeOpacity={0.7}>
                <View style={styles.menuIconWrap}>
                  <Image source={item.icon} style={styles.menuIcon} />
                </View>
                <View style={styles.menuBody}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                <Image source={ICONS.chevronRight} style={styles.menuArrow} />
              </TouchableOpacity>
              {i < menuItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, logoutPressed && styles.logoutBtnPressed]}
          onPress={() => setShowLogoutConfirm(true)}
          onPressIn={() => setLogoutPressed(true)}
          onPressOut={() => setLogoutPressed(false)}
          activeOpacity={1}
        >
          <Text style={[styles.logoutText, logoutPressed && styles.logoutTextPressed]}>
            Log Out
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

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
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  avatarText: { color: Colors.white, fontSize: 36, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  email: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeLight, paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  iconRoleBadge: { width: 14, height: 14 },
  roleText: { color: Colors.orange, fontWeight: '800', fontSize: 13 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 24, overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 13, color: Colors.black, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  verificationValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, justifyContent: 'flex-end' },
  verificationValueText: { fontSize: 13, color: Colors.black, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  iconVerification: { width: 15, height: 15, flexShrink: 0 },
  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10 },
  menuCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon: { width: 21, height: 21 },
  menuBody: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: Colors.black, marginBottom: 2 },
  menuSub: { fontSize: 12, color: Colors.textSecondary },
  menuArrow: { width: 16, height: 16 },

  logoutBtn: {
    borderWidth: 2, borderColor: Colors.error,
    borderRadius: 12, padding: 14, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoutBtnPressed: {
    backgroundColor: '#FFF0F0',
    borderColor: Colors.error,
  },
  logoutText: { color: Colors.error, fontWeight: '800', fontSize: 15 },
  logoutTextPressed: { color: Colors.error, opacity: 0.75 },

  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999, paddingHorizontal: 28,
  },
  confirmBox: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 28, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 14,
  },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 8 },
  confirmSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 24 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmCancel: {
    flex: 1, borderWidth: 2, borderColor: Colors.border,
    borderRadius: 12, padding: 13, alignItems: 'center',
  },
  confirmCancelText: { color: Colors.black, fontWeight: '700', fontSize: 15 },
  confirmLogout: {
    flex: 1, backgroundColor: Colors.error,
    borderRadius: 12, padding: 13, alignItems: 'center',
  },
  confirmLogoutText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
});