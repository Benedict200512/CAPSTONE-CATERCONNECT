import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, MessageSquareText, Star, Store } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type CustomerReview = {
  id: string; customer_id: string; caterer_id: string | null;
  food_quality: number | null; service_quality: number | null;
  timeliness: number | null; overall: number | null;
  comment: string | null; caterer_reply: string | null; created_at: string;
  business_name?: string;
};
const ratingLabels = [
  ['food_quality', 'Food Quality'], ['service_quality', 'Service Quality'],
  ['timeliness', 'Timeliness'], ['overall', 'Overall'],
] as const;

function Rating({ value }: { value: number | null }) {
  const rating = value === null ? null : Number(value);
  if (rating === null || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return <Text style={styles.muted}>Not rated</Text>;
  }
  return <View style={styles.stars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={15}
      color={star <= Math.round(rating) ? Colors.orange : Colors.border}
      fill={star <= Math.round(rating) ? Colors.orange : 'transparent'} />)}
    <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
  </View>;
}

export default function MyReviewsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const customerId = profile?.id === session?.user.id && profile?.role === 'customer'
    ? session?.user.id ?? null : null;
  const identity = useRef(customerId);
  identity.current = customerId;
  const request = useRef(0);
  const [state, setState] = useState<{
    owner: string | null; rows: CustomerReview[]; loading: boolean;
    error: string | null; warning: string | null;
  }>({ owner: null, rows: [], loading: false, error: null, warning: null });

  const refresh = useCallback(async () => {
    if (!customerId || identity.current !== customerId) return;
    const version = ++request.current;
    const current = () => identity.current === customerId && request.current === version;
    setState(prev => ({ owner: customerId, rows: prev.owner === customerId ? prev.rows : [], loading: true, error: null, warning: null }));
    try {
      const rows: CustomerReview[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('reviews')
          .select('id, customer_id, caterer_id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at')
          .eq('customer_id', customerId).order('created_at', { ascending: false })
          .order('id').range(offset, offset + 499);
        if (error) throw error;
        if (!current()) return;
        // Defense in depth; RLS remains the actual database authorization boundary.
        rows.push(...((data ?? []) as CustomerReview[]).filter(row => row.customer_id === customerId));
        if (!data || data.length < 500) break;
      }
      const ids = [...new Set(rows.map(row => row.caterer_id).filter((id): id is string => !!id))];
      const names = new Map<string, string>();
      let warning: string | null = null;
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await supabase.from('caterers').select('id, business_name')
          .in('id', ids.slice(offset, offset + 100));
        if (!current()) return;
        if (error) warning = 'Some caterer information could not be loaded. Pull down to retry.';
        else for (const caterer of data ?? []) names.set(caterer.id, caterer.business_name);
      }
      if (current()) setState({ owner: customerId, rows: rows.map(row => ({ ...row, business_name: names.get(row.caterer_id ?? '') })), loading: false, error: null, warning });
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message) : 'Please check your connection and try again.';
      if (current()) setState({ owner: customerId, rows: [], loading: false, error: message, warning: null });
    }
  }, [customerId]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current++; };
  }, [refresh]));

  const own = !!customerId && state.owner === customerId;
  const rows = own ? state.rows : [];
  const loading = !!customerId && (!own || state.loading);
  const error = own ? state.error : null;
  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}>
        <ChevronLeft color={Colors.orange} size={24} />
      </TouchableOpacity>
      <View><Text style={styles.title}>My Reviews</Text><Text style={styles.muted}>Your feedback and catering experiences</Text></View>
    </View>
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={() => void refresh()} tintColor={Colors.orange} />}>
      {!customerId ? <View style={styles.empty}><MessageSquareText size={42} color={Colors.orange} />
        <Text style={styles.name}>Customer account required</Text><Text style={styles.muted}>Sign in with your customer account to view your reviews.</Text></View>
        : loading && !rows.length ? <View style={styles.empty}><ActivityIndicator size="large" color={Colors.orange} /><Text style={styles.muted}>Loading your reviews…</Text></View>
        : error ? <View style={styles.notice} accessibilityRole="alert"><Text style={styles.name}>Could not load your reviews</Text>
          <Text style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => void refresh()}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity></View>
        : !rows.length ? <View style={styles.empty}><Star size={44} color={Colors.orange} /><Text style={styles.name}>No reviews yet</Text>
          <Text style={styles.muted}>Share your experience after a completed booking. Your submitted reviews will appear here.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/(tabs)/bookings')}><Text style={styles.buttonText}>View My Bookings</Text></TouchableOpacity></View> : null}
      {own && state.warning && <Text style={styles.warning}>{state.warning}</Text>}
      {rows.map(review => {
        const date = new Date(review.created_at);
        return <View key={review.id} style={styles.card}>
          <View style={styles.catererRow}><View style={styles.icon}><Store size={22} color={Colors.orange} /></View>
            <View style={styles.catererText}><Text style={styles.name}>{review.business_name || 'Caterer information unavailable'}</Text>
              <Text style={styles.muted}>{Number.isNaN(date.getTime()) ? 'Review date unavailable' : date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</Text></View></View>
          <View style={styles.ratings}>{ratingLabels.map(([field, label]) => <View key={field} style={styles.ratingRow}>
            <Text style={styles.label}>{label}</Text><Rating value={review[field]} /></View>)}</View>
          <Text style={styles.sectionLabel}>YOUR REVIEW</Text>
          <Text style={review.comment?.trim() ? styles.comment : styles.muted}>{review.comment?.trim() || 'No written comment.'}</Text>
          {!!review.caterer_reply?.trim() && <View style={styles.reply}><Text style={styles.sectionLabel}>CATERER RESPONSE</Text><Text style={styles.comment}>{review.caterer_reply}</Text></View>}
        </View>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  back: { padding: 8, borderRadius: 12, backgroundColor: Colors.orangeLight },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  card: { padding: 18, backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 18 },
  catererRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  catererText: { flex: 1, gap: 5 },
  icon: { padding: 12, backgroundColor: Colors.orangeLight, borderRadius: 14 },
  name: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  muted: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  ratings: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, gap: 10, marginBottom: 16 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  ratingValue: { marginLeft: 5, color: Colors.orange, fontSize: 13, fontWeight: '800' },
  sectionLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  comment: { color: Colors.textPrimary, fontSize: 14, lineHeight: 22 },
  reply: { backgroundColor: Colors.orangeLight, padding: 14, borderRadius: 12, marginTop: 16 },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 50 },
  notice: { padding: 18, gap: 12, borderRadius: 14, backgroundColor: Colors.orangeLight },
  error: { color: Colors.error, lineHeight: 21 },
  warning: { color: Colors.textSecondary, padding: 12, marginBottom: 12 },
  button: { backgroundColor: Colors.orange, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});
