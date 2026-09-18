import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { pickAndUpload } from '../../lib/storage';
import { 
  ChevronLeft, Camera, User, Phone, MapPin, 
  Mail, Shield, Check, Save 
} from 'lucide-react-native';

export default function CustomerEditProfile() {
  const { profile, session, reloadProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName]   = useState(profile?.full_name ?? '');
  const [phone, setPhone]         = useState((profile as any)?.phone_number ?? '');
  const [address, setAddress]     = useState((profile as any)?.address ?? '');
  const [avatarUrl, setAvatarUrl] = useState((profile as any)?.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone((profile as any)?.phone_number ?? '');
    setAddress((profile as any)?.address ?? '');
    setAvatarUrl((profile as any)?.avatar_url ?? '');
  }, [profile]);

  const handlePickAvatar = async () => {
    if (!session?.user?.id) return;
    try {
      setUploading(true);
      const url = await pickAndUpload('avatars', session.user.id, 'avatar', [1, 1]);
      if (url) {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', session.user.id);
        if (error) throw new Error(error.message);
        setAvatarUrl(url);
        await reloadProfile();
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name:    fullName.trim(),
      phone_number: phone.trim() || null,
      address:      address.trim() || null,
    }).eq('id', session.user.id);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await reloadProfile();
    Alert.alert('✅ Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const initial = (profile?.full_name ?? 'U').charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.black} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Edit Profile</Text>
        <Text style={styles.pageSub}>Update your personal information and preferences</Text>
      </View>

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              onError={() => setAvatarUrl('')}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.avatarEditBtn}
            onPress={handlePickAvatar}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Camera size={16} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.avatarHint}>Tap the camera to update your photo</Text>
      </View>

      {/* Form Section */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>FULL NAME *</Text>
            <View style={styles.inputWrap}>
              <User size={18} color={Colors.orange} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <View style={styles.inputWrap}>
              <Phone size={18} color={Colors.orange} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 09171234567"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>HOME ADDRESS</Text>
            <View style={[styles.inputWrap, { alignItems: 'flex-start', paddingVertical: 12 }]}>
              <MapPin size={18} color={Colors.orange} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={address}
                onChangeText={setAddress}
                placeholder="Your home or delivery address in Cebu"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT CREDENTIALS</Text>
        <View style={styles.card}>
          <View style={styles.readOnlyRow}>
            <View style={styles.readOnlyLeft}>
              <Mail size={18} color={Colors.textSecondary} />
              <Text style={styles.readOnlyLabel}>Email Address</Text>
            </View>
            <Text style={styles.readOnlyValue} numberOfLines={1}>{session?.user?.email ?? '—'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.readOnlyRow}>
            <View style={styles.readOnlyLeft}>
              <Shield size={18} color={Colors.textSecondary} />
              <Text style={styles.readOnlyLabel}>Account Role</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{profile?.role ? profile.role.toUpperCase() : 'USER'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <View style={styles.saveBtnInner}>
              <Save size={18} color={Colors.white} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    paddingHorizontal: 20, 
    paddingBottom: 16, 
    backgroundColor: Colors.white, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginBottom: 12, 
    alignSelf: 'flex-start' 
  },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: Colors.orange,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FED7AA',
  },
  avatarInitial: { color: Colors.white, fontSize: 38, fontWeight: '900' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.black,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  avatarHint: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  formSection: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 8, marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  field: { padding: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 12, gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.black, paddingVertical: 12, fontWeight: '600' },
  multiline: { minHeight: 70, paddingTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  
  readOnlyRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  readOnlyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readOnlyLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  readOnlyValue: { fontSize: 13, fontWeight: '800', color: Colors.black, maxWidth: '50%' },
  
  roleBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '900', color: Colors.orange },

  saveBtn: {
    backgroundColor: Colors.orange, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
    marginBottom: 20,
  },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});