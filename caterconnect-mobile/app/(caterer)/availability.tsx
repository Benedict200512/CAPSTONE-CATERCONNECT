import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import AvailabilityMonthCalendar from '../../components/AvailabilityMonthCalendar';
import { availabilityError, loadAvailability, manilaToday, saveDailyCapacity, setDateBlocked } from '../../lib/availability';

export default function AvailabilityScreen() {
  const router = useRouter();
  const { session, catererData } = useAuth();
  const userId = session?.user.id;
  const catererId: string | undefined = catererData?.id;
  const [month, setMonth] = useState(() => manilaToday().slice(0, 7));
  const [selected, setSelected] = useState(manilaToday);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAvailability>> | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${userId ?? ''}/${catererId ?? ''}/${month}`;
  const current = useRef(key); current.current = key;
  const version = useRef(0);
  const focused = useRef(false);
  const writing = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    setLoading(true); setError(null);
    try {
      if (!userId || !catererId) throw new Error('Sign in with your caterer account to manage availability.');
      const result = await loadAvailability(catererId, userId, month);
      if (!focused.current || current.current !== key || request !== version.current) return;
      setData(result); setLoadedKey(key); setCapacity(String(result.capacity));
    } catch (failure) {
      if (focused.current && current.current === key && request === version.current) setError(availabilityError(failure));
    } finally {
      if (focused.current && current.current === key && request === version.current) setLoading(false);
    }
  }, [userId, catererId, month, key]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setBusy(writing.current);
    void refresh();
    return () => { focused.current = false; version.current++; };
  }, [refresh]));
  const ready = !!data && loadedKey === key && !loading && !error;
  const mutate = async (operation: () => Promise<void>) => {
    if (!ready || writing.current) return;
    writing.current = true; setBusy(true);
    try {
      await operation();
      if (focused.current && current.current === key) await refresh();
    } catch (failure) {
      if (focused.current && current.current === key) {
        Alert.alert('Availability not updated', availabilityError(failure));
        await refresh();
      }
    } finally {
      writing.current = false;
      if (focused.current) setBusy(false);
    }
  };
  const saveCapacity = () => {
    if (!/^\d+$/.test(capacity.trim())) { Alert.alert('Invalid capacity', 'Enter a positive whole number.'); return; }
    void mutate(() => saveDailyCapacity(catererId!, userId!, Number(capacity.trim())));
  };
  const blocked = data?.blocked.includes(selected) ?? false;
  const count = data?.counts[selected] ?? 0;
  const toggleBlock = () => {
    if (!ready || busy || selected < manilaToday()) return;
    Alert.alert(blocked ? 'Make this date available?' : 'Mark this date as unavailable?',
      blocked ? `${selected} will reopen if daily capacity permits.`
        : `New requests and confirmations for ${selected} will be prevented. Existing bookings will remain unchanged.`,
      [{ text: 'Keep current setting', style: 'cancel' }, { text: blocked ? 'Make available' : 'Mark unavailable',
        onPress: () => { if (current.current === key) void mutate(() => setDateBlocked(catererId!, userId!, selected, !blocked)); } }]);
  };
  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={Colors.orange} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Availability & Booking Management</Text>
        <Text style={styles.subtitle}>Manage your booking schedule, daily capacity, and event availability.</Text>
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy) void refresh(); }} tintColor={Colors.orange} />}>
      <View style={styles.card}>
        <CalendarDays size={28} color={Colors.orange} />
        <Text style={styles.heading}>Manage Your Event Schedule</Text>
        <Text style={styles.hint}>Manage your event schedule, daily booking capacity, and available dates in one place. Dates follow Philippine Standard Time. Pending requests do not reserve a slot, and blocking a date does not cancel existing bookings.</Text>
      </View>
      {loading && <ActivityIndicator color={Colors.orange} />}
      {error && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>Try again</Text></TouchableOpacity></View>}
      {ready && data && <>
        <View style={styles.card}>
          <Text style={styles.heading}>Daily Booking Limit</Text>
          <Text style={styles.hint}>Set the maximum number of committed bookings you can accommodate per event date across all packages. Current limit: {data.capacity}. Your monthly subscription limit is separate.</Text>
          <View style={styles.row}><TextInput accessibilityLabel="Daily booking limit" value={capacity} onChangeText={setCapacity}
            editable={!busy} keyboardType="number-pad" style={styles.input} />
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={saveCapacity} style={[styles.button, busy && styles.dim]}>
              <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save capacity'}</Text>
            </TouchableOpacity></View>
          <Text style={styles.hint}>You cannot lower the daily limit below existing bookings scheduled for today or any future date.</Text>
        </View>
        <View style={styles.card}>
          <AvailabilityMonthCalendar month={month} selected={selected} blocked={data.blocked} counts={data.counts} capacity={data.capacity}
            disabled={busy} onSelect={setSelected} onMonthChange={next => { setMonth(next); setSelected(`${next}-01`); }} />
          <Text style={styles.hint}>Each date shows the number of committed bookings. Shaded dates are blocked or fully booked. Select a date to update its availability.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>{selected}</Text>
          <Text style={styles.hint}>{count} committed bookings out of {data.capacity} available daily slots</Text>
          <Text style={styles.link}>{blocked ? 'Unavailable for Bookings' : count >= data.capacity ? 'Fully Booked' : 'Open for Bookings'}</Text>
          <Text style={styles.hint}>Committed bookings include confirmed, awaiting-payment, paid, ongoing, and completed reservations. Existing commitments remain unchanged.</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy || selected < manilaToday()} onPress={toggleBlock}
            style={[styles.button, { marginTop: 16 }, (busy || selected < manilaToday()) && styles.dim]}>
            <Text style={styles.buttonText}>{blocked ? 'Make Date Available' : 'Mark as Unavailable'}</Text>
          </TouchableOpacity>
        </View>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  back: { padding: 8, borderRadius: 12, backgroundColor: Colors.orangeLight },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.black },
  subtitle: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary, marginTop: 4 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  heading: { fontSize: 17, fontWeight: '800', color: Colors.black },
  hint: { fontSize: 12, lineHeight: 19, color: Colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  input: { flex: 1, padding: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.black, backgroundColor: Colors.bgInput },
  button: { backgroundColor: Colors.orange, borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  link: { color: Colors.orange, fontWeight: '700', fontSize: 13 }, error: { color: Colors.error, lineHeight: 20 }, dim: { opacity: 0.5 },
});
