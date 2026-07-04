import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Modal, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { sendNotification } from '../../../lib/notifications';

const { width } = Dimensions.get('window');

const ICONS = {
  arrowLeft: require('../../../assets/icons/arrow_left.png'),
  medal: require('../../../assets/icons/medal.png'),
  checkOutline: require('../../../assets/icons/check_outline.png'),
  package: require('../../../assets/icons/package.png'),
  plate: require('../../../assets/icons/plate.png'),
  mainCourse: require('../../../assets/icons/main_course.png'),
  appetizer: require('../../../assets/icons/appetizer.png'),
  dessert: require('../../../assets/icons/dessert.png'),
  drink: require('../../../assets/icons/drink.png'),
  scale: require('../../../assets/icons/scale.png'),
  pin: require('../../../assets/icons/pin.png'),
  clipboard: require('../../../assets/icons/clipboard.png'),
  sparkles: require('../../../assets/icons/sparkles.png'),
  card: require('../../../assets/icons/card.png'),
  info: require('../../../assets/icons/info.png'),
  confetti: require('../../../assets/icons/confetti.png'),
  searchEmpty: require('../../../assets/icons/search_empty.png'),
};

type Package = {
  id: string; name: string; tier: string; description: string | null;
  price: number; guest_capacity: number; image_url: string | null;
  includes: string[]; event_types: string[];
  menu_items?: MenuItem[];
};

type MenuItem = {
  id: string; name: string; category: string;
  description: string | null; price_per_guest: number; image_url: string | null;
};

type Caterer = {
  id: string; business_name: string; business_description: string | null;
  logo_url: string | null; cover_photo_url: string | null;
  city: string | null; contact_phone: string | null;
  downpayment_percent: number;
};

type CustomItem = { menuItem: MenuItem; quantity: number };

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  bronze:  { color: '#B45309', bg: '#FEF3C7', label: 'Bronze'  },
  silver:  { color: '#6B7280', bg: '#F3F4F6', label: 'Silver'  },
  gold:    { color: '#D97706', bg: '#FFFBEB', label: 'Gold'    },
  premium: { color: '#7C3AED', bg: '#F5F3FF', label: 'Premium' },
};

const EVENT_TYPES = ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Anniversary', 'Party', 'Other'];

const CATEGORY_CONFIG: Record<string, { icon: any; color: string }> = {
  main_course: { icon: ICONS.mainCourse, color: Colors.orange },
  appetizer:   { icon: ICONS.appetizer,  color: '#16A34A' },
  dessert:     { icon: ICONS.dessert,    color: '#EC4899' },
  drink:       { icon: ICONS.drink,      color: '#2563EB' },
};

const categoryOrder = ['main_course', 'appetizer', 'dessert', 'drink'];

function StepBar({ step, total }: { step: number; total: number }) {
  const steps = ['Package', 'Details', 'Customize', 'Review'];
  return (
    <View style={sb.wrap}>
      {steps.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <View key={label} style={sb.stepWrap}>
            <View style={[sb.circle, active && sb.circleActive, done && sb.circleDone]}>
              {done ? (
                <Image source={ICONS.checkOutline} style={[sb.circleCheckIcon, { tintColor: Colors.white }]} />
              ) : (
                <Text style={[sb.circleText, active && sb.circleTextActive]}>{String(i + 1)}</Text>
              )}
            </View>
            <Text style={[sb.label, active && sb.labelActive]}>{label}</Text>
            {i < steps.length - 1 && (
              <View style={[sb.line, done && sb.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  circle: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bgInput, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  circleActive: { borderColor: Colors.orange, backgroundColor: Colors.orange },
  circleDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  circleText: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  circleTextActive: { color: Colors.white },
  circleCheckIcon: { width: 14, height: 14 },
  label: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  labelActive: { color: Colors.orange, fontWeight: '800' },
  line: { position: 'absolute', top: 15, left: '50%', right: '-50%', height: 2, backgroundColor: Colors.border, zIndex: -1 },
  lineDone: { backgroundColor: Colors.success },
});

export default function BookingWizard() {
  const { catererId, preSelectedPackageId } = useLocalSearchParams<{
    catererId: string;
    preSelectedPackageId?: string;
  }>();
  const { session, profile } = useAuth();
  const router = useRouter();

  const [caterer, setCaterer]         = useState<Caterer | null>(null);
  const [packages, setPackages]       = useState<Package[]>([]);
  const [menuItems, setMenuItems]     = useState<MenuItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [step, setStep]               = useState(0);

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  const [eventDate, setEventDate]     = useState('');
  const [guestCount, setGuestCount]   = useState('');
  const [eventType, setEventType]     = useState('');
  const [venue, setVenue]             = useState('');
  const [specialReqs, setSpecialReqs] = useState('');

  const [customItems, setCustomItems] = useState<CustomItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [catererRes, packagesRes, menuRes] = await Promise.all([
        supabase.from('caterers')
          .select('id, business_name, business_description, logo_url, cover_photo_url, city, contact_phone, downpayment_percent')
          .eq('id', catererId)
          .single(),
        supabase.from('packages')
          .select('*, package_menu_items(menu_items(*))')
          .eq('caterer_id', catererId)
          .order('price', { ascending: true }),
        supabase.from('menu_items')
          .select('*')
          .eq('caterer_id', catererId)
          .order('category'),
      ]);

      if (catererRes.data) setCaterer(catererRes.data);
      if (packagesRes.data) setPackages(packagesRes.data as any);
      if (menuRes.data) setMenuItems(menuRes.data);
      setLoading(false);
    };
    if (catererId) load();
  }, [catererId]);

  useEffect(() => {
    if (preSelectedPackageId && packages.length > 0) {
      const pkg = packages.find(p => p.id === preSelectedPackageId);
      if (pkg) {
        setSelectedPkg(pkg);
        setStep(1); // skip straight to event details
      }
    }
  }, [packages, preSelectedPackageId]);

  const guests = parseInt(guestCount) || 0;

  const customizationTotal = useMemo(() =>
    customItems.reduce((sum, c) => sum + c.menuItem.price_per_guest * guests * c.quantity, 0),
    [customItems, guests]
  );

  const baseTotal = selectedPkg ? selectedPkg.price * Math.ceil(guests / selectedPkg.guest_capacity) : 0;
  const totalCost = baseTotal + customizationTotal;
  const downpayment = caterer ? totalCost * (caterer.downpayment_percent / 100) : 0;

  const addItem = (item: MenuItem) => {
    setCustomItems(prev => {
      const exists = prev.find(c => c.menuItem.id === item.id);
      if (exists) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setCustomItems(prev => {
      const exists = prev.find(c => c.menuItem.id === itemId);
      if (!exists) return prev;
      if (exists.quantity <= 1) return prev.filter(c => c.menuItem.id !== itemId);
      return prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const getQty = (itemId: string) =>
    customItems.find(c => c.menuItem.id === itemId)?.quantity ?? 0;

  const validateStep = (): boolean => {
    if (step === 0 && !selectedPkg) {
      Alert.alert('Select a Package', 'Please choose a catering package to continue.'); return false;
    }
    if (step === 1) {
      if (!eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.'); return false;
      }
      if (guests <= 0) {
        Alert.alert('Guest Count', 'Please enter a valid number of guests.'); return false;
      }
      if (!eventType) {
        Alert.alert('Event Type', 'Please select an event type.'); return false;
      }
      if (!venue.trim()) {
        Alert.alert('Venue Required', 'Please enter the event venue.'); return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!session?.user?.id || !selectedPkg || !caterer) return;

    setSubmitting(true);
    try {
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: booking, error } = await supabase.from('bookings').insert({
        customer_id: session.user.id,
        caterer_id: caterer.id,
        package_id: selectedPkg.id,
        event_date: eventDate,
        guest_count: guests,
        total_cost: totalCost,
        downpayment_amount: downpayment,
        downpayment_deadline: deadline,
        status: 'pending',
        event_type: eventType,
        venue: venue.trim(),
        special_requests: specialReqs.trim() || null,
        customized_items: customItems.length > 0 ? customItems.map(c => ({
          menu_item_id: c.menuItem.id,
          name: c.menuItem.name,
          quantity: c.quantity,
          price_per_guest: c.menuItem.price_per_guest,
        })) : null,
      }).select('id').single();

      if (error) throw error;

      if (customItems.length > 0 && booking) {
        await supabase.from('booking_customizations').insert(
          customItems.map(c => ({
            booking_id: booking.id,
            menu_item_id: c.menuItem.id,
            quantity: c.quantity,
            price_per_guest: c.menuItem.price_per_guest,
            is_added: true,
          }))
        );
      }

      const { data: catererProfile } = await supabase
        .from('caterers').select('user_id').eq('id', caterer.id).single();
      if (catererProfile?.user_id) {
        await sendNotification({
          user_id: catererProfile.user_id,
          title: 'New Booking Request',
          message: `${profile?.full_name ?? 'A customer'} has requested a booking for ${eventType} on ${eventDate}.`,
          type: 'new_booking_request',
          booking_id: booking?.id,
        });
      }

      Alert.alert('Booking Submitted!',
        `Your booking request for ${caterer.business_name} has been sent. They will confirm within 24 hours.`,
        [{ text: 'View Bookings', onPress: () => router.push('/(tabs)/bookings') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Loading caterer info...</Text>
      </View>
    );
  }

  if (!caterer) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Image source={ICONS.searchEmpty} style={styles.emptyIconImg} />
        </View>
        <Text style={styles.emptyTitle}>Caterer not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Image source={ICONS.arrowLeft} style={[styles.iconBackBtnSm, { tintColor: Colors.white }]} />
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 52 : 36 }]}>
        <TouchableOpacity onPress={() => step === 0 ? router.back() : prevStep()} style={styles.headerBack}>
          <Image source={ICONS.arrowLeft} style={[styles.iconHeaderBack, { tintColor: Colors.black }]} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          {caterer.logo_url ? (
            <Image source={{ uri: caterer.logo_url }} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogoPlaceholder}>
              <Text style={styles.headerLogoText}>{caterer.business_name.charAt(0)}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{caterer.business_name}</Text>
            <Text style={styles.headerSub}>{caterer.city ?? 'Cebu'}</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <StepBar step={step} total={4} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {step === 0 && (
          <View style={styles.stepPad}>
            <Text style={styles.stepHeading}>Choose a Package</Text>
            <Text style={styles.stepSub}>Select the catering package that fits your event</Text>

            {packages.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrapSm}>
                  <Image source={ICONS.package} style={[styles.emptyIconImgSm, { tintColor: Colors.border }]} />
                </View>
                <Text style={styles.emptyTitle}>No packages yet</Text>
                <Text style={styles.emptySub}>This caterer hasn't set up packages yet.</Text>
              </View>
            ) : (
              packages.map(pkg => {
                const tier = TIER_CONFIG[pkg.tier] ?? TIER_CONFIG.bronze;
                const isSelected = selectedPkg?.id === pkg.id;
                const pricePerGuest = pkg.guest_capacity > 0 ? pkg.price / pkg.guest_capacity : 0;

                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.pkgCard, isSelected && styles.pkgCardSelected]}
                    onPress={() => setSelectedPkg(pkg)}
                    activeOpacity={0.85}
                  >
                    {pkg.image_url ? (
                      <Image source={{ uri: pkg.image_url }} style={styles.pkgImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.pkgImagePlaceholder, { backgroundColor: tier.bg }]}>
                        <Image source={ICONS.plate} style={[styles.pkgImagePlaceholderIcon, { tintColor: tier.color }]} />
                      </View>
                    )}

                    <View style={styles.pkgBody}>
                      <View style={styles.pkgTitleRow}>
                        <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
                          <Image source={ICONS.medal} style={[styles.iconTierMedal, { tintColor: tier.color }]} />
                          <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Image source={ICONS.checkOutline} style={[styles.iconSelectedBadge, { tintColor: Colors.white }]} />
                            <Text style={styles.selectedBadgeText}>Selected</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.pkgName}>{pkg.name}</Text>
                      {pkg.description && (
                        <Text style={styles.pkgDesc}>{pkg.description}</Text>
                      )}

                      <View style={styles.pkgPricing}>
                        <View>
                          <Text style={styles.pkgPrice}>₱{pkg.price.toLocaleString()}</Text>
                          <Text style={styles.pkgPriceSub}>per {pkg.guest_capacity} guests</Text>
                        </View>
                        <View style={styles.pkgPricePerGuest}>
                          <Text style={styles.pkgPricePerGuestNum}>₱{pricePerGuest.toFixed(0)}</Text>
                          <Text style={styles.pkgPricePerGuestLabel}>/guest</Text>
                        </View>
                      </View>

                      {pkg.includes && pkg.includes.length > 0 && (
                        <View style={styles.includesWrap}>
                          <Text style={styles.includesLabel}>WHAT'S INCLUDED</Text>
                          {pkg.includes.map((inc, i) => (
                            <View key={i} style={styles.includeRow}>
                              <Image source={ICONS.checkOutline} style={[styles.iconIncludeCheck, { tintColor: Colors.success }]} />
                              <Text style={styles.includeText}>{inc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {(pkg as any).package_menu_items?.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.includesLabel}>INCLUDED MENU ITEMS</Text>
                          <View style={styles.menuItemsChips}>
                            {(pkg as any).package_menu_items.slice(0, 10).map((pmi: any) => {
                              const catCfg = CATEGORY_CONFIG[pmi.menu_items?.category] ?? CATEGORY_CONFIG.main_course;
                              return (
                                <View key={pmi.menu_items?.id} style={styles.menuItemChip}>
                                  <Image source={catCfg.icon} style={[styles.iconMenuItemChip, { tintColor: catCfg.color }]} />
                                  <Text style={styles.menuItemChipText}>{pmi.menu_items?.name}</Text>
                                </View>
                              );
                            })}
                            {(pkg as any).package_menu_items.length > 10 && (
                              <View style={styles.menuItemChip}>
                                <Text style={styles.menuItemChipText}>+{(pkg as any).package_menu_items.length - 10} more</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.selectPkgBtn, isSelected && styles.selectPkgBtnSelected]}
                        onPress={() => setSelectedPkg(pkg)}
                      >
                        {isSelected && (
                          <Image source={ICONS.checkOutline} style={[styles.iconSelectPkgBtn, { tintColor: Colors.white }]} />
                        )}
                        <Text style={[styles.selectPkgBtnText, isSelected && styles.selectPkgBtnTextSelected]}>
                          {isSelected ? 'Selected' : 'Select Package'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepPad}>
            <Text style={styles.stepHeading}>Event Details</Text>
            <Text style={styles.stepSub}>Tell the caterer about your event</Text>

            {selectedPkg && (
              <View style={styles.selectedPkgSummary}>
                <View style={[styles.tierBadge, { backgroundColor: TIER_CONFIG[selectedPkg.tier]?.bg }]}>
                  <Image source={ICONS.medal} style={[styles.iconTierMedal, { tintColor: TIER_CONFIG[selectedPkg.tier]?.color }]} />
                  <Text style={[styles.tierBadgeText, { color: TIER_CONFIG[selectedPkg.tier]?.color }]}>
                    {TIER_CONFIG[selectedPkg.tier]?.label}
                  </Text>
                </View>
                <Text style={styles.selectedPkgName}>{selectedPkg.name}</Text>
                <Text style={styles.selectedPkgPrice}>₱{selectedPkg.price.toLocaleString()} / {selectedPkg.guest_capacity} guests</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Date *</Text>
              <Text style={styles.fieldHint}>Format: YYYY-MM-DD (e.g. 2026-12-25)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="2026-12-25"
                placeholderTextColor={Colors.textMuted}
                value={eventDate}
                onChangeText={setEventDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Number of Guests *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 100"
                placeholderTextColor={Colors.textMuted}
                value={guestCount}
                onChangeText={setGuestCount}
                keyboardType="number-pad"
              />
              {selectedPkg && guests > 0 && (
                <View style={styles.guestCalc}>
                  <View style={styles.guestCalcTextRow}>
                    <Image source={ICONS.package} style={[styles.iconGuestCalc, { tintColor: '#92400E' }]} />
                    <Text style={styles.guestCalcText}>
                      {Math.ceil(guests / selectedPkg.guest_capacity)} × {selectedPkg.name} needed
                    </Text>
                  </View>
                  <Text style={styles.guestCalcPrice}>₱{(selectedPkg.price * Math.ceil(guests / selectedPkg.guest_capacity)).toLocaleString()}</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Type *</Text>
              <View style={styles.eventTypeGrid}>
                {EVENT_TYPES.map(et => (
                  <TouchableOpacity
                    key={et}
                    style={[styles.eventTypeChip, eventType === et && styles.eventTypeChipActive]}
                    onPress={() => setEventType(et)}
                  >
                    <Text style={[styles.eventTypeText, eventType === et && styles.eventTypeTextActive]}>{et}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Venue *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Cebu Grand Ballroom, Mactan"
                placeholderTextColor={Colors.textMuted}
                value={venue}
                onChangeText={setVenue}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Special Requests (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea]}
                placeholder="Any allergies, dietary restrictions, special setup needs..."
                placeholderTextColor={Colors.textMuted}
                value={specialReqs}
                onChangeText={setSpecialReqs}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepPad}>
            <Text style={styles.stepHeading}>Customize Your Menu</Text>
            <Text style={styles.stepSub}>Add extra dishes to your package (optional)</Text>

            {menuItems.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrapSm}>
                  <Image source={ICONS.plate} style={[styles.emptyIconImgSm, { tintColor: Colors.border }]} />
                </View>
                <Text style={styles.emptyTitle}>No menu items</Text>
                <Text style={styles.emptySub}>This caterer hasn't added menu items yet.</Text>
              </View>
            ) : (
              <>
                {customItems.length > 0 && (
                  <View style={styles.customTotal}>
                    <Text style={styles.customTotalLabel}>Customization Add-ons</Text>
                    <Text style={styles.customTotalValue}>+₱{customizationTotal.toLocaleString()}</Text>
                  </View>
                )}

                {categoryOrder.map(cat => {
                  const items = menuItems.filter(m => m.category === cat);
                  if (items.length === 0) return null;
                  const catCfg = CATEGORY_CONFIG[cat];
                  return (
                    <View key={cat}>
                      <View style={styles.catHeader}>
                        <Image source={catCfg.icon} style={[styles.iconCatHeader, { tintColor: catCfg.color }]} />
                        <Text style={styles.catLabel}>
                          {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                      {items.map(item => {
                        const qty = getQty(item.id);
                        const itemCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.main_course;
                        return (
                          <View key={item.id} style={styles.menuItemCard}>
                            {item.image_url ? (
                              <Image source={{ uri: item.image_url }} style={styles.menuItemImg} resizeMode="cover" />
                            ) : (
                              <View style={[styles.menuItemImgPlaceholder, { backgroundColor: itemCfg.color + '15' }]}>
                                <Image source={itemCfg.icon} style={[styles.iconMenuItemImg, { tintColor: itemCfg.color }]} />
                              </View>
                            )}
                            <View style={styles.menuItemInfo}>
                              <Text style={styles.menuItemName}>{item.name}</Text>
                              {item.description && (
                                <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                              )}
                              <Text style={styles.menuItemPrice}>
                                ₱{item.price_per_guest.toFixed(0)}/guest
                                {guests > 0 && (
                                  <Text style={styles.menuItemTotal}>
                                    {' '}· ₱{(item.price_per_guest * guests).toLocaleString()} total
                                  </Text>
                                )}
                              </Text>
                              {/* Serving size */}
                              {((item as any).serving_size || (item as any).serving_unit) ? (
                                <View style={styles.menuItemServing}>
                                  <Image source={ICONS.scale} style={[styles.iconServingSm, { tintColor: Colors.textSecondary }]} />
                                  <Text style={styles.menuItemServingText}>
                                    {(item as any).serving_size ? `${(item as any).serving_size} ` : ''}
                                    {(item as any).serving_unit}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.qtyControl}>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                                <Text style={styles.qtyBtnText}>−</Text>
                              </TouchableOpacity>
                              <Text style={styles.qtyNum}>{qty}</Text>
                              <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={() => addItem(item)}>
                                <Text style={[styles.qtyBtnText, styles.qtyBtnAddText]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {step === 3 && selectedPkg && (
          <View style={styles.stepPad}>
            <Text style={styles.stepHeading}>Review & Confirm</Text>
            <Text style={styles.stepSub}>Please review your booking details before submitting</Text>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <Image source={ICONS.plate} style={styles.iconReviewSectionTitle} />
                <Text style={styles.reviewSectionTitle}>Caterer</Text>
              </View>
              <View style={styles.reviewCatererCard}>
                {caterer.logo_url ? (
                  <Image source={{ uri: caterer.logo_url }} style={styles.reviewLogo} />
                ) : (
                  <View style={styles.reviewLogoPlaceholder}>
                    <Text style={{ color: Colors.white, fontSize: 20, fontWeight: '900' }}>{caterer.business_name.charAt(0)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewCatererName}>{caterer.business_name}</Text>
                  <View style={styles.reviewCatererCityRow}>
                    <Image source={ICONS.pin} style={styles.iconReviewPin} />
                    <Text style={styles.reviewCatererCity}>{caterer.city ?? 'Cebu'}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <Image source={ICONS.package} style={styles.iconReviewSectionTitle} />
                <Text style={styles.reviewSectionTitle}>Package</Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={[styles.tierBadge, { backgroundColor: TIER_CONFIG[selectedPkg.tier]?.bg, marginBottom: 8 }]}>
                  <Image source={ICONS.medal} style={[styles.iconTierMedal, { tintColor: TIER_CONFIG[selectedPkg.tier]?.color }]} />
                  <Text style={[styles.tierBadgeText, { color: TIER_CONFIG[selectedPkg.tier]?.color }]}>
                    {TIER_CONFIG[selectedPkg.tier]?.label}
                  </Text>
                </View>
                <Text style={styles.reviewPkgName}>{selectedPkg.name}</Text>
                {selectedPkg.description && <Text style={styles.reviewPkgDesc}>{selectedPkg.description}</Text>}
              </View>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <Image source={ICONS.clipboard} style={styles.iconReviewSectionTitle} />
                <Text style={styles.reviewSectionTitle}>Event Details</Text>
              </View>
              <View style={styles.reviewCard}>
                {[
                  { label: 'Date',       value: eventDate },
                  { label: 'Guests',     value: `${guests} guests` },
                  { label: 'Event Type', value: eventType },
                  { label: 'Venue',      value: venue },
                  ...(specialReqs ? [{ label: 'Special Requests', value: specialReqs }] : []),
                ].map(row => (
                  <View key={row.label} style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>{row.label}</Text>
                    <Text style={styles.reviewRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {customItems.length > 0 && (
              <View style={styles.reviewSection}>
                <View style={styles.reviewSectionTitleRow}>
                  <Image source={ICONS.sparkles} style={styles.iconReviewSectionTitle} />
                  <Text style={styles.reviewSectionTitle}>Add-ons</Text>
                </View>
                <View style={styles.reviewCard}>
                  {customItems.map(c => {
                    const itemCfg = CATEGORY_CONFIG[c.menuItem.category] ?? CATEGORY_CONFIG.main_course;
                    return (
                      <View key={c.menuItem.id} style={styles.reviewRow}>
                        <View style={styles.reviewAddonLabelRow}>
                          <Image source={itemCfg.icon} style={[styles.iconReviewAddon, { tintColor: itemCfg.color }]} />
                          <Text style={styles.reviewRowLabel}>{c.menuItem.name} ×{c.quantity}</Text>
                        </View>
                        <Text style={styles.reviewRowValue}>
                          +₱{(c.menuItem.price_per_guest * guests * c.quantity).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <Image source={ICONS.card} style={styles.iconReviewSectionTitle} />
                <Text style={styles.reviewSectionTitle}>Cost Breakdown</Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewRowLabel}>Package cost</Text>
                  <Text style={styles.reviewRowValue}>₱{baseTotal.toLocaleString()}</Text>
                </View>
                {customizationTotal > 0 && (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Add-ons</Text>
                    <Text style={styles.reviewRowValue}>+₱{customizationTotal.toLocaleString()}</Text>
                  </View>
                )}
                <View style={[styles.reviewRow, styles.reviewRowDivider]} />
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewTotalLabel}>TOTAL</Text>
                  <Text style={styles.reviewTotalValue}>₱{totalCost.toLocaleString()}</Text>
                </View>
                <View style={[styles.downpaymentBanner]}>
                  <View>
                    <Text style={styles.downpaymentLabel}>Downpayment Required ({caterer.downpayment_percent}%)</Text>
                    <Text style={styles.downpaymentNote}>Deadline: 48 hours after caterer confirms</Text>
                  </View>
                  <Text style={styles.downpaymentAmount}>₱{downpayment.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.noteBox}>
              <Image source={ICONS.info} style={styles.iconNote} />
              <Text style={styles.noteText}>
                By submitting, you agree to the caterer's terms. The caterer has 24 hours to confirm or reject this request.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.prevBtn} onPress={prevStep}>
            <Image source={ICONS.arrowLeft} style={[styles.iconPrevBtn, { tintColor: Colors.textSecondary }]} />
            <Text style={styles.prevBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < 3 ? (
          <TouchableOpacity style={[styles.nextBtn, step === 0 && { flex: 1 }]} onPress={nextStep}>
            <Text style={styles.nextBtnText}>
              {step === 0 ? 'Continue to Details' :
               step === 1 ? 'Continue to Menu' :
               'Review Booking'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <View style={styles.submitBtnRow}>
                <Image source={ICONS.confetti} style={[styles.iconSubmitBtn, { tintColor: Colors.white }]} />
                <Text style={styles.submitBtnText}>Submit Booking Request</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  scroll: { flex: 1 },
  stepPad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: Colors.white, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  headerBack: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18, backgroundColor: Colors.bgInput },
  iconHeaderBack: { width: 16, height: 16 },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  headerLogoPlaceholder: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  headerLogoText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.black },
  headerSub: { fontSize: 11, color: Colors.textSecondary },

  stepHeading: { fontSize: 22, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  stepSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  pkgCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1.5, borderColor: Colors.border,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  pkgCardSelected: { borderColor: Colors.orange, borderWidth: 2.5 },
  pkgImage: { width: '100%', height: 160 },
  pkgImagePlaceholder: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center' },
  pkgImagePlaceholderIcon: { width: 44, height: 44 },
  pkgBody: { padding: 16 },
  pkgTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  iconTierMedal: { width: 13, height: 13 },
  tierBadgeText: { fontSize: 12, fontWeight: '800' },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.orange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  iconSelectedBadge: { width: 11, height: 11 },
  selectedBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  pkgName: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  pkgDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  pkgPricing: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.divider },
  pkgPrice: { fontSize: 24, fontWeight: '900', color: Colors.orange },
  pkgPriceSub: { fontSize: 12, color: Colors.textSecondary },
  pkgPricePerGuest: { alignItems: 'flex-end' },
  pkgPricePerGuestNum: { fontSize: 18, fontWeight: '900', color: Colors.black },
  pkgPricePerGuestLabel: { fontSize: 11, color: Colors.textSecondary },
  includesWrap: { marginBottom: 14 },
  includesLabel: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  iconIncludeCheck: { width: 14, height: 14 },
  includeText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  menuItemsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  menuItemChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bgInput, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  iconMenuItemChip: { width: 11, height: 11 },
  menuItemChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  selectPkgBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, backgroundColor: Colors.bgInput, borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, marginTop: 8 },
  selectPkgBtnSelected: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  iconSelectPkgBtn: { width: 14, height: 14 },
  selectPkgBtnText: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  selectPkgBtnTextSelected: { color: Colors.white },

  selectedPkgSummary: { backgroundColor: Colors.orangeLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFB26B' },
  selectedPkgName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginTop: 6 },
  selectedPkgPrice: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  fieldInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.black,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  fieldTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 13 },
  guestCalc: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.orangeLight, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#FFB26B' },
  guestCalcTextRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  iconGuestCalc: { width: 13, height: 13 },
  guestCalcText: { fontSize: 13, color: '#92400E', fontWeight: '600', flex: 1 },
  guestCalcPrice: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  eventTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  eventTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  eventTypeChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  eventTypeText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  eventTypeTextActive: { color: Colors.white, fontWeight: '800' },

  customTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.orangeLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFB26B' },
  customTotalLabel: { fontSize: 13, color: '#92400E', fontWeight: '700' },
  customTotalValue: { fontSize: 18, fontWeight: '900', color: Colors.orange },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 },
  iconCatHeader: { width: 19, height: 19 },
  catLabel: { fontSize: 14, fontWeight: '900', color: Colors.black },
  menuItemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuItemImg: { width: 60, height: 60, borderRadius: 10 },
  menuItemImgPlaceholder: { width: 60, height: 60, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  iconMenuItemImg: { width: 28, height: 28 },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 3 },
  menuItemDesc: { fontSize: 11, color: Colors.textMuted, lineHeight: 16, marginBottom: 4 },
  menuItemPrice: { fontSize: 13, fontWeight: '700', color: Colors.orange },
  menuItemTotal: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  menuItemServing: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgInput, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconServingSm: { width: 11, height: 11 },
  menuItemServingText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary, lineHeight: 22 },
  qtyBtnAdd: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  qtyBtnAddText: { color: Colors.white },
  qtyNum: { fontSize: 16, fontWeight: '900', color: Colors.black, minWidth: 20, textAlign: 'center' },

  reviewSection: { marginBottom: 18 },
  reviewSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  iconReviewSectionTitle: { width: 16, height: 16, tintColor: Colors.black },
  reviewSectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, letterSpacing: 0.3 },
  reviewCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewCatererCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  reviewLogo: { width: 48, height: 48, borderRadius: 12 },
  reviewLogoPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  reviewCatererName: { fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  reviewCatererCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconReviewPin: { width: 11, height: 11, tintColor: Colors.textSecondary },
  reviewCatererCity: { fontSize: 12, color: Colors.textSecondary },
  reviewPkgName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  reviewPkgDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  reviewRowDivider: { borderBottomWidth: 0, paddingVertical: 4 },
  reviewRowLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  reviewRowValue: { fontSize: 13, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'right' },
  reviewAddonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  iconReviewAddon: { width: 14, height: 14 },
  reviewTotalLabel: { fontSize: 14, fontWeight: '900', color: Colors.black, flex: 1 },
  reviewTotalValue: { fontSize: 20, fontWeight: '900', color: Colors.orange, flex: 1, textAlign: 'right' },
  downpaymentBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.orangeLight, borderRadius: 12, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  downpaymentLabel: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 3 },
  downpaymentNote: { fontSize: 11, color: '#B45309' },
  downpaymentAmount: { fontSize: 22, fontWeight: '900', color: Colors.orange },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  iconNote: { width: 16, height: 16, marginTop: 1 },
  noteText: { fontSize: 12, color: '#1E40AF', lineHeight: 18, flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrapSm: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyIconImgSm: { width: 32, height: 32 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyIconImg: { width: 40, height: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  iconBackBtnSm: { width: 14, height: 14 },
  backBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border },
  iconPrevBtn: { width: 13, height: 13 },
  prevBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  nextBtn: { flex: 1, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
  submitBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconSubmitBtn: { width: 16, height: 16 },
  submitBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
});