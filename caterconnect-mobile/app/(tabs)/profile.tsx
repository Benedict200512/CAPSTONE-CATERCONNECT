import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../lib/auth';

const ICONS = {
  pencil: require('../../assets/icons/pencil.png'),
  chat: require('../../assets/icons/chat.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  siren: require('../../assets/icons/siren.png'),
  bell: require('../../assets/icons/bell.png'),
  person: require('../../assets/icons/person.png'),
  chevronRight: require('../../assets/icons/chevron_right.png'),
};

export default function ProfileScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const initial = (profile?.full_name ?? 'U').charAt(0).toUpperCase();
  const avatarUrl = (profile as any)?.avatar_url ?? null;

  const [logoutPressed, setLogoutPressed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    {
      icon: ICONS.pencil, label: 'Edit Profile',
      sub: 'Update your name, phone, address, and photo',
      onPress: () => router.push('/(tabs)/edit-profile'),
    },
    {
      icon: ICONS.chat, label: 'Consultations',
      sub: 'Ask platform staff for help',
      onPress: () => router.push('/(tabs)/consultation'),
    },
    {
      icon: ICONS.clipboard, label: 'My Bookings',
      sub: 'View all your booking history',
      onPress: () => router.push('/(tabs)/bookings'),
    },
    {
      icon: ICONS.siren, label: 'File a Complaint',
      sub: 'Report issues with caterers or platform',
      onPress: () => router.push('/(tabs)/complaints'),
    },
    {
      icon: ICONS.bell, label: 'Notifications',
      sub: 'View booking and payment alerts',
      onPress: () => router.push('/(tabs)/notifications'),
    },
  ];

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logoutUser();
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>My Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/edit-profile')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Image source={ICONS.pencil} style={styles.iconEditBadge} />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.full_name ?? 'No name set'}</Text>
          <Text style={styles.email}>{session?.user?.email}</Text>
          <View style={styles.roleBadge}>
            <Image source={ICONS.person} style={styles.iconRoleBadge} />
            <Text style={styles.roleText}>Customer</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          {[
            { label: 'Full Name', value: profile?.full_name ?? '—' },
            { label: 'Email',     value: session?.user?.email ?? '—' },
            { label: 'Phone',     value: (profile as any)?.phone_number ?? '—' },
            { label: 'Address',   value: (profile as any)?.address ?? '—' },
          ].map((row, i, arr) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Menu */}
        <Text style={styles.sectionLabel}>SUPPORT & SETTINGS</Text>
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

      {/* Logout Confirmation Overlay */}
      {showLogoutConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Log Out?</Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to log out of your account?
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
  content:   { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 24 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 3, borderColor: Colors.orange,
  },
  avatarPlaceholder: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.orangeDark,
  },
  avatarInitial:   { color: Colors.white, fontSize: 36, fontWeight: '900' },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  iconEditBadge: { width: 13, height: 13 },
  name:  { fontSize: 22, fontWeight: '800', color: Colors.black, marginTop: 12, marginBottom: 4 },
  email: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeLight, paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  iconRoleBadge: { width: 13, height: 13 },
  roleText: { color: Colors.orange, fontWeight: '800', fontSize: 13 },

  infoCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '700', color: Colors.black, flex: 2, textAlign: 'right' },
  divider:   { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 10,
  },
  menuCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon:  { width: 22, height: 22 },
  menuBody:  { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: Colors.black, marginBottom: 2 },
  menuSub:   { fontSize: 12, color: Colors.textSecondary },
  menuArrow: { width: 16, height: 16 },

  // Logout button
  logoutBtn: {
    borderWidth: 2, borderColor: Colors.error,
    borderRadius: 12, padding: 14, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoutBtnPressed: {
    backgroundColor: '#FFF0F0',
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