
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { sendPasswordResetEmail } from '../../lib/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendResetEmail() {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(email);

      Alert.alert(
        'Check Your Email',
        'If your account is eligible for password recovery, you will receive an email with instructions to reset your password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Unable to Send Email',
        error?.message ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={Colors.orange} />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <Mail size={42} color={Colors.orange} />
        </View>

        <Text style={styles.title}>Forgot Password?</Text>

        <Text style={styles.subtitle}>
          Don't worry! Enter the email address associated with your
          CaterConnect account. We'll send you instructions to reset
          your password.
        </Text>

        <Text style={styles.label}>EMAIL ADDRESS</Text>

        <View style={styles.inputContainer}>
          <Mail size={19} color={Colors.orange} />
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleSendResetEmail}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.loginText}>
            Remember your password?{' '}
            <Text style={styles.loginAccent}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#FFE3CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35,
  },
  iconContainer: {
    width: 85,
    height: 85,
    borderRadius: 25,
    backgroundColor: '#FFF3E8',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 35,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F5F2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFE3CC',
    paddingHorizontal: 14,
    marginBottom: 22,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
    paddingVertical: 15,
  },
  button: {
    backgroundColor: Colors.orange,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 25,
  },
  loginText: {
    color: '#777777',
    fontSize: 13,
  },
  loginAccent: {
    color: Colors.orange,
    fontWeight: '800',
  },
});
