import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { AppRole, signUp } from '../../lib/auth';

const { width } = Dimensions.get('window');
const BLOB_SIZE = width * 0.78;

type Step = 'role' | 'customer' | 'caterer';

const ICONS = {
  arrowLeft: require('../../assets/icons/arrow_left.png'),
  arrowRight: require('../../assets/icons/arrow_right.png'),
  arrowRightWhite: require('../../assets/icons/arrow_right_white.png'),
  envelope: require('../../assets/icons/envelope.png'),
  lock: require('../../assets/icons/lock.png'),
  eye: require('../../assets/icons/eye.png'),
  eyeOff: require('../../assets/icons/eye_off.png'),
  person: require('../../assets/icons/person.png'),
  storefront: require('../../assets/icons/storefront.png'),
  pin: require('../../assets/icons/pin.png'),
  corporate: require('../../assets/icons/corporate.png'),
  testTube: require('../../assets/icons/test_tube.png'),
  idCard: require('../../assets/icons/id_card.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  info: require('../../assets/icons/info.png'),
  card: require('../../assets/icons/card.png'),
  sparkles: require('../../assets/icons/sparkles.png'),
  draft: require('../../assets/icons/draft.png'),
  chevronUp: require('../../assets/icons/chevron_up.png'),
  chevronDown: require('../../assets/icons/chevron_down.png'),
  check: require('../../assets/icons/check.png'),
  pencil: require('../../assets/icons/pencil.png'),
  photo: require('../../assets/icons/photo.png'),
  phone: require('../../assets/icons/phone.png'),
  moneyBag: require('../../assets/icons/money_bag.png'),
  calendar: require('../../assets/icons/calendar.png'),
  search: require('../../assets/icons/search.png'),
  star: require('../../assets/icons/star.png'),
  shieldCheck: require('../../assets/icons/shield_check.png'),
};

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('role');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [hasPermit, setHasPermit] = useState(false);
  const [hasSanitary, setHasSanitary] = useState(false);
  const [hasGovId, setHasGovId] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (role: AppRole) => {
    setError('');
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (role === 'caterer') {
      if (!businessName) { setError('Please enter your business name.'); return; }
      if (!agreedToTerms) { setError('You must agree to the Terms & Conditions to proceed.'); return; }
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, role);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.replace('/(auth)/login');

    if (role === 'caterer') {
      Alert.alert(
        'Account Created!',
        'Your caterer account is pending verification. Complete your business profile after logging in, then platform staff will review your documents.'
      );
    } else {
      Alert.alert(
        'Account Created!',
        'Your account has been created. Please log in to continue.'
      );
    }
  };

  const BlobBackground = () => (
    <>
      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobTR]} />
      <View style={[styles.blob, styles.blobBL]} />
      <View style={[styles.blob, styles.blobBR]} />
    </>
  );

  const BackButton = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity style={styles.backBtn} onPress={onPress}>
      <Image source={ICONS.arrowLeft} style={[styles.iconBack, { tintColor: Colors.textSecondary }]} />
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  );

  const BrandHeader = ({ onBack }: { onBack: () => void }) => (
    <>
      <BackButton onPress={onBack} />
      <View style={styles.brandSection}>
        <Text style={styles.brand}>
          <Text style={styles.brandBlack}>CATER</Text>
          <Text style={styles.brandOrange}>CONNECT</Text>
        </Text>
        <Text style={styles.brandSub}>Cebu's Catering Marketplace</Text>
      </View>
    </>
  );

  if (step === 'role') {
    const customerTags = [
      { icon: ICONS.search, label: 'Browse Caterers' },
      { icon: ICONS.calendar, label: 'Book Events' },
      { icon: ICONS.star, label: 'Leave Reviews' },
    ];
    const catererTags = [
      { icon: ICONS.storefront, label: 'List Business' },
      { icon: ICONS.clipboard, label: 'Manage Bookings' },
      { icon: ICONS.moneyBag, label: 'Earn Revenue' },
    ];

    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <BlobBackground />
        <ScrollView
          contentContainerStyle={styles.roleContainer}
          showsVerticalScrollIndicator={false}
        >
          <BackButton onPress={() => router.push('/(auth)/welcome')} />
          <View style={styles.brandSection}>
            <Text style={styles.brand}>
              <Text style={styles.brandBlack}>CATER</Text>
              <Text style={styles.brandOrange}>CONNECT</Text>
            </Text>
            <Text style={styles.brandSub}>Cebu's Catering Marketplace</Text>
          </View>

          <Text style={styles.rolePickTitle}>Join as a...</Text>
          <Text style={styles.rolePickSub}>Choose how you'll use CaterConnect</Text>

          <TouchableOpacity style={styles.roleCard} onPress={() => setStep('customer')} activeOpacity={0.88}>
            <View style={styles.roleIllustrationWrap}>
              <View style={[styles.roleIllustrationBg, { backgroundColor: '#EBF5FF' }]} />
              <Image
                source={require('@/assets/images/customer.png')}
                style={styles.roleIllustration}
                resizeMode="contain"
              />
            </View>
            <View style={styles.roleCardContent}>
              <View style={styles.roleCardHeader}>
                <Text style={styles.roleCardTitle}>Customer</Text>
                <View style={[styles.roleBadge, { backgroundColor: '#EBF5FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#1D4ED8' }]}>Free</Text>
                </View>
              </View>
              <Text style={styles.roleCardDesc}>Browse verified caterers, compare packages, and book catering for your events.</Text>
              <View style={styles.roleCardTags}>
                {customerTags.map((t) => (
                  <View key={t.label} style={[styles.roleTag, { backgroundColor: '#F0F7FF', borderColor: '#BFDBFE' }]}>
                    <Image source={t.icon} style={[styles.roleTagIcon, { tintColor: '#1D4ED8' }]} />
                    <Text style={[styles.roleTagText, { color: '#1D4ED8' }]}>{t.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.roleCardArrowWrap}>
              <Image source={ICONS.arrowRight} style={[styles.iconRoleArrow, { tintColor: '#1D4ED8' }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleCard, styles.roleCardCaterer]} onPress={() => setStep('caterer')} activeOpacity={0.88}>
            <View style={styles.roleIllustrationWrap}>
              <View style={[styles.roleIllustrationBg, { backgroundColor: '#FFF7ED' }]} />
              <Image
                source={require('@/assets/images/caterers.png')}
                style={styles.roleIllustration}
                resizeMode="contain"
              />
            </View>
            <View style={styles.roleCardContent}>
              <View style={styles.roleCardHeader}>
                <Text style={styles.roleCardTitle}>Caterer</Text>
                <View style={[styles.roleBadge, { backgroundColor: '#FFF7ED', borderColor: '#FFB26B' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#C2410C' }]}>Business</Text>
                </View>
              </View>
              <Text style={styles.roleCardDesc}>List your catering business, showcase packages, and receive bookings from clients.</Text>
              <View style={styles.roleCardTags}>
                {catererTags.map((t) => (
                  <View key={t.label} style={[styles.roleTag, { backgroundColor: '#FFF7ED', borderColor: '#FFB26B' }]}>
                    <Image source={t.icon} style={[styles.roleTagIcon, { tintColor: '#C2410C' }]} />
                    <Text style={[styles.roleTagText, { color: '#C2410C' }]}>{t.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.requiresBadge}>
                <Image source={ICONS.shieldCheck} style={[styles.requiresIcon, { tintColor: '#92400E' }]} />
                <Text style={styles.requiresText}>Requires business document verification</Text>
              </View>
            </View>
            <View style={[styles.roleCardArrowWrap, { backgroundColor: Colors.orange }]}>
              <Image source={ICONS.arrowRight} style={[styles.iconRoleArrow, { tintColor: Colors.white }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkAccent}>Log in →</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (step === 'customer') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlobBackground />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandHeader onBack={() => setStep('role')} />

          <View style={styles.stepBanner}>
            <View style={[styles.stepBannerBg, { backgroundColor: '#EBF5FF' }]} />
            <Image
              source={require('@/assets/images/customer.png')}
              style={styles.stepBannerImage}
              resizeMode="contain"
            />
            <View style={styles.stepBannerText}>
              <Text style={styles.stepBannerTitle}>Customer Account</Text>
              <Text style={styles.stepBannerSub}>Start booking caterers today</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputWrap}>
              <Image source={ICONS.person} style={[styles.iconInput, { tintColor: Colors.orange }]} />
              <TextInput style={styles.input} placeholder="e.g. Juan Dela Cruz" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
            </View>

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <Image source={ICONS.envelope} style={[styles.iconInput, { tintColor: Colors.orange }]} />
              <TextInput style={styles.input} placeholder="you@email.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Image source={ICONS.lock} style={[styles.iconInput, { tintColor: Colors.orange }]} />
              <TextInput style={styles.input} placeholder="Minimum 6 characters" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Image source={showPassword ? ICONS.eyeOff : ICONS.eye} style={[styles.iconEye, { tintColor: Colors.textMuted }]} />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={() => handleRegister('customer')} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={Colors.white} /> : (
                <View style={styles.btnInner}>
                  <Text style={styles.btnText}>CREATE ACCOUNT</Text>
                  <View style={styles.btnArrow}>
                    <Image source={ICONS.arrowRightWhite} style={styles.iconBtnArrow} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchRole} onPress={() => setStep('caterer')}>
              <Text style={styles.switchRoleText}>Registering as a caterer? <Text style={styles.switchRoleAccent}>Switch →</Text></Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkAccent}>Log in →</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const requiredDocs = [
    { key: 'permit', label: 'Business Permit', icon: ICONS.corporate, desc: 'Valid business permit from LGU', checked: hasPermit, set: setHasPermit },
    { key: 'sanitary', label: 'Sanitary Permit', icon: ICONS.testTube, desc: 'Current sanitary permit from health office', checked: hasSanitary, set: setHasSanitary },
    { key: 'govid', label: 'Government-issued ID', icon: ICONS.idCard, desc: 'Valid ID of the business owner', checked: hasGovId, set: setHasGovId },
  ];

  const profileItems = [
    { icon: ICONS.photo, label: 'Business logo & cover photo' },
    { icon: ICONS.draft, label: 'Business description' },
    { icon: ICONS.phone, label: 'Contact phone & email' },
    { icon: ICONS.moneyBag, label: 'Preferred payment methods' },
    { icon: ICONS.clipboard, label: 'Upload verification documents' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlobBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandHeader onBack={() => setStep('role')} />

        <View style={[styles.stepBanner, { borderColor: 'rgba(255,178,107,0.4)' }]}>
          <View style={[styles.stepBannerBg, { backgroundColor: '#FFF7ED' }]} />
          <Image
            source={require('@/assets/images/caterers.png')}
            style={styles.stepBannerImage}
            resizeMode="contain"
          />
          <View style={styles.stepBannerText}>
            <Text style={styles.stepBannerTitle}>Caterer Account</Text>
            <Text style={styles.stepBannerSub}>Start receiving bookings today</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionDividerLabel}>ACCOUNT INFORMATION</Text>

          <Text style={styles.label}>FULL NAME</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.person} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput style={styles.input} placeholder="Your full name" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
          </View>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.envelope} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput style={styles.input} placeholder="business@email.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.lock} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput style={styles.input} placeholder="Minimum 6 characters" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Image source={showPassword ? ICONS.eyeOff : ICONS.eye} style={[styles.iconEye, { tintColor: Colors.textMuted }]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionDividerLabel}>BUSINESS INFORMATION</Text>

          <Text style={styles.label}>BUSINESS NAME</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.storefront} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput style={styles.input} placeholder="e.g. Dela Cruz Catering" placeholderTextColor={Colors.textMuted} value={businessName} onChangeText={setBusinessName} />
          </View>

          <Text style={styles.label}>CITY / SERVICE AREA</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.pin} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput style={styles.input} placeholder="e.g. Lapu-Lapu City" placeholderTextColor={Colors.textMuted} value={city} onChangeText={setCity} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Image source={ICONS.clipboard} style={[styles.sectionHeaderIcon, { tintColor: Colors.orange }]} />
            <Text style={styles.docsTitle}>Required Documents</Text>
          </View>
          <Text style={styles.docsSub}>Confirm you have these ready to upload after registration. Platform staff will review them before approving your account.</Text>

          {requiredDocs.map((doc) => (
            <TouchableOpacity key={doc.key} style={[styles.docRow, doc.checked && styles.docRowChecked]} onPress={() => doc.set(!doc.checked)} activeOpacity={0.8}>
              <View style={styles.docIconWrap}>
                <Image source={doc.icon} style={[styles.docIconImg, { tintColor: Colors.orange }]} />
              </View>
              <View style={styles.docBody}>
                <Text style={styles.docLabel}>{doc.label}</Text>
                <Text style={styles.docDesc}>{doc.desc}</Text>
              </View>
              <View style={[styles.checkbox, doc.checked && styles.checkboxChecked]}>
                {doc.checked && <Image source={ICONS.check} style={styles.checkmarkImg} />}
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.docNote}>
            <Image source={ICONS.info} style={[styles.docNoteIcon, { tintColor: '#1E40AF' }]} />
            <Text style={styles.docNoteText}>You'll upload actual document files through the app after your account is created. Approval takes 1–3 business days.</Text>
          </View>

          <View style={styles.additionalDocs}>
            <Text style={styles.additionalDocsTitle}>Also required during verification:</Text>
            {['Business Registration Certificate', 'Proof of Address'].map((d) => (
              <View key={d} style={styles.additionalDocRow}>
                <Text style={styles.additionalDocDot}>•</Text>
                <Text style={styles.additionalDocText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subscription & Terms */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Image source={ICONS.card} style={[styles.sectionHeaderIcon, { tintColor: Colors.orange }]} />
            <Text style={styles.docsTitle}>Subscription Plans</Text>
          </View>
          <Text style={styles.docsSub}>
            CaterConnect uses a freemium model. You keep 100% of your booking earnings — no commissions.
          </Text>

          {[
            { id: 'free',     name: 'Free Plan',     price: '₱0/mo',    color: '#6B7280', bg: '#F3F4F6',  features: '3 packages · 5 bookings/month · Basic visibility' },
            { id: 'basic',    name: 'Basic Plan',    price: '₱299/mo',  color: '#2563EB', bg: '#DBEAFE',  features: 'Unlimited packages · 20 bookings/month · Higher visibility' },
            { id: 'standard', name: 'Standard Plan', price: '₱499/mo',  color: '#D97706', bg: '#FEF3C7',  features: 'All Basic + 50 bookings/month · Featured listing' },
            { id: 'premium',  name: 'Premium Plan',  price: '₱999/mo',  color: '#7C3AED', bg: '#F5F3FF',  features: 'Unlimited everything · Top placement · Featured Badge' },
          ].map((plan) => (
            <View key={plan.id} style={[styles.planRow, { borderColor: plan.color + '44' }]}>
              <View style={[styles.planIcon, { backgroundColor: plan.bg }]}>
                <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <Text style={styles.planFeatures}>{plan.features}</Text>
              </View>
            </View>
          ))}

          <View style={styles.freeNote}>
            <Image source={ICONS.sparkles} style={[styles.freeNoteIcon, { tintColor: '#166534' }]} />
            <Text style={styles.freeNoteText}>
              You start on the <Text style={{ fontWeight: '900' }}>Free Plan</Text> automatically once approved. Upgrade anytime from your dashboard.
            </Text>
          </View>

          <TouchableOpacity style={styles.termsToggle} onPress={() => setShowTerms(!showTerms)} activeOpacity={0.8}>
            <View style={styles.termsToggleLeft}>
              <Image source={ICONS.draft} style={[styles.termsToggleIcon, { tintColor: Colors.black }]} />
              <Text style={styles.termsToggleText}>View Full Terms & Conditions</Text>
            </View>
            <Image source={showTerms ? ICONS.chevronUp : ICONS.chevronDown} style={[styles.termsToggleArrowIcon, { tintColor: Colors.textSecondary }]} />
          </TouchableOpacity>

          {showTerms && (
            <View style={styles.termsBox}>
              <Text style={styles.termsTitle}>CaterConnect — Caterer Terms & Conditions</Text>
              <Text style={styles.termsLastUpdated}>Effective date: 2025 · Cebu, Philippines</Text>

              {[
                { heading: '1. Business Model — No Commission', body: 'CaterConnect does not charge commissions on bookings. Caterers receive 100% of their booking payments directly from customers. The platform generates revenue solely through optional subscription plans.' },
                { heading: '2. Subscription Plans', body: 'All verified caterers automatically receive the Free Plan upon approval. Caterers may upgrade to Basic (₱299/mo), Standard (₱499/mo), or Premium (₱999/mo) at any time.' },
                { heading: '3. Booking Limits', body: 'Each booking request received counts toward the caterer\'s monthly limit. Once the limit is reached, the caterer\'s packages remain visible but cannot accept new requests until the next cycle or an upgrade.' },
                { heading: '4. Package Limits', body: 'Free Plan caterers may create a maximum of 3 catering packages. Basic, Standard, and Premium Plan caterers may create unlimited packages.' },
                { heading: '5. Search & Budget Match Visibility', body: 'Subscription level affects placement in search results. Premium caterers appear first, followed by Standard, Basic, and Free plan caterers.' },
                { heading: '6. Subscription Payments', body: 'Subscription fees are paid monthly via GCash, Maya, or other accepted methods. Subscriptions not renewed revert to the Free Plan at end of billing cycle.' },
                { heading: '7. Caterer Verification', body: 'All caterers must submit valid business documents. Platform staff reviews and approves applications. Approved caterers receive a Verified Caterer Badge.' },
                { heading: '8. Cancellation Policy', body: 'Caterers set their own downpayment policy (10%, 25%, or 50%). In cases of caterer no-shows, the platform may take action including warnings, suspension, or permanent termination.' },
                { heading: '9. Code of Conduct', body: 'Caterers agree to provide accurate information, fulfill booked services as agreed, maintain valid permits, and treat customers professionally.' },
                { heading: '10. Account Suspension', body: 'CaterConnect reserves the right to suspend or permanently ban caterer accounts found in violation of these terms.' },
              ].map((section) => (
                <View key={section.heading} style={styles.termsSection}>
                  <Text style={styles.termsSectionHeading}>{section.heading}</Text>
                  <Text style={styles.termsSectionBody}>{section.body}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.agreeRow, agreedToTerms && styles.agreeRowChecked]}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Image source={ICONS.check} style={styles.checkmarkImg} />}
            </View>
            <Text style={styles.agreeText}>
              I have read and agree to the{' '}
              <Text style={styles.agreeAccent}>Terms & Conditions</Text>
              {' '}including the{' '}
              <Text style={styles.agreeAccent}>Freemium Subscription Model</Text>
              {' '}and understand that CaterConnect charges no commission on bookings.
            </Text>
          </TouchableOpacity>

          <View style={styles.profileNoteBox}>
            <View style={styles.sectionHeaderRow}>
              <Image source={ICONS.pencil} style={[styles.sectionHeaderIcon, { tintColor: '#166534' }]} />
              <Text style={styles.profileNoteTitle}>Complete Your Profile After Logging In</Text>
            </View>
            <Text style={styles.profileNoteText}>After your account is created, go to your <Text style={{ fontWeight: '800' }}>Business Profile</Text> to add:</Text>
            {profileItems.map((item) => (
              <View key={item.label} style={styles.profileNoteRow}>
                <Image source={item.icon} style={[styles.profileNoteIcon, { tintColor: '#166534' }]} />
                <Text style={styles.profileNoteItem}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, styles.btnCaterer, (!agreedToTerms || loading) && styles.btnDisabled]}
          onPress={() => handleRegister('caterer')}
          disabled={!agreedToTerms || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <View style={styles.btnInner}>
              <Text style={styles.btnText}>CREATE CATERER ACCOUNT</Text>
              <View style={[styles.btnArrow, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                <Image source={ICONS.arrowRightWhite} style={styles.iconBtnArrow} />
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchRole} onPress={() => setStep('customer')}>
          <Text style={styles.switchRoleText}>Registering as a customer instead? <Text style={styles.switchRoleAccent}>Switch →</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkAccent}>Log in →</Text></Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  roleContainer: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },

 
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
  },
  blobTL: { backgroundColor: '#FFE8D6', top: -(BLOB_SIZE * 0.5), left: -(BLOB_SIZE * 0.5), opacity: 0.8 },
  blobTR: { backgroundColor: '#FFF3E8', top: -(BLOB_SIZE * 0.38), right: -(BLOB_SIZE * 0.55), opacity: 0.65 },
  blobBL: { backgroundColor: '#FFF0E5', bottom: -(BLOB_SIZE * 0.5), left: -(BLOB_SIZE * 0.45), opacity: 0.6 },
  blobBR: { backgroundColor: '#FFD6A5', bottom: -(BLOB_SIZE * 0.42), right: -(BLOB_SIZE * 0.5), opacity: 0.55 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, alignSelf: 'flex-start' },
  iconBack: { width: 13, height: 13 },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },

  brandSection: { alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  brandBlack: { color: Colors.black },
  brandOrange: { color: Colors.orange },
  brandSub: { fontSize: 10, color: Colors.orange, fontWeight: '600', marginTop: 3, letterSpacing: 0.5 },

  rolePickTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  rolePickSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  
  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1.5, borderColor: 'rgba(191,219,254,0.6)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  roleCardCaterer: {
    borderColor: 'rgba(255,178,107,0.5)',
    shadowColor: '#F97316',
  },
  roleIllustrationWrap: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  roleIllustrationBg: {
    position: 'absolute',
    width: '100%', height: '100%',
    opacity: 0.6,
  },
  roleIllustration: {
    width: 130, height: 130,
  },
  roleCardContent: { padding: 16 },
  roleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roleCardTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  roleBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  roleBadgeText: { fontSize: 10, fontWeight: '800' },
  roleCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 10 },
  roleCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  roleTagIcon: { width: 11, height: 11 },
  roleTagText: { fontSize: 10, fontWeight: '700' },
  requiresBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF7ED', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FFB26B', marginTop: 6 },
  requiresIcon: { width: 13, height: 13 },
  requiresText: { fontSize: 11, color: '#92400E', fontWeight: '600', flex: 1 },
  roleCardArrowWrap: {
    position: 'absolute',
    top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  iconRoleArrow: { width: 15, height: 15 },

  
  stepBanner: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(191,219,254,0.5)',
    position: 'relative',
  },
  stepBannerBg: {
    position: 'absolute', width: '100%', height: '100%', opacity: 0.5,
  },
  stepBannerImage: {
    width: 95, height: 95,
    marginLeft: 10,
  },
  stepBannerText: { flex: 1, paddingHorizontal: 14 },
  stepBannerTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  stepBannerSub: { fontSize: 12, color: Colors.textSecondary },

 
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,178,107,0.2)',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    marginBottom: 16,
  },
  sectionDividerLabel: { fontSize: 10, fontWeight: '800', color: Colors.orange, letterSpacing: 2, marginBottom: 14, marginTop: 4 },
  label: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 14, marginBottom: 16, gap: 10,
  },
  iconInput: { width: 16, height: 16 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  iconEye: { width: 18, height: 18 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionHeaderIcon: { width: 17, height: 17 },

  docsTitle: { fontSize: 17, fontWeight: '900', color: Colors.black },
  docsSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  docRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F5F2', borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)', gap: 12,
  },
  docRowChecked: { borderColor: Colors.orange, backgroundColor: '#FFF7ED' },
  docIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center' },
  docIconImg: { width: 19, height: 19 },
  docBody: { flex: 1 },
  docLabel: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  docDesc: { fontSize: 11, color: Colors.textSecondary },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  checkboxChecked: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  checkmarkImg: { width: 13, height: 13, tintColor: Colors.white },
  docNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  docNoteIcon: { width: 15, height: 15, marginTop: 1 },
  docNoteText: { flex: 1, fontSize: 11, color: '#1E40AF', lineHeight: 17 },
  additionalDocs: { backgroundColor: '#F9F5F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.1)' },
  additionalDocsTitle: { fontSize: 12, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  additionalDocRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  additionalDocDot: { color: Colors.orange, fontWeight: '900' },
  additionalDocText: { fontSize: 12, color: Colors.textSecondary },

 
  planRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    padding: 12, marginBottom: 10, gap: 12,
  },
  planIcon: { borderRadius: 10, padding: 8, alignItems: 'center', minWidth: 80 },
  planPrice: { fontSize: 13, fontWeight: '900' },
  planName: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  planFeatures: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  freeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 14, marginTop: 4, borderWidth: 1, borderColor: '#86EFAC' },
  freeNoteIcon: { width: 15, height: 15, marginTop: 1 },
  freeNoteText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 18 },


  termsToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9F5F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', marginBottom: 12,
  },
  termsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termsToggleIcon: { width: 15, height: 15 },
  termsToggleText: { fontSize: 13, fontWeight: '700', color: Colors.black },
  termsToggleArrowIcon: { width: 12, height: 12 },
  termsBox: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  termsTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  termsLastUpdated: { fontSize: 11, color: Colors.textMuted, marginBottom: 14 },
  termsSection: { marginBottom: 12 },
  termsSectionHeading: { fontSize: 12, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  termsSectionBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 19 },

  agreeRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F9F5F2', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)', gap: 12, marginBottom: 16,
  },
  agreeRowChecked: { borderColor: Colors.orange, backgroundColor: '#FFF7ED' },
  agreeText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  agreeAccent: { color: Colors.orange, fontWeight: '800' },

  profileNoteBox: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#86EFAC' },
  profileNoteTitle: { fontSize: 13, fontWeight: '900', color: '#166534' },
  profileNoteText: { fontSize: 12, color: '#15803D', marginBottom: 8, lineHeight: 18 },
  profileNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  profileNoteIcon: { width: 13, height: 13 },
  profileNoteItem: { fontSize: 12, color: '#166534' },


  btn: {
    backgroundColor: Colors.black, borderRadius: 50,
    paddingVertical: 15, paddingHorizontal: 20,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6, marginBottom: 14,
  },
  btnCaterer: { backgroundColor: Colors.orange },
  btnDisabled: { backgroundColor: Colors.textMuted },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.5, flex: 1, textAlign: 'center' },
  btnArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnArrow: { width: 13, height: 13 },

  error: { color: Colors.error, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  switchRole: { alignItems: 'center', marginBottom: 12 },
  switchRoleText: { fontSize: 13, color: Colors.textSecondary },
  switchRoleAccent: { color: Colors.orange, fontWeight: '800' },
  loginLink: { alignItems: 'center', marginBottom: 8 },
  loginLinkText: { fontSize: 14, color: Colors.textSecondary },
  loginLinkAccent: { color: Colors.orange, fontWeight: '800' },
});