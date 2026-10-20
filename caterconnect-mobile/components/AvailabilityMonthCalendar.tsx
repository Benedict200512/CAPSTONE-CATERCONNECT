import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { shiftMonth, manilaToday } from '../lib/availability';

type Props = {
  month: string; selected: string; onMonthChange: (month: string) => void;
  onSelect: (date: string) => void; blocked?: string[];
  counts?: Record<string, number>; capacity?: number;
  disableUnavailable?: boolean; disabled?: boolean;
};

export default function AvailabilityMonthCalendar({ month, selected, onMonthChange, onSelect,
  blocked = [], counts, capacity, disableUnavailable = false, disabled = false }: Props) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const today = manilaToday();
  return <View>
    <View style={styles.heading}>
      <TouchableOpacity accessibilityLabel="Previous month" accessibilityRole="button"
        disabled={disabled || month <= today.slice(0, 7)} onPress={() => onMonthChange(shiftMonth(month, -1))} style={styles.arrow}>
        <ChevronLeft size={22} color={month <= today.slice(0, 7) ? Colors.textMuted : Colors.orange} />
      </TouchableOpacity>
      <Text style={styles.title}>{first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
      <TouchableOpacity accessibilityLabel="Next month" accessibilityRole="button" disabled={disabled}
        onPress={() => onMonthChange(shiftMonth(month, 1))} style={styles.arrow}><ChevronRight size={22} color={Colors.orange} /></TouchableOpacity>
    </View>
    <View style={styles.grid}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
      {Array.from({ length: first.getUTCDay() }, (_, i) => <View key={`blank-${i}`} style={styles.day} />)}
      {Array.from({ length }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const isBlocked = blocked.includes(date);
        const full = capacity !== undefined && (counts?.[date] ?? 0) >= capacity;
        const unavailable = isBlocked || full;
        const inactive = disabled || date < today || (disableUnavailable && unavailable);
        const active = selected === date;
        return <TouchableOpacity key={date} accessibilityRole="button"
          accessibilityLabel={`${date}${isBlocked ? ', unavailable' : ''}${counts ? `, ${counts[date] ?? 0} committed bookings` : ''}`}
          accessibilityState={{ selected: active, disabled: inactive }} disabled={inactive}
          onPress={() => onSelect(date)} style={[styles.day, unavailable && styles.unavailable, active && styles.selected, inactive && styles.inactive]}>
          <Text style={[styles.number, active && styles.white]}>{i + 1}</Text>
          {counts ? <Text style={[styles.caption, active && styles.white]}>{counts[date] ?? 0} booked</Text>
            : unavailable ? <Text style={[styles.caption, active && styles.white]}>Unavailable</Text> : null}
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.black }, arrow: { padding: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, color: Colors.textSecondary, paddingBottom: 8 },
  day: { width: '14.2857%', minHeight: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  number: { color: Colors.black, fontWeight: '700', fontSize: 14 },
  caption: { color: Colors.textSecondary, fontSize: 8, marginTop: 3 },
  unavailable: { backgroundColor: Colors.orangeLight }, selected: { backgroundColor: Colors.orange },
  white: { color: Colors.white }, inactive: { opacity: 0.4 },
});
