import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Plus, Edit3, Trash2, Check,
  ChevronDown, UtensilsCrossed, Soup, CakeSlice,
  CupSoda, Scale, ImagePlus,
} from 'lucide-react-native';

type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price_per_guest: number;
  serving_size: number | null;
  serving_unit: string | null;
  image_url: string | null;
};

const CATEGORIES = [
  { key: 'main_course', label: 'Main Course', icon: UtensilsCrossed, color: Colors.orange },
  { key: 'appetizer', label: 'Appetizer', icon: Soup, color: '#16A34A' },
  { key: 'dessert', label: 'Dessert', icon: CakeSlice, color: '#EC4899' },
  { key: 'drink', label: 'Drink', icon: CupSoda, color: '#2563EB' },
];

const SERVING_UNITS = [
  { label: 'per person', value: 'per person' },
  { label: 'kg', value: 'kg' },
  { label: 'grams', value: 'grams' },
  { label: 'ml', value: 'ml' },
  { label: 'liter', value: 'liter' },
  { label: 'tub', value: 'tub' },
  { label: 'tray', value: 'tray' },
  { label: 'platter', value: 'platter' },
  { label: 'pack', value: 'pack' },
  { label: 'dozen', value: 'dozen' },
  { label: 'piece', value: 'piece' },
  { label: 'cup', value: 'cup' },
  { label: 'bottle', value: 'bottle' },
  { label: 'gallon', value: 'gallon' },
];

const EMPTY_FORM = {
  name: '',
  category: 'main_course',
  description: '',
  price_per_guest: '',
  serving_size: '',
  serving_unit: 'per person',
  image_url: '',
};

export default function MenuScreen() {
  const { catererData } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeCategory, setActiveCategory] = useState('main_course');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!catererData?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, category, description, price_per_guest, serving_size, serving_unit, image_url')
      .eq('caterer_id', catererData.id)
      .order('category')
      .order('name');

    if (error) {
      console.warn('menu_items load error:', error.message);
      Alert.alert('Error', 'Unable to load menu items.');
    }

    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!catererData?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, description, price_per_guest, serving_size, serving_unit, image_url')
        .eq('caterer_id', catererData.id)
        .order('category')
        .order('name');

      if (cancelled) return;

      if (error) console.warn('menu_items load error:', error.message);

      setItems(data ?? []);
      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [catererData?.id]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: activeCategory });
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description ?? '',
      price_per_guest: String(item.price_per_guest),
      serving_size: item.serving_size ? String(item.serving_size) : '',
      serving_unit: item.serving_unit ?? 'per person',
      image_url: item.image_url ?? '',
    });
    setShowForm(true);
  };

  // Matches the existing Mobile Packages image-picker + Supabase Storage flow.
  const handlePickImage = async () => {
    if (!catererData?.id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload a menu image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Upload failed', 'Could not read the selected image.');
      return;
    }
    setUploadingImage(true);
    try {
      const contentType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const extension = contentType === 'image/png' ? 'png' : 'jpg';
      const path = `${catererData.id}/menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const characters = atob(asset.base64);
      const bytes = new Uint8Array(characters.length);
      for (let i = 0; i < characters.length; i++) bytes[i] = characters.charCodeAt(i);
      const { error } = await supabase.storage.from('caterer-media')
        .upload(path, bytes, { contentType, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('caterer-media').getPublicUrl(path);
      setForm(current => ({ ...current, image_url: data.publicUrl }));
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message ?? 'Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (uploadingImage || saving) return;
    if (!form.name.trim()) {
      Alert.alert('Required', 'Item name is required.');
      return;
    }

    const price = Number(form.price_per_guest);

    if (!form.price_per_guest.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Required', 'Enter a valid price greater than zero.');
      return;
    }

    if (!catererData?.id) return;

    const servingSize = form.serving_size.trim()
      ? Number(form.serving_size)
      : null;

    if (servingSize !== null && (!Number.isFinite(servingSize) || servingSize <= 0)) {
      Alert.alert('Invalid Serving Size', 'Enter a valid serving size greater than zero.');
      return;
    }

    setSaving(true);

    const payload = {
      caterer_id: catererData.id,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price_per_guest: price,
      serving_size: servingSize,
      serving_unit: form.serving_unit || null,
      image_url: form.image_url || null,
    };

    if (editing) {
      const { error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', editing.id)
        .eq('caterer_id', catererData.id);

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('menu_items')
        .insert(payload);

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (item: MenuItem) => {
    if (!catererData?.id) return;

    const { data: references, error: referenceError } = await supabase
      .from('booking_customizations')
      .select('id')
      .eq('menu_item_id', item.id)
      .limit(1);

    if (referenceError) {
      Alert.alert('Error', referenceError.message);
      return;
    }

    if (references?.length) {
      Alert.alert(
        'Cannot Delete Menu Item',
        'This menu item is included in booking records and cannot be deleted. Edit the item details instead.'
      );
      return;
    }

    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from your menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('menu_items')
              .delete()
              .eq('id', item.id)
              .eq('caterer_id', catererData.id);

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }

            await load();
          },
        },
      ]
    );
  };

  const formatServing = (item: MenuItem) => {
    if (!item.serving_unit) return null;
    if (item.serving_size) return `${item.serving_size} ${item.serving_unit}`;
    return item.serving_unit;
  };

  const filteredItems = items.filter(item => item.category === activeCategory);
  const catInfo = CATEGORIES.find(category => category.key === activeCategory);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>Menu Items</Text>
          <Text style={styles.pageSub}>{items.length} items across all categories</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAdd}
          activeOpacity={0.85}
          accessibilityLabel="Add Item"
        >
          <Plus size={22} color={Colors.white} strokeWidth={3} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          {CATEGORIES.map(cat => {
            const count = items.filter(item => item.category === cat.key).length;
            const isActive = activeCategory === cat.key;

            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.catTab,
                  isActive && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.85}
              >
                <cat.icon
                  size={16}
                  color={isActive ? Colors.white : Colors.textSecondary}
                />

                <Text style={[styles.catTabLabel, isActive && styles.catTabLabelActive]}>
                  {cat.label}
                </Text>

                {count > 0 && (
                  <View style={[styles.catTabCount, isActive && styles.catTabCountActive]}>
                    <Text style={[styles.catTabCountText, isActive && styles.catTabCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: (catInfo?.color ?? Colors.orange) + '15' },
            ]}
          >
            {catInfo && (
              <catInfo.icon size={42} color={catInfo.color} strokeWidth={1.5} />
            )}
          </View>

          <Text style={styles.emptyTitle}>No {catInfo?.label} yet</Text>
          <Text style={styles.emptySub}>
            Tap "Add" to create your first {catInfo?.label?.toLowerCase()} item.
          </Text>

          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={openAdd}
            activeOpacity={0.85}
          >
            <Plus size={18} color={Colors.white} />
            <Text style={styles.emptyAddBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
        >
          {filteredItems.map(item => {
            const serving = formatServing(item);
            const itemColor = getCategoryColor(item.category);

            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={[styles.itemColorBar, { backgroundColor: itemColor }]} />

                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.itemImagePlaceholder}><ImagePlus size={23} color={Colors.textMuted} /></View>
                )}
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>

                      {item.description && (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>

                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openEdit(item)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Edit ${item.name}`}
                      >
                        <Edit3 size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnDelete}
                        onPress={() => handleDelete(item)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Delete ${item.name}`}
                      >
                        <Trash2 size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.itemBottom}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceValue}>
                        ₱{Number(item.price_per_guest).toLocaleString()}
                      </Text>
                      <Text style={styles.pricePer}>/guest</Text>
                    </View>

                    {serving && (
                      <View style={styles.servingBadge}>
                        <Scale size={12} color={Colors.textSecondary} />
                        <Text style={styles.servingText}>{serving}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 24 : 16 }]}>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              style={styles.modalHeaderBtn}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {editing ? 'Edit Item' : 'New Item'}
            </Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || uploadingImage}
              style={styles.modalHeaderBtn}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.orange} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>ITEM DETAILS</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Item Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Beef Caldereta, Lechon..."
                  placeholderTextColor={Colors.textMuted}
                  value={form.name}
                  onChangeText={value => setForm(current => ({ ...current, name: value }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category *</Text>

                <View style={styles.categoryGrid}>
                  {CATEGORIES.map(cat => {
                    const isActive = form.category === cat.key;

                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.catChip,
                          isActive && {
                            backgroundColor: cat.color + '12',
                            borderColor: cat.color,
                          },
                        ]}
                        onPress={() => setForm(current => ({ ...current, category: cat.key }))}
                        activeOpacity={0.85}
                      >
                        <cat.icon
                          size={18}
                          color={isActive ? cat.color : Colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.catChipLabel,
                            isActive && { color: cat.color, fontWeight: '800' },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  placeholder="Describe the dish — ingredients, flavor, preparation..."
                  placeholderTextColor={Colors.textMuted}
                  value={form.description}
                  onChangeText={value => setForm(current => ({ ...current, description: value }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>FOOD PHOTO (OPTIONAL)</Text>
              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.imagePreview} resizeMode="cover" />
              ) : <View style={styles.imagePlaceholder}><ImagePlus size={30} color={Colors.textMuted} /></View>}
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.imageButton} onPress={handlePickImage} disabled={uploadingImage || saving}>
                  {uploadingImage ? <ActivityIndicator color={Colors.white} size="small" /> : <ImagePlus color={Colors.white} size={18} />}
                  <Text style={styles.imageButtonText}>{uploadingImage ? 'Uploading...' : form.image_url ? 'Replace Image' : 'Upload Image'}</Text>
                </TouchableOpacity>
                {!!form.image_url && <TouchableOpacity style={styles.removeImageButton}
                  disabled={uploadingImage || saving} onPress={() => setForm(current => ({ ...current, image_url: '' }))}>
                  <Text style={styles.removeImageText}>Remove</Text>
                </TouchableOpacity>}
              </View>
              <Text style={styles.formHint}>Square food photo recommended. Optional.</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>PRICING & SERVING</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price per Guest (₱) *</Text>
                <Text style={styles.formHint}>
                  Added to total when this item is selected
                </Text>

                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 120"
                  placeholderTextColor={Colors.textMuted}
                  value={form.price_per_guest}
                  onChangeText={value => setForm(current => ({
                    ...current,
                    price_per_guest: value,
                  }))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Serving Size Overview</Text>
                <Text style={styles.formHint}>
                  Tell customers how much they get — e.g. "1 kg per 10 guests", "1 tub serves 20"
                </Text>

                <View style={styles.servingRow}>
                  <TextInput
                    style={[styles.formInput, styles.servingSizeInput]}
                    placeholder="Amount"
                    placeholderTextColor={Colors.textMuted}
                    value={form.serving_size}
                    onChangeText={value => setForm(current => ({
                      ...current,
                      serving_size: value,
                    }))}
                    keyboardType="decimal-pad"
                  />

                  <TouchableOpacity
                    style={styles.unitPickerBtn}
                    onPress={() => setShowUnitPicker(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.unitPickerBtnText}>{form.serving_unit}</Text>
                    <ChevronDown size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {(form.serving_size || form.serving_unit) && (
                  <View style={styles.servingPreview}>
                    <Text style={styles.servingPreviewLabel}>Preview:</Text>
                    <Text style={styles.servingPreviewValue}>
                      {form.serving_size ? `${form.serving_size} ` : ''}
                      {form.serving_unit}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quick Serving Examples</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                >
                  {[
                    { size: '1', unit: 'kg', label: '1 kg' },
                    { size: '500', unit: 'grams', label: '500g' },
                    { size: '1', unit: 'tub', label: '1 tub' },
                    { size: '1', unit: 'tray', label: '1 tray' },
                    { size: '1', unit: 'liter', label: '1 liter' },
                    { size: '', unit: 'per person', label: 'Per person' },
                    { size: '1', unit: 'platter', label: '1 platter' },
                    { size: '1', unit: 'dozen', label: '1 dozen' },
                  ].map(example => {
                    const isActive =
                      form.serving_size === example.size &&
                      form.serving_unit === example.unit;

                    return (
                      <TouchableOpacity
                        key={example.label}
                        style={[
                          styles.exampleChip,
                          isActive && styles.exampleChipActive,
                        ]}
                        onPress={() => setForm(current => ({
                          ...current,
                          serving_size: example.size,
                          serving_unit: example.unit,
                        }))}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.exampleChipText,
                            isActive && styles.exampleChipTextActive,
                          ]}
                        >
                          {example.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </ScrollView>

          {showUnitPicker && (
            <View style={styles.unitOverlay} pointerEvents="box-none">
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setShowUnitPicker(false)}
              />

              <View style={styles.unitSheet}>
                <View style={styles.unitSheetHandle} />
                <Text style={styles.unitSheetTitle}>Select Unit</Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {SERVING_UNITS.map(unit => {
                    const isActive = form.serving_unit === unit.value;

                    return (
                      <TouchableOpacity
                        key={unit.value}
                        style={styles.unitOption}
                        onPress={() => {
                          setForm(current => ({
                            ...current,
                            serving_unit: unit.value,
                          }));
                          setShowUnitPicker(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.unitOptionText,
                            isActive && styles.unitOptionTextActive,
                          ]}
                        >
                          {unit.label}
                        </Text>

                        {isActive && <Check size={20} color={Colors.orange} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function getCategoryColor(category: string) {
  const map: Record<string, string> = {
    main_course: Colors.orange,
    appetizer: '#16A34A',
    dessert: '#EC4899',
    drink: '#2563EB',
  };

  return map[category] ?? Colors.orange;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabsContainer: {
    backgroundColor: Colors.white,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryTabs: { paddingHorizontal: 20, gap: 8 },
  catTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catTabLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catTabLabelActive: { color: Colors.white, fontWeight: '800' },
  catTabCount: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  catTabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  catTabCountText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  catTabCountTextActive: { color: Colors.white },
  list: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20 },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  itemColorBar: { width: 6 },
  itemImage: { width: 82, height: 100, alignSelf: 'center', marginLeft: 8, borderRadius: 10 },
  itemImagePlaceholder: { width: 82, height: 100, marginLeft: 8, alignSelf: 'center', borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  imagePreview: { width: 180, height: 180, borderRadius: 12, backgroundColor: '#F8FAFC' },
  imagePlaceholder: { width: 180, height: 150, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  imageActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  imageButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.orange },
  imageButtonText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  removeImageButton: { padding: 10 },
  removeImageText: { color: Colors.error, fontWeight: '700' },
  itemBody: { flex: 1, padding: 16 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  itemDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionBtnDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  itemBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  priceValue: { fontSize: 14, fontWeight: '900', color: Colors.orange },
  pricePer: { fontSize: 11, color: Colors.orange, fontWeight: '600', marginLeft: 2 },
  servingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  servingText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyAddBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  modalRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  modalCancel: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  modalSave: { fontSize: 16, color: Colors.orange, fontWeight: '800' },
  modalBody: { padding: 20, paddingBottom: 60, gap: 24 },
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  formGroup: { marginBottom: 20 },
  formLabel: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  formHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 10, lineHeight: 16 },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.black,
  },
  formTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  servingRow: { flexDirection: 'row', gap: 10 },
  servingSizeInput: { flex: 1 },
  unitPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 140,
  },
  unitPickerBtnText: { fontSize: 15, fontWeight: '700', color: Colors.black },
  servingPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  servingPreviewLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  servingPreviewValue: { fontSize: 14, fontWeight: '900', color: Colors.orange },
  exampleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exampleChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  exampleChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  exampleChipTextActive: { color: Colors.white, fontWeight: '800' },
  unitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  unitSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  unitSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  unitSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.black,
    marginBottom: 16,
    textAlign: 'center',
  },
  unitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unitOptionText: { fontSize: 16, color: Colors.black, fontWeight: '600' },
  unitOptionTextActive: { color: Colors.orange, fontWeight: '800' },
});
