import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { isPublicationStatus, packagePublicationError, setPackagePublication, type PackagePublicationStatus } from '../../lib/packagePublication';
import { calculatePackagePricing, formatPricingMoney, packageGuestBounds } from '../../lib/packagePricing';
import { 
  Plus, Edit3, Archive, X, Check, Image as ImageIcon,
  CheckCircle2, UtensilsCrossed, PackageSearch, XCircle, 
  Users, RefreshCw, Send, Eye, EyeOff
} from 'lucide-react-native';

type Package = {
  id: string;
  publication_status: PackagePublicationStatus;
  tier: string;
  name: string;
  description: string | null;
  price: number;
  guest_capacity: number;
  max_guests: number;
  min_guests: number | null;
  includes: string[] | null;
  food_inclusions: string[] | null;
  event_types: string[] | null;
  image_url: string | null;
};

const TIERS = ['bronze', 'silver', 'gold', 'premium'];
const TIER_COLORS: Record<string, string> = {
  bronze: '#B45309', silver: '#6B7280', gold: '#D97706', premium: '#7C3AED',
};

const ALL_EVENT_TYPES = [
  'Wedding', 'Birthday', 'Debut', 'Corporate',
  'Anniversary', 'Party', 'Reunion', 'Other',
];

// Display thousands separators without changing the numeric value used by pricing and saving.
const formatPackagePriceInput = (value: string): string => {
  const [integer, ...decimal] = value.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal.length ? `${formattedInteger}.${decimal.join('.')}` : formattedInteger;
};

const INCLUDE_SUGGESTIONS = [
  'Buffet setup', 'Chafing dishes', 'Premium tableware',
  '2 waiters', '5 waiters', 'Free flowing drinks', 
  'Dessert station', 'Cleanup service', 'Event coordinator', 
];

export default function PackagesScreen() {
  const { catererData, session } = useAuth();
  const [packages, setPackages]   = useState<Package[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Package | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const visiblePackages = packages.filter(pkg => view === 'archived'
    ? pkg.publication_status === 'archived' : pkg.publication_status !== 'archived');

  // Form State
  const [name, setName]               = useState('');
  const [tier, setTier]               = useState('bronze');
  const [description, setDescription] = useState('');
  const [price, setPrice]             = useState('');
  const [guestCapacity, setGuestCapacity] = useState('');
  const [maxGuests, setMaxGuests] = useState('');
  const [minGuests, setMinGuests]     = useState('');
  const automaticRate = (() => {
    try { return calculatePackagePricing({ price, guest_capacity: Number(guestCapacity), min_guests: minGuests ? Number(minGuests) : null, max_guests: Number(maxGuests) }, Number(guestCapacity)).pricePerGuest; }
    catch { return null; }
  })();
  const [includes, setIncludes]       = useState<string[]>([]);
  const [customInclude, setCustomInclude] = useState('');
  const [eventTypes, setEventTypes]   = useState<string[]>([]);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  
  // New Direct Entry Food State
  const [foodInclusions, setFoodInclusions] = useState<string[]>([]);
  const [newFood, setNewFood] = useState('');

  const load = async () => {
    if (!catererData?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from('packages')
        .select('id, tier, name, description, price, guest_capacity, min_guests, max_guests, includes, food_inclusions, event_types, image_url, publication_status')
        .eq('caterer_id', catererData.id).order('created_at', { ascending: true });
      if (error) throw error;
      if ((data ?? []).some(pkg => !isPublicationStatus(pkg.publication_status))) {
        throw new Error('Package publishing setup is required. Please contact platform support.');
      }
      setPackages(data ?? []);
    } catch (error) {
      setPackages([]);
      setLoadError(packagePublicationError(error));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [catererData?.id]);

  const handlePickImage = async () => {
    if (!session?.user?.id || !catererData?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Failed to read image.'); return; }

    setUploadingImage(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `package_${Date.now()}.${ext}`;
      const path = `${catererData.id}/${fileName}`;
      const byteChars = atob(asset.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const { error } = await supabase.storage.from('caterer-media').upload(path, byteArray, { contentType: mimeType, upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('caterer-media').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName(''); setTier('bronze'); setDescription('');
    setPrice(''); setGuestCapacity(''); setMinGuests('');
    setMaxGuests('');
    setIncludes([]); setCustomInclude(''); setEventTypes([]);
    setFoodInclusions([]); setNewFood('');
    setImageUrl(null);
    setShowModal(true);
  };

  const openEdit = (pkg: Package) => {
    setEditing(pkg);
    setName(pkg.name); setTier(pkg.tier); setDescription(pkg.description ?? '');
    setPrice(String(pkg.price)); setGuestCapacity(String(pkg.guest_capacity)); setMinGuests(String(pkg.min_guests ?? ''));
    setMaxGuests(String(pkg.max_guests ?? ''));
    setIncludes(pkg.includes ?? []); setEventTypes(pkg.event_types ?? []);
    setFoodInclusions(pkg.food_inclusions ?? []);
    setImageUrl(pkg.image_url ?? null); setCustomInclude(''); setNewFood('');
    setShowModal(true);
  };

  const toggleEventType = (et: string) => setEventTypes(prev => prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et]);
  const toggleInclude = (item: string) => setIncludes(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  
  const addCustomInclude = () => {
    const t = customInclude.trim();
    if (!t) return;
    if (!includes.includes(t)) setIncludes(prev => [...prev, t]);
    setCustomInclude('');
  };
  const removeInclude = (item: string) => setIncludes(prev => prev.filter(i => i !== item));

  // Food Direct Entry Methods
  const addFood = () => {
    const item = newFood.trim();
    if (!item) return;
    if (!foodInclusions.includes(item)) setFoodInclusions(prev => [...prev, item]);
    setNewFood('');
  };
  const removeFood = (item: string) => setFoodInclusions(prev => prev.filter(i => i !== item));

  const handleSave = async () => {
    if (saving || changingId || loadError) return;
    if (!name.trim() || !price || !guestCapacity) {
      Alert.alert('Missing fields', 'Name, price, and guest capacity are required.');
      return;
    }
    if (!catererData?.id) return;

    const limits = { price, guest_capacity: Number(guestCapacity), min_guests: minGuests ? Number(minGuests) : null, max_guests: Number(maxGuests) };
    try {
      packageGuestBounds(limits);
      calculatePackagePricing(limits, limits.guest_capacity);
    } catch (error) {
      Alert.alert('Check package pricing', error instanceof Error ? error.message : 'Check the package guest limits.');
      return;
    }

    setSaving(true);
    const payload = {
      caterer_id: catererData.id,
      name: name.trim(),
      tier,
      description: description.trim() || null,
      price: Number(price),
      guest_capacity: limits.guest_capacity,
      min_guests: limits.min_guests,
      max_guests: limits.max_guests,
      includes: includes.length > 0 ? includes : null,
      food_inclusions: foodInclusions.length > 0 ? foodInclusions : null,
      event_types: eventTypes.length > 0 ? eventTypes : null,
      image_url: imageUrl,
    };

    try {
      const query = editing
        ? supabase.from('packages').update(payload).eq('id', editing.id)
          .eq('caterer_id', catererData.id).eq('publication_status', editing.publication_status)
        : supabase.from('packages').insert({ ...payload, publication_status: 'unpublished' });
      const { data, error } = await query.select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error('Package changed or permission was denied. Refresh and try again.');
      setShowModal(false);
      await load();
    } catch (error) { Alert.alert('Package not saved', packagePublicationError(error)); }
    finally { setSaving(false); }
  };

  const changePublication = async (pkg: Package, next: PackagePublicationStatus) => {
    if (changingId || saving || !session?.user.id || !catererData?.id) return;
    setChangingId(pkg.id);
    try {
      await setPackagePublication(pkg.id, catererData.id, session.user.id, pkg.publication_status, next);
      await load();
    } catch (error) {
      Alert.alert('Package not updated', packagePublicationError(error));
      await load();
    } finally { setChangingId(null); }
  };

  const handleArchive = (pkg: Package) => {
    Alert.alert('Archive Package', `Archive "${pkg.name}"? It will be hidden from new bookings. Existing accepted bookings and their history remain unchanged.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => { void changePublication(pkg, 'archived'); },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>My Packages</Text>
          {packages.length > 0 && (
            <Text style={styles.pageCount}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.85} disabled={loading || !!loadError || saving || !!changingId} accessibilityLabel="Add Package">
          <Plus size={22} color={Colors.white} strokeWidth={3} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['active', 'archived'] as const).map(value => {
          const isActive = view === value;
          return (
            <TouchableOpacity 
              key={value} 
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }} 
              onPress={() => setView(value)}
              style={styles.tabItem}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {value === 'active' ? 'Active packages' : 'Archived packages'}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {loadError ? (
        <View style={styles.empty}>
          <Text style={styles.emptySub}>{loadError}</Text>
          <TouchableOpacity onPress={() => void load()}><Text style={{ color: Colors.orange, fontWeight: '700' }}>Retry</Text></TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : visiblePackages.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <PackageSearch size={48} color={Colors.orange} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{view === 'archived' ? 'No archived packages' : 'No active packages'}</Text>
          <Text style={styles.emptySub}>New packages start unpublished. Publish a package when it is ready for customer bookings.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.85} accessibilityLabel="Create Package">
            <Plus size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
          {visiblePackages.map((pkg) => {
            const tierColor = TIER_COLORS[pkg.tier] ?? Colors.orange;
            const isPublished = pkg.publication_status === 'published';

            return (
              <View key={pkg.id} style={styles.pkgCard}>
                <View style={styles.pkgImageContainer}>
                  {pkg.image_url ? (
                    <Image source={{ uri: pkg.image_url }} style={styles.pkgImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.pkgImagePlaceholder, { backgroundColor: tierColor + '15' }]}>
                      <ImageIcon size={32} color={tierColor} opacity={0.5} />
                    </View>
                  )}
                  <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                    <Text style={styles.tierText}>{pkg.tier.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.pkgContent}>
                  <View style={styles.pkgHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.pkgName} numberOfLines={1}>{pkg.name}</Text>
                      <View style={styles.statusPillContainer}>
                        <View style={[styles.statusDot, { backgroundColor: isPublished ? '#10B981' : '#94A3B8' }]} />
                        <Text style={[styles.statusPillText, { color: isPublished ? '#047857' : '#64748B' }]}>
                          {pkg.publication_status.charAt(0).toUpperCase() + pkg.publication_status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pkgActions}>
                      <TouchableOpacity accessibilityLabel={`Edit ${pkg.name}`} disabled={saving || !!changingId} style={styles.actionBtn} onPress={() => openEdit(pkg)}>
                        <Edit3 size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      {pkg.publication_status !== 'archived' && (
                        <TouchableOpacity accessibilityLabel={`Archive ${pkg.name}`} disabled={saving || !!changingId} style={styles.actionBtnDelete} onPress={() => handleArchive(pkg)}>
                          <Archive size={16} color={Colors.orange} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        accessibilityRole="button" 
                        accessibilityLabel={isPublished ? 'Unpublish' : pkg.publication_status === 'archived' ? 'Restore as unpublished' : 'Publish'}
                        disabled={saving || !!changingId}
                        style={styles.actionBtnView}
                        onPress={() => void changePublication(pkg, isPublished || pkg.publication_status === 'archived' ? 'unpublished' : 'published')}
                      >
                        {changingId === pkg.id ? (
                          <ActivityIndicator size="small" color={Colors.orange} />
                        ) : isPublished ? (
                          <EyeOff size={16} color={Colors.orange} />
                        ) : (
                          <Eye size={16} color={Colors.orange} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {pkg.description && <Text style={styles.pkgDesc} numberOfLines={2}>{pkg.description}</Text>}

                  <View style={[styles.metricsRow, { backgroundColor: tierColor + '10' }]}>
                    <View style={styles.metric}>
                      <Text style={{ color: tierColor, fontSize: 16, fontWeight: '700' }}>₱</Text>
                      <View>
                        <Text style={styles.metricValue}>₱{pkg.price.toLocaleString()}</Text>
                        <Text style={styles.metricLabel}>Total Base</Text>
                      </View>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                      <Users size={16} color={tierColor} />
                      <View>
                        <Text style={styles.metricValue}>{pkg.guest_capacity}</Text>
                        <Text style={styles.metricLabel}>Included guests</Text>
                      </View>
                    </View>
                  </View>

                  {((pkg.includes && pkg.includes.length > 0) || (pkg.food_inclusions && pkg.food_inclusions.length > 0)) && (
                    <View style={styles.pkgPreviewData}>
                      {pkg.food_inclusions && pkg.food_inclusions.length > 0 && (
                        <View style={styles.previewSection}>
                          <Text style={styles.previewLabel}>FOOD INCLUDED</Text>
                          <View style={styles.pillWrap}>
                            {pkg.food_inclusions.slice(0, 3).map((food, i) => (
                              <View key={i} style={[styles.previewPill, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                                <UtensilsCrossed size={12} color={Colors.orange} />
                                <Text style={[styles.previewPillText, { color: Colors.orange }]}>{food}</Text>
                              </View>
                            ))}
                            {pkg.food_inclusions.length > 3 && (
                              <View style={[styles.previewPill, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                                <Text style={[styles.previewPillText, { color: Colors.orange }]}>+{pkg.food_inclusions.length - 3} more</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {pkg.includes && pkg.includes.length > 0 && (
                        <View style={styles.previewSection}>
                          <Text style={styles.previewLabel}>SERVICE INCLUSIONS</Text>
                          <View style={styles.pillWrap}>
                            {pkg.includes.slice(0, 3).map((inc, i) => (
                              <View key={i} style={styles.previewPill}>
                                <CheckCircle2 size={12} color={Colors.success} />
                                <Text style={styles.previewPillText}>{inc}</Text>
                              </View>
                            ))}
                            {pkg.includes.length > 3 && (
                              <View style={styles.previewPill}>
                                <Text style={styles.previewPillText}>+{pkg.includes.length - 3} more</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* --- ADD / EDIT MODAL --- */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editing ? 'Edit Package' : 'New Package'}</Text>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)} activeOpacity={0.8} accessibilityLabel="Close Modal">
            <X size={20} color={Colors.black} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: '#F8FAFC' }}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Visuals & Basics */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>VISUALS & TIER</Text>
            
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={handlePickImage}
              disabled={uploadingImage}
              activeOpacity={0.85}
              accessibilityLabel="Upload cover photo"
            >
              {uploadingImage ? (
                <View style={styles.photoPickerContent}>
                  <ActivityIndicator color={Colors.orange} />
                  <Text style={styles.photoPickerHint}>Uploading...</Text>
                </View>
              ) : imageUrl ? (
                <>
                  <Image source={{ uri: imageUrl }} style={styles.photoPreview} resizeMode="cover" />
                  <View style={styles.photoOverlay}>
                    <Edit3 size={20} color={Colors.white} />
                    <Text style={styles.photoOverlayText}>Change Photo</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPickerContent}>
                  <ImageIcon size={32} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={styles.photoPickerLabel}>Tap to upload cover photo</Text>
                  <Text style={styles.photoPickerHint}>16:9 ratio recommended</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.tierSelector}>
              {TIERS.map((t) => {
                const isActive = tier === t;
                const tColor = TIER_COLORS[t];
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTier(t)}
                    style={[styles.tierOption, isActive && { backgroundColor: tColor, borderColor: tColor }]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.tierOptionText, isActive && { color: Colors.white }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2: Details */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>PACKAGE DETAILS</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Package Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Premium Wedding Buffet" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="What makes this package special?" placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </View>

          {/* Section 3: Pricing & Capacity */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>PRICING & GUESTS</Text>
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Package Price (₱) *</Text>
                <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted} value={formatPackagePriceInput(price)} onChangeText={(value) => setPrice(value.replace(/,/g, ''))} keyboardType="numeric" />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Included Guest Capacity *</Text>
                <TextInput style={styles.input} placeholder="100" placeholderTextColor={Colors.textMuted} value={guestCapacity} onChangeText={setGuestCapacity} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Maximum Guests *</Text>
              <TextInput accessibilityLabel="Maximum guests" style={styles.input} placeholder="e.g. 150" placeholderTextColor={Colors.textMuted} value={maxGuests} onChangeText={setMaxGuests} keyboardType="number-pad" />
              <Text style={styles.sectionSub}>Guests above the included capacity are priced automatically using package price ÷ included capacity. No manual extra-guest fee.</Text>
              {automaticRate !== null && <Text style={styles.sectionSub}>Automatic rate: ₱{formatPricingMoney(automaticRate)} per extra guest (display rounded). The extra-guest subtotal is rounded after multiplication.</Text>}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Min Guests (Optional)</Text>
              <TextInput style={styles.input} placeholder="e.g. 30" placeholderTextColor={Colors.textMuted} value={minGuests} onChangeText={setMinGuests} keyboardType="numeric" />
            </View>
          </View>

          {/* Section 4: Direct Entry Food Menu */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>FOOD MENU FOR THIS PACKAGE</Text>
              <Text style={styles.selectionCount}>{foodInclusions.length} Added</Text>
            </View>
            <Text style={styles.sectionSub}>Type the dishes included in this package and tap Add.</Text>
            
            <View style={styles.customAddRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="e.g. Beef Caldereta..."
                placeholderTextColor={Colors.textMuted}
                value={newFood}
                onChangeText={setNewFood}
                onSubmitEditing={addFood}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.customAddBtn} onPress={addFood} accessibilityLabel="Add Food Item">
                <Plus size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {foodInclusions.length > 0 && (
              <View style={styles.selectedPillWrap}>
                {foodInclusions.map((food, i) => (
                  <View key={i} style={[styles.selectedPill, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                    <UtensilsCrossed size={14} color={Colors.orange} />
                    <Text style={[styles.selectedPillText, { color: Colors.orange }]}>{food}</Text>
                    <TouchableOpacity onPress={() => removeFood(food)} style={{ padding: 2 }} accessibilityLabel={`Remove ${food}`}>
                      <XCircle size={16} color={Colors.orange} opacity={0.6} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section 5: Inclusions */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>SERVICE INCLUSIONS</Text>
              <Text style={styles.selectionCount}>{includes.length} Added</Text>
            </View>
            
            <View style={styles.customAddRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Type custom inclusion..."
                placeholderTextColor={Colors.textMuted}
                value={customInclude}
                onChangeText={setCustomInclude}
                onSubmitEditing={addCustomInclude}
                returnKeyType="done"
              />
              <TouchableOpacity style={[styles.customAddBtn, { backgroundColor: Colors.success }]} onPress={addCustomInclude} accessibilityLabel="Add Custom Inclusion">
                <Plus size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {includes.length > 0 && (
              <View style={styles.selectedPillWrap}>
                {includes.map((inc, i) => (
                  <View key={i} style={styles.selectedPill}>
                    <Check size={14} color={Colors.success} />
                    <Text style={styles.selectedPillText}>{inc}</Text>
                    <TouchableOpacity onPress={() => removeInclude(inc)} style={{ padding: 2 }} accessibilityLabel={`Remove ${inc}`}>
                      <XCircle size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.suggestionLabel}>Quick Add Suggestions:</Text>
            <View style={styles.suggestionsWrap}>
              {INCLUDE_SUGGESTIONS.map(item => {
                if (includes.includes(item)) return null;
                return (
                  <TouchableOpacity key={item} style={styles.suggestionPill} onPress={() => toggleInclude(item)} accessibilityLabel={`Add suggestion ${item}`}>
                    <Plus size={14} color={Colors.textSecondary} />
                    <Text style={styles.suggestionPillText}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 6: Event Types */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>SUITABLE EVENT TYPES</Text>
            <View style={styles.eventGrid}>
              {ALL_EVENT_TYPES.map(et => {
                const isActive = eventTypes.includes(et);
                return (
                  <TouchableOpacity
                    key={et}
                    style={[styles.eventChip, isActive && styles.eventChipActive]}
                    onPress={() => toggleEventType(et)}
                    activeOpacity={0.85}
                    accessibilityLabel={`Select event type ${et}`}
                  >
                    <Text style={[styles.eventChipText, isActive && styles.eventChipTextActive]}>{et}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
            accessibilityLabel={editing ? 'Save Changes' : 'Create Package'}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Send size={22} color={Colors.white} />
            )}
          </TouchableOpacity>
          
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingBottom: 16, 
    backgroundColor: Colors.white, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    zIndex: 10
  },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageCount: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  addBtn: { 
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.orange, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 
  },
  
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabItem: {
    paddingVertical: 14,
    marginRight: 24,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.orange,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.orange,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  pkgCard: { 
    backgroundColor: Colors.white, borderRadius: 24, 
    borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', 
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3 
  },
  pkgImageContainer: { height: 180, position: 'relative', backgroundColor: '#F8FAFC' },
  pkgImage: { width: '100%', height: '100%' },
  pkgImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tierBadge: { 
    position: 'absolute', top: 16, left: 16, 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2
  },
  tierText: { color: Colors.white, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  
  pkgContent: { padding: 20 },
  pkgHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  pkgName: { fontSize: 20, fontWeight: '900', color: Colors.black, letterSpacing: -0.5, marginBottom: 4 },
  
  statusPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  pkgActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  actionBtnDelete: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  actionBtnView: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  pkgDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  
  metricsRow: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16 },
  metric: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricDivider: { width: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 12 },
  metricValue: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  pkgPreviewData: { gap: 14 },
  previewSection: { gap: 6 },
  previewLabel: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  previewPillText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  modalHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 24, 
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.black },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  
  formSection: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  selectionCount: { fontSize: 12, fontWeight: '700', color: Colors.orange, backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, fontSize: 15, color: Colors.black },
  textArea: { minHeight: 100, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', gap: 12 },

  photoPicker: { height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', marginBottom: 20 },
  photoPickerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoPreview: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoOverlayText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  photoPickerLabel: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  photoPickerHint: { fontSize: 12, color: Colors.textMuted },

  tierSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tierOption: { flex: 1, minWidth: '45%', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center' },
  tierOptionText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  customAddRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  customAddBtn: { backgroundColor: Colors.orange, borderRadius: 12, width: 52, justifyContent: 'center', alignItems: 'center' },
  selectedPillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  selectedPillText: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  suggestionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  suggestionPillText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', minWidth: '45%', flex: 1, alignItems: 'center' },
  eventChipActive: { backgroundColor: '#FFF7ED', borderColor: Colors.orange },
  eventChipText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  eventChipTextActive: { color: Colors.orange },

  saveBtn: { 
    height: 56, 
    backgroundColor: Colors.orange, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: Colors.orange, 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 4 
  },
});
