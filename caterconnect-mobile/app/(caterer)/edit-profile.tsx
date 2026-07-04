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
import * as ImagePicker from 'expo-image-picker';

type CatererDoc = {
  id: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  status: string;
};

const REQUIRED_DOCS = [
  { type: 'business_permit',       label: 'Business Permit',                    icon: '🏢' },
  { type: 'sanitary_permit',       label: 'Sanitary Permit',                    icon: '🧪' },
  { type: 'government_id',         label: 'Government-issued ID',               icon: '🪪' },
  { type: 'business_registration', label: 'Business Registration Certificate',  icon: '📋' },
  { type: 'proof_of_address',      label: 'Proof of Address',                   icon: '🏠' },
];

export default function CatererEditProfile() {
  const { profile, catererData, session, reloadProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName]         = useState(profile?.full_name ?? '');
  const [phone, setPhone]               = useState((profile as any)?.phone_number ?? '');
  const [businessName, setBusinessName] = useState(catererData?.business_name ?? '');
  const [description, setDescription]   = useState(catererData?.business_description ?? '');
  const [city, setCity]                 = useState(catererData?.city ?? '');
  const [contactPhone, setContactPhone] = useState(catererData?.contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(catererData?.contact_email ?? '');
  const [address, setAddress]           = useState(catererData?.address ?? '');
  const [downpayment, setDownpayment]   = useState(String(catererData?.downpayment_percent ?? '25'));
  const [logoUrl, setLogoUrl]           = useState(catererData?.logo_url ?? '');
  const [coverUrl, setCoverUrl]         = useState(catererData?.cover_photo_url ?? '');
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving]             = useState(false);

  const [docs, setDocs]                 = useState<CatererDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone((profile as any)?.phone_number ?? '');
    setBusinessName(catererData?.business_name ?? '');
    setDescription(catererData?.business_description ?? '');
    setCity(catererData?.city ?? '');
    setContactPhone(catererData?.contact_phone ?? '');
    setContactEmail(catererData?.contact_email ?? '');
    setAddress(catererData?.address ?? '');
    setDownpayment(String(catererData?.downpayment_percent ?? '25'));
    setLogoUrl(catererData?.logo_url ?? '');
    setCoverUrl(catererData?.cover_photo_url ?? '');
    if (catererData?.id) loadDocs(catererData.id);
  }, [profile, catererData]);

  const loadDocs = async (catererId: string) => {
    const { data } = await supabase
      .from('caterer_documents')
      .select('*')
      .eq('caterer_id', catererId);
    setDocs(data ?? []);
  };

  const ensureCatererId = async (): Promise<string | null> => {
    if (catererData?.id) return catererData.id;
    if (!session?.user?.id || !businessName.trim()) return null;
    const { data, error } = await supabase.from('caterers').insert({
      user_id: session.user.id,
      business_name: businessName.trim(),
      verification_status: 'pending',
    }).select('id').single();
    if (error) { Alert.alert('Error', error.message); return null; }
    return data.id;
  };

  const handlePickLogo = async () => {
    if (!session?.user?.id) return;
    try {
      setUploadingLogo(true);
      const catererId = await ensureCatererId();
      if (!catererId) { Alert.alert('Required', 'Please enter your business name first.'); return; }
      const url = await pickAndUpload('caterer-logos', session.user.id, 'logo', [1, 1]);
      if (url) {
        const { error } = await supabase.from('caterers').update({ logo_url: url }).eq('id', catererId);
        if (error) throw new Error(error.message);
        setLogoUrl(url);
        await reloadProfile();
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePickCover = async () => {
    if (!session?.user?.id) return;
    try {
      setUploadingCover(true);
      const catererId = await ensureCatererId();
      if (!catererId) { Alert.alert('Required', 'Please enter your business name first.'); return; }
      const url = await pickAndUpload('caterer-covers', session.user.id, 'cover', [16, 9]);
      if (url) {
        const { error } = await supabase.from('caterers').update({ cover_photo_url: url }).eq('id', catererId);
        if (error) throw new Error(error.message);
        setCoverUrl(url);
        await reloadProfile();
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleUploadDocument = async (docType: string, docLabel: string) => {
    if (!session?.user?.id) return;

    const catererId = await ensureCatererId();
    if (!catererId) {
      Alert.alert('Required', 'Please save your business name first before uploading documents.');
      return;
    }

    try {
      setUploadingDoc(docType);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const base64 = asset.base64;
      if (!base64) throw new Error('Failed to read file.');

      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${docType}_${Date.now()}.${ext}`;
      const storagePath = `${session.user.id}/${fileName}`;

      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('caterer-documents')
        .upload(storagePath, byteArray, { contentType: mimeType, upsert: true });

      if (uploadError) throw new Error('Storage error: ' + uploadError.message);

      const { data: urlData } = supabase.storage
        .from('caterer-documents')
        .getPublicUrl(storagePath);

      const fileUrl = urlData.publicUrl;

      const existing = docs.find(d => d.document_type === docType);
      if (existing) {
        const { error: updateError } = await supabase
          .from('caterer_documents')
          .update({ file_url: fileUrl, file_name: fileName, status: 'pending' })
          .eq('id', existing.id);
        if (updateError) throw new Error('DB update error: ' + updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('caterer_documents')
          .insert({
            caterer_id:    catererId,
            document_type: docType,
            file_url:      fileUrl,
            file_name:     fileName,
            status:        'pending',
          });
        if (insertError) throw new Error('DB insert error: ' + insertError.message);
      }

      await loadDocs(catererId);
      Alert.alert('Uploaded!', `${docLabel} has been uploaded successfully.`);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    if (!businessName.trim()) { Alert.alert('Required', 'Business name is required.'); return; }
    setSaving(true);

    await supabase.from('profiles').update({
      full_name:    fullName.trim() || profile?.full_name,
      phone_number: phone.trim() || null,
    }).eq('id', session.user.id);

    const catererId = catererData?.id ?? null;
    const payload = {
      user_id:              session.user.id,
      business_name:        businessName.trim(),
      business_description: description.trim() || null,
      city:                 city.trim() || null,
      contact_phone:        contactPhone.trim() || null,
      contact_email:        contactEmail.trim() || null,
      address:              address.trim() || null,
      downpayment_percent:  parseFloat(downpayment) || 25,
    };

    if (catererId) {
      const { error } = await supabase.from('caterers').update(payload).eq('id', catererId);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('caterers').insert({ ...payload, verification_status: 'pending' });
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    }

    await reloadProfile();
    setSaving(false);
    Alert.alert('Saved', 'Your business profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const uploadedCount = REQUIRED_DOCS.filter(d =>
    docs.some(doc => doc.document_type === d.type)
  ).length;

  const initial = (businessName || profile?.full_name || 'C').charAt(0).toUpperCase();

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
        <Text style={styles.pageTitle}>Business Profile</Text>
        <Text style={styles.pageSub}>Manage your caterer profile and photos</Text>
      </View>

      <View style={styles.coverWrap}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverPhoto}
            resizeMode="cover"
            onError={() => setCoverUrl('')}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>🏞️ Cover Photo</Text>
            <Text style={styles.coverPlaceholderSub}>16:9 ratio recommended</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.coverEditBtn}
          onPress={handlePickCover}
          disabled={uploadingCover}
        >
          {uploadingCover
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.coverEditText}>📷 Change Cover</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logoWrap}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.logo}
              onError={() => setLogoUrl('')}
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoInitial}>{initial}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.logoEditBtn}
            onPress={handlePickLogo}
            disabled={uploadingLogo}
          >
            {uploadingLogo
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.logoEditIcon}>📷</Text>
            }
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.logoLabel}>Business Logo</Text>
          <Text style={styles.logoHint}>Square image recommended</Text>
        </View>
      </View>

      <View style={styles.formSection}>

        <Text style={styles.sectionTitle}>BUSINESS INFORMATION</Text>
        <View style={styles.card}>
          {[
            { label: 'Business Name *', value: businessName, onChange: setBusinessName, placeholder: "e.g. Maria's Catering" },
            { label: 'City / Area',     value: city,         onChange: setCity,         placeholder: 'e.g. Lapu-Lapu City' },
            { label: 'Contact Phone',   value: contactPhone, onChange: setContactPhone, placeholder: 'e.g. 09171234567', keyboard: 'phone-pad' as const },
            { label: 'Contact Email',   value: contactEmail, onChange: setContactEmail, placeholder: 'business@email.com', keyboard: 'email-address' as const },
          ].map((field, i, arr) => (
            <View key={field.label}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={field.keyboard ?? 'default'}
                />
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Business Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="Full business address"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Business Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell customers about your catering services..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>BOOKING POLICY</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Downpayment Percentage</Text>
            <Text style={styles.fieldSub}>Percentage customers must pay to confirm booking</Text>
            <View style={styles.dpRow}>
              {['10', '25', '50'].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.dpBtn, downpayment === pct && styles.dpBtnActive]}
                  onPress={() => setDownpayment(pct)}
                >
                  <Text style={[styles.dpBtnText, downpayment === pct && styles.dpBtnTextActive]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name</Text>
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
        </View>

        <Text style={styles.sectionTitle}>BUSINESS DOCUMENTS</Text>

        <View style={styles.docProgressCard}>
          <View style={styles.docProgressTop}>
            <Text style={styles.docProgressLabel}>Documents Submitted</Text>
            <Text style={[
              styles.docProgressCount,
              { color: uploadedCount === REQUIRED_DOCS.length ? Colors.success : Colors.orange }
            ]}>
              {uploadedCount}/{REQUIRED_DOCS.length}
            </Text>
          </View>
          <View style={styles.docProgressBarBg}>
            <View style={[
              styles.docProgressBarFill,
              {
                width: `${(uploadedCount / REQUIRED_DOCS.length) * 100}%` as any,
                backgroundColor: uploadedCount === REQUIRED_DOCS.length ? Colors.success : Colors.orange,
              }
            ]} />
          </View>
          {uploadedCount < REQUIRED_DOCS.length && (
            <Text style={styles.docProgressNote}>
              Upload all documents to complete your verification application.
            </Text>
          )}
          {uploadedCount === REQUIRED_DOCS.length && (
            <Text style={[styles.docProgressNote, { color: Colors.success }]}>
              All documents uploaded! Submit for verification in your profile.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          {REQUIRED_DOCS.map((doc, i) => {
            const uploaded = docs.find(d => d.document_type === doc.type);
            const isUploading = uploadingDoc === doc.type;

            return (
              <View key={doc.type}>
                <View style={styles.docRow}>
                  <View style={[
                    styles.docIconWrap,
                    { backgroundColor: uploaded ? '#DCFCE7' : Colors.bgInput }
                  ]}>
                    <Text style={styles.docIcon}>{doc.icon}</Text>
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docLabel}>{doc.label}</Text>
                    {uploaded ? (
                      <View style={styles.docStatusRow}>
                        <View style={[
                          styles.docStatusDot,
                          { backgroundColor: uploaded.status === 'approved' ? Colors.success : uploaded.status === 'rejected' ? Colors.error : Colors.orange }
                        ]} />
                        <Text style={[
                          styles.docStatusText,
                          {
                            color: uploaded.status === 'approved' ? Colors.success
                              : uploaded.status === 'rejected' ? Colors.error
                              : Colors.orange
                          }
                        ]}>
                          {uploaded.status === 'approved' ? 'Approved'
                            : uploaded.status === 'rejected' ? 'Rejected'
                            : 'Pending review'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.docMissingText}>Not uploaded yet</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.docUploadBtn,
                      uploaded && styles.docUploadBtnUploaded,
                      isUploading && { opacity: 0.6 },
                    ]}
                    onPress={() => handleUploadDocument(doc.type, doc.label)}
                    disabled={isUploading || uploadingDoc !== null}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={[
                        styles.docUploadBtnText,
                        uploaded && styles.docUploadBtnTextUploaded,
                      ]}>
                        {uploaded ? 'Re-upload' : 'Upload'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* File name preview if uploaded */}
                {uploaded?.file_name && (
                  <View style={styles.docFileName}>
                    <Text style={styles.docFileIcon}>📄</Text>
                    <Text style={styles.docFileNameText} numberOfLines={1}>
                      {uploaded.file_name}
                    </Text>
                  </View>
                )}

                {i < REQUIRED_DOCS.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            ℹ️ All documents are reviewed by our staff before your account is verified. Accepted formats: JPG, PNG. Make sure documents are clear and legible.
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>Save Business Profile</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header:    { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:   { marginBottom: 8 },
  backText:  { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  pageSub:   { fontSize: 13, color: Colors.textSecondary },

  coverWrap: { width: '100%', height: 190, position: 'relative', backgroundColor: '#1A1A1A' },
  coverPhoto: { width: '100%', height: 190 },
  coverPlaceholder: { width: '100%', height: 190, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { fontSize: 28, marginBottom: 8 },
  coverPlaceholderSub:  { fontSize: 12, color: Colors.textMuted },
  coverEditBtn: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  coverEditText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 20 },
  logoWrap:    { position: 'relative' },
  logo:        { width: 80, height: 80, borderRadius: 16, borderWidth: 3, borderColor: Colors.white },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 16, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white },
  logoInitial: { color: Colors.white, fontSize: 32, fontWeight: '900' },
  logoEditBtn: { position: 'absolute', bottom: -4, right: -4, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.black, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
  logoEditIcon: { fontSize: 14 },
  logoLabel:    { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  logoHint:     { fontSize: 12, color: Colors.textMuted },

  formSection:  { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, overflow: 'hidden' },
  field:      { padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  fieldSub:   { fontSize: 11, color: Colors.textMuted, marginBottom: 10 },
  input: {
    backgroundColor: Colors.bgInput, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: Colors.black,
  },
  multiline: { minHeight: 80, paddingTop: 11 },
  divider:   { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },

  dpRow:           { flexDirection: 'row', gap: 10, marginTop: 4 },
  dpBtn:           { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border },
  dpBtnActive:     { backgroundColor: Colors.orangeLight, borderColor: Colors.orange },
  dpBtnText:       { fontSize: 16, fontWeight: '800', color: Colors.textSecondary },
  dpBtnTextActive: { color: Colors.orange },

  docProgressCard: {
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  docProgressTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  docProgressLabel:  { fontSize: 13, fontWeight: '700', color: Colors.black },
  docProgressCount:  { fontSize: 18, fontWeight: '900' },
  docProgressBarBg:  { height: 8, backgroundColor: Colors.bgInput, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  docProgressBarFill:{ height: 8, borderRadius: 4 },
  docProgressNote:   { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  docRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  docIconWrap:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  docIcon:       { fontSize: 22 },
  docInfo:       { flex: 1 },
  docLabel:      { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 3 },
  docStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  docStatusDot:  { width: 6, height: 6, borderRadius: 3 },
  docStatusText: { fontSize: 11, fontWeight: '700' },
  docMissingText:{ fontSize: 11, color: Colors.textMuted },

  docUploadBtn: {
    backgroundColor: Colors.orange, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 72, alignItems: 'center',
  },
  docUploadBtnUploaded: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  docUploadBtnText:         { fontSize: 12, fontWeight: '800', color: Colors.white },
  docUploadBtnTextUploaded: { color: Colors.textSecondary },

  docFileName: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  docFileIcon:     { fontSize: 13 },
  docFileNameText: { fontSize: 11, color: Colors.textMuted, flex: 1 },

  infoBox: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoBoxText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },

  saveBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});