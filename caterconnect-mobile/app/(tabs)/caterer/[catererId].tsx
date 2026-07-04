import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';

const { width } = Dimensions.get('window');

// ── Custom icon set (PNG) — replaces all emoji glyphs. ──────────
const ICONS = {
  arrowLeft: require('../../../assets/icons/arrow_left.png'),
  arrowRightWhite: require('../../../assets/icons/arrow_right_white.png'),
  pin: require('../../../assets/icons/pin.png'),
  star: require('../../../assets/icons/star.png'),
  starOutline: require('../../../assets/icons/star_outline.png'),
  mainCourse: require('../../../assets/icons/main_course.png'),
  appetizer: require('../../../assets/icons/appetizer.png'),
  dessert: require('../../../assets/icons/dessert.png'),
  drink: require('../../../assets/icons/drink.png'),
  package: require('../../../assets/icons/package.png'),
  plate: require('../../../assets/icons/plate.png'),
  checkOutline: require('../../../assets/icons/check_outline.png'),
  phone: require('../../../assets/icons/phone.png'),
  envelope: require('../../../assets/icons/envelope.png'),
  scale: require('../../../assets/icons/scale.png'),
  searchEmpty: require('../../../assets/icons/search_empty.png'),
};

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
  silver:  { color: '#6B7280', bg: '#F3F4F6', label: 'Silver'  },
  gold:    { color: '#D97706', bg: '#FFFBEB', label: 'Gold'    },
  premium: { color: '#7C3AED', bg: '#F5F3FF', label: 'Premium' },
};

const PLAN_CONFIG: Record<string, { color: string; bg: string }> = {
  premium:  { color: '#7C3AED', bg: '#F5F3FF' },
  standard: { color: '#D97706', bg: '#FEF3C7' },
  basic:    { color: '#2563EB', bg: '#DBEAFE' },
  free:     { color: '#6B7280', bg: '#F3F4F6' },
};

const CATEGORY_CONFIG: Record<string, { icon: any; color: string }> = {
  main_course: { icon: ICONS.mainCourse, color: Colors.orange },
  appetizer:   { icon: ICONS.appetizer,  color: '#16A34A' },
  dessert:     { icon: ICONS.dessert,    color: '#EC4899' },
  drink:       { icon: ICONS.drink,      color: '#2563EB' },
};
const CATEGORY_ORDER = ['main_course', 'appetizer', 'dessert', 'drink'];

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Image
          key={i}
          source={i <= Math.round(value) ? ICONS.star : ICONS.starOutline}
          style={{ width: size, height: size }}
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
        // ── Updated: now also fetches linked menu items via package_menu_items ──
        supabase
          .from('packages')
          .select('*, package_menu_items(menu_items(*))')
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
      if (packagesRes.data) setPackages(packagesRes.data);
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
          <Image source={ICONS.searchEmpty} style={s.emptyIconImg} />
        </View>
        <Text style={s.emptyTitle}>Caterer not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Image source={ICONS.arrowLeft} style={[s.iconBackBtnSm, { tintColor: Colors.white }]} />
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── COVER PHOTO ── */}
        <View style={s.coverWrap}>
          {caterer.cover_photo_url ? (
            <Image source={{ uri: caterer.cover_photo_url }} style={s.coverPhoto} resizeMode="cover" />
          ) : (
            <View style={s.coverPlaceholder} />
          )}

          {/* Back button */}
          <TouchableOpacity
            style={[s.backFloatBtn, { top: Platform.OS === 'ios' ? 52 : 36 }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Image source={ICONS.arrowLeft} style={[s.iconBackFloat, { tintColor: Colors.white }]} />
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
                  <Image source={ICONS.checkOutline} style={[s.iconVerifiedSm, { tintColor: '#166534' }]} />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            {/* City */}
            {caterer.city && (
              <View style={s.locationRow}>
                <Image source={ICONS.pin} style={[s.iconLocationPin, { tintColor: Colors.textSecondary }]} />
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

            {/* Price range */}
            {lowestPrice !== null && (
              <Text style={s.priceRange}>
                Starting from <Text style={s.priceRangeNum}>₱{lowestPrice.toFixed(0)}/guest</Text>
              </Text>
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
          <View style={s.quickStatDivider} />
          <View style={s.quickStat}>
            <Text style={s.quickStatNum}>{caterer.review_count ?? 0}</Text>
            <Text style={s.quickStatLabel}>Reviews</Text>
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
                <View style={[s.contactIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Image source={ICONS.phone} style={[s.contactIcon, { tintColor: '#2563EB' }]} />
                </View>
                <Text style={s.contactText}>{caterer.contact_phone}</Text>
              </View>
            )}
            {caterer.contact_email && (
              <View style={s.contactRow}>
                <View style={[s.contactIconWrap, { backgroundColor: '#F3F4F6' }]}>
                  <Image source={ICONS.envelope} style={[s.contactIcon, { tintColor: Colors.textSecondary }]} />
                </View>
                <Text style={s.contactText}>{caterer.contact_email}</Text>
              </View>
            )}
            {caterer.address && (
              <View style={s.contactRow}>
                <View style={[s.contactIconWrap, { backgroundColor: Colors.orangeLight }]}>
                  <Image source={ICONS.pin} style={[s.contactIcon, { tintColor: Colors.orange }]} />
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
        <View style={s.tabRow}>
          {(['packages', 'menu', 'reviews'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.85}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'packages' ? `Packages (${packages.length})`
                  : tab === 'menu' ? `Menu (${menuItems.length})`
                  : `Reviews (${reviews.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── PACKAGES TAB ── */}
        {activeTab === 'packages' && (
          <View style={s.tabContent}>
            {packages.length === 0 ? (
              <View style={s.emptyTab}>
                <View style={s.emptyTabIconWrap}>
                  <Image source={ICONS.package} style={[s.emptyTabIconImg, { tintColor: Colors.border }]} />
                </View>
                <Text style={s.emptyTabText}>No packages available yet</Text>
              </View>
            ) : (
              packages.map(pkg => {
                const tier = TIER_CONFIG[pkg.tier] ?? TIER_CONFIG.bronze;
                const pricePerGuest = pkg.guest_capacity > 0 ? pkg.price / pkg.guest_capacity : 0;
                return (
                  <View key={pkg.id} style={s.pkgCard}>
                    {/* Package image */}
                    {pkg.image_url ? (
                      <Image source={{ uri: pkg.image_url }} style={s.pkgImg} resizeMode="cover" />
                    ) : (
                      <View style={[s.pkgImgPlaceholder, { backgroundColor: tier.bg }]}>
                        <Image source={ICONS.plate} style={[s.pkgImgIcon, { tintColor: tier.color }]} />
                      </View>
                    )}

                    <View style={s.pkgBody}>
                      {/* Tier badge + name */}
                      <View style={[s.tierBadge, { backgroundColor: tier.bg }]}>
                        <Text style={[s.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                      </View>
                      <Text style={s.pkgName}>{pkg.name}</Text>
                      {pkg.description && (
                        <Text style={s.pkgDesc}>{pkg.description}</Text>
                      )}

                      {/* Pricing */}
                      <View style={s.pkgPriceRow}>
                        <View>
                          <Text style={s.pkgPrice}>₱{pkg.price.toLocaleString()}</Text>
                          <Text style={s.pkgPriceSub}>for {pkg.guest_capacity} guests</Text>
                        </View>
                        <View style={s.pkgPerGuest}>
                          <Text style={s.pkgPerGuestNum}>₱{pricePerGuest.toFixed(0)}</Text>
                          <Text style={s.pkgPerGuestLabel}>/guest</Text>
                        </View>
                      </View>

                      {/* Includes */}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <View style={s.includesWrap}>
                          <Text style={s.includesTitle}>WHAT'S INCLUDED</Text>
                          {pkg.includes.map((inc, i) => (
                            <View key={i} style={s.includeRow}>
                              <Image source={ICONS.checkOutline} style={[s.iconIncludeCheck, { tintColor: Colors.success }]} />
                              <Text style={s.includeText}>{inc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* ── FOOD INCLUDED (from package_menu_items) ── */}
                      {(pkg as any).package_menu_items?.length > 0 && (
                        <View style={s.foodIncludedWrap}>
                          <Text style={s.includesTitle}>FOOD INCLUDED</Text>
                          {(() => {
                            const linked = (pkg as any).package_menu_items
                              .filter((pmi: any) => pmi.menu_items)
                              .map((pmi: any) => pmi.menu_items);

                            const byCat: Record<string, any[]> = {};
                            linked.forEach((item: any) => {
                              if (!byCat[item.category]) byCat[item.category] = [];
                              byCat[item.category].push(item);
                            });

                            return CATEGORY_ORDER.map(cat => {
                              const catItems = byCat[cat];
                              if (!catItems || catItems.length === 0) return null;
                              const catCfg = CATEGORY_CONFIG[cat];
                              return (
                                <View key={cat} style={s.foodCatGroup}>
                                  <View style={s.foodCatLabelRow}>
                                    <Image
                                      source={catCfg.icon}
                                      style={[s.foodCatIcon, { tintColor: catCfg.color }]}
                                    />
                                    <Text style={[s.foodCatLabel, { color: catCfg.color }]}>
                                      {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </Text>
                                  </View>
                                  {catItems.map((item: any) => (
                                    <View key={item.id} style={s.foodItemRow}>
                                      <View style={s.foodItemDot} />
                                      <View style={s.foodItemInfo}>
                                        <Text style={s.foodItemName}>{item.name}</Text>
                                        {(item.serving_size || item.serving_unit) && (
                                          <View style={s.foodServingBadge}>
                                            <Image
                                              source={ICONS.scale}
                                              style={[s.foodServingIcon, { tintColor: Colors.textMuted }]}
                                            />
                                            <Text style={s.foodServingText}>
                                              {item.serving_size ? `${item.serving_size} ` : ''}
                                              {item.serving_unit}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              );
                            });
                          })()}
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

                      {/* Book this package */}
                      <TouchableOpacity
                        style={s.bookPkgBtn}
                        onPress={() => handleBookPackage(pkg)}
                        activeOpacity={0.85}
                      >
                        <Text style={s.bookPkgBtnText}>Book This Package</Text>
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
                  <Image source={ICONS.plate} style={[s.emptyTabIconImg, { tintColor: Colors.border }]} />
                </View>
                <Text style={s.emptyTabText}>No menu items added yet</Text>
              </View>
            ) : (
              CATEGORY_ORDER.map(cat => {
                const items = menuItems.filter(m => m.category === cat);
                if (items.length === 0) return null;
                const catCfg = CATEGORY_CONFIG[cat];
                return (
                  <View key={cat}>
                    <View style={s.menuCatHeader}>
                      <Image source={catCfg.icon} style={[s.menuCatIcon, { tintColor: catCfg.color }]} />
                      <Text style={s.menuCatLabel}>
                        {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <Text style={s.menuCatCount}>{items.length} items</Text>
                    </View>
                    {items.map(item => {
                      const itemCfg = CATEGORY_CONFIG[item.category];
                      return (
                        <View key={item.id} style={s.menuItemCard}>
                          <View style={[s.menuItemIconWrap, { backgroundColor: itemCfg.color + '15' }]}>
                            <Image source={itemCfg.icon} style={[s.menuItemIcon, { tintColor: itemCfg.color }]} />
                          </View>
                          <View style={s.menuItemInfo}>
                            <Text style={s.menuItemName}>{item.name}</Text>
                            {item.description && (
                              <Text style={s.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                            )}
                            <View style={s.menuItemMeta}>
                              <Text style={s.menuItemPrice}>₱{item.price_per_guest}/guest</Text>
                              {(item.serving_size || item.serving_unit) && (
                                <View style={s.servingBadge}>
                                  <Image source={ICONS.scale} style={[s.iconServingBadge, { tintColor: Colors.textSecondary }]} />
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
            {/* Summary */}
            {caterer.review_count && caterer.review_count > 0 ? (
              <View style={s.reviewSummaryCard}>
                <Text style={s.reviewSummaryNum}>{(caterer.avg_rating ?? 0).toFixed(1)}</Text>
                <View>
                  <StarRating value={caterer.avg_rating ?? 0} size={22} />
                  <Text style={s.reviewSummaryCount}>{caterer.review_count} reviews</Text>
                </View>
              </View>
            ) : null}

            {reviews.length === 0 ? (
              <View style={s.emptyTab}>
                <View style={s.emptyTabIconWrap}>
                  <Image source={ICONS.starOutline} style={[s.emptyTabIconImg, { tintColor: Colors.border }]} />
                </View>
                <Text style={s.emptyTabText}>No reviews yet</Text>
                <Text style={s.emptyTabSub}>Be the first to leave a review after your event!</Text>
              </View>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={s.reviewCard}>
                  {/* Reviewer */}
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
                        {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={s.reviewOverallBadge}>
                      <Text style={s.reviewOverallNum}>{r.overall}</Text>
                      <Image source={ICONS.star} style={s.iconReviewOverall} />
                    </View>
                  </View>

                  {/* Category ratings */}
                  <View style={s.reviewRatingsRow}>
                    {[
                      { label: 'Food',     val: r.food_quality    },
                      { label: 'Service',  val: r.service_quality },
                      { label: 'Time',     val: r.timeliness      },
                    ].map(cat => (
                      <View key={cat.label} style={s.reviewRatingItem}>
                        <Text style={s.reviewRatingLabel}>{cat.label}</Text>
                        <StarRating value={cat.val} size={11} />
                      </View>
                    ))}
                  </View>

                  {/* Comment */}
                  {r.comment && (
                    <Text style={s.reviewComment}>{r.comment}</Text>
                  )}

                  {/* Caterer reply */}
                  {r.caterer_reply && (
                    <View style={s.catererReply}>
                      <Text style={s.catererReplyLabel}>Response from {caterer.business_name}</Text>
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
              <Text style={s.bottomBarFrom}>Starting from</Text>
              <Text style={s.bottomBarPrice}>₱{lowestPrice.toFixed(0)}<Text style={s.bottomBarPer}>/guest</Text></Text>
            </>
          ) : (
            <Text style={s.bottomBarFrom}>Contact for pricing</Text>
          )}
        </View>
        <TouchableOpacity style={s.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
          <Text style={s.bookNowText}>Book Now</Text>
          <Image source={ICONS.arrowRightWhite} style={[s.iconBookNow, { tintColor: Colors.white }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },

  // Cover
  coverWrap:        { height: 240, position: 'relative' },
  coverPhoto:       { width: '100%', height: 240 },
  coverPlaceholder: { width: '100%', height: 240, backgroundColor: '#1A1A1A' },
  backFloatBtn: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  iconBackFloat: { width: 17, height: 17 },
  planBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 36, right: 16,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  planBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // Info header
  infoHeader: {
    backgroundColor: Colors.white, paddingHorizontal: 20,
    paddingBottom: 20, paddingTop: 0,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  logoWrap: {
    marginTop: -36, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
    alignSelf: 'flex-start',
  },
  logo: {
    width: 72, height: 72, borderRadius: 18,
    borderWidth: 3, borderColor: Colors.white,
  },
  logoPlaceholder: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.white,
  },
  logoInitial:  { color: Colors.white, fontSize: 28, fontWeight: '900' },
  infoBody:     { },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  businessName: { fontSize: 22, fontWeight: '900', color: Colors.black, flex: 1 },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#86EFAC' },
  iconVerifiedSm: { width: 11, height: 11 },
  verifiedText: { fontSize: 11, fontWeight: '800', color: '#166534' },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  iconLocationPin: { width: 13, height: 13 },
  locationText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  ratingNum:    { fontSize: 15, fontWeight: '900', color: Colors.black },
  ratingCount:  { fontSize: 13, color: Colors.textSecondary },
  noRating:     { fontSize: 13, color: Colors.textMuted, marginBottom: 6 },
  priceRange:   { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  priceRangeNum:{ fontWeight: '900', color: Colors.orange },

  // Quick stats
  quickStats: {
    flexDirection: 'row', backgroundColor: Colors.white,
    marginHorizontal: 20, marginTop: 16, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  quickStat:       { flex: 1, alignItems: 'center', paddingVertical: 14 },
  quickStatNum:    { fontSize: 18, fontWeight: '900', color: Colors.orange, marginBottom: 2 },
  quickStatLabel:  { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  quickStatDivider:{ width: 1, backgroundColor: Colors.divider },

  // Description
  section:      { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: Colors.black, marginBottom: 10 },
  descText:     { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  // Contact
  contactCard:  { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  contactRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  contactIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contactIcon:  { width: 17, height: 17 },
  contactText:  { fontSize: 14, color: Colors.black, fontWeight: '600', flex: 1, lineHeight: 20 },
  noContact:    { fontSize: 13, color: Colors.textMuted, padding: 16, textAlign: 'center' },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 20,
    backgroundColor: Colors.bgInput, borderRadius: 12,
    padding: 4, borderWidth: 1, borderColor: Colors.border,
  },
  tab:         { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:   { backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:     { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive:{ fontSize: 12, fontWeight: '800', color: Colors.black },

  tabContent: { paddingHorizontal: 20, paddingTop: 16 },

  // Packages
  pkgCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  pkgImg:            { width: '100%', height: 160 },
  pkgImgPlaceholder: { width: '100%', height: 130, justifyContent: 'center', alignItems: 'center' },
  pkgImgIcon:        { width: 44, height: 44 },
  pkgBody:           { padding: 16 },
  tierBadge:         { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  tierBadgeText:     { fontSize: 12, fontWeight: '800' },
  pkgName:           { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  pkgDesc:           { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  pkgPriceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.divider, marginBottom: 14,
  },
  pkgPrice:         { fontSize: 24, fontWeight: '900', color: Colors.orange },
  pkgPriceSub:      { fontSize: 12, color: Colors.textSecondary },
  pkgPerGuest:      { alignItems: 'flex-end' },
  pkgPerGuestNum:   { fontSize: 18, fontWeight: '900', color: Colors.black },
  pkgPerGuestLabel: { fontSize: 11, color: Colors.textSecondary },
  includesWrap:     { marginBottom: 12 },
  includesTitle:    { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  includeRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  iconIncludeCheck: { width: 14, height: 14 },
  includeText:      { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  eventTypesWrap:   { marginBottom: 14 },
  eventTypesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  eventTypeChip:    { backgroundColor: Colors.orangeLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FFB26B' },
  eventTypeText:    { fontSize: 11, fontWeight: '700', color: Colors.orange },
  bookPkgBtn: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  bookPkgBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },

  // Food included (package_menu_items)
  foodIncludedWrap: {
    marginBottom: 14,
    backgroundColor: Colors.bgInput,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  foodCatGroup:    { marginBottom: 10 },
  foodCatLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  foodCatIcon:     { width: 15, height: 15 },
  foodCatLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  foodItemRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5, paddingLeft: 4 },
  foodItemDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.orange, marginTop: 6, flexShrink: 0 },
  foodItemInfo:    { flex: 1 },
  foodItemName:    { fontSize: 12, color: Colors.black, fontWeight: '600' },
  foodServingBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  foodServingIcon: { width: 10, height: 10 },
  foodServingText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },

  // Menu
  menuCatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider,
    marginBottom: 10,
  },
  menuCatIcon:  { width: 19, height: 19 },
  menuCatLabel: { fontSize: 15, fontWeight: '900', color: Colors.black, flex: 1 },
  menuCatCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  menuItemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuItemIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  menuItemIcon:  { width: 24, height: 24 },
  menuItemInfo:  { flex: 1 },
  menuItemName:  { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 3 },
  menuItemDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 17, marginBottom: 6 },
  menuItemMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  menuItemPrice: { fontSize: 13, fontWeight: '800', color: Colors.orange },
  servingBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bgInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  iconServingBadge: { width: 11, height: 11 },
  servingText:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Reviews
  reviewSummaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: Colors.orangeLight, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  reviewSummaryNum:   { fontSize: 52, fontWeight: '900', color: Colors.orange },
  reviewSummaryCount: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  reviewCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  reviewerRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  reviewerAvatar:        { width: 42, height: 42, borderRadius: 21 },
  reviewerAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  reviewerAvatarText:    { fontSize: 16, fontWeight: '900', color: Colors.orange },
  reviewerName:          { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  reviewDate:            { fontSize: 11, color: Colors.textMuted },
  reviewOverallBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.orangeLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  reviewOverallNum:      { fontSize: 16, fontWeight: '900', color: Colors.orange },
  iconReviewOverall:     { width: 13, height: 13 },
  reviewRatingsRow:      { flexDirection: 'row', gap: 16, marginBottom: 10 },
  reviewRatingItem:      { alignItems: 'center', gap: 4 },
  reviewRatingLabel:     { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  reviewComment:         { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic', marginBottom: 10 },
  catererReply: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  catererReplyLabel: { fontSize: 11, fontWeight: '800', color: '#1D4ED8', marginBottom: 4 },
  catererReplyText:  { fontSize: 13, color: '#1E40AF', lineHeight: 19 },

  // Empty states
  emptyTab:    { alignItems: 'center', paddingVertical: 48 },
  emptyTabIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTabIconImg: { width: 34, height: 34 },
  emptyTabText:{ fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  emptyTabSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyIconImg:  { width: 40, height: 40 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: Colors.black },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  iconBackBtnSm: { width: 14, height: 14 },
  backBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  bottomBarLeft:  { },
  bottomBarFrom:  { fontSize: 12, color: Colors.textSecondary },
  bottomBarPrice: { fontSize: 22, fontWeight: '900', color: Colors.black },
  bottomBarPer:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  bookNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  iconBookNow: { width: 14, height: 14 },
  bookNowText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
});