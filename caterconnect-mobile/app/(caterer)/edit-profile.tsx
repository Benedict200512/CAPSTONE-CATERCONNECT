import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { pickAndUpload } from '../../lib/storage';
import * as ImagePicker from 'expo-image-picker';
import {
  Building2,
  ShieldCheck,
  IdCard,
  ClipboardType,
  MapPin,
  Camera,
  ImageIcon,
  FileText,
  Info,
  ChevronLeft,
  UploadCloud,
} from 'lucide-react-native';

type CatererDoc = {
  id: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  status: string;
};

const REQUIRED_DOCS = [
  { type: 'business_permit', label: 'Business Permit', icon: Building2 },
  { type: 'sanitary_permit', label: 'Sanitary Permit', icon: ShieldCheck },
  { type: 'government_id', label: 'Government-issued ID', icon: IdCard },
  {
    type: 'business_registration',
    label: 'Business Registration Certificate',
    icon: ClipboardType,
  },
  { type: 'proof_of_address', label: 'Proof of Address', icon: MapPin },
];

const PAYMENT_OPTIONS = [
  { key: 'gcash', label: 'GCash', desc: 'Mobile wallet payment' },
  { key: 'maya', label: 'Maya', desc: 'Mobile wallet payment' },
  { key: 'bpi', label: 'BPI Online / QR', desc: 'Bank transfer via BPI' },
  { key: 'bdo', label: 'BDO Online / QR', desc: 'Bank transfer via BDO' },
  { key: 'card', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, JCB' },
];

export default function CatererEditProfile() {
  const { profile, catererData, session, reloadProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState((profile as any)?.phone_number ?? '');
  const [businessName, setBusinessName] = useState(
    catererData?.business_name ?? (profile as any)?.business_name ?? ''
  );
  const [description, setDescription] = useState(
    catererData?.business_description ?? ''
  );
  const [city, setCity] = useState(
    catererData?.city ?? (profile as any)?.city ?? ''
  );
  const [contactPhone, setContactPhone] = useState(
    catererData?.contact_phone ?? (profile as any)?.phone_number ?? ''
  );
  const [contactEmail, setContactEmail] = useState(
    catererData?.contact_email ?? profile?.email ?? ''
  );
  const [address, setAddress] = useState(
    catererData?.address ?? (profile as any)?.address ?? ''
  );

  const [downpayment, setDownpayment] = useState(
    String(catererData?.downpayment_percent ?? 25)
  );

  const [acceptedMethods, setAcceptedMethods] = useState<string[]>(
    catererData?.accepted_payment_methods ?? [
      'gcash',
      'maya',
      'bpi',
      'bdo',
      'card',
    ]
  );

  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>(
    catererData?.accepted_payment_details ?? {}
  );

  const [logoUrl, setLogoUrl] = useState(catererData?.logo_url ?? '');
  const [coverUrl, setCoverUrl] = useState(
    catererData?.cover_photo_url ?? ''
  );

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);

  const [docs, setDocs] = useState<CatererDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone((profile as any)?.phone_number ?? '');

    setBusinessName(
      catererData?.business_name ?? (profile as any)?.business_name ?? ''
    );
    setDescription(catererData?.business_description ?? '');
    setCity(catererData?.city ?? (profile as any)?.city ?? '');

    setContactPhone(
      catererData?.contact_phone ?? (profile as any)?.phone_number ?? ''
    );
    setContactEmail(catererData?.contact_email ?? profile?.email ?? '');
    setAddress(catererData?.address ?? (profile as any)?.address ?? '');

    setDownpayment(String(catererData?.downpayment_percent ?? 25));

    setAcceptedMethods(
      catererData?.accepted_payment_methods ?? [
        'gcash',
        'maya',
        'bpi',
        'bdo',
        'card',
      ]
    );

    setPaymentDetails(catererData?.accepted_payment_details ?? {});
    setLogoUrl(catererData?.logo_url ?? '');
    setCoverUrl(catererData?.cover_photo_url ?? '');

    if (catererData?.id) {
      loadDocs(catererData.id);
    }
  }, [profile, catererData]);

  const loadDocs = async (catererId: string) => {
    try {
      const { data, error } = await supabase
        .from('caterer_documents')
        .select('id, document_type, file_url, file_name, status')
        .eq('caterer_id', catererId);

      if (error) throw error;

      setDocs(data ?? []);
    } catch (error: any) {
      Alert.alert('Document Error', error.message);
    }
  };

  const ensureCatererId = async (): Promise<string | null> => {
    if (catererData?.id) {
      return catererData.id;
    }

    const userId = session?.user?.id;

    if (!userId || !businessName.trim()) {
      return null;
    }

    const { data: existing, error: lookupError } = await supabase
      .from('caterers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (existing?.id) {
      return existing.id;
    }

    const { data, error } = await supabase
      .from('caterers')
      .insert({
        user_id: userId,
        business_name: businessName.trim(),
        city: city.trim() || null,
        verification_status: 'unsubmitted',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id;
  };

  const togglePaymentMethod = (methodKey: string) => {
    if (acceptedMethods.includes(methodKey)) {
      if (acceptedMethods.length <= 1) {
        Alert.alert(
          'Required',
          'Please keep at least one payment method enabled.'
        );
        return;
      }

      setAcceptedMethods(
        acceptedMethods.filter((method) => method !== methodKey)
      );
    } else {
      setAcceptedMethods([...acceptedMethods, methodKey]);
    }
  };

  // LOGO UPLOAD
  const handlePickLogo = async () => {
    if (!session?.user?.id) return;

    try {
      setUploadingLogo(true);

      const catererId = await ensureCatererId();

      if (!catererId) {
        Alert.alert('Required', 'Please enter your business name first.');
        return;
      }

      const url = await pickAndUpload(
        'caterer-logos',
        catererId,
        'logo',
        [1, 1]
      );

      if (!url) return;

      const { error } = await supabase
        .from('caterers')
        .update({ logo_url: url })
        .eq('id', catererId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setLogoUrl(url);

      Alert.alert('Success', 'Business logo updated successfully.');
    } catch (error: any) {
      Alert.alert('Logo Upload Failed', error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // COVER PHOTO UPLOAD
  const handlePickCover = async () => {
    if (!session?.user?.id) return;

    try {
      setUploadingCover(true);

      const catererId = await ensureCatererId();

      if (!catererId) {
        Alert.alert('Required', 'Please enter your business name first.');
        return;
      }

      const url = await pickAndUpload(
        'caterer-covers',
        catererId,
        'cover',
        [16, 9]
      );

      if (!url) return;

      const { error } = await supabase
        .from('caterers')
        .update({ cover_photo_url: url })
        .eq('id', catererId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setCoverUrl(url);

      Alert.alert('Success', 'Business cover photo updated successfully.');
    } catch (error: any) {
      Alert.alert('Cover Upload Failed', error.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // DOCUMENT UPLOAD
  const handleUploadDocument = async (
    docType: string,
    docLabel: string
  ) => {
    if (!session?.user?.id) return;

    try {
      setUploadingDoc(docType);

      const catererId = await ensureCatererId();

      if (!catererId) {
        Alert.alert(
          'Required',
          'Please enter your business name first before uploading documents.'
        );
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to upload documents.'
        );
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

      if (!base64) {
        throw new Error('Failed to read the selected file.');
      }

      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const safeExt = ext === 'png' ? 'png' : 'jpg';
      const mimeType = safeExt === 'png' ? 'image/png' : 'image/jpeg';

      const fileName = `${docType}_${Date.now()}.${safeExt}`;
      const storagePath = `${session.user.id}/${fileName}`;

      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);

      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('caterer-documents')
        .upload(storagePath, byteArray, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage error: ${uploadError.message}`);
      }

      // Store the private storage path, not a public URL.
      const fileUrl = storagePath;

      const existing = docs.find(
        (doc) => doc.document_type === docType
      );

      if (existing) {
        const { error: updateError } = await supabase
          .from('caterer_documents')
          .update({
            file_url: fileUrl,
            file_name: fileName,
            status: 'pending',
          })
          .eq('id', existing.id)
          .eq('caterer_id', catererId);

        if (updateError) {
          throw new Error(
            `Database update error: ${updateError.message}`
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from('caterer_documents')
          .insert({
            caterer_id: catererId,
            document_type: docType,
            file_url: fileUrl,
            file_name: fileName,
            status: 'pending',
          });

        if (insertError) {
          throw new Error(
            `Database insert error: ${insertError.message}`
          );
        }
      }

      await loadDocs(catererId);

      Alert.alert(
        'Uploaded!',
        `${docLabel} has been uploaded successfully.`
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  // CHECK REQUIRED INFORMATION
  const validateSubmission = (documentRows: CatererDoc[]): string | null => {
    if (!businessName.trim()) {
      return 'Please enter your business name.';
    }

    if (!city.trim()) {
      return 'Please enter your city or area.';
    }

    if (!contactPhone.trim()) {
      return 'Please enter your business contact phone.';
    }

    if (!contactEmail.trim()) {
      return 'Please enter your business contact email.';
    }

    if (!address.trim()) {
      return 'Please enter your complete business address.';
    }

    if (!description.trim()) {
      return 'Please enter your business description.';
    }

    if (!fullName.trim()) {
      return 'Please enter your full name.';
    }

    if (!phone.trim()) {
      return 'Please enter your personal phone number.';
    }

    if (acceptedMethods.length === 0) {
      return 'Please select at least one accepted payment method.';
    }

    const missingDocuments = REQUIRED_DOCS.filter((required) => {
      return !documentRows.some(
        (doc) =>
          doc.document_type === required.type &&
          !!doc.file_url
      );
    });

    if (missingDocuments.length > 0) {
      return `Please upload all required documents:\n\n${missingDocuments
        .map((doc) => `• ${doc.label}`)
        .join('\n')}`;
    }

    return null;
  };

  // SAVE BUSINESS PROFILE AND SUBMIT FOR VERIFICATION
  const handleSave = async () => {
    if (!session?.user?.id) return;

    try {
      setSaving(true);

      const userId = session.user.id;

      const catererId = await ensureCatererId();

      if (!catererId) {
        throw new Error('Unable to find your caterer account.');
      }

      // Retrieve the latest documents directly from Supabase.
      const { data: documentRows, error: documentError } = await supabase
        .from('caterer_documents')
        .select('id, document_type, file_url, file_name, status')
        .eq('caterer_id', catererId);

      if (documentError) {
        throw new Error(
          `Unable to check your documents: ${documentError.message}`
        );
      }

      const latestDocs = (documentRows ?? []) as CatererDoc[];

      setDocs(latestDocs);

      // Validate all requirements before submission.
      const validationError = validateSubmission(latestDocs);

      if (validationError) {
        Alert.alert('Incomplete Requirements', validationError);
        return;
      }

      // Update personal profile.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          business_name: businessName.trim(),
          city: city.trim(),
        })
        .eq('id', userId);

      if (profileError) {
        throw new Error(
          `Profile update failed: ${profileError.message}`
        );
      }

      // Update caterer business information.
      const payload = {
        business_name: businessName.trim(),
        business_description: description.trim(),
        city: city.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        address: address.trim(),
        downpayment_percent: Number(downpayment) || 25,
        accepted_payment_methods: acceptedMethods,
        accepted_payment_details: paymentDetails,
      };

      const { error: catererError } = await supabase
        .from('caterers')
        .update(payload)
        .eq('id', catererId)
        .eq('user_id', userId);

      if (catererError) {
        throw new Error(
          `Business profile update failed: ${catererError.message}`
        );
      }

      // Retrieve current verification status.
      const { data: currentCaterer, error: statusError } = await supabase
        .from('caterers')
        .select('verification_status')
        .eq('id', catererId)
        .eq('user_id', userId)
        .single();

      if (statusError) {
        throw new Error(
          `Unable to check verification status: ${statusError.message}`
        );
      }

      const currentStatus = currentCaterer.verification_status;

      // Only unsubmitted or rejected applications should be submitted again.
      // Pending and approved accounts keep their existing status.
      if (
        currentStatus === 'unsubmitted' ||
        currentStatus === 'rejected'
      ) {
        const { data: submittedCaterer, error: submissionError } =
          await supabase
            .from('caterers')
            .update({
              verification_status: 'pending',
              rejection_reason: null,
            })
            .eq('id', catererId)
            .eq('user_id', userId)
            .eq('verification_status', currentStatus)
            .select('id')
            .maybeSingle();

        if (submissionError) {
          throw new Error(
            `Verification submission failed: ${submissionError.message}`
          );
        }

        if (!submittedCaterer) {
          throw new Error(
            'Your application could not be submitted. Please refresh and try again.'
          );
        }
      }

      await reloadProfile();

      const message =
        currentStatus === 'unsubmitted' ||
        currentStatus === 'rejected'
          ? 'Your business profile and all five required documents have been submitted successfully. Please wait while Platform Staff reviews your application.'
          : currentStatus === 'pending'
            ? 'Your business profile has been updated. Your application is still waiting for Platform Staff review.'
            : 'Your business profile has been updated successfully.';

      Alert.alert(
        currentStatus === 'unsubmitted' || currentStatus === 'rejected'
          ? 'Application Submitted!'
          : 'Profile Saved!',
        message,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(caterer)'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Save Failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadedCount = REQUIRED_DOCS.filter((required) =>
    docs.some(
      (doc) =>
        doc.document_type === required.type &&
        !!doc.file_url
    )
  ).length;

  const initial = (
    businessName || profile?.full_name || 'C'
  ).charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? 60 : 40 },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={Colors.black} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.pageTitle}>Business Profile</Text>
          <Text style={styles.pageSub}>
            Manage your catering details and verification
          </Text>
        </View>
      </View>

      {/* COVER PHOTO AND LOGO */}
      <View style={styles.mediaContainer}>
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
              <ImageIcon size={32} color={Colors.textMuted} />
              <Text style={styles.coverPlaceholderSub}>
                16:9 Cover Photo
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.coverEditBtn}
            onPress={handlePickCover}
            disabled={uploadingCover}
          >
            {uploadingCover ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Camera size={14} color={Colors.white} />
                <Text style={styles.coverEditText}>Edit Cover</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

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
            {uploadingLogo ? (
              <ActivityIndicator size="small" color={Colors.black} />
            ) : (
              <Camera size={16} color={Colors.black} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>BUSINESS INFORMATION</Text>

        <View style={styles.card}>
          {[
            {
              label: 'Business Name *',
              value: businessName,
              onChange: setBusinessName,
              placeholder: "e.g. Maria's Catering",
            },
            {
              label: 'City / Area',
              value: city,
              onChange: setCity,
              placeholder: 'e.g. Lapu-Lapu City',
            },
            {
              label: 'Contact Phone',
              value: contactPhone,
              onChange: setContactPhone,
              placeholder: 'e.g. 09171234567',
              keyboard: 'phone-pad' as const,
            },
            {
              label: 'Contact Email',
              value: contactEmail,
              onChange: setContactEmail,
              placeholder: 'business@email.com',
              keyboard: 'email-address' as const,
            },
          ].map((field, index, array) => (
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

              {index < array.length - 1 && (
                <View style={styles.divider} />
              )}
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

        {/* BOOKING POLICY */}
        <Text style={styles.sectionTitle}>BOOKING POLICY</Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Downpayment Percentage
            </Text>
            <Text style={styles.fieldSub}>
              Percentage customers must pay to confirm booking
            </Text>

            <View style={styles.dpRow}>
              {['10', '25', '50'].map((percentage) => (
                <TouchableOpacity
                  key={percentage}
                  style={[
                    styles.dpBtn,
                    downpayment === percentage && styles.dpBtnActive,
                  ]}
                  onPress={() => setDownpayment(percentage)}
                >
                  <Text
                    style={[
                      styles.dpBtnText,
                      downpayment === percentage && styles.dpBtnTextActive,
                    ]}
                  >
                    {percentage}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* PAYMENT METHODS */}
        <Text style={styles.sectionTitle}>
          ACCEPTED PAYMENT METHODS
        </Text>

        <Text style={styles.sectionSubText}>
          Choose which payment channels you support for client bookings.
        </Text>

        <View style={styles.card}>
          {PAYMENT_OPTIONS.map((option, index) => {
            const isSelected = acceptedMethods.includes(option.key);

            return (
              <View key={option.key}>
                <TouchableOpacity
                  style={styles.paymentRow}
                  activeOpacity={0.7}
                  onPress={() => togglePaymentMethod(option.key)}
                >
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentLabel}>
                      {option.label}
                    </Text>
                    <Text style={styles.paymentDesc}>
                      {option.desc}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>

                {index < PAYMENT_OPTIONS.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            );
          })}
        </View>

        {/* PAYMENT ACCOUNT DETAILS */}
        {acceptedMethods.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              PAYMENT ACCOUNT DETAILS
            </Text>

            <Text style={styles.sectionSubText}>
              Provide the account numbers or details clients should reference.
            </Text>

            <View style={styles.card}>
              {acceptedMethods.map((methodKey, index) => {
                const option = PAYMENT_OPTIONS.find(
                  (item) => item.key === methodKey
                );

                if (!option) return null;

                return (
                  <View key={methodKey}>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>
                        {option.label} Account / Number
                      </Text>

                      <TextInput
                        style={styles.input}
                        value={paymentDetails[methodKey] ?? ''}
                        onChangeText={(text) =>
                          setPaymentDetails((previous) => ({
                            ...previous,
                            [methodKey]: text,
                          }))
                        }
                        placeholder="e.g. 0917XXXXXXX or Account #"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>

                    {index < acceptedMethods.length - 1 && (
                      <View style={styles.divider} />
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* PERSONAL INFORMATION */}
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

        {/* BUSINESS DOCUMENTS */}
        <Text style={styles.sectionTitle}>BUSINESS DOCUMENTS</Text>

        <View style={styles.docProgressCard}>
          <View style={styles.docProgressTop}>
            <Text style={styles.docProgressLabel}>
              Verification Progress
            </Text>

            <Text
              style={[
                styles.docProgressCount,
                {
                  color:
                    uploadedCount === REQUIRED_DOCS.length
                      ? Colors.success
                      : Colors.orange,
                },
              ]}
            >
              {uploadedCount}/{REQUIRED_DOCS.length}
            </Text>
          </View>

          <View style={styles.docProgressBarBg}>
            <View
              style={[
                styles.docProgressBarFill,
                {
                  width: `${(uploadedCount / REQUIRED_DOCS.length) * 100}%`,
                  backgroundColor:
                    uploadedCount === REQUIRED_DOCS.length
                      ? Colors.success
                      : Colors.orange,
                },
              ]}
            />
          </View>

          {uploadedCount < REQUIRED_DOCS.length ? (
            <Text style={styles.docProgressNote}>
              Upload all required documents below to submit your profile for platform verification.
            </Text>
          ) : (
            <Text
              style={[
                styles.docProgressNote,
                { color: Colors.success, fontWeight: '600' },
              ]}
            >
              All documents uploaded. Your profile is ready for review.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          {REQUIRED_DOCS.map((document, index) => {
            const uploaded = docs.find(
              (doc) => doc.document_type === document.type
            );

            const isUploading = uploadingDoc === document.type;
            const DocumentIcon = document.icon;

            return (
              <View key={document.type}>
                <View style={styles.docRow}>
                  <View
                    style={[
                      styles.docIconWrap,
                      {
                        backgroundColor: uploaded ? '#DCFCE7' : '#F1F5F9',
                      },
                    ]}
                  >
                    <DocumentIcon
                      size={22}
                      color={
                        uploaded ? Colors.success : Colors.textSecondary
                      }
                    />
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docLabel}>
                      {document.label}
                    </Text>

                    {uploaded ? (
                      <View style={styles.docStatusRow}>
                        <View
                          style={[
                            styles.docStatusDot,
                            {
                              backgroundColor:
                                uploaded.status === 'approved'
                                  ? Colors.success
                                  : uploaded.status === 'rejected'
                                    ? Colors.error
                                    : Colors.orange,
                            },
                          ]}
                        />

                        <Text
                          style={[
                            styles.docStatusText,
                            {
                              color:
                                uploaded.status === 'approved'
                                  ? Colors.success
                                  : uploaded.status === 'rejected'
                                    ? Colors.error
                                    : Colors.orange,
                            },
                          ]}
                        >
                          {uploaded.status === 'approved'
                            ? 'Approved'
                            : uploaded.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending review'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.docMissingText}>
                        Not uploaded yet
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.docUploadBtn,
                      uploaded && styles.docUploadBtnUploaded,
                      isUploading && { opacity: 0.6 },
                    ]}
                    onPress={() =>
                      handleUploadDocument(document.type, document.label)
                    }
                    disabled={uploadingDoc !== null}
                  >
                    {isUploading ? (
                      <ActivityIndicator
                        size="small"
                        color={uploaded ? Colors.black : Colors.white}
                      />
                    ) : (
                      <>
                        <UploadCloud
                          size={14}
                          color={
                            uploaded
                              ? Colors.textSecondary
                              : Colors.white
                          }
                          style={{ marginRight: 4 }}
                        />

                        <Text
                          style={[
                            styles.docUploadBtnText,
                            uploaded && styles.docUploadBtnTextUploaded,
                          ]}
                        >
                          {uploaded ? 'Replace' : 'Upload'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {uploaded?.file_name && (
                  <View style={styles.docFileName}>
                    <FileText size={12} color={Colors.textMuted} />
                    <Text
                      style={styles.docFileNameText}
                      numberOfLines={1}
                    >
                      {uploaded.file_name}
                    </Text>
                  </View>
                )}

                {index < REQUIRED_DOCS.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          <Info size={20} color="#1D4ED8" style={{ marginTop: 2 }} />

          <Text style={styles.infoBoxText}>
            All documents are manually reviewed by our staff. Accepted formats: JPG and PNG. Please ensure your images are bright and text is legible.
          </Text>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving || uploadingDoc !== null}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>
              Save Business Profile
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.white,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mediaContainer: {
    position: 'relative',
    marginBottom: 56,
    backgroundColor: Colors.white,
  },
  coverWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPlaceholderSub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  coverEditBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coverEditText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  logoWrap: {
    position: 'absolute',
    bottom: -40,
    left: 24,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    backgroundColor: Colors.bgInput,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitial: {
    color: Colors.white,
    fontSize: 36,
    fontWeight: '800',
  },
  logoEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  formSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 12,
  },
  sectionSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  field: {
    padding: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.black,
  },
  multiline: {
    minHeight: 90,
    paddingTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 18,
  },
  dpRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dpBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dpBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.orange,
  },
  dpBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  dpBtnTextActive: {
    color: Colors.orange,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  paymentInfo: {
    flex: 1,
    paddingRight: 12,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  checkboxSelected: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  docProgressCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  docProgressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  docProgressLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.black,
  },
  docProgressCount: {
    fontSize: 18,
    fontWeight: '900',
  },
  docProgressBarBg: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  docProgressBarFill: {
    height: 10,
    borderRadius: 5,
  },
  docProgressNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  docStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  docStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  docMissingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  docUploadBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docUploadBtnUploaded: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  docUploadBtnTextUploaded: {
    color: Colors.textSecondary,
  },
  docFileName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    marginTop: -6,
  },
  docFileNameText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 20,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
