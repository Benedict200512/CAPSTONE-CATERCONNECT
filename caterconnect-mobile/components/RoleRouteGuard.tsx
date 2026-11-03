
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

type AllowedRole = 'customer' | 'caterer';

export default function RoleRouteGuard({
  allowedRole,
  children,
}: {
  allowedRole: AllowedRole;
  children: React.ReactNode;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile.status?.trim().toLowerCase() === 'suspended') {
    return <Redirect href="/(auth)/appeal" />;
  }

  if (profile.role !== allowedRole) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <>{children}</>;
}
