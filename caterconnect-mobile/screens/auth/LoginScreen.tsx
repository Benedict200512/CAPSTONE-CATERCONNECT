
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  Animated,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { signIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BLOB_SIZE = width * 0.78;

type AccountAppeal = {
  status: string;
  staff_explanation: string | null;
};

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      const animateDot = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(dot, {
              toValue: -6,
              duration: 300,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = animateDot(dot1, 0);
      const anim2 = animateDot(dot2, 150);
      const anim3 = animateDot(dot3, 300);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    }
  }, [loading, dot1, dot2, dot3]);

  // Always allow users to return to Welcome.
  function handleBackPress() {
    router.replace('/(auth)/welcome');
  }

  // Get the latest appeal submitted by this user.
  async function getLatestAppeal(
    userId: string
  ): Promise<AccountAppeal | null> {
    const { data, error } = await supabase
      .from('account_appeals')
      .select('status, staff_explanation')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading latest account appeal:', error);
      return null;
    }

    return data;
  }

  // Show suspension alert with the latest appeal information.
  async function showSuspensionAlert(
    userId: string,
    suspensionReason: string | null
  ) {
    const appeal = await getLatestAppeal(userId);

    const appealStatus = (appeal?.status ?? '').trim().toLowerCase();
    const staffExplanation = (appeal?.staff_explanation ?? '').trim();

    let appealStatusMessage = '';
    let buttonText = 'Submit an Appeal';

    if (appealStatus === 'pending') {
      appealStatusMessage =
        'Appeal Status: Pending\nYour appeal is waiting for Staff review.';
      buttonText = 'View Submitted Appeal';
    } else if (appealStatus === 'approved') {
      appealStatusMessage =
        'Appeal Status: Approved by Staff\nYour appeal has been forwarded to the Administrator for a final decision.';
      buttonText = 'View Submitted Appeal';
    } else if (appealStatus === 'rejected') {
      appealStatusMessage = 'Appeal Status: Rejected';

      if (staffExplanation) {
        appealStatusMessage += `\nStaff Explanation: ${staffExplanation}`;
      }

      appealStatusMessage +=
        '\nYou may edit and resubmit your appeal.';
      buttonText = 'View Submitted Appeal';
    } else if (appealStatus) {
      appealStatusMessage =
        `Appeal Status: ${appeal?.status ?? 'Submitted'}\nYou can view your submitted appeal for more details.`;
      buttonText = 'View Submitted Appeal';
    }

    const messageParts = [
      'Your CaterConnect account has been temporarily suspended.',
      '',
      'Reason for Suspension:',
      suspensionReason?.trim() ||
        'No specific reason was provided. Please contact CaterConnect Support for clarification.',
    ];

    if (!appeal) {
      messageParts.push(
        '',
        'You may submit an appeal if you believe this decision was made in error.'
      );
    }

    if (appealStatusMessage) {
      messageParts.push('', appealStatusMessage);
    }

    Alert.alert(
      'Account Temporarily Suspended',
      messageParts.join('\n'),
      [
        {
          text: 'Close',
          style: 'cancel',
        },
        {
          text: buttonText,
          onPress: () => router.push('/(auth)/appeal'),
        },
      ],
      {
        cancelable: false,
      }
    );
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing fields',
        'Please enter your email and password.'
      );
      return;
    }

    try {
      setLoading(true);

      const {
        data,
        error,
        suspended,
        suspensionReason,
        userId,
        role: accountRole,
      } = await signIn(email.trim(), password);

      if (error) {
        Alert.alert('Login Failed', error.message);
        return;
      }

      // Suspended Customers and Caterers can view their appeal.
      // Their dashboard access remains blocked by the dashboard layouts.
      if (
        suspended &&
        (accountRole === 'customer' || accountRole === 'caterer') &&
        userId
      ) {
        await showSuspensionAlert(userId, suspensionReason ?? null);
        return;
      }

      const user = data?.user;

      if (!user) {
        Alert.alert(
          'Login Failed',
          'No user was returned. Please try again.'
        );
        return;
      }

      let role: string | undefined =
        accountRole || user.user_metadata?.role;

      // Retrieve the role from profiles if it was not returned by signIn.
      if (!role) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          Alert.alert(
            'Login Failed',
            'Could not determine your account type.'
          );
          return;
        }

        role = profile.role;
      }

      if (role === 'caterer') {
        router.replace('/(caterer)');
      } else if (role === 'customer') {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Login Failed',
          'Unknown account type. Please contact support.'
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.message ?? 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBackPress}
          >
            <ChevronLeft
              size={18}
              color={Colors.orange}
              strokeWidth={2.5}
            />
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
            <Text style={styles.brandSub}>
              Cebu's Premier Catering Marketplace
            </Text>
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.headingOutside}>Welcome Back</Text>
            <Text style={styles.subOutside}>
              Log in to manage your events and bookings
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color={Colors.orange} />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.orange} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
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

            <TouchableOpacity
  style={styles.forgotRow}
  onPress={() => router.push('/(auth)/forgot-password')}
>
  <Text style={styles.forgotText}>Forgot password?</Text>
</TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.btnLoadingInner}>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={styles.btnLoadingText}>Logging in</Text>
                  <View style={styles.dotsContainer}>
                    <Animated.View
                      style={[
                        styles.dot,
                        { transform: [{ translateY: dot1 }] },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.dot,
                        { transform: [{ translateY: dot2 }] },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.dot,
                        { transform: [{ translateY: dot3 }] },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.btnText}>LOG IN</Text>
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

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.registerBtnText}>
                Don't have an account?{' '}
                <Text style={styles.registerBtnAccent}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustBadge}>
              <Lock size={13} color={Colors.textSecondary} />
              <Text style={styles.trustText}>Secure</Text>
            </View>
            <View style={styles.trustBadge}>
              <ShieldCheck size={13} color={Colors.orange} />
              <Text style={styles.trustText}>Verified</Text>
            </View>
            <View style={styles.trustBadge}>
              <CheckCircle2 size={13} color="#16A34A" />
              <Text style={styles.trustText}>Cebu Based</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 13,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 12,
    color: Colors.orange,
    fontWeight: '700',
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
    opacity: 0.9,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLoadingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnLoadingText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
    height: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  registerBtn: {
    alignItems: 'center',
  },
  registerBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  registerBtnAccent: {
    color: Colors.orange,
    fontWeight: '800',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  trustBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,178,107,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trustText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
});
