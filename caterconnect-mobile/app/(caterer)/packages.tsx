import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Plus, Edit3, Trash2, X, Check, Image as ImageIcon, 
  CheckCircle2, UtensilsCrossed, PackageSearch, XCircle, 
  DollarSign, Users
} from 'lucide-react-native';

type Package = {
  id: string;
  tier: string;
  name: string;
  description: string | null;
  price: number;
  guest_capacity: number;
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

  // Form State
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
  
  // New Direct Entry Food State
  const [foodInclusions, setFoodInclusions] = useState<string[]>([]);
  const [newFood, setNewFood] = useState('');

  const load = async () => {
    if (!catererData?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('caterer_id', catererData.id)
      .order('created_at', { ascending: true });
    
    setPackages(data ?? []);
    setLoading(false);
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
    setIncludes([]); setCustomInclude(''); setEventTypes([]);
    setFoodInclusions([]); setNewFood('');
    setImageUrl(null);
    setShowModal(true);
  };

  const openEdit = (pkg: Package) => {
    setEditing(pkg);
    setName(pkg.name); setTier(pkg.tier); setDescription(pkg.description ?? '');
    setPrice(String(pkg.price)); setGuestCapacity(String(pkg.guest_capacity)); setMinGuests(String(pkg.min_guests ?? ''));
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
    if (!name.trim() || !price || !guestCapacity) {
      Alert.alert('Missing fields', 'Name, price, and guest capacity are required.');
      return;
    }
    if (!catererData?.id) return;

    setSaving(true);
    const payload = {
      caterer_id: catererData.id,
      name: name.trim(),
      tier,
      description: description.trim() || null,
      price: parseFloat(price),
      guest_capacity: parseInt(guestCapacity),
      min_guests: minGuests ? parseInt(minGuests) : null,
      includes: includes.length > 0 ? includes : null,
      food_inclusions: foodInclusions.length > 0 ? foodInclusions : null,
      event_types: eventTypes.length > 0 ? eventTypes : null,
      image_url: imageUrl,
    };

    if (editing) {
      const { error } = await supabase.from('packages').update(payload).eq('id', editing.id);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('packages').insert(payload);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowModal(false);
    load();
  };

  const handleDelete = (pkg: Package) => {
    Alert.alert('Delete Package', `Remove "${pkg.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('packages').delete().eq('id', pkg.id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>My Packages</Text>
          {packages.length > 0 && (
            <Text style={styles.pageCount}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.85}>
          <Plus size={18} color={Colors.white} strokeWidth={3} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : packages.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <PackageSearch size={48} color={Colors.orange} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No packages yet</Text>
          <Text style={styles.emptySub}>Create your first catering package to start receiving bookings.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.85}>
            <Plus size={20} color={Colors.white} />
            <Text style={styles.emptyBtnText}>Create Package</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
          {packages.map((pkg) => {
            const tierColor = TIER_COLORS[pkg.tier] ?? Colors.orange;

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
                    <Text style={styles.pkgName} numberOfLines={1}>{pkg.name}</Text>
                    <View style={styles.pkgActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(pkg)}>
                        <Edit3 size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDelete(pkg)}>
                        <Trash2 size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {pkg.description && <Text style={styles.pkgDesc} numberOfLines={2}>{pkg.description}</Text>}

                  <View style={[styles.metricsRow, { backgroundColor: tierColor + '10' }]}>
                    <View style={styles.metric}>
                      <DollarSign size={16} color={tierColor} />
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
                        <Text style={styles.metricLabel}>Max Guests</Text>
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
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)} activeOpacity={0.8}>
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
                <Text style={styles.inputLabel}>Base Price (₱) *</Text>
                <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted} value={price} onChangeText={setPrice} keyboardType="numeric" />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Max Guests *</Text>
                <TextInput style={styles.input} placeholder="100" placeholderTextColor={Colors.textMuted} value={guestCapacity} onChangeText={setGuestCapacity} keyboardType="numeric" />
              </View>
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
              <TouchableOpacity style={styles.customAddBtn} onPress={addFood}>
                <Plus size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {foodInclusions.length > 0 && (
              <View style={styles.selectedPillWrap}>
                {foodInclusions.map((food, i) => (
                  <View key={i} style={[styles.selectedPill, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                    <UtensilsCrossed size={14} color={Colors.orange} />
                    <Text style={[styles.selectedPillText, { color: Colors.orange }]}>{food}</Text>
                    <TouchableOpacity onPress={() => removeFood(food)} style={{ padding: 2 }}>
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
              <TouchableOpacity style={[styles.customAddBtn, { backgroundColor: Colors.success }]} onPress={addCustomInclude}>
                <Plus size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {includes.length > 0 && (
              <View style={styles.selectedPillWrap}>
                {includes.map((inc, i) => (
                  <View key={i} style={styles.selectedPill}>
                    <Check size={14} color={Colors.success} />
                    <Text style={styles.selectedPillText}>{inc}</Text>
                    <TouchableOpacity onPress={() => removeInclude(inc)} style={{ padding: 2 }}>
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
                  <TouchableOpacity key={item} style={styles.suggestionPill} onPress={() => toggleInclude(item)}>
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
          >
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Create Package'}</Text>}
          </TouchableOpacity>
          
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 24, paddingBottom: 20, 
    backgroundColor: Colors.white, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    zIndex: 10
  },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageCount: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  addBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: Colors.orange, borderRadius: 24, 
    paddingHorizontal: 16, paddingVertical: 10, 
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 
  },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16 },
  emptyBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },

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
  pkgHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pkgName: { flex: 1, fontSize: 20, fontWeight: '900', color: Colors.black, letterSpacing: -0.5, paddingRight: 12 },
  pkgActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  actionBtnDelete: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  pkgDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  
  metricsRow: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 20 },
  metric: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricDivider: { width: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 12 },
  metricValue: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  pkgPreviewData: { gap: 16 },
  previewSection: { gap: 8 },
  previewLabel: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2 },
  previewTextSub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
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

  saveBtn: { backgroundColor: Colors.orange, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
});