import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { logoutUser, resendVerificationEmail } from '../../lib/auth';

const ORANGE = '#FF7A00';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { session } = useAuth();

  // Get email passed from RegisterScreen
  const params = useLocalSearchParams<{ email?: string }>();

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefer registration email, then use session email as fallback
  const email =
    (typeof params.email === 'string' ? params.email.trim() : '') ||
    session?.user?.email ||
    '';

  async function handleResend() {
    if (!email) {
      Alert.alert(
        'Email Not Found',
        'The registered email address could not be found. Please register again.'
      );
      return;
    }

    try {
      setLoading(true);
      setSent(false);

      await resendVerificationEmail(email);

      setSent(true);

      Alert.alert(
        'Email Sent',
        `A new verification link has been sent to ${email}. Please check your inbox.`
      );
    } catch (err: any) {
      Alert.alert(
        'Unable to Send Email',
        err?.message ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      router.replace('/(auth)/login');
    } catch (err: any) {
      Alert.alert(
        'Logout Failed',
        err?.message ?? 'Unable to log out. Please try again.'
      );
    }
  }

  return (
    <View style={styles.container}>
      {/* Email Illustration */}
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationCircle}>
          <Mail size={68} color={ORANGE} strokeWidth={1.6} />
        </View>

        <View style={styles.checkBadge}>
          <CheckCircle size={30} color="#FFFFFF" fill={ORANGE} />
        </View>
      </View>

      {/* Heading */}
      <Text style={styles.title}>Verify your email</Text>

      <Text style={styles.subtitle}>
        We've sent a verification link to your email address.
        Please check your inbox to verify your account.
      </Text>

      {/* Email Address */}
      <View style={styles.emailCard}>
        <View style={styles.emailIconContainer}>
          <Mail size={22} color={ORANGE} />
        </View>

        <View style={styles.emailDetails}>
          <Text style={styles.emailLabel}>
            Verification email sent to
          </Text>

          <Text style={styles.email} numberOfLines={2}>
            {email || 'Email address unavailable'}
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <Text style={styles.note}>
        You must verify your email before you can access your CaterConnect
        account and make bookings.
      </Text>

      {/* Resend Button */}
      <TouchableOpacity
        style={[
          styles.button,
          (loading || !email) && styles.buttonDisabled,
        ]}
        onPress={handleResend}
        disabled={loading || !email}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Resend Verification Email
          </Text>
        )}
      </TouchableOpacity>

      {/* Success Message */}
      {sent && (
        <View style={styles.successContainer}>
          <CheckCircle size={18} color="#16A34A" />
          <Text style={styles.successText}>
            Verification email resent! Check your inbox.
          </Text>
        </View>
      )}

      {/* Spam Folder Reminder */}
      <Text style={styles.spamNote}>
        Didn't receive the email? Check your spam or junk folder.
      </Text>

      {/* Change Account */}
      <TouchableOpacity
        style={styles.changeAccountButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <ArrowLeft size={17} color={ORANGE} />
        <Text style={styles.link}>Already verified? Go to Login</Text>
      </TouchableOpacity>

      {/* Branding */}
      <Text style={styles.brand}>
        Cater<Text style={styles.brandAccent}>Connect</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },

  illustrationContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },

  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF3E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkBadge: {
    position: 'absolute',
    bottom: 5,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 3,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 5,
  },

  emailCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#FFE3CC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },

  emailIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  emailDetails: {
    flex: 1,
  },

  emailLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },

  email: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
  },

  note: {
    fontSize: 13,
    lineHeight: 20,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 25,
  },

  button: {
    width: '100%',
    minHeight: 52,
    backgroundColor: ORANGE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 14,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 7,
  },

  successText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '600',
  },

  spamNote: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
  },

  changeAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 8,
  },

  link: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '700',
  },

  brand: {
    position: 'absolute',
    bottom: 25,
    fontSize: 17,
    fontWeight: '800',
    color: '#222222',
  },

  brandAccent: {
    color: ORANGE,
  },
});
