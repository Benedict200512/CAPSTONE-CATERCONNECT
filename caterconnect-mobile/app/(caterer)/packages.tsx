import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const ICONS = {
  package:      require('../../assets/icons/package.png'),
  pencil:       require('../../assets/icons/pencil.png'),
  trash:        require('../../assets/icons/trash.png'),
  close:        require('../../assets/icons/close.png'),
  checkOutline: require('../../assets/icons/check_outline.png'),
  plusWhite:    require('../../assets/icons/plus_white.png'),
};

type Package = {
  id: string;
  tier: string;
  name: string;
  description: string | null;
  price: number;
  guest_capacity: number;
  min_guests: number | null;
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

const TIERS = ['bronze', 'silver', 'gold', 'premium'];
const TIER_COLORS: Record<string, string> = {
  bronze: '#B45309', silver: '#6B7280', gold: '#D97706', premium: '#7C3AED',
};

const ALL_EVENT_TYPES = [
  'Wedding', 'Birthday', 'Debut', 'Corporate',
  'Anniversary', 'Party', 'Reunion', 'Other',
];

const INCLUDE_SUGGESTIONS = [
  'Buffet setup', 'Chafing dishes', 'Basic tableware', 'Premium tableware',
  '1 waiter', '2 waiters', '3 waiters', '4 waiters', '5 waiters',
  'Free flowing drinks', 'Dessert station', 'Cleanup service',
  'Event coordinator', 'Food warmer', 'Serving spoons',
  'Napkins & tissue', 'Table skirting',
];

const CATEGORY_ICONS: Record<string, string> = {
  main_course: '🍖', appetizer: '🥗', dessert: '🍰', drink: '🥤',
};
const CATEGORY_LABELS: Record<string, string> = {
  main_course: 'Main Course', appetizer: 'Appetizer',
  dessert: 'Dessert', drink: 'Drink',
};
const CATEGORY_ORDER = ['main_course', 'appetizer', 'dessert', 'drink'];

export default function PackagesScreen() {
  const { catererData, session } = useAuth();
  const [packages, setPackages]   = useState<Package[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Package | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [name, setName]               = useState('');
  const [tier, setTier]               = useState('bronze');
  const [description, setDescription] = useState('');
  const [price, setPrice]             = useState('');
  const [guestCapacity, setGuestCapacity] = useState('');
  const [minGuests, setMinGuests]     = useState('');
  const [includes, setIncludes]       = useState<string[]>([]);
  const [customInclude, setCustomInclude] = useState('');
  const [eventTypes, setEventTypes]   = useState<string[]>([]);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);

  const load = async () => {
    if (!catererData?.id) return;
    setLoading(true);
    const [pkgRes, menuRes] = await Promise.all([
      supabase.from('packages').select('*').eq('caterer_id', catererData.id).order('created_at', { ascending: true }),
      supabase.from('menu_items').select('*').eq('caterer_id', catererData.id).order('category'),
    ]);
    setPackages(pkgRes.data ?? []);
    setMenuItems(menuRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [catererData?.id]);

  const [packageMenuItems, setPackageMenuItems] = useState<Record<string, string[]>>({});

  const loadPackageMenuItems = async (pkgIds: string[]) => {
    if (pkgIds.length === 0) return;
    const { data } = await supabase
      .from('package_menu_items')
      .select('package_id, menu_item_id')
      .in('package_id', pkgIds);
    const map: Record<string, string[]> = {};
    (data ?? []).forEach(row => {
      if (!map[row.package_id]) map[row.package_id] = [];
      map[row.package_id].push(row.menu_item_id);
    });
    setPackageMenuItems(map);
  };

  useEffect(() => {
    if (packages.length > 0) loadPackageMenuItems(packages.map(p => p.id));
  }, [packages]);

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

      const { error } = await supabase.storage
        .from('caterer-media')
        .upload(path, byteArray, { contentType: mimeType, upsert: true });

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
    setIncludes([]); setCustomInclude(''); setEventTypes([]);
    setImageUrl(null); setSelectedMenuItems([]);
    setShowModal(true);
  };

  const openEdit = async (pkg: Package) => {
    setEditing(pkg);
    setName(pkg.name);
    setTier(pkg.tier);
    setDescription(pkg.description ?? '');
    setPrice(String(pkg.price));
    setGuestCapacity(String(pkg.guest_capacity));
    setMinGuests(String(pkg.min_guests ?? ''));
    setIncludes(pkg.includes ?? []);
    setEventTypes(pkg.event_types ?? []);
    setImageUrl(pkg.image_url ?? null);
    setCustomInclude('');

    const { data } = await supabase
      .from('package_menu_items')
      .select('menu_item_id')
      .eq('package_id', pkg.id);
    setSelectedMenuItems((data ?? []).map(r => r.menu_item_id));

    setShowModal(true);
  };

  const toggleEventType = (et: string) =>
    setEventTypes(prev => prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et]);

  const toggleInclude = (item: string) =>
    setIncludes(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);

  const addCustomInclude = () => {
    const t = customInclude.trim();
    if (!t) return;
    if (!includes.includes(t)) setIncludes(prev => [...prev, t]);
    setCustomInclude('');
  };

  const removeInclude = (item: string) =>
    setIncludes(prev => prev.filter(i => i !== item));

  const toggleMenuItem = (id: string) =>
    setSelectedMenuItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );

  const handleSave = async () => {
    if (!name.trim() || !price || !guestCapacity) {
      Alert.alert('Missing fields', 'Name, price, and guest capacity are required.');
      return;
    }
    if (!catererData?.id) return;

    setSaving(true);
    const payload = {
      caterer_id:     catererData.id,
      name:           name.trim(),
      tier,
      description:    description.trim() || null,
      price:          parseFloat(price),
      guest_capacity: parseInt(guestCapacity),
      min_guests:     minGuests ? parseInt(minGuests) : null,
      includes:       includes.length > 0 ? includes : null,
      event_types:    eventTypes.length > 0 ? eventTypes : null,
      image_url:      imageUrl,
    };

    let pkgId = editing?.id ?? null;

    if (editing) {
      const { error } = await supabase.from('packages').update(payload).eq('id', editing.id);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('packages').insert(payload).select('id').single();
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
      pkgId = data.id;
    }

    if (pkgId) {
      await supabase.from('package_menu_items').delete().eq('package_id', pkgId);
      if (selectedMenuItems.length > 0) {
        await supabase.from('package_menu_items').insert(
          selectedMenuItems.map(miId => ({ package_id: pkgId, menu_item_id: miId }))
        );
      }
    }

    setSaving(false);
    setShowModal(false);
    load();
  };

  const handleDelete = (pkg: Package) => {
    Alert.alert('Delete Package', `Remove "${pkg.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('packages').delete().eq('id', pkg.id);
          load();
        },
      },
    ]);
  };

  const getLinkedMenuItems = (pkgId: string) => {
    const ids = packageMenuItems[pkgId] ?? [];
    return menuItems.filter(m => ids.includes(m.id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>My Packages</Text>
          {packages.length > 0 && (
            <Text style={styles.pageCount}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.85}>
          <Image source={ICONS.plusWhite} style={styles.iconAddBtn} />
          <Text style={styles.addBtnText}>Add Package</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : packages.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Image source={ICONS.package} style={styles.emptyIcon} />
          </View>
          <Text style={styles.emptyTitle}>No packages yet</Text>
          <Text style={styles.emptySub}>Create your first catering package to start receiving bookings.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.85}>
            <Image source={ICONS.plusWhite} style={styles.iconAddBtn} />
            <Text style={styles.emptyBtnText}>Create Package</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
          {packages.map((pkg) => {
            const tierColor = TIER_COLORS[pkg.tier] ?? Colors.orange;
            const linkedItems = getLinkedMenuItems(pkg.id);

            return (
              <View key={pkg.id} style={styles.pkgCard}>
                <View style={[styles.tierStripe, { backgroundColor: tierColor }]} />

                <View style={styles.pkgCardBody}>
                  {pkg.image_url ? (
                    <Image
                      source={{ uri: pkg.image_url }}
                      style={styles.pkgCardPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.pkgCardPhotoPlaceholder, { backgroundColor: tierColor + '15' }]}>
                      <Text style={{ fontSize: 36 }}>🍽️</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>No photo</Text>
                    </View>
                  )}

                  <View style={styles.pkgCardContent}>
                    <View style={styles.pkgCardTop}>
                      <View style={[styles.tierBadge, { backgroundColor: tierColor + '1A' }]}>
                        <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
                        <Text style={[styles.tierText, { color: tierColor }]}>
                          {pkg.tier.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.pkgActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(pkg)} activeOpacity={0.8}>
                          <Image source={ICONS.pencil} style={styles.iconEditBtn} />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(pkg)} activeOpacity={0.8}>
                          <Image source={ICONS.trash} style={styles.iconDeleteBtn} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.pkgName}>{pkg.name}</Text>
                    {pkg.description && <Text style={styles.pkgDesc}>{pkg.description}</Text>}

                    <View style={[styles.priceHero, { backgroundColor: tierColor + '12', borderColor: tierColor + '35' }]}>
                      <View>
                        <Text style={[styles.priceHeroLabel, { color: tierColor }]}>STARTING AT</Text>
                        <Text style={[styles.priceHeroValue, { color: tierColor }]}>
                          ₱{pkg.price.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.priceHeroDivider} />
                      <View style={styles.priceHeroStatsCol}>
                        <View style={styles.priceHeroStatRow}>
                          <Text style={styles.priceHeroStatValue}>₱{(pkg.price / pkg.guest_capacity).toFixed(0)}</Text>
                          <Text style={styles.priceHeroStatLabel}>per guest</Text>
                        </View>
                        <View style={styles.priceHeroStatRow}>
                          <Text style={styles.priceHeroStatValue}>{pkg.guest_capacity}</Text>
                          <Text style={styles.priceHeroStatLabel}>max guests</Text>
                        </View>
                      </View>
                    </View>

                    {pkg.includes && pkg.includes.length > 0 && (
                      <View style={styles.pkgIncludesWrap}>
                        <Text style={styles.pkgIncludesTitle}>WHAT'S INCLUDED</Text>
                        {pkg.includes.map((inc, i) => (
                          <View key={i} style={styles.pkgIncludeRow}>
                            <Image source={ICONS.checkOutline} style={[styles.iconIncludeCheck, { tintColor: Colors.success }]} />
                            <Text style={styles.pkgIncludeText}>{inc}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {linkedItems.length > 0 && (
                      <View style={styles.pkgFoodWrap}>
                        <Text style={styles.pkgIncludesTitle}>FOOD INCLUDED</Text>
                        {CATEGORY_ORDER.map(cat => {
                          const catItems = linkedItems.filter(m => m.category === cat);
                          if (catItems.length === 0) return null;
                          return (
                            <View key={cat} style={styles.pkgFoodCatGroup}>
                              <Text style={styles.pkgFoodCatLabel}>
                                {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                              </Text>
                              {catItems.map(item => (
                                <View key={item.id} style={styles.pkgFoodItem}>
                                  <View style={styles.pkgFoodDot} />
                                  <Text style={styles.pkgFoodName}>{item.name}</Text>
                                  {(item.serving_size || item.serving_unit) && (
                                    <Text style={styles.pkgFoodServing}>
                                      {item.serving_size ? `${item.serving_size} ` : ''}{item.serving_unit}
                                    </Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {pkg.event_types && pkg.event_types.length > 0 && (
                      <View style={styles.pkgEventTypesWrap}>
                        <Text style={styles.pkgIncludesTitle}>EVENT TYPES</Text>
                        <View style={styles.pkgEventTypesRow}>
                          {pkg.event_types.map(et => (
                            <View key={et} style={styles.pkgEventTypeChip}>
                              <Text style={styles.pkgEventTypeText}>{et}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView
          style={{ flex: 1, backgroundColor: Colors.bg }}
          contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Package' : 'New Package'}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)} activeOpacity={0.8}>
              <Image source={ICONS.close} style={[styles.iconModalClose, { tintColor: Colors.textSecondary }]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>PACKAGE PHOTO</Text>
          <Text style={styles.fieldHint}>Show customers what your package looks like. 16:9 ratio recommended.</Text>
          <TouchableOpacity
            style={styles.photoPickerWrap}
            onPress={handlePickImage}
            disabled={uploadingImage}
            activeOpacity={0.85}
          >
            {uploadingImage ? (
              <View style={styles.photoPickerPlaceholder}>
                <ActivityIndicator color={Colors.orange} />
                <Text style={styles.photoPickerHint}>Uploading...</Text>
              </View>
            ) : imageUrl ? (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: imageUrl }} style={styles.photoPickerPreview} resizeMode="cover" />
                <View style={styles.photoPickerOverlay}>
                  <Text style={styles.photoPickerOverlayText}>Tap to change photo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoPickerPlaceholder}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text>
                <Text style={styles.photoPickerLabel}>Tap to add package photo</Text>
                <Text style={styles.photoPickerHint}>JPG or PNG, 16:9 recommended</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>PACKAGE TIER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TIERS.map((t) => {
                const isActive = tier === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTier(t)}
                    style={[styles.tierChip, isActive && { backgroundColor: TIER_COLORS[t], borderColor: TIER_COLORS[t] }]}
                    activeOpacity={0.85}
                  >
                    {isActive && <Image source={ICONS.checkOutline} style={[styles.iconTierCheck, { tintColor: Colors.white }]} />}
                    <Text style={[styles.tierChipText, isActive && { color: 'white' }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.label}>PACKAGE NAME *</Text>
          <TextInput style={styles.input} placeholder="e.g. Silver Package" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput style={styles.textArea} placeholder="What makes this package special?" placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />

          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>BASE PRICE (₱) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 25000" placeholderTextColor={Colors.textMuted} value={price} onChangeText={setPrice} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>MAX GUESTS *</Text>
              <TextInput style={styles.input} placeholder="e.g. 100" placeholderTextColor={Colors.textMuted} value={guestCapacity} onChangeText={setGuestCapacity} keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>MIN GUESTS (optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. 30" placeholderTextColor={Colors.textMuted} value={minGuests} onChangeText={setMinGuests} keyboardType="numeric" />

          <Text style={[styles.label, { marginTop: 4 }]}>FOOD ITEMS INCLUDED IN THIS PACKAGE</Text>
          <Text style={styles.fieldHint}>
            Select which of your menu items come with this package (no extra charge).
          </Text>

          {menuItems.length === 0 ? (
            <View style={styles.noMenuItemsBox}>
              <Text style={styles.noMenuItemsText}>
                No menu items yet. Add items in the Menu tab first, then come back to link them to this package.
              </Text>
            </View>
          ) : (
            CATEGORY_ORDER.map(cat => {
              const catItems = menuItems.filter(m => m.category === cat);
              if (catItems.length === 0) return null;
              return (
                <View key={cat} style={styles.menuCatSection}>
                  <Text style={styles.menuCatSectionTitle}>
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </Text>
                  {catItems.map(item => {
                    const isSelected = selectedMenuItems.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.menuItemRow, isSelected && styles.menuItemRowSelected]}
                        onPress={() => toggleMenuItem(item.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.menuItemCheckbox, isSelected && styles.menuItemCheckboxSelected]}>
                          {isSelected && (
                            <Image source={ICONS.checkOutline} style={[styles.iconMenuCheck, { tintColor: Colors.white }]} />
                          )}
                        </View>

                        {/* Item info */}
                        <View style={styles.menuItemRowInfo}>
                          <Text style={[styles.menuItemRowName, isSelected && styles.menuItemRowNameSelected]}>
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text style={styles.menuItemRowDesc} numberOfLines={1}>{item.description}</Text>
                          )}
                          {(item.serving_size || item.serving_unit) && (
                            <Text style={styles.menuItemRowServing}>
                              ⚖️ {item.serving_size ? `${item.serving_size} ` : ''}{item.serving_unit}
                            </Text>
                          )}
                        </View>

                        {/* Price */}
                        <Text style={styles.menuItemRowPrice}>₱{item.price_per_guest}/guest</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}

          {selectedMenuItems.length > 0 && (
            <View style={styles.selectedFoodSummary}>
              <Text style={styles.selectedFoodSummaryText}>
                {selectedMenuItems.length} food item{selectedMenuItems.length !== 1 ? 's' : ''} included in this package
              </Text>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>SERVICE INCLUSIONS</Text>
          <Text style={styles.fieldHint}>Tap to add, tap again to remove. Add your own below.</Text>

          <View style={styles.suggestionsWrap}>
            {INCLUDE_SUGGESTIONS.map(item => {
              const isActive = includes.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.suggestionChip, isActive && styles.suggestionChipActive]}
                  onPress={() => toggleInclude(item)}
                  activeOpacity={0.85}
                >
                  {isActive && <Image source={ICONS.checkOutline} style={[styles.iconSuggestionCheck, { tintColor: Colors.orange }]} />}
                  <Text style={[styles.suggestionText, isActive && styles.suggestionTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customIncludeRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add custom item..."
              placeholderTextColor={Colors.textMuted}
              value={customInclude}
              onChangeText={setCustomInclude}
              onSubmitEditing={addCustomInclude}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addIncludeBtn} onPress={addCustomInclude} activeOpacity={0.85}>
              <Text style={styles.addIncludeBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {includes.length > 0 && (
            <View style={styles.selectedIncludesWrap}>
              <Text style={styles.selectedIncludesTitle}>Selected ({includes.length}):</Text>
              {includes.map((inc, i) => (
                <View key={i} style={styles.selectedIncludeRow}>
                  <Image source={ICONS.checkOutline} style={[styles.iconSelectedCheck, { tintColor: Colors.success }]} />
                  <Text style={styles.selectedIncludeText}>{inc}</Text>
                  <TouchableOpacity onPress={() => removeInclude(inc)} activeOpacity={0.7}>
                    <Image source={ICONS.close} style={[styles.iconRemoveInclude, { tintColor: Colors.error }]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>EVENT TYPES</Text>
          <Text style={styles.fieldHint}>Select which events this package is suitable for.</Text>
          <View style={styles.eventTypesGrid}>
            {ALL_EVENT_TYPES.map(et => (
              <TouchableOpacity
                key={et}
                style={[styles.eventTypeChip, eventTypes.includes(et) && styles.eventTypeChipActive]}
                onPress={() => toggleEventType(et)}
                activeOpacity={0.85}
              >
                <Text style={[styles.eventTypeText, eventTypes.includes(et) && styles.eventTypeTextActive]}>{et}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={styles.saveBtnText}>{editing ? 'SAVE CHANGES' : 'CREATE PACKAGE'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.black },
  pageCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orange, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  iconAddBtn:{ width: 13, height: 13 },
  addBtnText:{ color: Colors.white, fontWeight: '800', fontSize: 13 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emptyIcon: { width: 42, height: 42, tintColor: Colors.orange },
  emptyTitle:{ fontSize: 20, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  emptySub:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },

  pkgCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  tierStripe: { width: 5 },
  pkgCardBody: { flex: 1 },
  pkgCardPhoto: { width: '100%', height: 160 },
  pkgCardPhotoPlaceholder: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
  pkgCardContent: { padding: 16 },
  pkgCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tierBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tierDot:    { width: 6, height: 6, borderRadius: 3 },
  tierText:   { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pkgActions: { flexDirection: 'row', gap: 8 },
  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bgInput, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  iconEditBtn:{ width: 12, height: 12 },
  editBtnText:{ fontSize: 12, fontWeight: '700', color: Colors.black },
  deleteBtn:  { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  iconDeleteBtn: { width: 14, height: 14 },
  pkgName:   { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  pkgDesc:   { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 14 },

  priceHero: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  priceHeroLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3, opacity: 0.8 },
  priceHeroValue: { fontSize: 24, fontWeight: '900' },
  priceHeroDivider: { width: 1, height: 38, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 16 },
  priceHeroStatsCol: { flex: 1, gap: 6 },
  priceHeroStatRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  priceHeroStatValue: { fontSize: 14, fontWeight: '900', color: Colors.black },
  priceHeroStatLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  pkgIncludesWrap: { marginBottom: 12 },
  pkgIncludesTitle: { fontSize: 9, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 7 },
  pkgIncludeRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  iconIncludeCheck: { width: 13, height: 13 },
  pkgIncludeText:  { fontSize: 12, color: Colors.textSecondary },

  pkgFoodWrap:      { marginBottom: 12, backgroundColor: Colors.bgInput, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  pkgFoodCatGroup:  { marginBottom: 8 },
  pkgFoodCatLabel:  { fontSize: 11, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  pkgFoodItem:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pkgFoodDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.orange, flexShrink: 0 },
  pkgFoodName:      { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  pkgFoodServing:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },

  pkgEventTypesWrap: { marginTop: 2 },
  pkgEventTypesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pkgEventTypeChip:  { backgroundColor: Colors.orangeLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FFB26B' },
  pkgEventTypeText:  { fontSize: 11, fontWeight: '700', color: Colors.orange },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle:  { fontSize: 22, fontWeight: '900', color: Colors.black },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center' },
  iconModalClose: { width: 13, height: 13 },
  label:       { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 8 },
  fieldHint:   { fontSize: 11, color: Colors.textMuted, marginBottom: 10, marginTop: -4 },
  input:       { backgroundColor: Colors.bgInput, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 16 },
  textArea:    { backgroundColor: Colors.bgInput, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, fontSize: 14, color: Colors.textPrimary, minHeight: 90, marginBottom: 16 },
  rowInputs:   { flexDirection: 'row', gap: 12 },

  photoPickerWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  photoPickerPreview: { width: '100%', height: 180 },
  photoPickerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, alignItems: 'center' },
  photoPickerOverlayText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  photoPickerPlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput },
  photoPickerLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  photoPickerHint:  { fontSize: 11, color: Colors.textMuted },

  menuCatSection:    { marginBottom: 12 },
  menuCatSectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  menuItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  menuItemRowSelected: { backgroundColor: Colors.orangeLight, borderColor: Colors.orange },
  menuItemCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  menuItemCheckboxSelected: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  iconMenuCheck: { width: 12, height: 12 },
  menuItemRowInfo: { flex: 1 },
  menuItemRowName: { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 2 },
  menuItemRowNameSelected: { color: Colors.orange },
  menuItemRowDesc: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  menuItemRowServing: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  menuItemRowPrice: { fontSize: 12, fontWeight: '800', color: Colors.orange },
  noMenuItemsBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  noMenuItemsText: { fontSize: 13, color: '#92400E', lineHeight: 19 },
  selectedFoodSummary: { backgroundColor: Colors.orangeLight, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FFB26B' },
  selectedFoodSummaryText: { fontSize: 13, fontWeight: '800', color: Colors.orange, textAlign: 'center' },

  tierChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgInput },
  iconTierCheck: { width: 12, height: 12 },
  tierChipText:{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  suggestionsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  suggestionChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border },
  suggestionChipActive: { backgroundColor: Colors.orangeLight, borderColor: Colors.orange },
  iconSuggestionCheck: { width: 11, height: 11 },
  suggestionText:    { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  suggestionTextActive: { color: Colors.orange, fontWeight: '800' },
  customIncludeRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addIncludeBtn:     { backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  addIncludeBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  selectedIncludesWrap:  { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  selectedIncludesTitle: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, marginBottom: 8 },
  selectedIncludeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  iconSelectedCheck:     { width: 13, height: 13 },
  selectedIncludeText:   { flex: 1, fontSize: 13, color: Colors.black },
  iconRemoveInclude:     { width: 11, height: 11, marginLeft: 4 },
  eventTypesGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  eventTypeChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border },
  eventTypeChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  eventTypeText:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  eventTypeTextActive: { color: Colors.white, fontWeight: '800' },
  saveBtn:     { backgroundColor: Colors.orange, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
});