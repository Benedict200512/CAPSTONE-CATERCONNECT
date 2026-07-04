import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

export default function AuthIndex() {
  const { session, profile } = useAuth();
  if (session && profile) {
    if (profile.role === 'caterer') return <Redirect href="/(caterer)" />;
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/(auth)/welcome" />;
}