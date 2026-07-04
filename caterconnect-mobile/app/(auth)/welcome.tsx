import { useRouter } from 'expo-router';
import {
    Dimensions, Image,
    StatusBar,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const ICONS = {
  star: require('../../assets/icons/star.png'),
  shieldCheck: require('../../assets/icons/shield_check.png'),
  lock: require('../../assets/icons/lock.png'),
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobTR]} />
      <View style={[styles.blob, styles.blobBL]} />
      <View style={[styles.blob, styles.blobBR]} />
      <View style={[styles.topSection, { paddingTop: insets.top + 16 }]}>

        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            <Text style={styles.brandBlack}>CATER</Text>
            <Text style={styles.brandOrange}>CONNECT</Text>
          </Text>
          <View style={styles.ratingPill}>
            <Image source={ICONS.star} style={styles.iconRatingStar} />
            <Text style={styles.ratingPillText}>4.8 Rated</Text>
          </View>
        </View>

        <View style={styles.heroWrap}>
          {/* Glow circle behind image */}
          <View style={styles.heroGlow} />
          <Image
            source={require('@/assets/images/food-hero.png')}
            style={styles.heroImage}
            resizeMode="contain"
          />
          <View style={styles.badgeLeft}>
            <Image source={ICONS.shieldCheck} style={styles.iconBadgeLeft} />
            <Text style={styles.badgeText}>Verified Caterers</Text>
          </View>
          <View style={styles.badgeRight}>
            <Text style={styles.badgeRightText}>500+{'\n'}Caterers</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>

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
            <Text style={styles.btnLoginText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSignup}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnSignupText}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnGuest}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.btnGuestText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trustRow}>
          <Image source={ICONS.lock} style={styles.iconTrust} />
          <Text style={styles.trust}>Secure · Verified · Trusted in Cebu</Text>
        </View>
      </View>
    </View>
  );
}

const BLOB_SIZE = width * 0.75;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    top: -(BLOB_SIZE * 0.5),
    left: -(BLOB_SIZE * 0.5),
    opacity: 0.75,
  },
  blobTR: {
    backgroundColor: '#FFF3E8',
    top: -(BLOB_SIZE * 0.35),
    right: -(BLOB_SIZE * 0.55),
    opacity: 0.6,
  },
  blobBL: {
    backgroundColor: '#FFF3E8',
    bottom: -(BLOB_SIZE * 0.5),
    left: -(BLOB_SIZE * 0.45),
    opacity: 0.55,
  },
  blobBR: {
    backgroundColor: '#FFD6A5',
    bottom: -(BLOB_SIZE * 0.4),
    right: -(BLOB_SIZE * 0.5),
    opacity: 0.5,
  },

  topSection: {
    flex: 1.1,
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brand: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  brandBlack: { color: '#111111' },
  brandOrange: { color: '#F97316' },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF3E8',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  iconRatingStar: { width: 12, height: 12 },
  ratingPillText: { fontSize: 11, fontWeight: '700', color: '#F97316' },

  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    backgroundColor: '#FFE8D6',
    opacity: 0.55,
  },
  heroImage: {
    width: width * 0.82,
    height: width * 0.82,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
  },
  badgeLeft: {
    position: 'absolute',
    bottom: 12,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  iconBadgeLeft: { width: 14, height: 14 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#111111' },
  badgeRight: {
    position: 'absolute',
    top: 12,
    right: 8,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  badgeRightText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 16 },

  bottomSection: {
    flex: 0.9,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
  },
  heading: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111111',
    lineHeight: 40,
    marginBottom: 8,
  },
  headingAccent: { color: '#F97316', fontStyle: 'italic' },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 24,
  },

  buttons: { gap: 12, marginBottom: 14 },
  btnLogin: {
    backgroundColor: '#111111',
    borderRadius: 50, paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  btnLoginText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  btnSignup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2, borderColor: '#111111',
  },
  btnSignupText: { color: '#111111', fontWeight: '900', fontSize: 16 },
  btnGuest: {
    borderRadius: 50, paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFB26B',
    backgroundColor: 'transparent',
  },
  btnGuestText: { color: '#F97316', fontWeight: '700', fontSize: 14 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  iconTrust: { width: 11, height: 11, tintColor: '#9CA3AF' },
  trust: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});