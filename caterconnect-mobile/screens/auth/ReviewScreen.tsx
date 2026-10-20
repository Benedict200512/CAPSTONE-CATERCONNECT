import { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Props = {
  bookingId: string;
  catererId: string;
  catererName: string;
  onClose: () => void;
  onSubmitted: () => void;
};

type Ratings = {
  food_quality: number;
  service_quality: number;
  timeliness: number;
  overall: number;
};

const RATING_LABELS = [
  { key: 'food_quality',    label: 'Food Quality',    icon: '🍽️' },
  { key: 'service_quality', label: 'Service Quality', icon: '🤝' },
  { key: 'timeliness',      label: 'Timeliness',      icon: '⏰' },
  { key: 'overall',         label: 'Overall',         icon: '⭐' },
] as const;

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarRow({
  label, icon, value, onChange,
}: { label: string; icon: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.starRow}>
      <View style={s.starRowLeft}>
        <Text style={s.starIcon}>{icon}</Text>
        <View>
          <Text style={s.starLabel}>{label}</Text>
          {value > 0 && <Text style={s.starLabelSub}>{STAR_LABELS[value]}</Text>}
        </View>
      </View>
      <View style={s.starsWrap}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
            <Text style={[s.star, star <= value && s.starFilled]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function ReviewScreen({ bookingId, catererId, catererName, onClose, onSubmitted }: Props) {
  const { session } = useAuth();
  const [ratings, setRatings] = useState<Ratings>({
    food_quality: 0, service_quality: 0, timeliness: 0, overall: 0,
  });
  const [comment, setComment]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setRating = (key: keyof Ratings) => (value: number) =>
    setRatings(prev => ({ ...prev, [key]: value }));

  const avgRating = Object.values(ratings).every(v => v > 0)
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / 4).toFixed(1)
    : null;

  const handleSubmit = async () => {
    const allRated = Object.values(ratings).every(v => v > 0);
    if (!allRated) {
      Alert.alert('Incomplete', 'Please rate all categories before submitting.');
      return;
    }
    if (!session?.user?.id) return;

    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      booking_id:      bookingId,
      customer_id:     session.user.id,
      caterer_id:      catererId,
      food_quality:    ratings.food_quality,
      service_quality: ratings.service_quality,
      timeliness:      ratings.timeliness,
      overall:         ratings.overall,
      comment:         comment.trim() || null,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    Alert.alert('Thank you!', 'Your review has been submitted.', [
      { text: 'OK', onPress: onSubmitted },
    ]);
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 16 }]}>
        <TouchableOpacity onPress={onClose}>
          <Text style={s.headerClose}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Write a Review</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Caterer info */}
        <View style={s.catererBanner}>
          <View style={s.catererInitial}>
            <Text style={s.catererInitialText}>{catererName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={s.catererBannerSub}>You're reviewing</Text>
            <Text style={s.catererBannerName}>{catererName}</Text>
          </View>
        </View>

        {/* Overall score preview */}
        {avgRating && (
          <View style={s.avgBanner}>
            <Text style={s.avgNum}>{avgRating}</Text>
            <View>
              <View style={s.avgStars}>
                {[1,2,3,4,5].map(i => (
                  <Text key={i} style={[s.avgStar, i <= Math.round(parseFloat(avgRating)) && s.avgStarFilled]}>★</Text>
                ))}
              </View>
              <Text style={s.avgLabel}>Your average score</Text>
            </View>
          </View>
        )}

        {/* Star ratings */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Rate Your Experience</Text>
          {RATING_LABELS.map(({ key, label, icon }) => (
            <StarRow
              key={key}
              label={label}
              icon={icon}
              value={ratings[key]}
              onChange={setRating(key)}
            />
          ))}
        </View>

        {/* Comment */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Share Your Experience</Text>
          <Text style={s.cardSub}>Tell others what you loved (or didn't love)</Text>
          <TextInput
            style={s.commentInput}
            placeholder="The food was amazing, especially the lechon! Service was prompt and professional..."
            placeholderTextColor={Colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={s.charCount}>{comment.length}/500</Text>
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitBtnText}>Submit Review</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerClose: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: Colors.black },

  catererBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 20, backgroundColor: Colors.white,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  catererInitial: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  catererInitialText: { color: Colors.white, fontSize: 22, fontWeight: '900' },
  catererBannerSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  catererBannerName: { fontSize: 17, fontWeight: '900', color: Colors.black },

  avgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 20, marginBottom: 4,
    backgroundColor: Colors.orangeLight,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  avgNum: { fontSize: 42, fontWeight: '900', color: Colors.orange },
  avgStars: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  avgStar: { fontSize: 20, color: Colors.border },
  avgStarFilled: { color: Colors.orange },
  avgLabel: { fontSize: 12, color: Colors.textSecondary },

  card: {
    margin: 20, marginBottom: 0,
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 14 },

  starRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  starRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  starIcon: { fontSize: 22, width: 30 },
  starLabel: { fontSize: 14, fontWeight: '700', color: Colors.black },
  starLabelSub: { fontSize: 11, color: Colors.orange, fontWeight: '600', marginTop: 1 },
  starsWrap: { flexDirection: 'row', gap: 4 },
  star: { fontSize: 28, color: Colors.border },
  starFilled: { color: Colors.orange },

  commentInput: {
    backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, fontSize: 14, color: Colors.black,
    minHeight: 120, marginBottom: 8,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },

  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});