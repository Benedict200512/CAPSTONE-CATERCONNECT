import { useEffect, useState, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Dimensions, Modal, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { sendNotification } from '../../../lib/notifications';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';

// ── Lucide React Native Icons ──
import {
  ChevronLeft,
  Medal,
  Check,
  Package as PackageIcon,
  UtensilsCrossed,
  Soup,
  Cake,
  Wine,
  Scale,
  MapPin,
  ClipboardList,
  Sparkles,
  CreditCard,
  Info,
  PartyPopper,
  SearchX,
  CalendarDays,
  Clock,
  Plus,
  Minus,
  Navigation,
  X,
  CheckCircle2,
  Search,
  AlertTriangle
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

type Package = {
  id: string; name: string; tier: string; description: string | null;
  price: number; min_guests: number; guest_capacity: number; image_url: string | null;
  includes: string[] | null;
  food_inclusions: string[] | null;
  event_types: string[];
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
  silver:  { color: '#4B5563', bg: '#F3F4F6', label: 'Silver'  },
  gold:    { color: '#D97706', bg: '#FEF08A', label: 'Gold'    },
  premium: { color: '#6D28D9', bg: '#EDE9FE', label: 'Premium' },
};

const EVENT_TYPES = ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Anniversary', 'Party', 'Other'];

const CATEGORY_CONFIG: Record<string, { icon: any; color: string }> = {
  main_course: { icon: UtensilsCrossed, color: Colors.orange },
  appetizer:   { icon: Soup,  color: '#10B981' },
  dessert:     { icon: Cake,    color: '#EC4899' },
  drink:       { icon: Wine,      color: '#3B82F6' },
};

const categoryOrder = ['main_course', 'appetizer', 'dessert', 'drink'];

function StepBar({ step }: { step: number }) {
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
                <Check size={14} color={Colors.white} strokeWidth={3} />
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
  wrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.white },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  circle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  circleActive: { borderColor: Colors.orange, backgroundColor: Colors.orange },
  circleDone: { borderColor: '#10B981', backgroundColor: '#10B981' },
  circleText: { fontSize: 12, fontWeight: '800', color: '#9CA3AF' },
  circleTextActive: { color: Colors.white },
  label: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textAlign: 'center' },
  labelActive: { color: Colors.orange, fontWeight: '800' },
  line: { position: 'absolute', top: 16, left: '50%', right: '-50%', height: 2, backgroundColor: '#E5E7EB', zIndex: -1 },
  lineDone: { backgroundColor: '#10B981' },
});

export default function BookingWizard() {
  const { catererId, preSelectedPackageId } = useLocalSearchParams<{
    catererId: string;
    preSelectedPackageId?: string;
  }>();
  const { session, profile } = useAuth();
  const router = useRouter();

  const [caterer, setCaterer]        = useState<Caterer | null>(null);
  const [packages, setPackages]      = useState<Package[]>([]);
  const [menuItems, setMenuItems]    = useState<MenuItem[]>([]);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [loading, setLoading]        = useState(true);
  const [submitting, setSubmitting]  = useState(false);
  const [step, setStep]              = useState(0);

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  // Date & Time states
  const [eventDate, setEventDate]     = useState<Date>(new Date());
  const [eventTime, setEventTime]     = useState<Date>(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);

  const [guestCount, setGuestCount]   = useState('');
  const [eventType, setEventType]     = useState('');
  const [venue, setVenue]             = useState('');
  const [specialReqs, setSpecialReqs] = useState('');

  // Map & Search states
  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const mapRef = useRef<MapView>(null);
  
  const [selectedCoordinates, setSelectedCoordinates] = useState({
    latitude: 10.2081,
    longitude: 123.7547,
  });

  const [customItems, setCustomItems] = useState<CustomItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [catererRes, packagesRes, menuRes, bookingsRes] = await Promise.all([
        supabase.from('caterers')
          .select('id, business_name, business_description, logo_url, cover_photo_url, city, contact_phone, downpayment_percent')
          .eq('id', catererId)
          .single(),
        supabase.from('packages')
          .select('*')
          .eq('caterer_id', catererId)
          .order('price', { ascending: true }),
        supabase.from('menu_items')
          .select('*')
          .eq('caterer_id', catererId)
          .order('category'),
        supabase.from('bookings')
          .select('event_date')
          .eq('caterer_id', catererId)
          .in('status', ['confirmed', 'paid', 'ongoing']),
      ]);

      if (catererRes.data) setCaterer(catererRes.data);
      if (packagesRes.data) setPackages(packagesRes.data as any);
      if (menuRes.data) setMenuItems(menuRes.data);
      if (bookingsRes.data) {
        const normalizedDates = bookingsRes.data
          .map(b => b.event_date ? String(b.event_date).split('T')[0] : '')
          .filter(Boolean);
        setFullyBookedDates(normalizedDates);
      }
      setLoading(false);
    };
    if (catererId) load();
  }, [catererId]);

  useEffect(() => {
    if (preSelectedPackageId && packages.length > 0) {
      const pkg = packages.find(p => p.id === preSelectedPackageId);
      if (pkg) {
        setSelectedPkg(pkg);
        setStep(1);
      }
    }
  }, [packages, preSelectedPackageId]);

  const guests = parseInt(guestCount) || 0;

  const customizationTotal = useMemo(() =>
    customItems.reduce((sum, c) => sum + c.menuItem.price_per_guest * guests * c.quantity, 0),
    [customItems, guests]
  );

  const packageMultiplier = selectedPkg ? Math.ceil(guests / (selectedPkg.guest_capacity || 1)) : 0;
  const baseTotal = selectedPkg ? selectedPkg.price * packageMultiplier : 0;
  
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

  const formattedDateString = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
  const formattedTimeString = eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const validateStep = (): boolean => {
    if (step === 0 && !selectedPkg) {
      Alert.alert('Select a Package', 'Please choose a catering package to continue.'); return false;
    }
    if (step === 1) {
      if (!eventDate) {
        Alert.alert('Invalid Date', 'Please select a valid event date.'); return false;
      }
      if (fullyBookedDates.includes(formattedDateString)) {
        Alert.alert(
          'Date Unavailable',
          'Sorry, but this date is fully booked. Please select another day for your event.'
        );
        return false;
      }
      if (!eventTime) {
        Alert.alert('Invalid Time', 'Please select a valid event time.'); return false;
      }
      if (guests <= 0) {
        Alert.alert('Guest Count', 'Please enter a valid number of guests.'); return false;
      }
      if (!eventType) {
        Alert.alert('Event Type', 'Please select an event type.'); return false;
      }
      if (!venue.trim()) {
        Alert.alert('Venue Required', 'Please enter or pin your event venue location on the map.'); return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleConfirmDate = (date: Date) => {
    setEventDate(date);
    setDatePickerVisible(false);
  };

  const handleConfirmTime = (time: Date) => {
    setEventTime(time);
    setTimePickerVisible(false);
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    setSelectedCoordinates(coords);
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearchingLocation(true);
      Keyboard.dismiss();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to search addresses.');
        return;
      }

      const geocodedLocations = await Location.geocodeAsync(searchQuery);
      if (geocodedLocations && geocodedLocations.length > 0) {
        const { latitude, longitude } = geocodedLocations[0];
        const newCoords = { latitude, longitude };
        
        setSelectedCoordinates(newCoords);
        
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.0121,
        }, 1000);
      } else {
        Alert.alert('Location Not Found', 'Could not find coordinates for that place. Try typing a more specific landmark or barangay.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to search location: ' + error.message);
    } finally {
      setSearchingLocation(false);
    }
  };

  const confirmPinnedLocation = () => {
    const isEnanChiong = 
      Math.abs(selectedCoordinates.latitude - 10.2081) < 0.001 && 
      Math.abs(selectedCoordinates.longitude - 123.7547) < 0.001;

    const pinnedText = isEnanChiong 
      ? `Enan Chiong Activity Center, Naga City (${selectedCoordinates.latitude.toFixed(4)}, ${selectedCoordinates.longitude.toFixed(4)})`
      : searchQuery.trim() 
        ? `${searchQuery.trim()} (${selectedCoordinates.latitude.toFixed(4)}, ${selectedCoordinates.longitude.toFixed(4)})`
        : `Pinned Location (${selectedCoordinates.latitude.toFixed(4)}, ${selectedCoordinates.longitude.toFixed(4)})`;

    setVenue(pinnedText);
    setMapModalVisible(false);
  };

  const handleSubmit = async () => {
    if (!session?.user?.id || !selectedPkg || !caterer) return;

    setSubmitting(true);
    try {
      const { data: conflicting, error: checkError } = await supabase
        .from('bookings')
        .select('id')
        .eq('caterer_id', caterer.id)
        .eq('event_date', formattedDateString)
        .in('status', ['confirmed', 'paid', 'ongoing']);

      if (checkError) throw checkError;

      if (conflicting && conflicting.length > 0) {
        Alert.alert(
          'Date Fully Booked',
          'Sorry, but another client just booked this date. Please choose a different day.'
        );
        setSubmitting(false);
        return;
      }

      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: booking, error } = await supabase.from('bookings').insert({
        customer_id: session.user.id,
        caterer_id: caterer.id,
        package_id: selectedPkg.id,
        event_date: formattedDateString,
        event_time: formattedTimeString,
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
          message: `${profile?.full_name ?? 'A customer'} has requested a booking for ${eventType} on ${formattedDateString} at ${formattedTimeString}.`,
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
          <SearchX size={40} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>Caterer not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <ChevronLeft size={16} color={Colors.white} />
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCurrentDateBooked = fullyBookedDates.includes(formattedDateString);
  const isGuestBelowMinimum = Boolean(selectedPkg && guests > 0 && guests < (selectedPkg?.min_guests ?? 0));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 52 : 36 }]}>
        <TouchableOpacity onPress={() => step === 0 ? router.back() : prevStep()} style={styles.headerBack}>
          <ChevronLeft size={20} color={Colors.black} />
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

      <StepBar step={step} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

        {step === 0 && (
          <View style={styles.stepPad}>
            <Text style={styles.stepHeading}>Choose a Package</Text>
            <Text style={styles.stepSub}>Select the catering package that fits your event</Text>

            {packages.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrapSm}>
                  <PackageIcon size={32} color={Colors.border} />
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
                        <UtensilsCrossed size={44} color={tier.color} />
                      </View>
                    )}

                    <View style={styles.pkgBody}>
                      <View style={styles.pkgTitleRow}>
                        <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
                          <Medal size={13} color={tier.color} />
                          <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Check size={11} color={Colors.white} strokeWidth={3} />
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
                          <Text style={styles.pkgPriceSub}>capacity: up to {pkg.guest_capacity} pax</Text>
                        </View>
                        <View style={styles.pkgPricePerGuest}>
                          <Text style={styles.pkgPricePerGuestNum}>₱{pricePerGuest.toFixed(0)}</Text>
                          <Text style={styles.pkgPricePerGuestLabel}>per head</Text>
                        </View>
                      </View>

                      {pkg.food_inclusions && pkg.food_inclusions.length > 0 && (
                        <View style={styles.includesWrap}>
                          <Text style={styles.includesLabel}>FOOD INCLUSIONS</Text>
                          {pkg.food_inclusions.map((food, i) => (
                            <View key={i} style={styles.includeRow}>
                              <UtensilsCrossed size={14} color={Colors.orange} />
                              <Text style={styles.includeText}>{food}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {pkg.includes && pkg.includes.length > 0 && (
                        <View style={styles.includesWrap}>
                          <Text style={styles.includesLabel}>PACKAGE INCLUSIONS</Text>
                          {pkg.includes.map((inc, i) => (
                            <View key={i} style={styles.includeRow}>
                              <Check size={14} color="#10B981" strokeWidth={3} />
                              <Text style={styles.includeText}>{inc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.selectPkgBtn, isSelected && styles.selectPkgBtnSelected]}
                        onPress={() => setSelectedPkg(pkg)}
                      >
                        {isSelected && (
                          <Check size={14} color={Colors.white} strokeWidth={3} />
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
                  <Medal size={13} color={TIER_CONFIG[selectedPkg.tier]?.color} />
                  <Text style={[styles.tierBadgeText, { color: TIER_CONFIG[selectedPkg.tier]?.color }]}>
                    {TIER_CONFIG[selectedPkg.tier]?.label}
                  </Text>
                </View>
                <Text style={styles.selectedPkgName}>{selectedPkg.name}</Text>
                <Text style={styles.selectedPkgPrice}>₱{selectedPkg.price.toLocaleString()} / up to {selectedPkg.guest_capacity} guests (Min recommendation: {selectedPkg.min_guests} pax)</Text>
              </View>
            )}

            {/* Event Date Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Date *</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, isCurrentDateBooked && { borderColor: Colors.error, backgroundColor: '#FEF2F2' }]}
                onPress={() => setDatePickerVisible(true)}
              >
                {isCurrentDateBooked ? (
                  <AlertTriangle size={18} color={Colors.error} />
                ) : (
                  <CalendarDays size={18} color={Colors.orange} />
                )}
                <Text style={[styles.datePickerButtonText, isCurrentDateBooked && { color: Colors.error }]}>
                  {formattedDateString} {isCurrentDateBooked ? ' (Fully Booked)' : ''}
                </Text>
              </TouchableOpacity>
              {isCurrentDateBooked && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <AlertTriangle size={14} color={Colors.error} />
                  <Text style={{ fontSize: 12, color: Colors.error, fontWeight: '700' }}>
                    Sorry, but this date is fully booked. Please select another day.
                  </Text>
                </View>
              )}
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={() => setDatePickerVisible(false)}
                minimumDate={new Date()}
              />
            </View>

            {/* Event Time Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Time *</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setTimePickerVisible(true)}
              >
                <Clock size={18} color={Colors.orange} />
                <Text style={styles.datePickerButtonText}>{formattedTimeString}</Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={isTimePickerVisible}
                mode="time"
                onConfirm={handleConfirmTime}
                onCancel={() => setTimePickerVisible(false)}
              />
            </View>

            {/* Number of Guests Field with Polite Soft Warning */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Number of Guests *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={`e.g. ${selectedPkg?.min_guests || 50}`}
                placeholderTextColor={Colors.textMuted}
                value={guestCount}
                onChangeText={setGuestCount}
                keyboardType="number-pad"
              />
              {isGuestBelowMinimum ? (
                <View style={styles.inlineNoticeBox}>
                  <Info size={16} color={Colors.orange} />
                  <Text style={styles.inlineNoticeText}>
                    Note: This package is optimized for at least {selectedPkg?.min_guests} guests. You can proceed, but pricing is calculated based on the baseline package capacity.
                  </Text>
                </View>
              ) : selectedPkg && guests > 0 ? (
                <View style={styles.guestCalc}>
                  <View style={styles.guestCalcTextRow}>
                    <PackageIcon size={14} color="#92400E" />
                    <Text style={styles.guestCalcText}>
                      {packageMultiplier} × {selectedPkg.name} ({selectedPkg.guest_capacity} pax capacity)
                    </Text>
                  </View>
                  <Text style={styles.guestCalcPrice}>₱{baseTotal.toLocaleString()}</Text>
                </View>
              ) : null}
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

            {/* Venue & Map Picker */}
            <View style={styles.fieldGroup}>
              <View style={styles.venueLabelRow}>
                <Text style={styles.fieldLabel}>Venue / Location *</Text>
                <TouchableOpacity style={styles.locationPinHelper} onPress={() => setMapModalVisible(true)}>
                  <Navigation size={13} color={Colors.orange} />
                  <Text style={styles.locationPinHelperText}>Pin on Map</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Enan Chiong Activity Center or tap 'Pin on Map'"
                placeholderTextColor={Colors.textMuted}
                value={venue}
                onChangeText={setVenue}
              />
              <TouchableOpacity 
                style={styles.mapPreviewCard} 
                onPress={() => setMapModalVisible(true)}
                activeOpacity={0.8}
              >
                <MapPin size={20} color={Colors.orange} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapPreviewTitle}>Interactive Venue Mapper</Text>
                  <Text style={styles.mapPreviewSub}>
                    {venue ? `Selected: ${venue}` : 'Tap here to drop a pin precisely at your event venue.'}
                  </Text>
                </View>
              </TouchableOpacity>
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
                  <UtensilsCrossed size={32} color={Colors.border} />
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
                  const CatIcon = catCfg.icon;
                  return (
                    <View key={cat}>
                      <View style={styles.catHeader}>
                        <CatIcon size={18} color={catCfg.color} />
                        <Text style={styles.catLabel}>
                          {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                      {items.map(item => {
                        const qty = getQty(item.id);
                        const itemCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.main_course;
                        const ItemIcon = itemCfg.icon;
                        return (
                          <View key={item.id} style={styles.menuItemCard}>
                            {item.image_url ? (
                              <Image source={{ uri: item.image_url }} style={styles.menuItemImg} resizeMode="cover" />
                            ) : (
                              <View style={[styles.menuItemImgPlaceholder, { backgroundColor: itemCfg.color + '15' }]}>
                                <ItemIcon size={24} color={itemCfg.color} />
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
                              {((item as any).serving_size || (item as any).serving_unit) ? (
                                <View style={styles.menuItemServing}>
                                  <Scale size={11} color={Colors.textSecondary} />
                                  <Text style={styles.menuItemServingText}>
                                    {(item as any).serving_size ? `${(item as any).serving_size} ` : ''}
                                    {(item as any).serving_unit}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.qtyControl}>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                                <Minus size={14} color={Colors.textSecondary} />
                              </TouchableOpacity>
                              <Text style={styles.qtyNum}>{qty}</Text>
                              <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={() => addItem(item)}>
                                <Plus size={14} color={Colors.white} />
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
                <UtensilsCrossed size={16} color={Colors.black} />
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
                    <MapPin size={11} color={Colors.textSecondary} />
                    <Text style={styles.reviewCatererCity}>{caterer.city ?? 'Cebu'}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <PackageIcon size={16} color={Colors.black} />
                <Text style={styles.reviewSectionTitle}>Package & Inclusions</Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={[styles.tierBadge, { backgroundColor: TIER_CONFIG[selectedPkg.tier]?.bg, marginBottom: 8 }]}>
                  <Medal size={13} color={TIER_CONFIG[selectedPkg.tier]?.color} />
                  <Text style={[styles.tierBadgeText, { color: TIER_CONFIG[selectedPkg.tier]?.color }]}>
                    {TIER_CONFIG[selectedPkg.tier]?.label}
                  </Text>
                </View>
                <Text style={styles.reviewPkgName}>{selectedPkg.name}</Text>
                {selectedPkg.description && <Text style={styles.reviewPkgDesc}>{selectedPkg.description}</Text>}

                {selectedPkg.food_inclusions && selectedPkg.food_inclusions.length > 0 && (
                  <View style={[styles.includesWrap, { marginTop: 12, marginBottom: selectedPkg.includes && selectedPkg.includes.length > 0 ? 12 : 0 }]}>
                    <Text style={styles.includesLabel}>FOOD INCLUSIONS</Text>
                    {selectedPkg.food_inclusions.map((food, i) => (
                      <View key={i} style={styles.includeRow}>
                        <UtensilsCrossed size={14} color={Colors.orange} />
                        <Text style={styles.includeText}>{food}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedPkg.includes && selectedPkg.includes.length > 0 && (
                  <View style={[styles.includesWrap, { marginBottom: 0 }]}>
                    <Text style={styles.includesLabel}>PACKAGE INCLUSIONS</Text>
                    {selectedPkg.includes.map((inc, i) => (
                      <View key={i} style={styles.includeRow}>
                        <Check size={14} color="#10B981" strokeWidth={3} />
                        <Text style={styles.includeText}>{inc}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTitleRow}>
                <ClipboardList size={16} color={Colors.black} />
                <Text style={styles.reviewSectionTitle}>Event Details</Text>
              </View>
              <View style={styles.reviewCard}>
                {[
                  { label: 'Date',      value: formattedDateString },
                  { label: 'Time',      value: formattedTimeString },
                  { label: 'Guests',    value: `${guests} guests` },
                  { label: 'Event Type', value: eventType },
                  { label: 'Venue',     value: venue },
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
                  <Sparkles size={16} color={Colors.black} />
                  <Text style={styles.reviewSectionTitle}>Add-ons</Text>
                </View>
                <View style={styles.reviewCard}>
                  {customItems.map(c => {
                    const itemCfg = CATEGORY_CONFIG[c.menuItem.category] ?? CATEGORY_CONFIG.main_course;
                    const ItemIcon = itemCfg.icon;
                    return (
                      <View key={c.menuItem.id} style={styles.reviewRow}>
                        <View style={styles.reviewAddonLabelRow}>
                          <ItemIcon size={14} color={itemCfg.color} />
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
                <CreditCard size={16} color={Colors.black} />
                <Text style={styles.reviewSectionTitle}>Cost Breakdown</Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewRowLabel}>Package cost ({packageMultiplier}x)</Text>
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
              <Info size={16} color="#1E40AF" style={{ marginTop: 1 }} />
              <Text style={styles.noteText}>
                By submitting, you agree to the caterer's terms. The caterer has 24 hours to confirm or reject this request.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Map Modal */}
      <Modal visible={isMapModalVisible} animationType="slide" transparent={false}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search & Pin Venue</Text>
            <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.mapSearchContainer}>
            <TextInput
                style={styles.mapSearchInput}
                placeholder="Search location (e.g. Enan Chiong Center)"
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchLocation}
                returnKeyType="search"
            />
            <TouchableOpacity 
                style={styles.mapSearchBtn} 
                onPress={handleSearchLocation}
                disabled={searchingLocation}
            >
              {searchingLocation ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Search size={18} color={Colors.white} />
              )}
            </TouchableOpacity>
        </View>

          <View style={{ flex: 1, position: 'relative' }}>
            <MapView
                ref={mapRef}
                style={{ width: '100%', height: '100%' }}
                initialRegion={{
                  latitude: selectedCoordinates.latitude,
                  longitude: selectedCoordinates.longitude,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.0121,
              }}
                onPress={handleMapPress}
            >
              <Marker 
                coordinate={selectedCoordinates} 
                title={searchQuery || "Event Venue Location"} 
                description="Tap anywhere on map or use search bar" 
              />
            </MapView>

            <View style={styles.mapInstructionOverlay}>
              <Text style={styles.mapInstructionText}>📍 Search or tap map to position pin.</Text>
          </View>
        </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.confirmPinBtn} onPress={confirmPinnedLocation}>
              <CheckCircle2 size={18} color={Colors.white} />
              <Text style={styles.confirmPinBtnText}>Confirm Venue Pin Location</Text>
            </TouchableOpacity>
        </View>
      </View>
      </Modal>

      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.prevBtn} onPress={prevStep}>
            <ChevronLeft size={16} color={Colors.textSecondary} />
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
                <PartyPopper size={16} color={Colors.white} />
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
  pkgBody: { padding: 16 },
  pkgTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tierBadgeText: { fontSize: 12, fontWeight: '800' },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.orange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
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
  includeText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  selectPkgBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, backgroundColor: Colors.bgInput, borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, marginTop: 8 },
  selectPkgBtnSelected: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  selectPkgBtnText: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  selectPkgBtnTextSelected: { color: Colors.white },

  selectedPkgSummary: { backgroundColor: Colors.orangeLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFB26B' },
  selectedPkgName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginTop: 6 },
  selectedPkgPrice: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  datePickerButton: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  datePickerButtonText: { fontSize: 15, fontWeight: '700', color: Colors.black },
  venueLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  locationPinHelper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationPinHelperText: { fontSize: 11, fontWeight: '800', color: Colors.orange },
  mapPreviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 12, padding: 12, marginTop: 8,
  },
  mapPreviewTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412' },
  mapPreviewSub: { fontSize: 11, color: '#C2410C', marginTop: 2 },
  fieldInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.black,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  fieldTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 13 },
  guestCalc: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.orangeLight, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#FFB26B' },
  guestCalcTextRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  guestCalcText: { fontSize: 13, color: '#92400E', fontWeight: '600', flex: 1 },
  guestCalcPrice: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  inlineNoticeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  inlineNoticeText: { fontSize: 12, color: '#9A3412', fontWeight: '600', flex: 1, lineHeight: 17 },
  eventTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  eventTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  eventTypeChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  eventTypeText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  eventTypeTextActive: { color: Colors.white, fontWeight: '800' },

  customTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.orangeLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFB26B' },
  customTotalLabel: { fontSize: 13, color: '#92400E', fontWeight: '700' },
  customTotalValue: { fontSize: 18, fontWeight: '900', color: Colors.orange },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 },
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
  menuItemServingText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyBtnAdd: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  qtyNum: { fontSize: 16, fontWeight: '900', color: Colors.black, minWidth: 20, textAlign: 'center' },

  reviewSection: { marginBottom: 18 },
  reviewSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  reviewSectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, letterSpacing: 0.3 },
  reviewCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewCatererCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  reviewLogo: { width: 48, height: 48, borderRadius: 12 },
  reviewLogoPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  reviewCatererName: { fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  reviewCatererCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewCatererCity: { fontSize: 12, color: Colors.textSecondary },
  reviewPkgName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  reviewPkgDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  reviewRowDivider: { borderBottomWidth: 0, paddingVertical: 4 },
  reviewRowLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  reviewRowValue: { fontSize: 13, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'right' },
  reviewAddonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
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
  noteText: { fontSize: 12, color: '#1E40AF', lineHeight: 18, flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrapSm: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  backBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  modalRoot: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center' },
  
  mapSearchContainer: { flexDirection: 'row', padding: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8, alignItems: 'center' },
  mapSearchInput: { flex: 1, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 14, color: Colors.black },
  mapSearchBtn: { backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center', width: 42, height: 42, borderRadius: 10 },

  mapInstructionOverlay: { position: 'absolute', top: 15, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  mapInstructionText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  modalFooter: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  confirmPinBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmPinBtnText: { color: Colors.white, fontSize: 15, fontWeight: '900' },

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
  prevBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  nextBtn: { flex: 1, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
  submitBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
});