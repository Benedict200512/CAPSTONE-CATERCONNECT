import React from 'react';
import { useRouter } from 'expo-router';
import SubscriptionScreen from '../../screens/auth/SubscriptionScreen';

export default function SubscriptionRoute() {
  const router = useRouter();

  return (
    <SubscriptionScreen onClose={() => router.back()} />
  );
}
