import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import {
  CatererWithPackages,
  fetchApprovedCaterers,
  getLowestPricePerGuest,
  getPlanBadge,
} from '../../lib/caterers';
import NotificationsScreen from '../../screens/auth/NotificationsScreen';

const { width } = Dimensions.get('window');

// Real buffet photo used as the hero banner background.
const HERO_BUFFET_IMAGE = require('../../assets/images/hero-buffet.png');

const ICONS = {
  bell: require('../../assets/icons/bell.png'),
  wave: require('../../assets/icons/wave.png'),
  pin: require('../../assets/icons/pin.png'),
  package: require('../../assets/icons/package.png'),
  lock: require('../../assets/icons/lock.png'),
  check: require('../../assets/icons/check.png'),
  close: require('../../assets/icons/close.png'),
  closeOrange: require('../../assets/icons/close_orange.png'),
  arrowRight: require('../../assets/icons/arrow_right.png'),
  arrowRightWhite: require('../../assets/icons/arrow_right_white.png'),
  plate: require('../../assets/icons/plate.png'),
  search: require('../../assets/icons/search.png'),
  bolt: require('../../assets/icons/bolt.png'),
  peso: require('../../assets/icons/peso.png'),
  guests: require('../../assets/icons/guests.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  card: require('../../assets/icons/card.png'),
  confetti: require('../../assets/icons/confetti.png'),
  compass: require('../../assets/icons/compass.png'),
  wedding: require('../../assets/icons/wedding.png'),
  birthday: require('../../assets/icons/birthday.png'),
  corporate: require('../../assets/icons/corporate.png'),
  debut: require('../../assets/icons/debut.png'),
  anniversary: require('../../assets/icons/anniversary.png'),
  grid: require('../../assets/icons/grid.png'),
};

const EVENT_CATEGORIES = [
  { icon: ICONS.grid, label: 'All' },
  { icon: ICONS.wedding, label: 'Wedding' },
  { icon: ICONS.birthday, label: 'Birthday' },
  { icon: ICONS.corporate, label: 'Corporate' },
  { icon: ICONS.debut, label: 'Debut' },
  { icon: ICONS.anniversary, label: 'Anniversary' },
];

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  bronze: { bg: '#B45309', text: '#FEF3C7' },
  silver: { bg: '#6B7280', text: '#F9FAFB' },
  gold: { bg: '#D97706', text: '#FFFBEB' },
  premium: { bg: '#7C3AED', text: '#F5F3FF' },
};

export default function HomeScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();

  const [caterers, setCaterers] = useState<CatererWithPackages[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budget, setBudget] = useState('');
  const [guests, setGuests] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searched, setSearched] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadCaterers = async () => {
    try {
      const data = await fetchApprovedCaterers();
      setCaterers(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load unread notification count
  const loadUnreadCount = async () => {
    if (!session?.user?.id) return;
    const { supabase } = await import('../../lib/supabase');
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCaterers();
      setLoading(false);
    })();
    loadUnreadCount();
  }, [session]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCaterers();
    await loadUnreadCount();
    setRefreshing(false);
  };

  const pricePerGuest = useMemo(() => {
    const b = parseFloat(budget);
    const g = parseFloat(guests);
    if (!b || !g || g <= 0) return null;
    return b / g;
  }, [budget, guests]);

  const PLAN_PRIORITY: Record<string, number> = { premium: 0, standard: 1, basic: 2, free: 3 };

  const displayedCaterers = useMemo(() => {
    let list = caterers;
    if (activeCategory !== 'All') {
      // filter could be applied here if caterers had event_types
    }
    if (searched && pricePerGuest !== null) {
      list = list.filter((c) => {
        const lowest = getLowestPricePerGuest(c.packages);
        return lowest !== null && lowest <= pricePerGuest;
      });
    }
    return [...list].sort((a, b) => {
      const pa = PLAN_PRIORITY[a.subscription_plan] ?? 99;
      const pb = PLAN_PRIORITY[b.subscription_plan] ?? 99;
      return pa - pb;
    });
  }, [caterers, pricePerGuest, searched, activeCategory]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Guest';

  const handleBookPress = (catererId?: string) => {
  if (!session) {
    router.push('/(auth)/login');
  } else if (catererId) {
    router.push({ pathname: '/(tabs)/caterer/[catererId]', params: { catererId } });
  }
};

  const handleProfilePress = () => {
    if (session) {
      router.push('/(tabs)/profile');
    } else {
      router.push('/(auth)/login');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Finding caterers...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Notifications Modal */}
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <NotificationsScreen />
        <TouchableOpacity
          style={styles.closeNotifBtn}
          onPress={() => {
            setShowNotifs(false);
            loadUnreadCount();
          }}
        >
          <Image source={ICONS.close} style={styles.iconSm} />
          <Text style={styles.closeNotifText}>Close</Text>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
        }
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerGreetingRow}>
              <Text style={styles.headerGreeting}>
                {session ? `Good day, ${firstName}` : 'Welcome, Guest'}
              </Text>
              <Image source={ICONS.wave} style={styles.iconWaveInline} />
            </View>
            <View />
          </View>

          <View style={styles.headerTopRow}>
            <Text style={styles.headerBrand}>
              <Text style={{ color: Colors.black }}>CATER</Text>
              <Text style={{ color: Colors.orange }}>CONNECT</Text>
            </Text>
            <View style={styles.headerRight}>
              {/* Notification bell */}
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => (session ? setShowNotifs(true) : router.push('/(auth)/login'))}
              >
                <Image source={ICONS.bell} style={styles.iconMd} />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Profile avatar / Login */}
              {session ? (
                <TouchableOpacity style={styles.avatarBtn} onPress={handleProfilePress} activeOpacity={0.85}>
                  {(profile as any)?.avatar_url ? (
                    <Image source={{ uri: (profile as any).avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarBtnText}>{(profile?.full_name ?? 'U').charAt(0).toUpperCase()}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.loginPill} onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.loginPillText}>Log In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search bar */}
          <TouchableOpacity style={styles.searchBar} activeOpacity={0.8}>
            <Image source={ICONS.search} style={styles.iconSearch} />
            <Text style={styles.searchPlaceholder}>Search caterers in Cebu...</Text>
          </TouchableOpacity>
        </View>

        {/* ── GUEST BANNER ── */}
        {!session && (
          <View style={styles.guestBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBannerTitle}>You're browsing as a guest</Text>
              <Text style={styles.guestBannerSub}>Log in or sign up to book a caterer.</Text>
            </View>
            <TouchableOpacity style={styles.guestBannerBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.guestBannerBtnText}>Log In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── HERO BANNER ── */}
        <ImageBackground source={HERO_BUFFET_IMAGE} style={styles.heroBanner} imageStyle={styles.heroBannerImage}>
          <View style={styles.heroBannerOverlay} />
          <View style={styles.heroBannerContent}>
            <Text style={styles.heroBannerLabel}>CEBU'S #1 MARKETPLACE</Text>
            <Text style={styles.heroBannerTitle}>
              Book the{'\n'}
              <Text style={styles.heroBannerItalic}>Perfect </Text>Caterer
            </Text>
            <Text style={styles.heroBannerSub}>Weddings · Birthdays · Corporate</Text>
            <TouchableOpacity style={styles.heroBannerBtn}>
              <Text style={styles.heroBannerBtnText}>Browse Now</Text>
              <Image source={ICONS.arrowRightWhite} style={styles.iconArrowSm} />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* ── CATEGORIES ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
          {EVENT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                style={styles.catItem}
                onPress={() => setActiveCategory(cat.label)}
                activeOpacity={0.7}
              >
                <View style={[styles.catIconWrap, isActive && styles.catIconWrapActive]}>
                  <Image
                    source={cat.icon}
                    style={[styles.iconCategory, isActive && styles.iconCategoryActive]}
                  />
                </View>
                <Text style={[styles.catLabel, isActive && styles.catLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── FEATURED CATERERS ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Featured Caterers</Text>
          <TouchableOpacity style={styles.seeAllRow}>
            <Text style={styles.seeAll}>See all</Text>
            <Image source={ICONS.arrowRight} style={styles.iconArrowSm} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {caterers
            .filter((c) => ['premium', 'standard'].includes(c.subscription_plan))
            .sort((a, b) => (a.subscription_plan === 'premium' ? -1 : 1) - (b.subscription_plan === 'premium' ? -1 : 1))
            .slice(0, 6)
            .map((item) => {
              const lowest = getLowestPricePerGuest(item.packages);
              const planBadge = getPlanBadge(item.subscription_plan);
              const topTier = item.packages?.reduce((best: any, p: any) => {
                const order = ['bronze', 'silver', 'gold', 'premium'];
                return order.indexOf(p.tier) > order.indexOf(best?.tier ?? '') ? p : best;
              }, null);
              const tierStyle = topTier ? TIER_COLORS[topTier.tier] : { bg: Colors.orange, text: '#fff' };

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.featCard}
                  activeOpacity={0.88}
                  onPress={() => handleBookPress(item.id)}
                >
                  <View style={styles.featCardImg}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                      <Image source={ICONS.plate} style={styles.iconPlateFallback} />
                    )}
                    {/* Subscription plan badge */}
                    <View style={[styles.featPlanBadge, { backgroundColor: planBadge.bg }]}>
                      <Text style={[styles.featPlanText, { color: planBadge.text }]}>
                        {item.subscription_plan.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.featVerifiedBadge}>
                      <Image source={ICONS.check} style={styles.iconCheckSm} />
                      <Text style={styles.featVerifiedText}>Verified</Text>
                    </View>
                  </View>
                  <View style={styles.featCardInfo}>
                    <Text style={styles.featCardName} numberOfLines={1}>
                      {item.business_name}
                    </Text>
                    {item.city && (
                      <View style={styles.metaRow}>
                        <Image source={ICONS.pin} style={styles.iconXs} />
                        <Text style={styles.featCardCity}>{item.city}</Text>
                      </View>
                    )}
                    <View style={styles.featCardBottom}>
                      {lowest !== null ? (
                        <View style={styles.priceRow}>
                          <Image source={ICONS.peso} style={styles.iconPesoSm} />
                          <View>
                            <Text style={styles.featCardPrice}>{lowest.toFixed(0)}</Text>
                            <Text style={styles.featCardUnit}>/guest</Text>
                          </View>
                        </View>
                      ) : (
                        <View />
                      )}
                      <TouchableOpacity style={styles.featCardBtn} onPress={() => handleBookPress(item.id)}>
                        {session ? (
                          <Text style={styles.featCardBtnText}>Book</Text>
                        ) : (
                          <Image source={ICONS.lock} style={styles.iconLockSm} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          {caterers.filter((c) => ['premium', 'standard'].includes(c.subscription_plan)).length === 0 &&
            caterers.slice(0, 4).map((item) => {
              const lowest = getLowestPricePerGuest(item.packages);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.featCard}
                  activeOpacity={0.88}
                  onPress={() => handleBookPress(item.id)}
                >
                  <View style={styles.featCardImg}>
                    <Image source={ICONS.plate} style={styles.iconPlateFallback} />
                    <View style={styles.featVerifiedBadge}>
                      <Image source={ICONS.check} style={styles.iconCheckSm} />
                      <Text style={styles.featVerifiedText}>Verified</Text>
                    </View>
                  </View>
                  <View style={styles.featCardInfo}>
                    <Text style={styles.featCardName} numberOfLines={1}>
                      {item.business_name}
                    </Text>
                    {item.city && (
                      <View style={styles.metaRow}>
                        <Image source={ICONS.pin} style={styles.iconXs} />
                        <Text style={styles.featCardCity}>{item.city}</Text>
                      </View>
                    )}
                    <View style={styles.featCardBottom}>
                      {lowest !== null ? (
                        <View style={styles.priceRow}>
                          <Image source={ICONS.peso} style={styles.iconPesoSm} />
                          <View>
                            <Text style={styles.featCardPrice}>{lowest.toFixed(0)}</Text>
                            <Text style={styles.featCardUnit}>/guest</Text>
                          </View>
                        </View>
                      ) : (
                        <View />
                      )}
                      <TouchableOpacity style={styles.featCardBtn} onPress={() => handleBookPress(item.id)}>
                        {session ? (
                          <Text style={styles.featCardBtnText}>Book</Text>
                        ) : (
                          <Image source={ICONS.lock} style={styles.iconLockSm} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        {/* ── BUDGET MATCHER ── */}
        <View style={styles.sectionPad}>
          <View style={styles.matcherCard}>
            <View style={styles.matcherHeader}>
              <View style={styles.matcherHeaderIconWrap}>
                <Image source={ICONS.bolt} style={styles.iconBolt} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.matcherHeaderTitle}>Smart Budget Matcher</Text>
                <Text style={styles.matcherHeaderSub}>Find caterers within your budget</Text>
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputWrap}>
                <Image source={ICONS.peso} style={styles.iconInputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Total budget"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={(v) => {
                    setBudget(v);
                    setSearched(false);
                  }}
                />
              </View>
              <View style={styles.inputWrap}>
                <Image source={ICONS.guests} style={styles.iconInputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Guests"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={guests}
                  onChangeText={(v) => {
                    setGuests(v);
                    setSearched(false);
                  }}
                />
              </View>
            </View>
            {pricePerGuest !== null && (
              <View style={styles.perGuestRow}>
                <Text style={styles.perGuestLabel}>Price per guest</Text>
                <Text style={styles.perGuestValue}>₱{pricePerGuest.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.matcherBtn} onPress={() => setSearched(true)}>
              <Text style={styles.matcherBtnText}>Find Caterers</Text>
              <Image source={ICONS.arrowRightWhite} style={styles.iconArrowMd} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ALL CATERERS ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>
            {searched && pricePerGuest !== null
              ? `Matched Caterers (${displayedCaterers.length})`
              : `All Caterers (${caterers.length})`}
          </Text>
          {searched && (
            <TouchableOpacity
              style={styles.seeAllRow}
              onPress={() => {
                setSearched(false);
                setBudget('');
                setGuests('');
              }}
            >
              <Text style={styles.seeAll}>Clear</Text>
              <Image source={ICONS.closeOrange} style={styles.iconArrowSm} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listPad}>
          {displayedCaterers.length === 0 ? (
            <View style={styles.empty}>
              <Image source={ICONS.plate} style={styles.iconEmpty} />
              <Text style={styles.emptyTitle}>No caterers found</Text>
              <Text style={styles.emptySub}>
                {searched ? 'Try increasing your budget.' : 'No verified caterers yet.'}
              </Text>
            </View>
          ) : (
            displayedCaterers.map((item) => {
              const lowest = getLowestPricePerGuest(item.packages);
              const planBadge = getPlanBadge(item.subscription_plan);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.listCard}
                  activeOpacity={0.88}
                  onPress={() => handleBookPress(item.id)}
                >
                  <View style={styles.listCardImg}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                      <Image source={ICONS.plate} style={styles.iconPlateFallbackSm} />
                    )}
                    <View style={[styles.listPlanTag, { backgroundColor: planBadge.bg }]}>
                      <Text style={[styles.listPlanTagText, { color: planBadge.text }]}>
                        {item.subscription_plan.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.listCardBody}>
                    <View style={styles.listCardTop}>
                      <Text style={styles.listCardName} numberOfLines={1}>
                        {item.business_name}
                      </Text>
                      {lowest !== null && (
                        <Text style={styles.listCardPrice}>
                          ₱{lowest.toFixed(0)}
                          <Text style={styles.listCardPricePer}>/guest</Text>
                        </Text>
                      )}
                    </View>
                    <View style={styles.listCardMeta}>
                      {item.city && (
                        <View style={styles.metaRow}>
                          <Image source={ICONS.pin} style={styles.iconXs} />
                          <Text style={styles.listCardMetaText}>{item.city}</Text>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Image source={ICONS.package} style={styles.iconXs} />
                        <Text style={styles.listCardMetaText}>{item.packages?.length ?? 0} packages</Text>
                      </View>
                    </View>
                    {item.business_description && (
                      <Text style={styles.listCardDesc} numberOfLines={1}>
                        {item.business_description}
                      </Text>
                    )}
                    <View style={styles.listCardActions}>
                      <TouchableOpacity style={styles.listCardBtnPrimary} onPress={() => handleBookPress(item.id)}>
                        {!session && <Image source={ICONS.lock} style={styles.iconLockSm} />}
                        <Text style={styles.listCardBtnPrimaryText}>{session ? 'Book Now' : 'Login to Book'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── HOW IT WORKS ── */}
        <View style={[styles.sectionTitleRow, { paddingTop: 24 }]}>
          <Text style={styles.sectionTitle}>How It Works</Text>
        </View>
        <View style={styles.howGrid}>
          {[
            { step: '1', icon: ICONS.compass, title: 'Browse', desc: 'Find verified caterers in Cebu' },
            { step: '2', icon: ICONS.clipboard, title: 'Book', desc: 'Choose your package & customize' },
            { step: '3', icon: ICONS.card, title: 'Pay', desc: 'Pay downpayment via GCash' },
            { step: '4', icon: ICONS.confetti, title: 'Enjoy', desc: 'Celebrate your perfect event!' },
          ].map((s) => (
            <View key={s.step} style={styles.howItem}>
              <View style={styles.howIconWrap}>
                <Image source={s.icon} style={styles.iconHow} />
              </View>
              <Text style={styles.howStep}>STEP {s.step}</Text>
              <Text style={styles.howTitle}>{s.title}</Text>
              <Text style={styles.howDesc}>{s.desc}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // ── Icon size presets ──────────────────────────────────────
  iconSm: { width: 14, height: 14 },
  iconMd: { width: 18, height: 18 },
  iconXs: { width: 11, height: 11 },
  iconSearch: { width: 16, height: 16 },
  iconArrowSm: { width: 11, height: 11 },
  iconArrowMd: { width: 13, height: 13 },
  iconWaveInline: { width: 16, height: 16, marginLeft: 4 },
  iconCategory: { width: 26, height: 26 },
  iconCategoryActive: { tintColor: Colors.white },
  iconCheckSm: { width: 11, height: 11 },
  iconLockSm: { width: 12, height: 12 },
  iconPesoSm: { width: 13, height: 13 },
  iconPlateFallback: { width: 44, height: 44 },
  iconPlateFallbackSm: { width: 34, height: 34 },
  iconBolt: { width: 22, height: 22 },
  iconInputIcon: { width: 15, height: 15 },
  iconEmpty: { width: 50, height: 50, marginBottom: 12 },
  iconHow: { width: 24, height: 24 },

  // Notif modal close
  closeNotifBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.black,
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  closeNotifText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  // Header
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: { marginBottom: 2 },
  headerGreetingRow: { flexDirection: 'row', alignItems: 'center' },
  headerGreeting: { fontSize: 12, color: Colors.textSecondary },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBrand: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  notifBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // ← needed so Image clips to circle
  },
  avatarBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  loginPill: { backgroundColor: Colors.orange, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  loginPillText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  searchPlaceholder: { color: Colors.textMuted, fontSize: 14 },

  // Guest banner
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFB26B',
    gap: 12,
  },
  guestBannerTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  guestBannerSub: { fontSize: 11, color: '#B45309' },
  guestBannerBtn: { backgroundColor: Colors.orange, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  guestBannerBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  // Hero
  heroBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 148,
    justifyContent: 'center',
  },
  heroBannerImage: { borderRadius: 20 },
  heroBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,8,6,0.55)',
  },
  heroBannerContent: { flex: 1, padding: 20 },
  heroBannerLabel: { fontSize: 9, color: Colors.orange, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  heroBannerTitle: { fontSize: 22, fontWeight: '900', color: Colors.white, lineHeight: 28, marginBottom: 4 },
  heroBannerItalic: { color: Colors.orange, fontStyle: 'italic' },
  heroBannerSub: { fontSize: 11, color: '#E5E7EB', marginBottom: 14 },
  heroBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.orange,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  heroBannerBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  // Sections
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 13, color: Colors.orange, fontWeight: '700' },

  // Categories
  catsRow: { paddingHorizontal: 20, paddingBottom: 4, gap: 14 },
  catItem: { alignItems: 'center', gap: 6 },
  catIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  catIconWrapActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  catLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  catLabelActive: { color: Colors.orange },

  // Featured cards
  featuredRow: { paddingHorizontal: 20, paddingBottom: 4, gap: 12 },
  featCard: {
    width: 170,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  featCardImg: {
    height: 116,
    backgroundColor: Colors.orange + '18',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  featPlanBadge: { position: 'absolute', top: 10, left: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  featPlanText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  featVerifiedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featVerifiedText: { fontSize: 10, color: '#16a34a', fontWeight: '800' },
  featCardInfo: { padding: 12 },
  featCardName: { fontSize: 13, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  featCardCity: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  featCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  featCardPrice: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  featCardUnit: { fontSize: 10, color: Colors.textMuted },
  featCardBtn: { backgroundColor: Colors.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  featCardBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  // Budget matcher
  sectionPad: { paddingHorizontal: 20, paddingTop: 20 },
  matcherCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  matcherHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  matcherHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matcherHeaderTitle: { fontSize: 16, fontWeight: '800', color: Colors.black },
  matcherHeaderSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputField: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  perGuestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.orangeLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  perGuestLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  perGuestValue: { fontSize: 20, fontWeight: '900', color: Colors.orange },
  matcherBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
  },
  matcherBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },

  // List cards
  listPad: { paddingHorizontal: 20, gap: 12 },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listCardImg: {
    width: 96,
    height: 110,
    backgroundColor: Colors.orange + '18',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  listPlanTag: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingVertical: 3 },
  listPlanTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  listCardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardName: { fontSize: 14, fontWeight: '900', color: Colors.black, flex: 1, marginRight: 8 },
  listCardPrice: { fontSize: 15, fontWeight: '900', color: Colors.orange },
  listCardPricePer: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  listCardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  listCardMetaText: { fontSize: 11, color: Colors.textSecondary },
  listCardDesc: { fontSize: 11, color: Colors.textMuted },
  listCardActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  listCardBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 8,
  },
  listCardBtnPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  // How it works
  howGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  howItem: {
    width: (width - 52) / 2,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  howIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  howStep: { fontSize: 9, color: Colors.orange, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  howTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  howDesc: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});