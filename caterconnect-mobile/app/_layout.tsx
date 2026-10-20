import { AuthProvider, useAuth } from '@/context/AuthContext';
import MaintenanceGate from '@/components/MaintenanceGate';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <MaintenanceGate>
          <RootNavigator />
        </MaintenanceGate>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  // Not logged in or guest → auth screens
  if (!session) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    );
  }

  // Logged in — route by role
  const role = profile?.role;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {role === 'caterer' ? (
        <Stack.Screen name="(caterer)" />
      ) : (
        <Stack.Screen name="(tabs)" />
      )}
      {/* Keep auth accessible for logout redirect */}
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}
