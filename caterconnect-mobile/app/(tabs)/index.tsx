import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

// ── Lucide Icons ──
import {
  Bell, Hand, MapPin, Package, Lock, CheckCircle, X,
  ArrowRight, Utensils, Search, Zap, Users, ClipboardList,
  CreditCard, PartyPopper, Compass, LayoutGrid, Cake,
  Briefcase, Heart, Sparkles, Image as ImageIcon, SlidersHorizontal,
  Star, ChevronRight, HelpCircle, ChevronDown, ChevronUp,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Real buffet photo used as the hero banner background.
const HERO_BUFFET_IMAGE = require('../../assets/images/hero-buffet.png');
const LOGO_IMAGE = require('../../assets/images/caterlogo.png');

const EVENT_CATEGORIES = [
  { icon: LayoutGrid, label: 'All' },
  { icon: Heart, label: 'Wedding' },
  { icon: Cake, label: 'Birthday' },
  { icon: Briefcase, label: 'Corporate' },
  { icon: Sparkles, label: 'Debut' },
  { icon: PartyPopper, label: 'Anniversary' },
];

export default function HomeScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();

  const scrollViewRef = useRef<ScrollView>(null);
  const [browseAllY, setBrowseAllY] = useState(0);

  const [caterers, setCaterers] = useState<CatererWithPackages[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budget, setBudget] = useState('');
  const [guests, setGuests] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searched, setSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // State for expanding/collapsing all featured caterers horizontally
  const [showAllFeatured, setShowAllFeatured] = useState(false);

  // State to toggle the Smart Budget Matcher instructions
  const [showMatcherHelp, setShowMatcherHelp] = useState(false);

  // Caterer reviews state mapped by caterer id
  const [catererReviews, setCatererReviews] = useState<Record<string, { avg: number; count: number }>>({});

  const loadCaterers = async () => {
    try {
      const data = await fetchApprovedCaterers();
      setCaterers(data);

      // Fetch actual reviews from Supabase for each caterer
      const { supabase } = await import('../../lib/supabase');
      const reviewsMap: Record<string, { avg: number; count: number }> = {};
      
      for (const cat of data) {
        const { data: revs, error } = await supabase
          .from('reviews')
          .select('overall')
          .eq('caterer_id', cat.id);
        
        if (!error && revs && revs.length > 0) {
          const total = revs.reduce((acc, r) => acc + (r.overall || 0), 0);
          reviewsMap[cat.id] = {
            avg: Number((total / revs.length).toFixed(1)),
            count: revs.length,
          };
        } else {
          reviewsMap[cat.id] = { avg: 0, count: 0 };
        }
      }
      setCatererReviews(reviewsMap);
    } catch (err) {
      console.error(err);
    }
  };

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
    const cleanBudget = budget.replace(/,/g, '');
    const b = parseFloat(cleanBudget);
    const g = parseFloat(guests);
    if (!b || !g || g <= 0) return null;
    return b / g;
  }, [budget, guests]);

  const PLAN_PRIORITY: Record<string, number> = { premium: 0, standard: 1, basic: 2, free: 3 };

  // ── FILTERING LOGIC (Categories + Search Bar + Budget Matcher) ──
  const displayedCaterers = useMemo(() => {
    let list = caterers;

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.business_name?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.business_description?.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (activeCategory !== 'All') {
      const cat = activeCategory.toLowerCase();
      list = list.filter((c) => {
        const searchStr = `${c.business_name} ${c.business_description} ${JSON.stringify(c.packages)}`.toLowerCase();
        return searchStr.includes(cat);
      });
    }

    // 3. Budget Matcher Filter
    if (searched && pricePerGuest !== null) {
      list = list.filter((c) => {
        const lowest = getLowestPricePerGuest(c.packages);
        return lowest !== null && lowest <= pricePerGuest;
      });
    }

    // 4. Sort by Subscription Tier
    return [...list].sort((a, b) => {
      const pa = PLAN_PRIORITY[a.subscription_plan] ?? 99;
      const pb = PLAN_PRIORITY[b.subscription_plan] ?? 99;
      return pa - pb;
    });
  }, [caterers, pricePerGuest, searched, activeCategory, searchQuery]);

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

  const scrollToBrowseAll = () => {
    scrollViewRef.current?.scrollTo({ y: browseAllY, animated: true });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Curating best caterers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Notifications Modal */}
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <NotificationsScreen />
        <TouchableOpacity
          style={styles.closeNotifBtn}
          onPress={() => {
            setShowNotifs(false);
            loadUnreadCount();
          }}
          activeOpacity={0.8}
        >
          <X size={16} color={Colors.white} />
          <Text style={styles.closeNotifText}>Close</Text>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
        }
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.brandContainer}>
              <Image source={LOGO_IMAGE} style={styles.logoIcon} resizeMode="contain" />
              <View>
                <Text style={styles.headerBrand}>
                  <Text style={{ color: Colors.black }}>CATER</Text>
                  <Text style={{ color: Colors.orange }}>CONNECT</Text>
                </Text>
                <Text style={styles.headerSubtitle}>Nasa screen pa lang, ramdam mo na ang sarap.</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* Notification bell */}
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => (session ? setShowNotifs(true) : router.push('/(auth)/login'))}
                activeOpacity={0.7}
              >
                <Bell size={16} color={Colors.black} />
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
                <TouchableOpacity style={styles.loginPill} onPress={() => router.push('/(auth)/login')} activeOpacity={0.8}>
                  <Text style={styles.loginPillText}>Log In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Functional Search bar */}
          <View style={styles.searchBar}>
            <Search size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search caterers, dishes, or events..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 6 }}>
                <X size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <View style={styles.searchDivider} />
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => {}}
              style={styles.filterActionBtn}
            >
              <SlidersHorizontal size={14} color={Colors.orange} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO BANNER ── */}
        <ImageBackground source={HERO_BUFFET_IMAGE} style={styles.heroBanner} imageStyle={styles.heroBannerImage}>
          <View style={styles.heroBannerOverlay} />
          <View style={styles.heroBannerContent}>
            <View style={styles.heroBadge}>
              <Sparkles size={9} color="#FFFFFF" style={{ marginRight: 3 }} />
              <Text style={styles.heroBadgeText}>CATERING MADE EASY</Text>
            </View>
            <Text style={styles.heroBannerTitle}>
              Book the <Text style={styles.heroBannerItalic}>Perfect</Text>{'\n'}Caterer for Your{'\n'}Special Occasion
            </Text>
            <Text style={styles.heroBannerSub}>Weddings  ·  Birthdays  ·  Corporate  ·  And More</Text>
            
            <View style={styles.heroBottomRow}>
              <TouchableOpacity style={styles.heroBannerBtn} activeOpacity={0.85} onPress={scrollToBrowseAll}>
                <Text style={styles.heroBannerBtnText}>Browse Now</Text>
                <ChevronRight size={12} color={Colors.white} />
              </TouchableOpacity>
              
              <View style={styles.heroPagination}>
                <View style={[styles.paginationDot, styles.dotActive]} />
                <View style={styles.paginationDot} />
                <View style={styles.paginationDot} />
              </View>
            </View>
          </View>
        </ImageBackground>

        {/* ── CATEGORIES ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
          {EVENT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            const IconComp = cat.icon;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[styles.catCard, isActive && styles.catCardActive]}
                onPress={() => setActiveCategory(cat.label)}
                activeOpacity={0.8}
              >
                <View style={[styles.catIconWrap, isActive && styles.catIconWrapActive]}>
                  <IconComp size={16} color={isActive ? Colors.white : Colors.orange} />
                </View>
                <Text style={[styles.catLabel, isActive && styles.catLabelActive]}>{cat.label}</Text>
                {isActive && <View style={styles.catIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── FEATURED CATERERS ── */}
        {displayedCaterers.length > 0 && (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Featured Caterers</Text>
              <TouchableOpacity 
                style={styles.seeAllRow} 
                activeOpacity={0.7} 
                onPress={() => setShowAllFeatured(!showAllFeatured)}
              >
                <Text style={styles.seeAll}>{showAllFeatured ? 'Show Less' : 'See All'}</Text>
                <ChevronRight size={12} color={Colors.orange} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow} decelerationRate="fast" snapToInterval={240} snapToAlignment="start">
              {displayedCaterers
                .filter((c) => ['premium', 'standard'].includes(c.subscription_plan))
                .sort((a, b) => (a.subscription_plan === 'premium' ? -1 : 1) - (b.subscription_plan === 'premium' ? -1 : 1))
                .slice(0, showAllFeatured ? undefined : 6)
                .map((item) => {
                  const lowest = getLowestPricePerGuest(item.packages);
                  const planBadge = getPlanBadge(item.subscription_plan);
                  const revData = catererReviews[item.id] || { avg: 0, count: 0 };

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.featCard}
                      activeOpacity={0.9}
                      onPress={() => handleBookPress(item.id)}
                    >
                      <View style={styles.featCardImg}>
                        {item.logo_url ? (
                          <Image source={{ uri: item.logo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <ImageIcon size={26} color={Colors.orange} style={{ opacity: 0.5 }} />
                        )}
                        {/* Subscription plan badge */}
                        <View style={[styles.featPlanBadge, { backgroundColor: planBadge.bg }]}>
                          <Sparkles size={8} color={planBadge.text} />
                          <Text style={[styles.featPlanText, { color: planBadge.text }]}>
                            {item.subscription_plan.toUpperCase()}
                          </Text>
                        </View>
                        
                        <View style={styles.verifiedBadgeAbsolute}>
                          <CheckCircle size={10} color="#10B981" fill="#FFFFFF" />
                          <Text style={styles.verifiedTextAbsolute}>Verified</Text>
                        </View>
                      </View>

                      {/* Floating round logo */}
                      <View style={styles.floatingLogoContainer}>
                        {item.logo_url ? (
                          <Image source={{ uri: item.logo_url }} style={styles.floatingLogoImg} />
                        ) : (
                          <View style={styles.floatingLogoPlaceholder}>
                            <Utensils size={16} color={Colors.orange} />
                          </View>
                        )}
                      </View>

                      <View style={styles.featCardInfo}>
                        <Text style={styles.featCardName} numberOfLines={1}>
                          {item.business_name}
                        </Text>
                        
                        {item.city && (
                          <View style={styles.metaRow}>
                            <MapPin size={10} color={Colors.orange} />
                            <Text style={styles.featCardCity}>{item.city}</Text>
                          </View>
                        )}

                        <View style={styles.ratingRow}>
                          <Star size={10} color="#F59E0B" fill="#F59E0B" />
                          <Text style={styles.ratingScore}>
                            {revData.count > 0 ? revData.avg.toFixed(1) : 'New'}
                          </Text>
                          <Text style={styles.ratingCount}>
                            {revData.count > 0 ? `(${revData.count} reviews)` : '(No reviews)'}
                          </Text>
                        </View>

                        <View style={styles.featCardBottom}>
                          {lowest !== null ? (
                            <View>
                              <Text style={styles.featCardPrice}>₱{lowest.toFixed(0)}</Text>
                              <Text style={styles.featCardUnit}>/guest</Text>
                            </View>
                          ) : (
                            <View />
                          )}
                          <TouchableOpacity style={styles.featCardBtn} onPress={() => handleBookPress(item.id)} activeOpacity={0.8}>
                            {session ? (
                              <>
                                <Text style={styles.featCardBtnText}>Book</Text>
                                <ChevronRight size={10} color={Colors.white} />
                              </>
                            ) : (
                              <Lock size={12} color={Colors.white} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </>
        )}

        {/* ── SMART BUDGET MATCHER ── */}
        <View style={styles.sectionPad}>
          <View style={styles.matcherCard}>
            <View style={styles.matcherHeader}>
              <View style={styles.matcherHeaderIconWrap}>
                <Zap size={20} color={Colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.matcherHeaderTitle}>Smart Budget Matcher</Text>
                <Text style={styles.matcherHeaderSub}>Find caterers that fit your exact budget and guest count.</Text>
              </View>
            </View>

            {/* Clickable "How to Use" Toggle Button */}
            <TouchableOpacity
              style={styles.helpToggleBtn}
              onPress={() => setShowMatcherHelp(!showMatcherHelp)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={14} color={Colors.orange} />
                <Text style={styles.helpToggleText}>How does this work?</Text>
              </View>
              {showMatcherHelp ? (
                <ChevronUp size={14} color={Colors.orange} />
              ) : (
                <ChevronDown size={14} color={Colors.orange} />
              )}
            </TouchableOpacity>

            {/* Collapsible Instruction Box */}
            {showMatcherHelp && (
              <View style={styles.matcherInstructionBox}>
                <Text style={styles.matcherInstructionText}>
                  1. Enter your overall event <Text style={{ fontWeight: '700' }}>Total Budget</Text> (e.g., 50,000).{'\n'}
                  2. Enter your expected <Text style={{ fontWeight: '700' }}>No. of Guests</Text> (e.g., 100).{'\n'}
                  3. Tap <Text style={{ fontWeight: '700' }}>Find Matching Caterers</Text> to instantly view packages fitting your budget per guest!
                </Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputWrap}>
                <Text style={styles.currencyPrefix}>₱</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Total budget"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={(v) => {
                    const numericOnly = v.replace(/\D/g, '');
                    const formatted = numericOnly ? Number(numericOnly).toLocaleString('en-US') : '';
                    setBudget(formatted);
                    setSearched(false);
                  }}
                />
              </View>
              <View style={styles.inputWrap}>
                <Users size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.inputField}
                  placeholder="No. of Guests"
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
                <Text style={styles.perGuestLabel}>Estimated Price Per Guest</Text>
                <Text style={styles.perGuestValue}>₱{pricePerGuest.toFixed(2)}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.matcherBtn} 
              onPress={() => setSearched(true)} 
              activeOpacity={0.85}
            >
              <Text style={styles.matcherBtnText}>Find Matching Caterers</Text>
              <ChevronRight size={14} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ALL CATERERS ── */}
        <View 
          style={styles.sectionTitleRow}
          onLayout={(e) => setBrowseAllY(e.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>
            {searched && pricePerGuest !== null
              ? `Matched Caterers (${displayedCaterers.length})`
              : `Browse All (${displayedCaterers.length})`}
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
              <Text style={styles.seeAll}>Clear Filters</Text>
              <X size={12} color={Colors.orange} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listPad}>
          {displayedCaterers.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Utensils size={26} color={Colors.orange} />
              </View>
              <Text style={styles.emptyTitle}>No caterers found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search query, budget, or category to find more options.
              </Text>
            </View>
          ) : (
            displayedCaterers.map((item) => {
              const lowest = getLowestPricePerGuest(item.packages);
              const planBadge = getPlanBadge(item.subscription_plan);
              const revData = catererReviews[item.id] || { avg: 0, count: 0 };

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.listCard}
                  activeOpacity={0.85}
                  onPress={() => handleBookPress(item.id)}
                >
                  <View style={styles.listCardImg}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                      <ImageIcon size={22} color={Colors.orange} style={{ opacity: 0.5 }} />
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
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.listCardPrice}>₱{lowest.toFixed(0)}</Text>
                          <Text style={styles.listCardPricePer}>per guest</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.listCardMeta}>
                      {item.city && (
                        <View style={styles.metaRow}>
                          <MapPin size={10} color={Colors.textSecondary} />
                          <Text style={styles.listCardMetaText}>{item.city}</Text>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.listCardMetaText}>
                          {revData.count > 0 ? `${revData.avg.toFixed(1)} (${revData.count})` : 'New (0)'}
                        </Text>
                      </View>
                    </View>

                    {item.business_description && (
                      <Text style={styles.listCardDesc} numberOfLines={2}>
                        {item.business_description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── HOW IT WORKS ── */}
        <View style={[styles.sectionTitleRow, { paddingTop: 24 }]}>
          <Text style={styles.sectionTitle}>How CaterConnect Works</Text>
        </View>
        <View style={styles.howGrid}>
          {[
            { step: '1', icon: Compass, title: 'Browse & Compare', desc: 'Find verified caterers in Cebu tailored to your needs.' },
            { step: '2', icon: ClipboardList, title: 'Customize Package', desc: 'Select a package and tailor it to your guest list.' },
            { step: '3', icon: CreditCard, title: 'Secure Payment', desc: 'Pay downpayments easily and safely via GCash.' },
            { step: '4', icon: PartyPopper, title: 'Enjoy the Event', desc: 'Relax and let the professionals handle the feast.' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <View key={s.step} style={styles.howItem}>
                <View style={styles.howIconWrap}>
                  <Icon size={18} color={Colors.orange} />
                </View>
                <Text style={styles.howStep}>STEP {s.step}</Text>
                <Text style={styles.howTitle}>{s.title}</Text>
                <Text style={styles.howDesc}>{s.desc}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  closeNotifBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  closeNotifText: { color: Colors.white, fontWeight: '800', fontSize: 13 },

  // Header
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoIcon: {
    width: 30,
    height: 30,
  },
  headerBrand: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 9.5, color: Colors.textSecondary, fontWeight: '500', marginTop: -2 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  notifBadgeText: { color: Colors.white, fontSize: 7.5, fontWeight: '900' },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.orange,
  },
  avatarBtnText: { color: Colors.orange, fontWeight: '900', fontSize: 14 },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  loginPill: { backgroundColor: Colors.orange, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  loginPillText: { color: Colors.white, fontWeight: '800', fontSize: 11.5 },
  
  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: { flex: 1, color: Colors.black, fontSize: 12.5, fontWeight: '500' },
  searchDivider: { width: 1, height: 14, backgroundColor: '#E5E7EB', marginHorizontal: 2 },
  filterActionBtn: { padding: 4 },

  // Hero Banner
  heroBanner: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 165,
    justifyContent: 'center',
  },
  heroBannerImage: { borderRadius: 18 },
  heroBannerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroBannerContent: { flex: 1, padding: 16, justifyContent: 'center' },
  heroBadge: { backgroundColor: Colors.orange, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 5, alignSelf: 'flex-start', marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  heroBadgeText: { fontSize: 8.5, color: Colors.white, fontWeight: '900', letterSpacing: 0.4 },
  heroBannerTitle: { fontSize: 18, fontWeight: '900', color: Colors.white, lineHeight: 24, marginBottom: 4 },
  heroBannerItalic: { color: Colors.orange, fontStyle: 'italic' },
  heroBannerSub: { fontSize: 10, color: '#E5E7EB', marginBottom: 12, fontWeight: '500' },
  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBannerBtnText: { color: Colors.white, fontWeight: '800', fontSize: 11.5 },
  heroPagination: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  paginationDot: { width: 4.5, height: 4.5, borderRadius: 2.25, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 12, backgroundColor: Colors.orange },

  // Sections
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16.5, fontWeight: '900', color: Colors.black, letterSpacing: -0.3 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 11.5, color: Colors.orange, fontWeight: '800' },

  // Categories (Smaller)
  catsRow: { paddingHorizontal: 14, gap: 8 },
  catCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    width: 60,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  catCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.orange,
    borderWidth: 1.5,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  catIconWrapActive: {
    backgroundColor: Colors.orange,
  },
  catLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  catLabelActive: { color: Colors.black, fontWeight: '900' },
  catIndicator: {
    position: 'absolute',
    bottom: 2.5,
    width: 10,
    height: 2,
    backgroundColor: Colors.orange,
    borderRadius: 1,
  },

  // Featured cards
  featuredRow: { paddingHorizontal: 14, gap: 10, paddingBottom: 6 },
  featCard: {
    width: 215,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    paddingBottom: 12,
  },
  featCardImg: {
    height: 105,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  featPlanBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  featPlanText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  verifiedBadgeAbsolute: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  verifiedTextAbsolute: { fontSize: 9, fontWeight: '800', color: '#10B981' },

  floatingLogoContainer: {
    position: 'absolute',
    top: 72,
    left: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  floatingLogoImg: { width: '100%', height: '100%', borderRadius: 24 },
  floatingLogoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },

  featCardInfo: { paddingHorizontal: 12, paddingTop: 24 },
  featCardName: { fontSize: 13.5, fontWeight: '900', color: Colors.black, marginBottom: 2, letterSpacing: -0.2 },
  featCardCity: { fontSize: 10.5, color: Colors.textSecondary, fontWeight: '500' },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginBottom: 8 },
  ratingScore: { fontSize: 11, fontWeight: '800', color: Colors.black },
  ratingCount: { fontSize: 10, color: Colors.textMuted },

  featCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 6 },
  featCardPrice: { fontSize: 14, fontWeight: '900', color: Colors.orange },
  featCardUnit: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  featCardBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 2 },
  featCardBtnText: { color: Colors.white, fontWeight: '800', fontSize: 11 },

  // Smart Budget Matcher Card
  sectionPad: { paddingHorizontal: 14, paddingTop: 14 },
  matcherCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  matcherHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  matcherHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  matcherHeaderTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: -0.3 },
  matcherHeaderSub: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  
  helpToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  helpToggleText: { fontSize: 12, fontWeight: '800', color: '#9A3412' },

  matcherInstructionBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  matcherInstructionText: { fontSize: 11.5, color: '#9A3412', lineHeight: 17, fontWeight: '500' },

  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  currencyPrefix: { fontSize: 14, color: Colors.textMuted, fontWeight: '700' },
  inputField: { flex: 1, fontSize: 13.5, color: Colors.black, fontWeight: '600' },
  perGuestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  perGuestLabel: { fontSize: 12.5, color: '#9A3412', fontWeight: '700' },
  perGuestValue: { fontSize: 18, fontWeight: '900', color: Colors.orange },
  matcherBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.black,
    borderRadius: 12,
    paddingVertical: 12,
  },
  matcherBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13.5 },

  // List cards
  listPad: { paddingHorizontal: 14, gap: 10 },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    height: 105,
  },
  listCardImg: {
    width: 90,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  listPlanTag: { position: 'absolute', bottom: 5, left: 5, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  listPlanTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  listCardBody: { flex: 1, padding: 10, justifyContent: 'space-between' },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardName: { fontSize: 13, fontWeight: '900', color: Colors.black, flex: 1, marginRight: 6, letterSpacing: -0.2 },
  listCardPrice: { fontSize: 14, fontWeight: '900', color: Colors.orange },
  listCardPricePer: { fontSize: 9, fontWeight: '600', color: Colors.textMuted },
  listCardMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 1 },
  listCardMetaText: { fontSize: 10.5, color: Colors.textSecondary, fontWeight: '500' },
  listCardDesc: { fontSize: 10.5, color: Colors.textMuted, lineHeight: 15, marginTop: 4 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 14 },
  emptyIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // How it works
  howGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, paddingBottom: 6 },
  howItem: {
    width: (width - 38) / 2,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  howIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  howStep: { fontSize: 9, color: Colors.orange, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  howTitle: { fontSize: 12.5, fontWeight: '900', color: Colors.black, marginBottom: 3, textAlign: 'center' },
  howDesc: { fontSize: 10.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 15, fontWeight: '500' },
});