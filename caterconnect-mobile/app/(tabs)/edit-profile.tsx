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
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Edit Profile</Text>
      </View>

      {/* Avatar */}
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
          >
            {uploading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.avatarEditIcon}>📷</Text>
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.avatarHint}>Tap the camera icon to change your photo</Text>
      </View>

      {/* Form */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 09171234567"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="Your home or delivery address"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
        <View style={styles.card}>
          {[
            { label: 'Email', value: session?.user?.email ?? '—' },
            { label: 'Role',  value: profile?.role ?? '—' },
          ].map((row, i, arr) => (
            <View key={row.label}>
              <View style={styles.readOnlyRow}>
                <Text style={styles.readOnlyLabel}>{row.label}</Text>
                <Text style={styles.readOnlyValue}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  header:      { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn:     { marginBottom: 8 },
  backText:    { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  pageTitle:   { fontSize: 26, fontWeight: '900', color: Colors.black },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap:    { position: 'relative', marginBottom: 10 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: Colors.orange,
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.orangeDark,
  },
  avatarInitial: { color: Colors.white, fontSize: 40, fontWeight: '900' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.black,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarEditIcon: { fontSize: 16 },
  avatarHint:     { fontSize: 12, color: Colors.textMuted },

  formSection:  { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 10, marginTop: 8,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
  },
  field:      { padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.bgInput, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: Colors.black,
  },
  multiline:    { minHeight: 80, paddingTop: 11 },
  divider:      { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
  readOnlyRow:  {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  readOnlyLabel: { fontSize: 13, color: Colors.textSecondary },
  readOnlyValue: { fontSize: 13, fontWeight: '700', color: Colors.black },
  saveBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});