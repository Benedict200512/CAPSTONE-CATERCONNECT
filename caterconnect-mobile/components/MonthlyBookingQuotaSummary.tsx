import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { loadMonthlyBookingQuota, type MonthlyQuota } from '../lib/monthlyBookingQuota';

export default function MonthlyBookingQuotaSummary({ refreshKey = 0, compact = false }: { refreshKey?: string | number; compact?: boolean }) {
  const { session, catererData } = useAuth();
  const userId = session?.user.id;
  const catererId = catererData?.id;
  const key = `${userId ?? ''}:${catererId ?? ''}`;
  const identity = useRef(key); identity.current = key;
  const version = useRef(0);
  const rotation = useRef(new Animated.Value(0)).current;
  const [state, setState] = useState<{ key: string; result: MonthlyQuota | null }>({ key: '', result: null });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    setState({ key, result: null });
    setRefreshing(true);
    try {
      if (!userId || !catererId) {
        if (identity.current === key && request === version.current) setState({ key, result: { status: 'unavailable', message: 'Sign in with your caterer account to view monthly usage.' } });
        return;
      }
      const result = await loadMonthlyBookingQuota(catererId, userId);
      if (identity.current === key && request === version.current) setState({ key, result });
    } catch (error) {
      if (identity.current === key && request === version.current) setState({ key, result: { status: 'unavailable', message: 'Monthly usage could not be loaded. Please try again.' } });
    } finally {
      if (identity.current === key && request === version.current) setRefreshing(false);
    }
  }, [key, userId, catererId]);
  useFocusEffect(useCallback(() => {
    void refreshKey;
    void refresh();
    return () => { version.current++; setRefreshing(false); };
  }, [refresh, refreshKey]));
  useEffect(() => {
    if (!refreshing) { rotation.stopAnimation(); rotation.setValue(0); return; }
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 850, useNativeDriver: true }));
    animation.start();
    return () => { animation.stop(); rotation.setValue(0); };
  }, [refreshing, rotation]);
  const result = state.key === key ? state.result : null;
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <View style={[styles.container, compact && styles.compact]}>
    <View style={styles.row}>
      <Text style={styles.title}>Monthly accepted bookings</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh monthly booking usage"
        disabled={refreshing} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={1}
        onPress={event => { event.stopPropagation(); void refresh(); }} style={styles.refresh}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}><RefreshCw size={13} color="#F97316" strokeWidth={2.2} /></Animated.View>
      </TouchableOpacity>
    </View>
    {!result ? <ActivityIndicator color={Colors.orange} accessibilityLabel="Loading monthly usage" /> :
      result.status !== 'ready' ? <Text style={styles.hint}>{result.message}</Text> : <>
        <Text style={styles.usage}>{result.used} / {result.limit ?? 'Unlimited'} used
          {' · '}{result.remaining === null ? 'Unlimited remaining' : `${result.remaining} remaining`}</Text>
        {!compact && result.limit !== null && <View style={styles.track}>
          <View style={[styles.fill, { width: `${result.limit > 0 ? Math.min(100, result.used / result.limit * 100) : 0}%` }]} />
        </View>}
        <Text style={styles.hint}>{result.month.slice(0, 7)} · Asia/Manila</Text>
      </>}
    {!compact && <Text style={styles.hint}>{result?.status === 'ready'
      ? 'Pending and rejected requests do not count. Completed bookings stay in their assigned month. Cancellation releases that booking\'s quota. The server checks the limit when confirming.'
      : 'Accepted-booking usage and limits require monthly quota setup. Usage is never estimated from pending requests.'}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 6, paddingVertical: 10 }, compact: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  title: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  refresh: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  usage: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  hint: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: Colors.orangeLight },
  fill: { height: '100%', backgroundColor: Colors.orange },
});
