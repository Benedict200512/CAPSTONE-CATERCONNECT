import { useEffect, useState } from 'react';
import {
  Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { 
  Pencil, MessageCircle, ClipboardList, ShieldAlert, 
  Bell, ChevronRight, LogOut, Calendar, Heart, Info, CheckCircle2, User, Mail, Bookmark 
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const displayName = profile?.full_name ?? 'No name set';
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = (profile as any)?.avatar_url ?? null;

  const [totalBookings, setTotalBookings] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const [showAboutModal, setShowAboutModal] = useState(false);
  const [logoutPressed, setLogoutPressed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const fetchCustomerStats = async () => {
      if (!session?.user?.id) {
        setLoadingStats(false);
        return;
      }

      // 1. Fetch live bookings count
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', session.user.id);

      if (bookingCount !== null) {
        setTotalBookings(bookingCount);
      }

      // 2. Fetch live favorites count
      const { count: favCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', session.user.id);

      if (favCount !== null) {
        setFavoritesCount(favCount);
      }

      // 3. Fetch live reviews count
      const { count: revCount } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', session.user.id);

      if (revCount !== null) {
        setReviewCount(revCount);
      }

      setLoadingStats(false);
    };

    fetchCustomerStats();
  }, [session?.user?.id]);

  const menuItems = [
    {
      icon: Pencil, 
      label: 'Edit Profile',
      sub: 'Update your name, phone, address, and photo',
      onPress: () => router.push('/(tabs)/edit-profile'),
    },
    {
      icon: MessageCircle, 
      label: 'Consultations',
      sub: 'Ask platform staff for help',
      onPress: () => router.push('/(tabs)/consultation'),
    },
    {
      icon: ClipboardList, 
      label: 'My Bookings',
      sub: 'View all your booking history',
      onPress: () => router.push('/(tabs)/bookings'),
    },
    {
      icon: ShieldAlert, 
      label: 'File a Complaint',
      sub: 'Report issues with caterers or platform',
      onPress: () => router.push('/(tabs)/complaints'),
    },
    {
      icon: Bell, 
      label: 'Notifications',
      sub: 'View booking and payment alerts',
      onPress: () => router.push('/(tabs)/notifications'),
    },
    {
      icon: Info,
      label: 'About CaterConnect',
      sub: 'Version 1.0.0 • Learn more about the platform',
      onPress: () => setShowAboutModal(true),
    },
  ];

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logoutUser();
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Consistent Decorative Background Blobs */}
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobMid} />
      <View style={styles.backgroundBlobBottom} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* About CaterConnect Modal */}
        <Modal visible={showAboutModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About CaterConnect</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.aboutLogoWrap}>
                <Image 
                  source={require('../../assets/images/caterlogo.png')} 
                  style={styles.aboutLogoImage} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={styles.aboutAppName}>CaterConnect</Text>
              <Text style={styles.aboutVersion}>Version 1.0.0 (Build 2026)</Text>
              
              <Text style={styles.aboutDesc}>
                CaterConnect is your premier platform designed to bridge the gap between event organizers, families, and elite local caterers. Whether you are planning a grand wedding, a corporate gala, or an intimate family gathering, CaterConnect makes discovering, booking, and managing catering services seamless and transparent.
              </Text>

              <View style={styles.aboutCard}>
                <Text style={styles.aboutCardTitle}>Key Features for Customers:</Text>
                <Text style={styles.aboutBullet}>• Direct booking with verified local caterers</Text>
                <Text style={styles.aboutBullet}>• Transparent menu customization and packages</Text>
                <Text style={styles.aboutBullet}>• Real-time booking status and notifications</Text>
                <Text style={styles.aboutBullet}>• Secure deposit and payment tracking</Text>
              </View>

              <Text style={styles.aboutFooter}>© 2026 CaterConnect Inc. All rights reserved.</Text>
            </ScrollView>
          </View>
        </Modal>

        <Text style={styles.pageTitle}>My Profile</Text>

        {/* Side-by-Side Avatar & Info Header */}
        <View style={styles.profileHeaderRow}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>

          <View style={styles.profileInfoMeta}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            
            <View style={styles.metaRow}>
              <User size={13} color={Colors.textSecondary} />
              <Text style={styles.metaText}>Customer</Text>
            </View>

            <View style={styles.metaRow}>
              <Mail size={13} color={Colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{session?.user?.email ?? '—'}</Text>
            </View>

            <View style={styles.badgeRow}>
              <CheckCircle2 size={13} color={Colors.success} />
              <Text style={styles.badgeText}>Verified User</Text>
            </View>
          </View>
        </View>

        {/* Unified 3-Stat Single Box Row Container */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Calendar size={18} color={Colors.orange} />
            </View>
            <Text style={styles.statNumber}>{loadingStats ? '...' : totalBookings}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Bookmark size={18} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{loadingStats ? '...' : favoritesCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <Heart size={18} color="#DC2626" />
            </View>
            <Text style={styles.statNumber}>{loadingStats ? '...' : reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        {/* Support & Settings Menu */}
        <Text style={styles.sectionLabel}>SUPPORT & SETTINGS</Text>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => {
            const IconComponent = item.icon;
            return (
              <View key={item.label}>
                <TouchableOpacity style={styles.menuRow} onPress={item.onPress} activeOpacity={0.75}>
                  <View style={styles.menuIconWrap}>
                    <IconComponent size={20} color={Colors.orange} />
                  </View>
                  <View style={styles.menuBody}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.sub}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                {i < menuItems.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, logoutPressed && styles.logoutBtnPressed]}
          onPress={() => setShowLogoutConfirm(true)}
          onPressIn={() => setLogoutPressed(true)}
          onPressOut={() => setLogoutPressed(false)}
          activeOpacity={0.85}
        >
          <LogOut size={18} color={Colors.error} />
          <Text style={[styles.logoutText, logoutPressed && styles.logoutTextPressed]}>
            Log Out
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Logout Confirmation Overlay */}
      {showLogoutConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <LogOut size={24} color={Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Log Out?</Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to log out of your account? You will need to sign back in to access bookings.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setShowLogoutConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogout}
                onPress={handleLogout}
                activeOpacity={0.85}
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
  content:   { paddingHorizontal: 20, paddingBottom: 40, zIndex: 1 },
  
  // Consistent Decorative Background Blobs (Using matching consistent color)
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

  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black, marginBottom: 16, letterSpacing: -0.5 },

  profileHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24, 
    gap: 16,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FED7AA',
    overflow: 'hidden',
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 45 },
  avatarInitial: { color: Colors.white, fontSize: 36, fontWeight: '900' },
  
  profileInfoMeta: { flex: 1 },
  name: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 4, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 2 },
  badgeText: { fontSize: 11, color: '#15803D', fontWeight: '800' },

  // Unified Single Box Stats Container
  statsContainer: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderRadius: 20, paddingVertical: 16, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
    marginBottom: 24, alignItems: 'center',
  },
  statCard: { flex: 1, alignItems: 'center' },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#FFF7ED', justifyContent: 'center',
    alignItems: 'center', marginBottom: 6,
  },
  statNumber: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 8, marginTop: 4,
  },
  
  menuCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7AA',
  },
  menuBody:  { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  menuSub:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  divider:   { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  // Logout button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5, 
    borderColor: '#FCA5A5',
    borderRadius: 16, 
    padding: 16, 
    backgroundColor: '#FEF2F2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  logoutBtnPressed: {
    backgroundColor: '#FEE2E2',
  },
  logoutText: { color: Colors.error, fontWeight: '800', fontSize: 15 },
  logoutTextPressed: { opacity: 0.75 },

  // Confirmation overlay
  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999, paddingHorizontal: 28,
  },
  confirmBox: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 14,
  },
  confirmIconWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 8, textAlign: 'center' },
  confirmSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24, textAlign: 'center', fontWeight: '500' },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 14, padding: 14, alignItems: 'center',
    backgroundColor: Colors.white,
  },
  confirmCancelText: { color: Colors.black, fontWeight: '700', fontSize: 14 },
  confirmLogout: {
    flex: 1, backgroundColor: Colors.error,
    borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  confirmLogoutText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  // About modal styles
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.black },
  modalCloseBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: Colors.orange },
  modalContent: { padding: 24, alignItems: 'center' },
  aboutLogoWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: '#FED7AA',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3
  },
  aboutLogoImage: { width: 50, height: 50 },
  aboutAppName: { fontSize: 24, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  aboutVersion: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: 20 },
  aboutDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  aboutCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20, width: '100%',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24,
  },
  aboutCardTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 10 },
  aboutBullet: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  aboutFooter: { fontSize: 12, color: Colors.textMuted, fontWeight: '500', textAlign: 'center' },
});