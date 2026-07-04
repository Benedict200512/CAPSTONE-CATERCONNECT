import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const ICONS = {
  mainCourse: require('../../assets/icons/main_course.png'),
  appetizer: require('../../assets/icons/appetizer.png'),
  dessert: require('../../assets/icons/dessert.png'),
  drink: require('../../assets/icons/drink.png'),
  scale: require('../../assets/icons/scale.png'),
  close: require('../../assets/icons/close.png'),
  checkOutline: require('../../assets/icons/check_outline.png'),
  chevronDown: require('../../assets/icons/chevron_down.png'),
  plusWhite: require('../../assets/icons/plus_white.png'),
};

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
  { key: 'main_course', label: 'Main Course', icon: ICONS.mainCourse, color: Colors.orange },
  { key: 'appetizer',   label: 'Appetizer',   icon: ICONS.appetizer,  color: '#16A34A' },
  { key: 'dessert',     label: 'Dessert',     icon: ICONS.dessert,    color: '#EC4899' },
  { key: 'drink',       label: 'Drink',       icon: ICONS.drink,      color: '#2563EB' },
];

const SERVING_UNITS = [
  { label: 'per person',  value: 'per person'  },
  { label: 'kg',          value: 'kg'          },
  { label: 'grams',       value: 'grams'       },
  { label: 'ml',          value: 'ml'          },
  { label: 'liter',       value: 'liter'       },
  { label: 'tub',         value: 'tub'         },
  { label: 'tray',        value: 'tray'        },
  { label: 'platter',     value: 'platter'     },
  { label: 'pack',        value: 'pack'        },
  { label: 'dozen',       value: 'dozen'       },
  { label: 'piece',       value: 'piece'       },
  { label: 'cup',         value: 'cup'         },
  { label: 'bottle',      value: 'bottle'      },
  { label: 'gallon',      value: 'gallon'      },
];

const EMPTY_FORM = {
  name: '', category: 'main_course', description: '',
  price_per_guest: '', serving_size: '', serving_unit: 'per person',
};

export default function MenuScreen() {
  const { catererData } = useAuth();
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<MenuItem | null>(null);
  const [saving, setSaving]       = useState(false);
  const [activeCategory, setActiveCategory] = useState('main_course');
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!catererData?.id) return;
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('caterer_id', catererData.id)
      .order('category')
      .order('name');
    if (error) {
      console.warn('menu_items load error:', error.message);
    }
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!catererData?.id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('caterer_id', catererData.id)
        .order('category')
        .order('name');
      if (cancelled) return; // avoid setting state if screen unmounted mid-fetch
      if (error) console.warn('menu_items load error:', error.message);
      setItems(data ?? []);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [catererData?.id]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: activeCategory });
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name:           item.name,
      category:       item.category,
      description:    item.description ?? '',
      price_per_guest: String(item.price_per_guest),
      serving_size:   item.serving_size ? String(item.serving_size) : '',
      serving_unit:   item.serving_unit ?? 'per person',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())          { Alert.alert('Required', 'Item name is required.'); return; }
    if (!form.price_per_guest)      { Alert.alert('Required', 'Price is required.'); return; }
    if (!catererData?.id)           return;

    setSaving(true);
    const payload = {
      caterer_id:      catererData.id,
      name:            form.name.trim(),
      category:        form.category,
      description:     form.description.trim() || null,
      price_per_guest: parseFloat(form.price_per_guest) || 0,
      serving_size:    form.serving_size ? parseFloat(form.serving_size) : null,
      serving_unit:    form.serving_unit || null,
    };

    if (editing) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editing.id);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('menu_items').insert(payload);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from your menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('menu_items').delete().eq('id', item.id);
            load();
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

  const filteredItems = items.filter(i => i.category === activeCategory);
  const catInfo = CATEGORIES.find(c => c.key === activeCategory);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>Menu Items</Text>
          <Text style={styles.pageSub}>{items.length} items across all categories</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Image source={ICONS.plusWhite} style={styles.iconAddBtn} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      >
        {CATEGORIES.map(cat => {
          const count = items.filter(i => i.category === cat.key).length;
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catTab, isActive && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.85}
            >
              <Image
                source={cat.icon}
                style={[styles.iconCatTab, isActive && { tintColor: Colors.white }]}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: (catInfo?.color ?? Colors.orange) + '18' }]}>
            <Image source={catInfo?.icon} style={[styles.emptyIcon, { tintColor: catInfo?.color ?? Colors.orange }]} />
          </View>
          <Text style={styles.emptyTitle}>No {catInfo?.label} yet</Text>
          <Text style={styles.emptySub}>Tap "Add" to add your first item</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.emptyAddBtnText}>Add {catInfo?.label}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {filteredItems.map(item => {
            const serving = formatServing(item);
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={[styles.itemColorBar, { backgroundColor: getCategoryColor(item.category) }]} />

                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                      )}
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} activeOpacity={0.8}>
                        <Image source={ICONS.close} style={[styles.iconDeleteBtn, { tintColor: Colors.error }]} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.itemBottom}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceValue}>₱{item.price_per_guest.toLocaleString()}</Text>
                      <Text style={styles.pricePer}>/guest</Text>
                    </View>

                    {serving && (
                      <View style={styles.servingBadge}>
                        <Image source={ICONS.scale} style={styles.iconServing} />
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

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 16 }]}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit Menu Item' : 'New Menu Item'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.orange} />
                : <Text style={styles.modalSave}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Lechon Baboy, Kare-Kare"
                placeholderTextColor={Colors.textMuted}
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
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
                      style={[styles.catChip, isActive && { backgroundColor: cat.color + '18', borderColor: cat.color }]}
                      onPress={() => setForm(f => ({ ...f, category: cat.key }))}
                      activeOpacity={0.85}
                    >
                      <Image source={cat.icon} style={[styles.iconCatChip, isActive && { tintColor: cat.color }]} />
                      <Text style={[styles.catChipLabel, isActive && { color: cat.color, fontWeight: '800' }]}>
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
                placeholder="Describe the dish — ingredients, flavor, how it's cooked..."
                placeholderTextColor={Colors.textMuted}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Price per Guest (₱) *</Text>
              <Text style={styles.formHint}>How much this item adds per guest to the total</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 120"
                placeholderTextColor={Colors.textMuted}
                value={form.price_per_guest}
                onChangeText={v => setForm(f => ({ ...f, price_per_guest: v }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Serving Size</Text>
              <Text style={styles.formHint}>
                Tell customers how much they get — e.g. "1 kg per 10 guests", "1 tub serves 20"
              </Text>
              <View style={styles.servingRow}>
                <TextInput
                  style={[styles.formInput, styles.servingSizeInput]}
                  placeholder="Amount"
                  placeholderTextColor={Colors.textMuted}
                  value={form.serving_size}
                  onChangeText={v => setForm(f => ({ ...f, serving_size: v }))}
                  keyboardType="decimal-pad"
                />

                <TouchableOpacity
                  style={styles.unitPickerBtn}
                  onPress={() => setShowUnitPicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.unitPickerBtnText}>{form.serving_unit}</Text>
                  <Image source={ICONS.chevronDown} style={styles.iconUnitChevron} />
                </TouchableOpacity>
              </View>

              {(form.serving_size || form.serving_unit) && (
                <View style={styles.servingPreview}>
                  <Text style={styles.servingPreviewLabel}>Preview:</Text>
                  <Text style={styles.servingPreviewValue}>
                    {form.serving_size ? `${form.serving_size} ` : ''}{form.serving_unit}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Quick Examples</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { size: '1',   unit: 'kg',         label: '1 kg'         },
                  { size: '500', unit: 'grams',       label: '500g'         },
                  { size: '1',   unit: 'tub',         label: '1 tub'        },
                  { size: '1',   unit: 'tray',        label: '1 tray'       },
                  { size: '1',   unit: 'liter',       label: '1 liter'      },
                  { size: '',    unit: 'per person',   label: 'Per person'   },
                  { size: '1',   unit: 'platter',     label: '1 platter'    },
                  { size: '1',   unit: 'dozen',       label: '1 dozen'      },
                ].map(ex => (
                  <TouchableOpacity
                    key={ex.label}
                    style={[
                      styles.exampleChip,
                      form.serving_size === ex.size && form.serving_unit === ex.unit && styles.exampleChipActive,
                    ]}
                    onPress={() => setForm(f => ({
                      ...f,
                      serving_size: ex.size,
                      serving_unit: ex.unit,
                    }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.exampleChipText,
                      form.serving_size === ex.size && form.serving_unit === ex.unit && styles.exampleChipTextActive,
                    ]}>
                      {ex.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* ── Unit picker — rendered as an in-modal overlay, NOT a second
              stacked <Modal>. iOS handles two simultaneously-visible native
              Modals poorly (the second one's touch events can get swallowed
              by the first), which is why tapping the unit button/options was
              unreliable before. This overlay lives inside the same Modal as
              the form, so there's only ever one native modal window. ── */}
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
                          setForm(f => ({ ...f, serving_unit: unit.value }));
                          setShowUnitPicker(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.unitOptionText,
                          isActive && styles.unitOptionTextActive,
                        ]}>
                          {unit.label}
                        </Text>
                        {isActive && (
                          <Image source={ICONS.checkOutline} style={[styles.iconUnitCheck, { tintColor: Colors.orange }]} />
                        )}
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

function getCategoryColor(cat: string) {
  const map: Record<string, string> = {
    main_course: Colors.orange,
    appetizer:   '#16A34A',
    dessert:     '#EC4899',
    drink:       '#2563EB',
  };
  return map[cat] ?? Colors.orange;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 10 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black },
  pageSub:   { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  iconAddBtn: { width: 13, height: 13 },
  addBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },

  categoryTabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catTab: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  iconCatTab:   { width: 17, height: 17 },
  catTabLabel:  { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catTabLabelActive: { color: Colors.white, fontWeight: '800' },
  catTabCount:  { backgroundColor: Colors.bgInput, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  catTabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  catTabCountText: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  catTabCountTextActive: { color: Colors.white },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  itemCard: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  itemColorBar: { width: 5 },
  itemBody:     { flex: 1, padding: 14 },
  itemTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  itemName:     { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 3 },
  itemDesc:     { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  itemActions:  { flexDirection: 'row', gap: 6 },
  editBtn: {
    backgroundColor: Colors.bgInput, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  editBtnText:   { fontSize: 12, fontWeight: '700', color: Colors.black },
  deleteBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FECACA',
    justifyContent: 'center', alignItems: 'center',
  },
  iconDeleteBtn: { width: 12, height: 12 },
  itemBottom:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  priceBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    backgroundColor: Colors.orangeLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  priceValue:  { fontSize: 15, fontWeight: '900', color: Colors.orange },
  pricePer:    { fontSize: 11, color: Colors.orange, fontWeight: '600' },
  servingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgInput, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconServing: { width: 12, height: 12, tintColor: Colors.textSecondary },
  servingText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  emptyIconWrap:  { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyIcon:      { width: 38, height: 38 },
  emptyTitle:     { fontSize: 18, fontWeight: '800', color: Colors.black },
  emptySub:       { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  emptyAddBtn: {
    marginTop: 16, backgroundColor: Colors.orange,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyAddBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  modalRoot:   { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalCancel: { fontSize: 15, color: Colors.textSecondary, fontWeight: '700' },
  modalTitle:  { fontSize: 17, fontWeight: '900', color: Colors.black },
  modalSave:   { fontSize: 15, color: Colors.orange, fontWeight: '900' },
  modalBody:   { padding: 20, paddingBottom: 48 },

  formGroup:   { marginBottom: 22 },
  formLabel:   { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  formHint:    { fontSize: 11, color: Colors.textMuted, marginBottom: 10, lineHeight: 16 },
  formInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.black,
  },
  formTextarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  iconCatChip:        { width: 18, height: 18 },
  catChipLabel:       { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  servingRow:        { flexDirection: 'row', gap: 10 },
  servingSizeInput:  { flex: 1 },
  unitPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    minWidth: 130,
  },
  unitPickerBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.black },
  iconUnitChevron: { width: 11, height: 11, tintColor: Colors.textMuted },
  servingPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.orangeLight, borderRadius: 10,
    padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#FFB26B',
  },
  servingPreviewLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  servingPreviewValue: { fontSize: 14, fontWeight: '900', color: Colors.orange },

  exampleChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  exampleChipActive:    { backgroundColor: Colors.orange, borderColor: Colors.orange },
  exampleChipText:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  exampleChipTextActive:{ color: Colors.white, fontWeight: '800' },

  unitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  unitSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
  },
  unitSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  unitSheetTitle: {
    fontSize: 17, fontWeight: '900', color: Colors.black,
    marginBottom: 12, textAlign: 'center',
  },
  unitOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  unitOptionText:      { fontSize: 16, color: Colors.black, fontWeight: '500' },
  unitOptionTextActive:{ color: Colors.orange, fontWeight: '800' },
  iconUnitCheck:       { width: 16, height: 16 },
});