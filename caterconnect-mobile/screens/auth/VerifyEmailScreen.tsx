import React, { useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { logoutUser, resendVerificationEmail } from '../../lib/auth'

export default function VerifyEmailScreen() {
  const { session } = useAuth()
  const [sent, setSent] = useState(false)

  async function handleResend() {
    try {
      await resendVerificationEmail(session?.user?.email ?? '')
      setSent(true)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📧</Text>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{session?.user?.email}</Text>
      </Text>
      <Text style={styles.note}>
        You must verify your email before you can make bookings.
      </Text>

      {sent ? (
        <Text style={styles.sent}>✅ Email resent! Check your inbox.</Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleResend}>
          <Text style={styles.buttonText}>Resend Verification Email</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={logoutUser}>
        <Text style={styles.link}>Use a different account</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#555', marginBottom: 8 },
  email: { fontWeight: 'bold', color: '#FF6B35' },
  note: { textAlign: 'center', color: '#888', marginBottom: 24, fontSize: 13 },
  button: {
    backgroundColor: '#FF6B35', padding: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 12, width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sent: { color: 'green', marginBottom: 12 },
  link: { color: '#FF6B35', marginTop: 8 },
})