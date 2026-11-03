
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';

import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { updateUserPassword } from '../../lib/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verifying, setVerifying] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState('');

  const processedCodes = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;

    async function processRecoveryLink(url: string | null) {
      if (!url || !mounted) return;

      try {
        const parsed = Linking.parse(url);
        const code =
          typeof parsed.queryParams?.code === 'string'
            ? parsed.queryParams.code
            : null;

        if (!code || processedCodes.current.has(code)) return;

        processedCodes.current.add(code);

        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        if (mounted) {
          setRecoveryReady(true);
          setLinkError('');
        }
      } catch (error: any) {
        if (mounted) {
          setLinkError(
            error?.message ??
              'This password reset link is invalid or has expired.'
          );
        }
      } finally {
        if (mounted) {
          setVerifying(false);
        }
      }
    }

    async function initializeRecovery() {
      // Check whether the recovery session was already established.
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session) {
        setRecoveryReady(true);
        setVerifying(false);
        return;
      }

      // Handle a link that opened the app from a closed state.
      const initialUrl = await Linking.getInitialURL();

      if (!mounted) return;

      if (initialUrl) {
        await processRecoveryLink(initialUrl);
      } else {
        setVerifying(false);
        setLinkError(
          'No password recovery link was detected. Please open the link from your email again.'
        );
      }
    }

    // Listen for a recovery link while the app is already open.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void processRecoveryLink(url);
    });

    void initializeRecovery();

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please complete both password fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Weak Password',
        'Your password must be at least 8 characters long.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }

    try {
      setSaving(true);

      await updateUserPassword(password);

      Alert.alert(
        'Password Updated',
        'Your CaterConnect password has been successfully changed. You can now log in using your new password.',
        [
          {
            text: 'Go to Login',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error?.message ?? 'Unable to update your password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (verifying) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.statusText}>
          Verifying your password reset link...
        </Text>
      </View>
    );
  }

  if (!recoveryReady) {
    return (
      <View style={styles.center}>
        <Lock size={48} color={Colors.orange} />

        <Text style={styles.title}>Invalid Reset Link</Text>

        <Text style={styles.subtitle}>
          {linkError ||
            'Your password reset link could not be verified.'}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/forgot-password')}
        >
          <Text style={styles.buttonText}>Request Another Link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Lock size={42} color={Colors.orange} />
        </View>

        <Text style={styles.title}>Create New Password</Text>

        <Text style={styles.subtitle}>
          Choose a strong password for your CaterConnect account.
        </Text>

        <Text style={styles.label}>NEW PASSWORD</Text>

        <View style={styles.inputContainer}>
          <Lock size={18} color={Colors.orange} />

          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor="#999999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={19} color="#999999" />
            ) : (
              <Eye size={19} color="#999999" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Password must contain at least 8 characters.
        </Text>

        <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>

        <View style={styles.inputContainer}>
          <Lock size={18} color={Colors.orange} />

          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#999999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity
            onPress={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
          >
            {showConfirmPassword ? (
              <EyeOff size={19} color="#999999" />
            ) : (
              <Eye size={19} color="#999999" />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, saving && styles.disabledButton]}
          onPress={handleUpdatePassword}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <View style={styles.secureNote}>
          <CheckCircle size={16} color="#16A34A" />
          <Text style={styles.secureText}>
            Your password is securely managed by Supabase.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 35,
  },
  center: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
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
    marginBottom: 32,
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
    marginBottom: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
    paddingVertical: 15,
  },
  hint: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 22,
  },
  button: {
    backgroundColor: Colors.orange,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statusText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
  },
  secureText: {
    color: '#777777',
    fontSize: 12,
  },
});
