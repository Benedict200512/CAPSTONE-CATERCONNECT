import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// ── Lucide Icons ──
import {
  ChevronLeft, ChevronRight, MapPin, Star, UtensilsCrossed,
  Soup, Cake, Wine, Package, Utensils, CheckCircle2,
  Phone, Mail, Scale, SearchX, Store, 
  MessageSquareText, StarIcon
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

type Caterer = {
  id: string;
  business_name: string;
  business_description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  city: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  downpayment_percent: number;
  subscription_plan: string;
  avg_rating: number | null;
  review_count: number | null;
  verification_status: string;
};

type Package = {
  id: string;
  name: string;
  tier: string;
  description: string | null;
  price: number;
  guest_capacity: number;
  includes: string[] | null;
  food_inclusions: string[] | null;
  event_types: string[] | null;
  image_url: string | null;
};

type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price_per_guest: number;
  serving_size: number | null;
  serving_unit: string | null;
};

type Review = {
  id: string;
  food_quality: number;
  service_quality: number;
  timeliness: number;
  overall: number;
  comment: string | null;
  caterer_reply: string | null;
  created_at: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  bronze:  { color: '#B45309', bg: '#FEF3C7', label: 'Bronze'  },
  silver:  { color: '#4B5563', bg: '#F3F4F6', label: 'Silver'  },
  gold:    { color: '#D97706', bg: '#FEF08A', label: 'Gold'    },
  premium: { color: '#6D28D9', bg: '#EDE9FE', label: 'Premium' },
};

const PLAN_CONFIG: Record<string, { color: string; bg: string }> = {
  premium:  { color: '#6D28D9', bg: '#EDE9FE' },
  standard: { color: '#D97706', bg: '#FEF3C7' },
  basic:    { color: '#1D4ED8', bg: '#DBEAFE' },
  free:     { color: '#4B5563', bg: '#F3F4F6' },
};

const CATEGORY_CONFIG: Record<string, { icon: any; color: string }> = {
  main_course: { icon: UtensilsCrossed, color: Colors.orange },
  appetizer:   { icon: Soup,  color: '#10B981' },
  dessert:     { icon: Cake,    color: '#EC4899' },
  drink:       { icon: Wine,      color: '#3B82F6' },
};
const CATEGORY_ORDER = ['main_course', 'appetizer', 'dessert', 'drink'];

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          color={i <= Math.round(value) ? '#F59E0B' : '#E5E7EB'}
          fill={i <= Math.round(value) ? '#F59E0B' : 'transparent'}
        />
      ))}
    </View>
  );
}

export default function CatererDetailScreen() {
  const { catererId } = useLocalSearchParams<{ catererId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [caterer, setCaterer]     = useState<Caterer | null>(null);
  const [packages, setPackages]   = useState<Package[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews]     = useState<Review[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'packages' | 'menu' | 'reviews'>('packages');

  useEffect(() => {
    const load = async () => {
      const [catererRes, packagesRes, menuRes, reviewsRes] = await Promise.all([
        supabase
          .from('caterers')
          .select('id, business_name, business_description, logo_url, cover_photo_url, city, address, contact_phone, contact_email, downpayment_percent, subscription_plan, avg_rating, review_count, verification_status')
          .eq('id', catererId)
          .single(),
        supabase
          .from('packages')
          .select('*')
          .eq('caterer_id', catererId)
          .order('price', { ascending: true }),
        supabase
          .from('menu_items')
          .select('*')
          .eq('caterer_id', catererId)
          .order('category'),
        supabase
          .from('reviews')
          .select('*, profiles(full_name, avatar_url)')
          .eq('caterer_id', catererId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (catererRes.data) setCaterer(catererRes.data as any);
      if (packagesRes.data) setPackages(packagesRes.data as any);
      if (menuRes.data) setMenuItems(menuRes.data);
      if (reviewsRes.data) setReviews(reviewsRes.data as any);
      setLoading(false);
    };

    if (catererId) load();
  }, [catererId]);

  const handleBookPackage = (pkg: Package) => {
    if (!session) {
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/(tabs)/book/[catererId]',
      params: { catererId: catererId!, preSelectedPackageId: pkg.id },
    });
  };

  const handleBookNow = () => {
    if (!session) {
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/(tabs)/book/[catererId]',
      params: { catererId: catererId! },
    });
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  if (!caterer) {
    return (
      <View style={s.center}>
        <View style={s.emptyIconWrap}>
          <SearchX size={36} color={Colors.textMuted} />
        </View>
        <Text style={s.emptyTitle}>Caterer not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <ChevronLeft size={18} color={Colors.white} />
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const planCfg = PLAN_CONFIG[caterer.subscription_plan] ?? PLAN_CONFIG.free;
  const lowestPrice = packages.length > 0
    ? Math.min(...packages.map(p => p.price / p.guest_capacity))
    : null;

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

        {/* ── COVER PHOTO ── */}
        <View style={s.coverWrap}>
          {caterer.cover_photo_url ? (
            <Image source={{ uri: caterer.cover_photo_url }} style={s.coverPhoto} resizeMode="cover" />
          ) : (
            <View style={s.coverPlaceholder}>
              <Store size={48} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.4)']}
            style={s.coverGradient}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[s.backFloatBtn, { top: Platform.OS === 'ios' ? 56 : 40 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ChevronLeft size={20} color={Colors.white} />
          </TouchableOpacity>

          {/* Plan badge */}
          <View style={[s.planBadge, { backgroundColor: planCfg.bg }]}>
            <Text style={[s.planBadgeText, { color: planCfg.color }]}>
              {caterer.subscription_plan.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── CATERER INFO HEADER ── */}
        <View style={s.infoHeader}>
          {/* Logo overlapping cover */}
          <View style={s.logoWrap}>
            {caterer.logo_url ? (
              <Image source={{ uri: caterer.logo_url }} style={s.logo} />
            ) : (
              <View style={s.logoPlaceholder}>
                <Text style={s.logoInitial}>{caterer.business_name.charAt(0)}</Text>
              </View>
            )}
          </View>

          <View style={s.infoBody}>
            {/* Name + verified */}
            <View style={s.nameRow}>
              <Text style={s.businessName} numberOfLines={2}>{caterer.business_name}</Text>
              {caterer.verification_status === 'approved' && (
                <View style={s.verifiedBadge}>
                  <CheckCircle2 size={12} color="#16A34A" />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            {/* City */}
            {caterer.city && (
              <View style={s.locationRow}>
                <MapPin size={14} color={Colors.textSecondary} />
                <Text style={s.locationText}>{caterer.city}</Text>
              </View>
            )}

            {/* Rating */}
            {caterer.review_count && caterer.review_count > 0 ? (
              <View style={s.ratingRow}>
                <StarRating value={caterer.avg_rating ?? 0} size={16} />
                <Text style={s.ratingNum}>{(caterer.avg_rating ?? 0).toFixed(1)}</Text>
                <Text style={s.ratingCount}>({caterer.review_count} reviews)</Text>
              </View>
            ) : (
              <Text style={s.noRating}>No reviews yet</Text>
            )}
          </View>
        </View>

        {/* ── QUICK STATS ── */}
        <View style={s.quickStats}>
          <View style={s.quickStat}>
            <Text style={s.quickStatNum}>{packages.length}</Text>
            <Text style={s.quickStatLabel}>Packages</Text>
          </View>
          <View style={s.quickStatDivider} />
          <View style={s.quickStat}>
            <Text style={s.quickStatNum}>{menuItems.length}</Text>
            <Text style={s.quickStatLabel}>Menu Items</Text>
          </View>
          <View style={s.quickStatDivider} />
          <View style={s.quickStat}>
            <Text style={s.quickStatNum}>{caterer.downpayment_percent}%</Text>
            <Text style={s.quickStatLabel}>Downpayment</Text>
          </View>
        </View>

        {/* ── DESCRIPTION ── */}
        {caterer.business_description && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.descText}>{caterer.business_description}</Text>
          </View>
        )}

        {/* ── CONTACT INFO ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact & Location</Text>
          <View style={s.contactCard}>
            {caterer.contact_phone && (
              <View style={s.contactRow}>
                <View style={[s.contactIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Phone size={18} color="#2563EB" />
                </View>
                <Text style={s.contactText}>{caterer.contact_phone}</Text>
              </View>
            )}
            {caterer.contact_email && (
              <View style={s.contactRow}>
                <View style={[s.contactIconWrap, { backgroundColor: '#F3F4F6' }]}>
                  <Mail size={18} color={Colors.textSecondary} />
                </View>
                <Text style={s.contactText}>{caterer.contact_email}</Text>
              </View>
            )}
            {caterer.address && (
              <View style={[s.contactRow, { borderBottomWidth: 0 }]}>
                <View style={[s.contactIconWrap, { backgroundColor: Colors.orangeLight }]}>
                  <MapPin size={18} color={Colors.orange} />
                </View>
                <Text style={s.contactText}>{caterer.address}</Text>
              </View>
            )}
            {!caterer.contact_phone && !caterer.contact_email && !caterer.address && (
              <Text style={s.noContact}>No contact info provided yet.</Text>
            )}
          </View>
        </View>

        {/* ── TABS ── */}
        <View style={s.tabContainer}>
          <View style={s.tabRow}>
            {(['packages', 'menu', 'reviews'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && s.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                  {tab === 'packages' ? `Packages`
                    : tab === 'menu' ? `Menu`
                    : `Reviews`}
                </Text>
                <View style={[s.tabCountBadge, activeTab === tab && s.tabCountBadgeActive]}>
                  <Text style={[s.tabCountText, activeTab === tab && s.tabCountTextActive]}>
                    {tab === 'packages' ? packages.length
                      : tab === 'menu' ? menuItems.length
                      : reviews.length}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── PACKAGES TAB ── */}
        {activeTab === 'packages' && (
          <View style={s.tabContent}>
            {packages.length === 0 ? (
              <View style={s.emptyTab}>
                <View style={s.emptyTabIconWrap}>
                  <Package size={32} color={Colors.textMuted} />
                </View>
                <Text style={s.emptyTabText}>No packages available</Text>
              </View>
            ) : (
              packages.map(pkg => {
                const tier = TIER_CONFIG[pkg.tier] ?? TIER_CONFIG.bronze;
                const pricePerGuest = pkg.guest_capacity > 0 ? pkg.price / pkg.guest_capacity : 0;
                return (
                  <View key={pkg.id} style={s.pkgCard}>
                    {pkg.image_url ? (
                      <Image source={{ uri: pkg.image_url }} style={s.pkgImg} resizeMode="cover" />
                    ) : (
                      <View style={[s.pkgImgPlaceholder, { backgroundColor: tier.bg }]}>
                        <Utensils size={40} color={tier.color} opacity={0.5} />
                      </View>
                    )}

                    <View style={s.pkgBody}>
                      <View style={[s.tierBadge, { backgroundColor: tier.bg }]}>
                        <Text style={[s.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                      </View>
                      
                      <View style={s.pkgPriceRow}>
                        <View style={{ flex: 1 }}>
                           <Text style={s.pkgName}>{pkg.name}</Text>
                           <Text style={s.pkgPriceSub}>For {pkg.guest_capacity} guests</Text>
                        </View>
                        <View style={s.pkgPerGuest}>
                          <Text style={s.pkgPrice}>₱{pkg.price.toLocaleString()}</Text>
                          <Text style={s.pkgPerGuestLabel}>≈ ₱{pricePerGuest.toFixed(0)} / pax</Text>
                        </View>
                      </View>

                      {pkg.description && (
                        <Text style={s.pkgDesc}>{pkg.description}</Text>
                      )}

                      {/* ── FOOD INCLUSIONS ── */}
                      {pkg.food_inclusions && pkg.food_inclusions.length > 0 && (
                        <View style={s.includesWrap}>
                          <Text style={s.includesTitle}>FOOD INCLUSIONS</Text>
                          {pkg.food_inclusions.map((food, i) => (
                            <View key={i} style={s.includeRow}>
                              <UtensilsCrossed size={16} color={Colors.orange} />
                              <Text style={s.includeText}>{food}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* ── PACKAGE / SERVICE INCLUSIONS ── */}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <View style={s.includesWrap}>
                          <Text style={s.includesTitle}>PACKAGE INCLUSIONS</Text>
                          {pkg.includes.map((inc, i) => (
                            <View key={i} style={s.includeRow}>
                              <CheckCircle2 size={16} color={Colors.success} />
                              <Text style={s.includeText}>{inc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Event types */}
                      {pkg.event_types && pkg.event_types.length > 0 && (
                        <View style={s.eventTypesWrap}>
                          <Text style={s.includesTitle}>SUITABLE FOR</Text>
                          <View style={s.eventTypesRow}>
                            {pkg.event_types.map(et => (
                              <View key={et} style={s.eventTypeChip}>
                                <Text style={s.eventTypeText}>{et}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={s.bookPkgBtn}
                        onPress={() => handleBookPackage(pkg)}
                        activeOpacity={0.85}
                      >
                        <Text style={s.bookPkgBtnText}>Book This Package</Text>
                        <ChevronRight size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── MENU TAB ── */}
        {activeTab === 'menu' && (
          <View style={s.tabContent}>
            {menuItems.length === 0 ? (
              <View style={s.emptyTab}>
                <View style={s.emptyTabIconWrap}>
                  <Utensils size={32} color={Colors.textMuted} />
                </View>
                <Text style={s.emptyTabText}>No menu items added yet</Text>
              </View>
            ) : (
              CATEGORY_ORDER.map(cat => {
                const items = menuItems.filter(m => m.category === cat);
                if (items.length === 0) return null;
                const catCfg = CATEGORY_CONFIG[cat];
                const Icon = catCfg.icon;
                return (
                  <View key={cat} style={{ marginBottom: 16 }}>
                    <View style={s.menuCatHeader}>
                      <Icon size={20} color={catCfg.color} />
                      <Text style={s.menuCatLabel}>
                        {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <View style={s.menuCatCountBadge}>
                         <Text style={s.menuCatCount}>{items.length}</Text>
                      </View>
                    </View>
                    {items.map(item => {
                      const itemCfg = CATEGORY_CONFIG[item.category];
                      const ItemIcon = itemCfg.icon;
                      return (
                        <View key={item.id} style={s.menuItemCard}>
                          <View style={[s.menuItemIconWrap, { backgroundColor: itemCfg.color + '15' }]}>
                            <ItemIcon size={24} color={itemCfg.color} />
                          </View>
                          <View style={s.menuItemInfo}>
                            <View style={s.menuItemHeader}>
                              <Text style={s.menuItemName} numberOfLines={1}>{item.name}</Text>
                              <Text style={s.menuItemPrice}>₱{item.price_per_guest}</Text>
                            </View>
                            {item.description && (
                              <Text style={s.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                            )}
                            <View style={s.menuItemMeta}>
                              <Text style={s.menuItemPerGuest}>per guest</Text>
                              {(item.serving_size || item.serving_unit) && (
                                <View style={s.servingBadge}>
                                  <Scale size={12} color={Colors.textSecondary} />
                                  <Text style={s.servingText}>
                                    {item.serving_size ? `${item.serving_size} ` : ''}{item.serving_unit}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === 'reviews' && (
          <View style={s.tabContent}>
            {caterer.review_count && caterer.review_count > 0 ? (
              <View style={s.reviewSummaryCard}>
                <Text style={s.reviewSummaryNum}>{(caterer.avg_rating ?? 0).toFixed(1)}</Text>
                <View>
                  <StarRating value={caterer.avg_rating ?? 0} size={20} />
                  <Text style={s.reviewSummaryCount}>Based on {caterer.review_count} reviews</Text>
                </View>
              </View>
            ) : null}

            {reviews.length === 0 ? (
              <View style={s.emptyTab}>
                <View style={s.emptyTabIconWrap}>
                  <StarIcon size={32} color={Colors.textMuted} />
                </View>
                <Text style={s.emptyTabText}>No reviews yet</Text>
                <Text style={s.emptyTabSub}>Be the first to leave a review after your event!</Text>
              </View>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={s.reviewCard}>
                  <View style={s.reviewerRow}>
                    {(r.profiles as any)?.avatar_url ? (
                      <Image source={{ uri: (r.profiles as any).avatar_url }} style={s.reviewerAvatar} />
                    ) : (
                      <View style={s.reviewerAvatarPlaceholder}>
                        <Text style={s.reviewerAvatarText}>
                          {((r.profiles as any)?.full_name ?? 'C').charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.reviewerName}>{(r.profiles as any)?.full_name ?? 'Customer'}</Text>
                      <Text style={s.reviewDate}>
                        {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={s.reviewOverallBadge}>
                      <Star size={12} color="#F59E0B" fill="#F59E0B" />
                      <Text style={s.reviewOverallNum}>{r.overall.toFixed(1)}</Text>
                    </View>
                  </View>

                  <View style={s.reviewRatingsRow}>
                    {[
                      { label: 'Food',    val: r.food_quality  },
                      { label: 'Service',  val: r.service_quality },
                      { label: 'Time',    val: r.timeliness    },
                    ].map(cat => (
                      <View key={cat.label} style={s.reviewRatingItem}>
                        <Text style={s.reviewRatingLabel}>{cat.label}</Text>
                        <StarRating value={cat.val} size={10} />
                      </View>
                    ))}
                  </View>

                  {r.comment && (
                    <Text style={s.reviewComment}>"{r.comment}"</Text>
                  )}

                  {r.caterer_reply && (
                    <View style={s.catererReply}>
                      <View style={s.catererReplyHeader}>
                        <MessageSquareText size={14} color="#2563EB" />
                        <Text style={s.catererReplyLabel}>Response from Caterer</Text>
                      </View>
                      <Text style={s.catererReplyText}>{r.caterer_reply}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── BOTTOM BOOK NOW BAR ── */}
      <View style={s.bottomBar}>
        <View style={s.bottomBarLeft}>
          {lowestPrice !== null ? (
            <>
              <Text style={s.bottomBarFrom}>Packages from</Text>
              <Text style={s.bottomBarPrice}>₱{lowestPrice.toFixed(0)}<Text style={s.bottomBarPer}> / guest</Text></Text>
            </>
          ) : (
            <Text style={s.bottomBarFrom}>Contact for pricing</Text>
          )}
        </View>
        <TouchableOpacity style={s.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
          <Text style={s.bookNowText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', gap: 12 },

  // Cover
  coverWrap:        { height: 260, position: 'relative' },
  coverPhoto:       { width: '100%', height: 260 },
  coverPlaceholder: { width: '100%', height: 260, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
  coverGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  backFloatBtn: {
    position: 'absolute', left: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  planBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: 20,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  planBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Info header
  infoHeader: {
    backgroundColor: Colors.white, paddingHorizontal: 20,
    paddingBottom: 24, paddingTop: 0,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03, shadowRadius: 16, elevation: 6,
    zIndex: 10,
  },
  logoWrap: {
    marginTop: -44, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 4,
  },
  logo: {
    width: 80, height: 80, borderRadius: 20,
  },
  logoPlaceholder: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitial:  { color: Colors.white, fontSize: 32, fontWeight: '900' },
  infoBody:     { },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  businessName: { fontSize: 26, fontWeight: '900', color: Colors.black, letterSpacing: -0.5, flexShrink: 1 },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  locationText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingNum:    { fontSize: 16, fontWeight: '900', color: Colors.black },
  ratingCount:  { fontSize: 14, color: Colors.textMuted },
  noRating:     { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },

  // Quick stats
  quickStats: {
    flexDirection: 'row', backgroundColor: Colors.white,
    marginHorizontal: 20, marginTop: 20, borderRadius: 20,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 2,
  },
  quickStat:       { flex: 1, alignItems: 'center', paddingVertical: 16 },
  quickStatNum:    { fontSize: 20, fontWeight: '900', color: Colors.orange, marginBottom: 4 },
  quickStatLabel:  { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  quickStatDivider:{ width: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  // Description & General Section
  section:       { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 12, letterSpacing: -0.3 },
  descText:     { fontSize: 15, color: Colors.textSecondary, lineHeight: 24, fontWeight: '400' },

  // Contact
  contactCard:  { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  contactRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  contactIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  contactText:  { fontSize: 15, color: Colors.black, fontWeight: '600', flex: 1 },
  noContact:    { fontSize: 14, color: Colors.textMuted, padding: 20, textAlign: 'center' },

  // Tabs Container
  tabContainer: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 16,
    padding: 4, 
  },
  tab:         { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive:   { backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive:{ fontSize: 13, fontWeight: '800', color: Colors.black },
  tabCountBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabCountBadgeActive: { backgroundColor: Colors.orangeLight },
  tabCountText: { fontSize: 10, fontWeight: '800', color: Colors.textMuted },
  tabCountTextActive: { color: Colors.orange },

  tabContent: { paddingHorizontal: 20, paddingTop: 8 },

  // Packages
  pkgCard: {
    backgroundColor: Colors.white, borderRadius: 24,
    borderWidth: 1, borderColor: '#F3F4F6',
    marginBottom: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04, shadowRadius: 16, elevation: 4,
  },
  pkgImg:            { width: '100%', height: 180 },
  pkgImgPlaceholder: { width: '100%', height: 160, justifyContent: 'center', alignItems: 'center' },
  pkgBody:           { padding: 20 },
  tierBadge:         { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  tierBadgeText:     { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  pkgPriceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 12,
  },
  pkgName:           { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 4, letterSpacing: -0.3 },
  pkgPriceSub:       { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  pkgPerGuest:       { alignItems: 'flex-end', backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  pkgPrice:          { fontSize: 18, fontWeight: '900', color: Colors.orange },
  pkgPerGuestLabel:  { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  pkgDesc:           { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  
  includesWrap:     { marginBottom: 16 },
  includesTitle:    { fontSize: 11, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 12 },
  includeRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  includeText:      { fontSize: 14, color: Colors.black, flex: 1, fontWeight: '500' },
  
  eventTypesWrap:   { marginBottom: 20 },
  eventTypesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  eventTypeChip:    { backgroundColor: Colors.orangeLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FFB26B' },
  eventTypeText:    { fontSize: 12, fontWeight: '800', color: Colors.orange },
  
  bookPkgBtn: {
    backgroundColor: Colors.black, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  bookPkgBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },

  // Menu List
  menuCatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    marginBottom: 8,
  },
  menuCatLabel: { fontSize: 18, fontWeight: '900', color: Colors.black, flex: 1 },
  menuCatCountBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  menuCatCount: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  menuItemCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
  },
  menuItemIconWrap: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  menuItemInfo:  { flex: 1 },
  menuItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  menuItemName:  { fontSize: 16, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  menuItemPrice: { fontSize: 15, fontWeight: '900', color: Colors.orange },
  menuItemDesc:  { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  menuItemMeta:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuItemPerGuest: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  servingBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  servingText:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Reviews
  reviewSummaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: '#FFF7ED', borderRadius: 20,
    padding: 24, marginBottom: 20,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  reviewSummaryNum:   { fontSize: 56, fontWeight: '900', color: Colors.orange, letterSpacing: -1 },
  reviewSummaryCount: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
  reviewCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: '#F3F4F6',
    padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02, shadowRadius: 10, elevation: 1,
  },
  reviewerRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  reviewerAvatar:        { width: 48, height: 48, borderRadius: 24 },
  reviewerAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  reviewerAvatarText:    { fontSize: 18, fontWeight: '900', color: Colors.orange },
  reviewerName:          { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  reviewDate:            { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  reviewOverallBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FED7AA' },
  reviewOverallNum:      { fontSize: 14, fontWeight: '900', color: Colors.orange },
  reviewRatingsRow:      { flexDirection: 'row', gap: 20, marginBottom: 12, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  reviewRatingItem:      { gap: 6 },
  reviewRatingLabel:     { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  reviewComment:         { fontSize: 14, color: Colors.black, lineHeight: 22, fontStyle: 'italic', marginBottom: 12 },
  catererReply: {
    backgroundColor: '#EFF6FF', borderRadius: 16,
    padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  catererReplyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  catererReplyLabel: { fontSize: 12, fontWeight: '900', color: '#1D4ED8' },
  catererReplyText:  { fontSize: 14, color: '#1E3A8A', lineHeight: 22 },

  // Empty states
  emptyTab:    { alignItems: 'center', paddingVertical: 60 },
  emptyTabIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTabText:{ fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptyTabSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: '900', color: Colors.black },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.black, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, marginTop: 12 },
  backBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05, shadowRadius: 20, elevation: 16,
  },
  bottomBarLeft:  { },
  bottomBarFrom:  { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  bottomBarPrice: { fontSize: 24, fontWeight: '900', color: Colors.black },
  bottomBarPer:   { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  bookNowBtn: {
    backgroundColor: Colors.orange, borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  bookNowText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});