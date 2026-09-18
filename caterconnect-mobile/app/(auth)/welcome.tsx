import { useRouter } from 'expo-router';
import {
  Dimensions, Image,
  StatusBar,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, ShieldCheck, Lock, User, Edit3, ChevronRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDF9" />

      {/* Modern Backdrop Decorative Elements */}
      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobTR]} />
      <View style={[styles.blob, styles.blobBL]} />
      <View style={[styles.blob, styles.blobBR]} />

      <View style={[styles.topSection, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandWrapper}>
            <Image 
              source={require('@/assets/images/caterlogo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <View>
              <Text style={styles.brand}>
                <Text style={styles.brandBlack}>CATER</Text>
                <Text style={styles.brandOrange}>CONNECT</Text>
              </Text>
              <Text style={styles.brandSub}>Good Food. Great Moments.</Text>
            </View>
          </View>
          <View style={styles.ratingPill}>
            <Star size={13} color="#F97316" fill="#F97316" />
            <Text style={styles.ratingPillText}>4.8 Rated</Text>
          </View>
        </View>

        <View style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCircleMask}>
            <Image
              source={require('@/assets/images/food-hero.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.contentCard}>
          <View style={styles.badgeLeft}>
            <ShieldCheck size={14} color="#16A34A" />
            <Text style={styles.badgeText}>Verified Caterers</Text>
          </View>

          <Text style={styles.heading}>
            Book Catering{'\n'}
            <Text style={styles.headingAccent}>Made Simple</Text>
          </Text>
          <Text style={styles.subheading}>
            Discover trusted caterers, compare packages, and plan unforgettable events.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.btnLogin}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.85}
            >
              <View style={styles.btnContent}>
                <User size={18} color="#FFFFFF" />
                <Text style={styles.btnLoginText}>Log in</Text>
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSignup}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.85}
            >
              <View style={styles.btnContent}>
                <Edit3 size={18} color="#F97316" />
                <Text style={styles.btnSignupText}>Sign up</Text>
                <ChevronRight size={18} color="#F97316" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnGuest}
              onPress={() => router.push('/(tabs)')}
              activeOpacity={0.7}
            >
              <View style={styles.btnContent}>
                <Text style={styles.btnGuestText}>Continue as Guest</Text>
                <ChevronRight size={16} color="#F97316" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.trustRow}>
            <Lock size={12} color="#9CA3AF" />
            <Text style={styles.trust}>Secure · Verified · Trusted in Cebu</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const BLOB_SIZE = width * 0.75;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
  },
  blobTL: {
    backgroundColor: '#FFE8D6',
    top: -(BLOB_SIZE * 0.45),
    left: -(BLOB_SIZE * 0.4),
    opacity: 0.85,
  },
  blobTR: {
    backgroundColor: '#FFF3E8',
    top: -(BLOB_SIZE * 0.3),
    right: -(BLOB_SIZE * 0.5),
    opacity: 0.7,
  },
  blobBL: {
    backgroundColor: '#FFF3E8',
    bottom: -(BLOB_SIZE * 0.4),
    left: -(BLOB_SIZE * 0.4),
    opacity: 0.6,
  },
  blobBR: {
    backgroundColor: '#FFD6A5',
    bottom: -(BLOB_SIZE * 0.35),
    right: -(BLOB_SIZE * 0.4),
    opacity: 0.65,
  },
  topSection: {
    flex: 1.0,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  brand: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  brandBlack: { color: '#111111' },
  brandOrange: { color: '#F97316' },
  brandSub: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginTop: -2 },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FED7AA',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingPillText: { fontSize: 12, fontWeight: '800', color: '#111111' },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 50, // Pushed slightly further down as requested
  },
  heroGlow: {
    position: 'absolute',
    width: width * 0.62,
    height: width * 0.62,
    borderRadius: (width * 0.62) / 2,
    backgroundColor: '#FFE8D6',
    opacity: 0.7,
  },
  heroCircleMask: {
    width: width * 0.56,
    height: width * 0.56,
    borderRadius: (width * 0.56) / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    flex: 1.1,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,178,107,0.25)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 10,
  },
  badgeLeft: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#166534' },
  heading: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    lineHeight: 34,
    marginBottom: 4,
  },
  headingAccent: { color: '#F97316' },
  subheading: {
    fontSize: 12.5,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },
  buttons: { gap: 8, marginBottom: 14 },
  btnLogin: {
    backgroundColor: '#F97316',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnLoginText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  btnSignup: {
    backgroundColor: '#FFFBF5',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  btnSignupText: { color: '#F97316', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  btnGuest: {
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnGuestText: { color: '#F97316', fontWeight: '800', fontSize: 14, textAlign: 'center', flex: 1 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 2 },
  trust: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});