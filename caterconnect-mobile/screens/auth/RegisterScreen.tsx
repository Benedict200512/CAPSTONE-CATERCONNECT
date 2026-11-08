
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { AppRole, signUp } from '../../lib/auth';
import {
  POLICY_VERSION,
  POLICY_SECTIONS,
} from '../../constants/registrationPolicies';

import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  User,
  Store,
  MapPin,
  Phone,
  Home,
  FileText,
  ChevronUp,
  ChevronDown,
  Check,
  ShieldCheck,
  Edit3,
  HelpCircle,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BLOB_SIZE = width * 0.78;

const GREEN = '#16A34A';
const RED = '#DC2626';
const MIN_PASSWORD_LENGTH = 8;

type Step = 'role' | 'customer' | 'caterer';
type FieldStatus = 'default' | 'valid' | 'invalid';

export default function RegisterScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');

  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [agreedToCatererTerms, setAgreedToCatererTerms] =
    useState(false);

  const [agreedToCustomerTerms, setAgreedToCustomerTerms] =
    useState(false);

  const [showTerms, setShowTerms] = useState(false);
  const [showCustomerTermsBox, setShowCustomerTermsBox] =
    useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ==========================================
  // VALIDATION
  // ==========================================

  const validateEmail = (value: string) => {
    if (!value.trim()) return 'Email address is required.';

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? ''
      : 'Please enter a valid email address.';
  };

  const validatePhone = (value: string) => /^09\d{9}$/.test(value);

  const emailError =
    emailTouched || submitted ? validateEmail(email) : '';

  const phoneError =
    phoneTouched || submitted
      ? validatePhone(phone)
        ? ''
        : 'Enter a valid 11-digit number starting with 09.'
      : '';

  const passwordError =
    passwordTouched || submitted
      ? password.length >= MIN_PASSWORD_LENGTH
        ? ''
        : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : '';

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailTouched(true);
    setError('');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
    setPhoneTouched(true);
    setError('');
  };

  // ==========================================
  // PASSWORD STRENGTH
  // ==========================================

  const getPasswordStrength = (pass: string) => {
    if (!pass) {
      return {
        score: 0,
        label: '',
        color: '#E5E7EB',
      };
    }

    let score = 0;

    if (pass.length >= MIN_PASSWORD_LENGTH) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) {
      return { score, label: 'Weak', color: '#EF4444' };
    }

    if (score <= 3) {
      return { score, label: 'Fair', color: '#F59E0B' };
    }

    if (score <= 4) {
      return { score, label: 'Good', color: '#3B82F6' };
    }

    return { score, label: 'Strong', color: '#10B981' };
  };

  const pwdStrength = getPasswordStrength(password);

  // ==========================================
  // INPUT HELPERS
  // ==========================================

  const getFieldStatus = (
    value: string,
    valid: boolean,
    touched: boolean
  ): FieldStatus => {
    if (!touched) return 'default';
    return valid ? 'valid' : 'invalid';
  };

  const getInputStyle = (status: FieldStatus) => [
    styles.inputWrap,
    status === 'valid' && styles.inputWrapValid,
    status === 'invalid' && styles.inputWrapError,
  ];

  const getIconColor = (status: FieldStatus) => {
    if (status === 'valid') return GREEN;
    if (status === 'invalid') return RED;
    return Colors.orange;
  };

  const renderFieldError = (
    status: FieldStatus,
    message: string
  ) => {
    if (status !== 'invalid') return null;

    return <Text style={styles.fieldError}>{message}</Text>;
  };

  // ==========================================
  // EMAIL INPUT
  // ==========================================

  const renderEmailInput = (placeholder: string) => {
    const status = getFieldStatus(
      email,
      !validateEmail(email),
      emailTouched || submitted
    );

    return (
      <>
        <Text style={styles.label}>EMAIL ADDRESS</Text>

        <View style={getInputStyle(status)}>
          <Mail size={18} color={getIconColor(status)} />

          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={handleEmailChange}
            onBlur={() => setEmailTouched(true)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        {renderFieldError(status, emailError)}
      </>
    );
  };

  // ==========================================
  // PHONE INPUT
  // ==========================================

  const renderPhoneInput = () => {
    const status = getFieldStatus(
      phone,
      validatePhone(phone),
      phoneTouched || submitted
    );

    return (
      <>
        <Text style={styles.label}>PHONE NUMBER</Text>

        <View style={getInputStyle(status)}>
          <Phone size={18} color={getIconColor(status)} />

          <TextInput
            style={styles.input}
            placeholder="09XXXXXXXXX"
            placeholderTextColor={Colors.textMuted}
            value={phone}
            onChangeText={handlePhoneChange}
            onBlur={() => setPhoneTouched(true)}
            keyboardType="number-pad"
            maxLength={11}
          />
        </View>

        {renderFieldError(status, phoneError)}

        {status === 'default' && (
          <Text style={styles.phoneHint}>
            Enter your 11-digit Philippine mobile number.
          </Text>
        )}
      </>
    );
  };

  // ==========================================
  // PASSWORD INPUT
  // ==========================================

  const renderPasswordInput = () => {
    const status = getFieldStatus(
      password,
      password.length >= MIN_PASSWORD_LENGTH,
      passwordTouched || submitted
    );

    return (
      <>
        <Text style={styles.label}>PASSWORD</Text>

        <View style={getInputStyle(status)}>
          <Lock size={18} color={getIconColor(status)} />

          <TextInput
            style={styles.input}
            placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setPasswordTouched(true);
              setError('');
            }}
            onBlur={() => setPasswordTouched(true)}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            {showPassword ? (
              <EyeOff size={18} color={Colors.textMuted} />
            ) : (
              <Eye size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {renderFieldError(status, passwordError)}

        {!!password.length && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBarsRow}>
              {[1, 2, 3, 4, 5].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        pwdStrength.score >= level
                          ? pwdStrength.color
                          : '#E5E7EB',
                    },
                  ]}
                />
              ))}
            </View>

            <Text
              style={[
                styles.strengthText,
                { color: pwdStrength.color },
              ]}
            >
              Strength: {pwdStrength.label}
            </Text>
          </View>
        )}
      </>
    );
  };

  // ==========================================
  // SIMPLE INPUT
  // ==========================================

  const renderSimpleInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    Icon: typeof User,
    errorMessage: string
  ) => {
    const status = getFieldStatus(
      value,
      !!value.trim(),
      submitted || !!value.length
    );

    return (
      <>
        <Text style={styles.label}>{label}</Text>

        <View style={getInputStyle(status)}>
          <Icon size={18} color={getIconColor(status)} />

          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={(newValue) => {
              onChange(newValue);
              setError('');
            }}
          />
        </View>

        {renderFieldError(status, errorMessage)}
      </>
    );
  };

  // ==========================================
  // TERMS AND CONDITIONS
  // ==========================================

  const renderTermsSections = (
    role: 'customer' | 'caterer'
  ) => (
    <View style={styles.termsBox}>
      <Text style={styles.termsTitle}>
        {role === 'customer'
          ? 'Customer Terms & Policies'
          : 'CaterConnect — Caterer Terms & Conditions'}
      </Text>

      <Text style={styles.termsLastUpdated}>
        Version {POLICY_VERSION} · Draft for review
      </Text>

      {POLICY_SECTIONS[role].map((section) => (
        <View key={section.heading} style={styles.termsSection}>
          <Text style={styles.termsSectionHeading}>
            {section.heading}
          </Text>

          <Text style={styles.termsSectionBody}>
            {section.body}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderAgreement = (
    role: 'customer' | 'caterer'
  ) => {
    const agreed =
      role === 'customer'
        ? agreedToCustomerTerms
        : agreedToCatererTerms;

    const setAgreed =
      role === 'customer'
        ? setAgreedToCustomerTerms
        : setAgreedToCatererTerms;

    const description =
      role === 'customer'
        ? 'Customer Terms, Downpayment Policy, Cancellation & Refund Policy, and Privacy Notice'
        : 'Caterer Terms, Verification, Zero-Commission and Subscription Policies, and Privacy Notice';

    return (
      <TouchableOpacity
        style={[
          styles.agreeRow,
          agreed && styles.agreeRowChecked,
        ]}
        onPress={() => {
          setAgreed(!agreed);
          setError('');
        }}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.checkbox,
            agreed && styles.checkboxChecked,
          ]}
        >
          {agreed && (
            <Check size={14} color={Colors.white} />
          )}
        </View>

        <Text style={styles.agreeText}>
          I {role === 'customer' ? 'agree to the' : 'accept the'}{' '}
          <Text style={styles.agreeAccent}>
            {description}
          </Text>

          {role === 'caterer'
            ? ` (version ${POLICY_VERSION}).`
            : ' of CaterConnect.'}
        </Text>
      </TouchableOpacity>
    );
  };

  // ==========================================
  // REGISTRATION
  // ==========================================

  const handleRegister = async (role: AppRole) => {
    if (loading) return;

    setSubmitted(true);
    setEmailTouched(true);
    setPhoneTouched(true);
    setPasswordTouched(true);
    setError('');

    const nameInvalid = !fullName.trim();
    const emailInvalid = !!validateEmail(email);
    const phoneInvalid = !validatePhone(phone);

    const passwordInvalid =
      password.length < MIN_PASSWORD_LENGTH;

    const customerInvalid =
      role === 'customer' && !address.trim();

    const catererInvalid =
      role === 'caterer' &&
      (!businessName.trim() || !city.trim());

    if (
      nameInvalid ||
      emailInvalid ||
      phoneInvalid ||
      passwordInvalid ||
      customerInvalid ||
      catererInvalid
    ) {
      return;
    }

    const agreed =
      role === 'caterer'
        ? agreedToCatererTerms
        : agreedToCustomerTerms;

    if (!agreed) {
      setError(
        role === 'caterer'
          ? 'You must agree to the Caterer Terms, Subscription and Verification Policies, and Privacy Notice to proceed.'
          : 'You must agree to the Customer Terms, Downpayment and Refund Policies, and Privacy Notice to proceed.'
      );

      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error: signUpError } = await signUp(
        cleanEmail,
        password,
        fullName.trim(),
        role,
        phone,
        role === 'customer' ? address.trim() : undefined,
        role === 'caterer' ? businessName.trim() : undefined,
        role === 'caterer' ? city.trim() : undefined,
        agreed
      );

      if (signUpError) {
        setError(
          signUpError.message ||
            'Registration failed. Please try again.'
        );
        return;
      }

      if (!data?.user) {
        setError(
          'Your account could not be created. Please try again.'
        );
        return;
      }

      // Do not automatically log in.
      // Send the user to email verification.
      router.replace({
  pathname: '/(auth)/verify-email',
  params: {
    email: email.trim(),
  },
});

    } catch (err: any) {
      console.error('Registration error:', err);

      setError(
        err?.message ||
          'Something went wrong during registration. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // BRAND
  // ==========================================

  const renderBrand = () => (
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

      <Text style={styles.brandSub}>
        Cebu's Premier Catering Marketplace
      </Text>
    </View>
  );

  // ==========================================
  // BACKGROUND
  // ==========================================

  const renderBlobs = () => (
    <>
      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobTR]} />
      <View style={[styles.blob, styles.blobBL]} />
      <View style={[styles.blob, styles.blobBR]} />
    </>
  );

  // ==========================================
  // BACK BUTTON
  // ==========================================

  const renderBackButton = (
    destination: Step | 'welcome'
  ) => (
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => {
        setError('');
        setSubmitted(false);
        setEmailTouched(false);
        setPhoneTouched(false);
        setPasswordTouched(false);

        if (destination === 'welcome') {
          router.push('/(auth)/welcome');
        } else {
          setStep(destination);
        }
      }}
    >
      <ChevronLeft
        size={18}
        color={Colors.orange}
        strokeWidth={2.5}
      />
    </TouchableOpacity>
  );

  // ==========================================
  // FOOTER
  // ==========================================

  const renderFooter = () => (
    <TouchableOpacity
      style={styles.registerBtn}
      onPress={() => router.push('/(auth)/login')}
    >
      <Text style={styles.registerBtnText}>
        Already have an account?{' '}
        <Text style={styles.registerBtnAccent}>
          Log in
        </Text>
      </Text>
    </TouchableOpacity>
  );

  // ==========================================
  // SUBMIT BUTTON
  // ==========================================

  const renderSubmitButton = (
    role: AppRole,
    label: string
  ) => (
    <TouchableOpacity
      style={[
        styles.btn,
        loading && styles.btnDisabled,
      ]}
      onPress={() => handleRegister(role)}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <View style={styles.btnInner}>
          <Text style={styles.btnText}>{label}</Text>

          <View style={styles.btnArrow}>
            <ChevronRight
              size={14}
              color={Colors.white}
              strokeWidth={2.5}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  // ==========================================
  // SWITCH ROLE
  // ==========================================

  const renderSwitchRole = (
    target: Step,
    label: string
  ) => (
    <TouchableOpacity
      style={styles.switchRole}
      onPress={() => {
        setError('');
        setSubmitted(false);
        setEmailTouched(false);
        setPhoneTouched(false);
        setPasswordTouched(false);
        setStep(target);
      }}
    >
      <Text style={styles.switchRoleText}>
        {label}{' '}
        <Text style={styles.switchRoleAccent}>
          Switch →
        </Text>
      </Text>
    </TouchableOpacity>
  );

  // ==========================================
  // CUSTOMER FORM
  // ==========================================

  const renderCustomer = () => (
    <View style={styles.card}>
      {renderSimpleInput(
        'FULL NAME',
        fullName,
        setFullName,
        'e.g. Juan Dela Cruz',
        User,
        'Please enter your full name.'
      )}

      {renderEmailInput('name@example.com')}

      {renderPhoneInput()}

      {renderSimpleInput(
        'ADDRESS',
        address,
        setAddress,
        'e.g. Mandaue City, Cebu',
        Home,
        'Please enter your address.'
      )}

      {renderPasswordInput()}

      <View style={{ marginTop: 10, marginBottom: 16 }}>
        <TouchableOpacity
          style={styles.termsToggle}
          onPress={() =>
            setShowCustomerTermsBox(!showCustomerTermsBox)
          }
        >
          <View style={styles.termsToggleLeft}>
            <HelpCircle
              size={16}
              color={Colors.orange}
            />

            <Text style={styles.termsToggleText}>
              How CaterConnect Works for Customers
            </Text>
          </View>

          {showCustomerTermsBox ? (
            <ChevronUp
              size={16}
              color={Colors.textSecondary}
            />
          ) : (
            <ChevronDown
              size={16}
              color={Colors.textSecondary}
            />
          )}
        </TouchableOpacity>

        {showCustomerTermsBox &&
          renderTermsSections('customer')}

        {renderAgreement('customer')}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {renderSubmitButton(
        'customer',
        'CREATE ACCOUNT'
      )}
    </View>
  );

  // ==========================================
  // CATERER FORM
  // ==========================================

  const renderCaterer = () => (
    <View style={styles.card}>
      <Text style={styles.sectionDividerLabel}>
        ACCOUNT INFORMATION
      </Text>

      {renderSimpleInput(
        'FULL NAME',
        fullName,
        setFullName,
        'Your full name',
        User,
        'Please enter your full name.'
      )}

      {renderEmailInput('business@email.com')}

      {renderPasswordInput()}

      <Text style={styles.sectionDividerLabel}>
        BUSINESS INFORMATION
      </Text>

      {renderSimpleInput(
        'BUSINESS NAME',
        businessName,
        setBusinessName,
        'e.g. Dela Cruz Catering',
        Store,
        'Please enter your business name.'
      )}

      {renderPhoneInput()}

      {renderSimpleInput(
        'CITY / SERVICE AREA',
        city,
        setCity,
        'e.g. Lapu-Lapu City',
        MapPin,
        'Please enter your city/service area.'
      )}

      <TouchableOpacity
        style={styles.termsToggle}
        onPress={() => setShowTerms(!showTerms)}
      >
        <View style={styles.termsToggleLeft}>
          <FileText
            size={16}
            color={Colors.black}
          />

          <Text style={styles.termsToggleText}>
            View Full Terms & Conditions
          </Text>
        </View>

        {showTerms ? (
          <ChevronUp
            size={16}
            color={Colors.textSecondary}
          />
        ) : (
          <ChevronDown
            size={16}
            color={Colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      {showTerms && renderTermsSections('caterer')}

      {renderAgreement('caterer')}

      <View style={styles.profileNoteBox}>
        <View style={styles.sectionHeaderRow}>
          <Edit3 size={18} color="#166534" />

          <Text style={styles.profileNoteTitle}>
            Manage Business Details in Dashboard
          </Text>
        </View>

        <Text style={styles.profileNoteText}>
          After creating your account, go to your{' '}
          <Text style={{ fontWeight: '800' }}>
            Edit Profile / Dashboard
          </Text>
          {' '}to upload verification documents (Permits, Gov ID)
          and set up your logo, cover photo, description, and
          contact methods.
        </Text>
      </View>
    </View>
  );

  // ==========================================
  // ROLE SELECTION
  // ==========================================

  if (step === 'role') {
    const roles = [
      {
        role: 'customer' as const,
        title: 'Customer',
        badge: 'Free',
        desc: 'Browse verified caterers, compare packages, and book catering for your special events seamlessly.',
        tags: ['Browse Caterers', 'Book Events'],
        bg: '#EBF5FF',
        border: '#BFDBFE',
        color: '#1D4ED8',
        image: require('@/assets/images/customer.png'),
      },
      {
        role: 'caterer' as const,
        title: 'Caterer',
        badge: 'Business',
        desc: 'List your catering business, showcase specialized menus, and receive direct bookings from local clients.',
        tags: ['List Business', 'Manage Bookings'],
        bg: '#FFF7ED',
        border: '#FFB26B',
        color: '#C2410C',
        image: require('@/assets/images/caterers.png'),
      },
    ];

    return (
      <View style={styles.screenContainer}>
        {renderBlobs()}

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerWrapper}>
            {renderBackButton('welcome')}

            {renderBrand()}

            <View style={styles.headerBlock}>
              <Text style={styles.headingOutside}>
                Join as a...
              </Text>

              <Text style={styles.subOutside}>
                Choose how you'll use CaterConnect
              </Text>
            </View>

            {roles.map((item) => (
              <TouchableOpacity
                key={item.role}
                style={[
                  styles.roleCard,
                  item.role === 'caterer' &&
                    styles.roleCardCaterer,
                ]}
                onPress={() => {
                  setError('');
                  setSubmitted(false);
                  setEmailTouched(false);
                  setPhoneTouched(false);
                  setPasswordTouched(false);
                  setStep(item.role);
                }}
                activeOpacity={0.88}
              >
                <View style={styles.roleIllustrationWrap}>
                  <View
                    style={[
                      styles.roleIllustrationBg,
                      { backgroundColor: item.bg },
                    ]}
                  />

                  <Image
                    source={item.image}
                    style={styles.roleIllustration}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.roleCardContent}>
                  <View style={styles.roleCardHeader}>
                    <Text style={styles.roleCardTitle}>
                      {item.title}
                    </Text>

                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: item.bg,
                          borderColor: item.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          { color: item.color },
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.roleCardDesc}>
                    {item.desc}
                  </Text>

                  <View style={styles.roleCardTags}>
                    {item.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[
                          styles.roleTag,
                          {
                            backgroundColor: item.bg,
                            borderColor: item.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleTagText,
                            { color: item.color },
                          ]}
                        >
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {item.role === 'caterer' && (
                    <View style={styles.requiresBadge}>
                      <ShieldCheck
                        size={14}
                        color="#C2410C"
                      />

                      <Text style={styles.requiresText}>
                        Requires business document verification
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.roleCardArrowWrap,
                    item.role === 'caterer' && {
                      backgroundColor: Colors.orange,
                    },
                  ]}
                >
                  <ChevronRight
                    size={16}
                    color={
                      item.role === 'caterer'
                        ? Colors.white
                        : '#1D4ED8'
                    }
                    strokeWidth={2.5}
                  />
                </View>
              </TouchableOpacity>
            ))}

            {renderFooter()}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // REGISTRATION FORM SCREEN
  // ==========================================

  const isCustomer = step === 'customer';

  return (
    <KeyboardAvoidingView
      style={styles.screenContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {renderBlobs()}

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrapper}>
          {renderBackButton('role')}

          {renderBrand()}

          <View style={styles.headerBlock}>
            <Text style={styles.headingOutside}>
              {isCustomer
                ? 'Customer Account'
                : 'Caterer Account'}
            </Text>

            <Text style={styles.subOutside}>
              {isCustomer
                ? 'Start discovering and booking caterers today'
                : 'Start receiving verified bookings today'}
            </Text>
          </View>

          {isCustomer
            ? renderCustomer()
            : renderCaterer()}

          {error && !isCustomer ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          {!isCustomer &&
            renderSubmitButton(
              'caterer',
              'CREATE CATERER ACCOUNT'
            )}

          {renderSwitchRole(
            isCustomer ? 'caterer' : 'customer',
            isCustomer
              ? 'Registering as a caterer?'
              : 'Registering as a customer instead?'
          )}

          {renderFooter()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

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

  brandSection: {
    alignItems: 'center',
    marginBottom: 16,
  },

  logoImage: {
    width: 56,
    height: 56,
    marginBottom: 6,
  },

  brand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },

  brandBlack: {
    color: Colors.black,
  },

  brandOrange: {
    color: Colors.orange,
  },

  brandSub: {
    fontSize: 11,
    color: Colors.orange,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },

  headingOutside: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.black,
    marginBottom: 4,
    textAlign: 'center',
  },

  subOutside: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(191,219,254,0.6)',
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
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },

  roleIllustration: {
    width: 130,
    height: 130,
  },

  roleCardContent: {
    padding: 22,
  },

  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  roleCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.black,
  },

  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },

  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  roleCardDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },

  roleCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },

  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  requiresBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFB26B',
    marginTop: 10,
  },

  requiresText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    flex: 1,
  },

  roleCardArrowWrap: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,178,107,0.25)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },

  sectionDividerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 2,
    marginBottom: 14,
    marginTop: 4,
  },

  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },

  inputWrapValid: {
    borderColor: GREEN,
    backgroundColor: '#F0FDF4',
  },

  inputWrapError: {
    borderColor: RED,
    backgroundColor: '#FEF2F2',
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 13,
  },

  fieldError: {
    color: RED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 4,
  },

  phoneHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 4,
  },

  eyeBtn: {
    padding: 4,
  },

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

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },

  checkboxChecked: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },

  termsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.15)',
    marginBottom: 12,
  },

  termsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  termsToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.black,
  },

  termsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },

  termsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.black,
    marginBottom: 4,
  },

  termsLastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    fontWeight: '600',
  },

  termsSection: {
    marginBottom: 14,
  },

  termsSectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.black,
    marginBottom: 4,
  },

  termsSectionBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F5F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(249,115,22,0.15)',
    gap: 14,
    marginBottom: 12,
  },

  agreeRowChecked: {
    borderColor: Colors.orange,
    backgroundColor: '#FFF7ED',
  },

  agreeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 21,
    fontWeight: '600',
  },

  agreeAccent: {
    color: Colors.orange,
    fontWeight: '900',
  },

  profileNoteBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginTop: 8,
  },

  profileNoteTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#166534',
  },

  profileNoteText: {
    fontSize: 12,
    color: '#15803D',
    marginBottom: 4,
    lineHeight: 18,
    fontWeight: '600',
  },

  btn: {
    backgroundColor: Colors.orange,
    borderRadius: 50,
    paddingVertical: 17,
    paddingHorizontal: 20,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 16,
  },

  btnDisabled: {
    backgroundColor: Colors.textMuted,
  },

  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },

  btnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  error: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '700',
  },

  switchRole: {
    alignItems: 'center',
    marginBottom: 16,
  },

  switchRoleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  switchRoleAccent: {
    color: Colors.orange,
    fontWeight: '900',
  },

  registerBtn: {
    alignItems: 'center',
    marginBottom: 8,
  },

  registerBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  registerBtnAccent: {
    color: Colors.orange,
    fontWeight: '800',
  },
});
