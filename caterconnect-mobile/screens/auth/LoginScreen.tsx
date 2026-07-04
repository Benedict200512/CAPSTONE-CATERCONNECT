import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { signIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const BLOB_SIZE = width * 0.78;

const ICONS = {
  arrowLeft: require('../../assets/icons/arrow_left.png'),
  envelope: require('../../assets/icons/envelope.png'),
  lock: require('../../assets/icons/lock.png'),
  eye: require('../../assets/icons/eye.png'),
  eyeOff: require('../../assets/icons/eye_off.png'),
  arrowRightWhite: require('../../assets/icons/arrow_right_white.png'),
  shieldCheck: require('../../assets/icons/shield_check.png'),
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await signIn(email, password);

      if (error) {
        Alert.alert('Login Failed', error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        Alert.alert('Login Failed', 'No user was returned. Please try again.');
        return;
      }

      let role: string | undefined = user.user_metadata?.role;

      if (!role) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          Alert.alert('Login Failed', 'Could not determine your account type.');
          return;
        }
        role = profile.role;
      }

      if (role === 'caterer') {
        router.replace('/(caterer)');
      } else if (role === 'customer') {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', 'Unknown account type. Please contact support.');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Something went wrong.');
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

        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(auth)/welcome')}>
          <Image source={ICONS.arrowLeft} style={[styles.iconBack, { tintColor: Colors.textSecondary }]} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.brandSection}>
          <Text style={styles.brand}>
            <Text style={styles.brandBlack}>CATER</Text>
            <Text style={styles.brandOrange}>CONNECT</Text>
          </Text>
          <Text style={styles.brandSub}>Cebu's Catering Marketplace</Text>
        </View>

        <Text style={styles.headingOutside}>Welcome Back</Text>
        <Text style={styles.subOutside}>Log in to continue to your account</Text>

        <View style={styles.card}>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.envelope} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <Image source={ICONS.lock} style={[styles.iconInput, { tintColor: Colors.orange }]} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Image
                source={showPassword ? ICONS.eyeOff : ICONS.eye}
                style={[styles.iconEye, { tintColor: Colors.textMuted }]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>LOG IN</Text>
                <View style={styles.btnArrow}>
                  <Image source={ICONS.arrowRightWhite} style={styles.iconBtnArrow} />
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

        {/* Trust badges */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <Image source={ICONS.lock} style={[styles.iconTrust, { tintColor: Colors.textSecondary }]} />
            <Text style={styles.trustText}>Secure</Text>
          </View>
          <View style={styles.trustBadge}>
            <Image source={ICONS.shieldCheck} style={styles.iconTrust} />
            <Text style={styles.trustText}>Verified</Text>
          </View>
          <View style={styles.trustBadge}>
            <Text style={styles.trustText}>  🇵🇭 Cebu  </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
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

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, alignSelf: 'flex-start' },
  iconBack: { width: 13, height: 13 },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },

  brandSection: { alignItems: 'center', marginBottom: 20 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  brandBlack: { color: Colors.black },
  brandOrange: { color: Colors.orange },
  brandSub: { fontSize: 10, color: Colors.orange, fontWeight: '600', marginTop: 3, letterSpacing: 0.5 },

  headingOutside: {
    fontSize: 28, fontWeight: '900', color: Colors.black,
    marginBottom: 4, paddingHorizontal: 4,
  },
  subOutside: {
    fontSize: 13, color: Colors.textSecondary,
    marginBottom: 20, paddingHorizontal: 4, lineHeight: 20,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,178,107,0.25)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },

  label: {
    fontSize: 10, fontWeight: '800', color: Colors.textSecondary,
    letterSpacing: 1.5, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 14, marginBottom: 16, gap: 10,
  },
  iconInput: { width: 16, height: 16 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  iconEye: { width: 18, height: 18 },

  forgotRow: { alignItems: 'flex-end', marginTop: -8, marginBottom: 20 },
  forgotText: { fontSize: 12, color: Colors.orange, fontWeight: '700' },

  btn: {
    backgroundColor: Colors.black, borderRadius: 50,
    paddingVertical: 15, paddingHorizontal: 20,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
    marginBottom: 20,
  },
  btnDisabled: { backgroundColor: Colors.textMuted },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 1, flex: 1, textAlign: 'center' },
  btnArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnArrow: { width: 13, height: 13 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dividerText: { fontSize: 12, color: Colors.textMuted },

  registerBtn: { alignItems: 'center' },
  registerBtnText: { fontSize: 14, color: Colors.textSecondary },
  registerBtnAccent: { color: Colors.orange, fontWeight: '800' },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  trustBadge: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,178,107,0.35)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  iconTrust: { width: 13, height: 13 },
  trustText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },
});