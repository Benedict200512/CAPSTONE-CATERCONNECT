import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, Image
} from 'react-native';
import { Colors } from '../../constants/colors';
import { AppRole, signUp } from '../../lib/auth';
import { 
  ChevronLeft, Mail, Lock, Eye, EyeOff, 
  ChevronRight, User, Store, MapPin, Building, 
  Phone, Home, ClipboardList, Info, 
  CreditCard, Sparkles, FileText, ChevronUp, 
  ChevronDown, Check, ShieldCheck, Edit3, Ban, HelpCircle 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BLOB_SIZE = width * 0.78;

type Step = 'role' | 'customer' | 'caterer';

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('role');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Customer specific fields (Phone is now shared with Caterer)
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Caterer specific fields
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  
  // Terms & Cancellation states
  const [agreedToCatererTerms, setAgreedToCatererTerms] = useState(false);
  const [agreedToCustomerTerms, setAgreedToCustomerTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCustomerTermsBox, setShowCustomerTermsBox] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '#E5E7EB' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: '#EF4444' };
    if (score <= 3) return { score, label: 'Fair', color: '#F59E0B' };
    if (score <= 4) return { score, label: 'Good', color: '#3B82F6' };
    return { score, label: 'Strong', color: '#10B981' };
  };

  const pwdStrength = getPasswordStrength(password);

  const handleRegister = async (role: AppRole) => {
    setError('');
    
    // Base validation for both roles
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    
    // Role-specific validation
    if (role === 'caterer') {
      if (!businessName || !city || !phone) { 
        setError('Please enter your business details and phone number.'); 
        return; 
      }
      if (!agreedToCatererTerms) { 
        setError('You must agree to the Terms & Conditions, Freemium Subscription Model, and Cancellation Policy to proceed.'); 
        return; 
      }
    } else {
      if (!phone || !address) {
        setError('Please enter your phone number and address.');
        return;
      }
      if (!agreedToCustomerTerms) {
        setError('You must agree to the Terms & Conditions, Downpayment Policies, and Cancellation Policy to proceed.');
        return;
      }
    }

    setLoading(true);
    
    // Pass the relevant data based on the role selected (Phone is passed for both)
    const { error } = await signUp(
      email, 
      password, 
      fullName, 
      role, 
      phone, 
      role === 'customer' ? address : undefined, 
      role === 'caterer' ? businessName : undefined, 
      role === 'caterer' ? city : undefined
    );
    
    setLoading(false);
    
    if (error) {
      setError(error.message);
      return;
    }

    router.replace('/(auth)/login');

    if (role === 'caterer') {
      Alert.alert(
        'Account Created!',
        'Your caterer account is pending verification. Complete your business profile in your dashboard for platform staff to verify you.'
      );
    } else {
      Alert.alert(
        'Account Created!',
        'Your account has been created. Please log in to continue.'
      );
    }
  };

  if (step === 'role') {
    const customerTags = [
      { label: 'Browse Caterers' },
      { label: 'Book Events' },
    ];
    const catererTags = [
      { label: 'List Business' },
      { label: 'Manage Bookings' },
    ];

    return (
      <View style={styles.screenContainer}>
        <View style={[styles.blob, styles.blobTL]} />
        <View style={[styles.blob, styles.blobTR]} />
        <View style={[styles.blob, styles.blobBL]} />
        <View style={[styles.blob, styles.blobBR]} />

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerWrapper}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(auth)/welcome')}>
              <ChevronLeft size={18} color={Colors.orange} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.brandSection}>
              <Image 
                source={require('../../assets/images/caterlogo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
              <Text style={styles.brand}>
                <Text style={styles.brandBlack}>CATER</Text>
                <Text style={styles.brandOrange}>CONNECT</Text>
              </Text>
              <Text style={styles.brandSub}>Cebu's Premier Catering Marketplace</Text>
            </View>

            <View style={styles.headerBlock}>
              <Text style={styles.headingOutside}>Join as a...</Text>
              <Text style={styles.subOutside}>Choose how you'll use CaterConnect</Text>
            </View>

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
                <Text style={styles.roleCardDesc}>Browse verified caterers, compare packages, and book catering for your special events seamlessly.</Text>
                <View style={styles.roleCardTags}>
                  {customerTags.map((t, idx) => (
                    <View key={idx} style={[styles.roleTag, { backgroundColor: '#F0F7FF', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.roleTagText, { color: '#1D4ED8' }]}>{t.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.roleCardArrowWrap}>
                <ChevronRight size={16} color="#1D4ED8" strokeWidth={2.5} />
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
                <Text style={styles.roleCardDesc}>List your catering business, showcase specialized menus, and receive direct bookings from local clients.</Text>
                <View style={styles.roleCardTags}>
                  {catererTags.map((t, idx) => (
                    <View key={idx} style={[styles.roleTag, { backgroundColor: '#FFF7ED', borderColor: '#FFB26B' }]}>
                      <Text style={[styles.roleTagText, { color: '#C2410C' }]}>{t.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.requiresBadge}>
                  <ShieldCheck size={14} color="#C2410C" />
                  <Text style={styles.requiresText}>Requires business document verification</Text>
                </View>
              </View>
              <View style={[styles.roleCardArrowWrap, { backgroundColor: Colors.orange }]}>
                <ChevronRight size={16} color={Colors.white} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.registerBtnText}>
                Already have an account?{' '}
                <Text style={styles.registerBtnAccent}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (step === 'customer') {
    return (
      <KeyboardAvoidingView
        style={styles.screenContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.blob, styles.blobTL]} />
        <View style={[styles.blob, styles.blobTR]} />
        <View style={[styles.blob, styles.blobBL]} />
        <View style={[styles.blob, styles.blobBR]} />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('role')}>
              <ChevronLeft size={18} color={Colors.orange} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.brandSection}>
              <Image 
                source={require('../../assets/images/caterlogo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
              <Text style={styles.brand}>
                <Text style={styles.brandBlack}>CATER</Text>
                <Text style={styles.brandOrange}>CONNECT</Text>
              </Text>
              <Text style={styles.brandSub}>Cebu's Premier Catering Marketplace</Text>
            </View>

            <View style={styles.headerBlock}>
              <Text style={styles.headingOutside}>Customer Account</Text>
              <Text style={styles.subOutside}>Start discovering and booking caterers today</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={styles.inputWrap}>
                <User size={18} color={Colors.orange} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrap}>
                <Mail size={18} color={Colors.orange} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={styles.inputWrap}>
                <Phone size={18} color={Colors.orange} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 09123456789"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.label}>ADDRESS</Text>
              <View style={styles.inputWrap}>
                <Home size={18} color={Colors.orange} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mandaue City, Cebu"
                  placeholderTextColor={Colors.textMuted}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Lock size={18} color={Colors.orange} />
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
                </TouchableOpacity>
              </View>

              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarsRow}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <View 
                        key={level} 
                        style={[
                          styles.strengthBar, 
                          { backgroundColor: pwdStrength.score >= level ? pwdStrength.color : '#E5E7EB' }
                        ]} 
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, { color: pwdStrength.color }]}>
                    Strength: {pwdStrength.label}
                  </Text>
                </View>
              )}

              {/* Customer Policy & How It Works Guide */}
              <View style={{ marginTop: 10, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={styles.termsToggle} 
                  onPress={() => setShowCustomerTermsBox(!showCustomerTermsBox)} 
                  activeOpacity={0.8}
                >
                  <View style={styles.termsToggleLeft}>
                    <HelpCircle size={16} color={Colors.orange} />
                    <Text style={styles.termsToggleText}>How CaterConnect Works for Customers</Text>
                  </View>
                  {showCustomerTermsBox ? <ChevronUp size={16} color={Colors.textSecondary} /> : <ChevronDown size={16} color={Colors.textSecondary} />}
                </TouchableOpacity>

                {showCustomerTermsBox && (
                  <View style={styles.termsBox}>
                    <Text style={styles.termsTitle}>Customer Guide & Policies</Text>
                    <Text style={styles.termsLastUpdated}>Cebu, Philippines · Platform Rules</Text>
                    
                    <Text style={[styles.termsSectionHeading, { marginTop: 6 }]}>1. Booking & Approval Process</Text>
                    <Text style={styles.termsSectionBody}>Browse verified local caterers, pick a standard package or custom setup, and submit your event details. The caterer will review and approve your request.</Text>

                    <Text style={[styles.termsSectionHeading, { marginTop: 6 }]}>2. Downpayment Policies (10%, 25%, 50%)</Text>
                    <Text style={styles.termsSectionBody}>Once approved, you are required to submit the required downpayment (10%, 25%, or 50% based on the caterer's package terms) before the specified deadline via GCash or digital payment gateways to lock in your schedule.</Text>

                    <Text style={[styles.termsSectionHeading, { marginTop: 6 }]}>3. Cancellation & Refund Rules</Text>
                    <Text style={styles.termsSectionBody}>• **&gt; 7 Days Before Event:** Free cancellation. Downpayments are fully eligible for a refund.{'\n'}• **&lt; 7 Days Before Event:** Downpayments are non-refundable because ingredients and staff have already been committed.</Text>

                    <Text style={[styles.termsSectionHeading, { marginTop: 6 }]}>4. In-App Chat Support</Text>
                    <Text style={styles.termsSectionBody}>Use the direct chatroom in your bookings tab to discuss dietary restrictions, venue guidelines, and coordinate any necessary refunds with your caterer.</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.agreeRow, agreedToCustomerTerms && styles.agreeRowChecked]}
                  onPress={() => setAgreedToCustomerTerms(!agreedToCustomerTerms)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, agreedToCustomerTerms && styles.checkboxChecked]}>
                    {agreedToCustomerTerms && <Check size={14} color={Colors.white} />}
                  </View>
                  <Text style={styles.agreeText}>
                    I agree to the <Text style={styles.agreeAccent}>Terms & Conditions, Downpayment Policies (10%, 25%, 50%), and Cancellation Policy</Text> of CaterConnect.
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, (!agreedToCustomerTerms || loading) && styles.btnDisabled]}
                onPress={() => handleRegister('customer')}
                disabled={!agreedToCustomerTerms || loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color={Colors.white} /> : (
                  <View style={styles.btnInner}>
                    <Text style={styles.btnText}>CREATE ACCOUNT</Text>
                    <View style={styles.btnArrow}>
                      <ChevronRight size={14} color={Colors.white} strokeWidth={2.5} />
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchRole} onPress={() => setStep('caterer')}>
                <Text style={styles.switchRoleText}>Registering as a caterer? <Text style={styles.switchRoleAccent}>Switch →</Text></Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.registerBtnText}>
                Already have an account?{' '}
                <Text style={styles.registerBtnAccent}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screenContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobTR]} />
      <View style={[styles.blob, styles.blobBL]} />
      <View style={[styles.blob, styles.blobBR]} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrapper}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('role')}>
            <ChevronLeft size={18} color={Colors.orange} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.brandSection}>
            <Image 
              source={require('../../assets/images/caterlogo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <Text style={styles.brand}>
              <Text style={styles.brandBlack}>CATER</Text>
              <Text style={styles.brandOrange}>CONNECT</Text>
            </Text>
            <Text style={styles.brandSub}>Cebu's Premier Catering Marketplace</Text>
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.headingOutside}>Caterer Account</Text>
            <Text style={styles.subOutside}>Start receiving verified bookings today</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionDividerLabel}>ACCOUNT INFORMATION</Text>

            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputWrap}>
              <User size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="Your full name" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
            </View>

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="business@email.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="Minimum 6 characters" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View 
                      key={level} 
                      style={[
                        styles.strengthBar, 
                        { backgroundColor: pwdStrength.score >= level ? pwdStrength.color : '#E5E7EB' }
                      ]} 
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: pwdStrength.color }]}>
                  Strength: {pwdStrength.label}
                </Text>
              </View>
            )}

            <Text style={styles.sectionDividerLabel}>BUSINESS INFORMATION</Text>

            <Text style={styles.label}>BUSINESS NAME</Text>
            <View style={styles.inputWrap}>
              <Store size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="e.g. Dela Cruz Catering" placeholderTextColor={Colors.textMuted} value={businessName} onChangeText={setBusinessName} />
            </View>

            <Text style={styles.label}>PHONE NUMBER</Text>
            <View style={styles.inputWrap}>
              <Phone size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="e.g. 09123456789" placeholderTextColor={Colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <Text style={styles.label}>CITY / SERVICE AREA</Text>
            <View style={styles.inputWrap}>
              <MapPin size={18} color={Colors.orange} />
              <TextInput style={styles.input} placeholder="e.g. Lapu-Lapu City" placeholderTextColor={Colors.textMuted} value={city} onChangeText={setCity} />
            </View>

            <TouchableOpacity style={styles.termsToggle} onPress={() => setShowTerms(!showTerms)} activeOpacity={0.8}>
              <View style={styles.termsToggleLeft}>
                <FileText size={16} color={Colors.black} />
                <Text style={styles.termsToggleText}>View Full Terms & Conditions</Text>
              </View>
              {showTerms ? <ChevronUp size={16} color={Colors.textSecondary} /> : <ChevronDown size={16} color={Colors.textSecondary} />}
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
                  { heading: '8. Cancellation Policy & Emergency Protocol', body: 'Caterers set their own downpayment policy. In case of emergency or unforeseen operational failures, caterers must provide valid notice. Habitual cancellations or unfulfilled booked services without valid cause may lead to account suspension or permanent termination.' },
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

            {/* Unified Caterer Terms & Cancellation Checkbox */}
            <TouchableOpacity
              style={[styles.agreeRow, agreedToCatererTerms && styles.agreeRowChecked]}
              onPress={() => setAgreedToCatererTerms(!agreedToCatererTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedToCatererTerms && styles.checkboxChecked]}>
                {agreedToCatererTerms && <Check size={14} color={Colors.white} />}
              </View>
              <Text style={styles.agreeText}>
                I agree to the <Text style={styles.agreeAccent}>Terms & Conditions</Text>, the <Text style={styles.agreeAccent}>Freemium Subscription Model</Text>, and the <Text style={styles.agreeAccent}>Caterer Cancellation & Emergency Protocol</Text> of CaterConnect.
              </Text>
            </TouchableOpacity>

            <View style={styles.profileNoteBox}>
              <View style={styles.sectionHeaderRow}>
                <Edit3 size={18} color="#166534" />
                <Text style={styles.profileNoteTitle}>Manage Business & Documents in Dashboard</Text>
              </View>
              <Text style={styles.profileNoteText}>After creating your account, go to your <Text style={{ fontWeight: '800' }}>Edit Profile / Dashboard</Text> to upload verification documents (Permits, Gov ID) and set up your logo, cover photo, description, and contact methods.</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (!agreedToCatererTerms || loading) && styles.btnDisabled]}
            onPress={() => handleRegister('caterer')}
            disabled={!agreedToCatererTerms || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>CREATE CATERER ACCOUNT</Text>
                <View style={styles.btnArrow}>
                  <ChevronRight size={14} color={Colors.white} strokeWidth={2.5} />
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRole} onPress={() => setStep('customer')}>
            <Text style={styles.switchRoleText}>Registering as a customer instead? <Text style={styles.switchRoleAccent}>Switch →</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.registerBtnText}>
              Already have an account?{' '}
              <Text style={styles.registerBtnAccent}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flexGrow: 1, 
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 24,
  },
  innerWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
  },
  blobTL: {
    backgroundColor: '#FFE8D6',
    top: -(BLOB_SIZE * 0.5),
    left: -(BLOB_SIZE * 0.5),
    opacity: 0.8,
  },
  blobTR: {
    backgroundColor: '#FFF3E8',
    top: -(BLOB_SIZE * 0.38),
    right: -(BLOB_SIZE * 0.55),
    opacity: 0.65,
  },
  blobBL: {
    backgroundColor: '#FFF0E5',
    bottom: -(BLOB_SIZE * 0.5),
    left: -(BLOB_SIZE * 0.45),
    opacity: 0.6,
  },
  blobBR: {
    backgroundColor: '#FFD6A5',
    bottom: -(BLOB_SIZE * 0.42),
    right: -(BLOB_SIZE * 0.5),
    opacity: 0.55,
  },

  backBtn: { 
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,178,107,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12, 
    alignSelf: 'flex-start',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  brandSection: { alignItems: 'center', marginBottom: 16 },
  logoImage: { width: 56, height: 56, marginBottom: 6 },
  brand: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  brandBlack: { color: Colors.black },
  brandOrange: { color: Colors.orange },
  brandSub: { fontSize: 11, color: Colors.orange, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },

  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headingOutside: {
    fontSize: 26, fontWeight: '900', color: Colors.black,
    marginBottom: 4, textAlign: 'center',
  },
  subOutside: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 18,
  },

  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1.5, borderColor: 'rgba(191,219,254,0.6)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
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
  roleCardContent: { padding: 22 },
  roleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  roleCardTitle: { fontSize: 20, fontWeight: '900', color: Colors.black },
  roleBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  roleBadgeText: { fontSize: 11, fontWeight: '800' },
  roleCardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 16 },
  roleCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  roleTagText: { fontSize: 11, fontWeight: '700' },
  requiresBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FFB26B', marginTop: 10 },
  requiresText: { fontSize: 12, color: '#92400E', fontWeight: '700', flex: 1 },
  roleCardArrowWrap: {
    position: 'absolute',
    top: 20, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center', alignItems: 'center',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1, borderColor: 'rgba(255,178,107,0.25)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },
  sectionDividerLabel: { fontSize: 10, fontWeight: '800', color: Colors.orange, letterSpacing: 2, marginBottom: 14, marginTop: 4 },
  label: {
    fontSize: 10, fontWeight: '800', color: Colors.textSecondary,
    letterSpacing: 1.2, marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 14, marginBottom: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 13 },
  eyeBtn: { padding: 4 },

  strengthContainer: {
    marginTop: -6,
    marginBottom: 14,
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  checkboxChecked: { backgroundColor: Colors.orange, borderColor: Colors.orange },

  termsToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9F5F2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', marginBottom: 12,
  },
  termsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  termsToggleText: { fontSize: 14, fontWeight: '800', color: Colors.black },
  termsBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  termsTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  termsLastUpdated: { fontSize: 12, color: Colors.textMuted, marginBottom: 12, fontWeight: '600' },
  termsSection: { marginBottom: 14 },
  termsSectionHeading: { fontSize: 13, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  termsSectionBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20 },

  agreeRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F9F5F2', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)', gap: 14, marginBottom: 12,
  },
  agreeRowChecked: { borderColor: Colors.orange, backgroundColor: '#FFF7ED' },
  agreeText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 21, fontWeight: '600' },
  agreeAccent: { color: Colors.orange, fontWeight: '900' },

  profileNoteBox: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#86EFAC', marginTop: 8 },
  profileNoteTitle: { fontSize: 14, fontWeight: '900', color: '#166534' },
  profileNoteText: { fontSize: 12, color: '#15803D', marginBottom: 4, lineHeight: 18, fontWeight: '600' },

  btn: {
    backgroundColor: Colors.orange, borderRadius: 50,
    paddingVertical: 17, paddingHorizontal: 20,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
    marginBottom: 16,
  },
  btnDisabled: { backgroundColor: Colors.textMuted },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 1, flex: 1, textAlign: 'center' },
  btnArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },

  error: { color: Colors.error, fontSize: 13, textAlign: 'center', marginBottom: 14, fontWeight: '700' },
  switchRole: { alignItems: 'center', marginBottom: 16 },
  switchRoleText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  switchRoleAccent: { color: Colors.orange, fontWeight: '900' },
  registerBtn: { alignItems: 'center', marginBottom: 8 },
  registerBtnText: { fontSize: 13, color: Colors.textSecondary },
  registerBtnAccent: { color: Colors.orange, fontWeight: '800' },
});