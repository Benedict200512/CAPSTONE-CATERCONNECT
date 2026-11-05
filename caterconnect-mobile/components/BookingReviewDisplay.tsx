import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Colors } from '../constants/colors';

export type BookingReview = {
  id: string; food_quality: number; service_quality: number; timeliness: number; overall: number;
  comment: string | null; caterer_reply: string | null; caterer_replied_at?: string | null; created_at: string;
};

// Customer display only: deliberately has no reply form or response action.
export default function BookingReviewDisplay({ review }: { review: BookingReview }) {
  return <View style={styles.review}>
    <View style={styles.stars} accessibilityLabel={`Overall rating ${review.overall} out of 5`}>
      {[1, 2, 3, 4, 5].map(value => <Star key={value} size={19} color={Colors.orange}
        fill={value <= review.overall ? Colors.orange : 'transparent'} />)}
      <Text style={styles.rating}>{review.overall}/5</Text>
    </View>
    <Text style={styles.meta}>{new Date(review.created_at).toLocaleDateString('en-PH')}</Text>
    <Text selectable style={styles.text}>{review.comment || 'No written comment provided.'}</Text>
    <Text style={styles.meta}>Food {review.food_quality}/5 · Service {review.service_quality}/5 · Timeliness {review.timeliness}/5</Text>
    {review.caterer_reply ? <View style={styles.reply}>
      <Text style={styles.heading}>Caterer Reply</Text>
      <Text selectable style={styles.text}>{review.caterer_reply}</Text>
      {review.caterer_replied_at && <Text style={styles.meta}>{new Date(review.caterer_replied_at).toLocaleDateString('en-PH')}</Text>}
    </View> : <Text style={styles.meta}>The Caterer has not replied yet.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  review: { paddingVertical: 12, gap: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  stars: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  rating: { marginLeft: 6, fontSize: 15, color: Colors.textPrimary, fontWeight: '700' },
  text: { fontSize: 14, lineHeight: 22, color: Colors.textPrimary },
  meta: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  reply: { backgroundColor: Colors.orangeLight, borderRadius: 12, padding: 14, gap: 7 },
  heading: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
});
