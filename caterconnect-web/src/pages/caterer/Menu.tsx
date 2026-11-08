
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, LoaderCircle, UtensilsCrossed,
  Soup, CakeSlice, CupSoda, Scale, AlertCircle, CheckCircle2, RefreshCw, ImagePlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import { supabase } from '../../lib/supabase';

type MenuItem = {
  id: string;
  caterer_id: string;
  name: string;
  category: string;
  description: string | null;
  price_per_guest: number;
  serving_size: number | null;
  serving_unit: string | null;
  image_url: string | null;
};

type MenuForm = {
  name: string;
  category: string;
  description: string;
  price_per_guest: string;
  serving_size: string;
  serving_unit: string;
  image_url: string;
};

type Category = {
  key: string;
  label: string;
  icon: typeof UtensilsCrossed;
  color: string;
};

const CATEGORIES: Category[] = [
  { key: 'main_course', label: 'Main Course', icon: UtensilsCrossed, color: '#F97316' },
  { key: 'appetizer', label: 'Appetizer', icon: Soup, color: '#16A34A' },
  { key: 'dessert', label: 'Dessert', icon: CakeSlice, color: '#EC4899' },
  { key: 'drink', label: 'Drink', icon: CupSoda, color: '#2563EB' },
];

const SERVING_UNITS = [
  'per person', 'kg', 'grams', 'ml', 'liter', 'tub', 'tray',
  'platter', 'pack', 'dozen', 'piece', 'cup', 'bottle', 'gallon',
];

const EMPTY_FORM: MenuForm = {
  name: '',
  category: 'main_course',
  description: '',
  price_per_guest: '',
  serving_size: '',
  serving_unit: 'per person',
  image_url: '',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      supabaseError.message,
      supabaseError.details,
      supabaseError.hint,
      supabaseError.code ? `Code: ${supabaseError.code}` : '',
    ].filter(Boolean).join(' | ') || 'An unknown error occurred.';
  }

  return String(error || 'An unknown error occurred.');
}

function formatPrice(value: number) {
  return `₱${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getCategory(category: string) {
  return CATEGORIES.find((item) => item.key === category) ?? { key: category, label: category, icon: UtensilsCrossed, color: '#64748B' };
}

export default function CatererMenu() {
  const { session, catererData } = useAuth();
  const catererId = catererData?.id;
  const userId = session?.user?.id;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('main_course');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const menuImageRef = useRef<HTMLInputElement>(null);
  const [selectedMenuPhoto, setSelectedMenuPhoto] = useState<File | null>(null);
  const [menuPhotoPreview, setMenuPhotoPreview] = useState<string | null>(null);
  useEffect(() => {
    return () => { if (menuPhotoPreview) URL.revokeObjectURL(menuPhotoPreview); };
  }, [menuPhotoPreview]);

  const [customServingUnit, setCustomServingUnit] = useState('');
  const [otherUnitSelected, setOtherUnitSelected] = useState(false);

  const loadItems = useCallback(async () => {
    if (!catererId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('menu_items')
        .select('id, caterer_id, name, category, description, price_per_guest, serving_size, serving_unit, image_url')
        .eq('caterer_id', catererId)
        .order('category')
        .order('name');

      if (queryError) throw queryError;
      setItems((data ?? []) as MenuItem[]);
    } catch (err) {
      console.error('Load menu items error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [catererId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Only the four supported food categories are selectable and displayed.
  const categoriesWithCustom = CATEGORIES;

  const categoryCounts = useMemo(() => {
    return categoriesWithCustom.reduce<Record<string, number>>((counts, category) => {
      counts[category.key] = items.filter(
        (item) => item.category === category.key
      ).length;
      return counts;
    }, {});
  }, [items, categoriesWithCustom]);

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = item.category === activeCategory;
      const matchesSearch = !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        (item.description ?? '').toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, search]);

  const updateForm = <K extends keyof MenuForm>(key: K, value: MenuForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: activeCategory });
    setSelectedMenuPhoto(null);
    setMenuPhotoPreview(null);
    setCustomServingUnit('');
    setOtherUnitSelected(false);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditing(item);
    setSelectedMenuPhoto(null);
    setMenuPhotoPreview(null);
    setOtherUnitSelected(!!item.serving_unit && !SERVING_UNITS.includes(item.serving_unit));
    setCustomServingUnit(item.serving_unit && !SERVING_UNITS.includes(item.serving_unit) ? item.serving_unit : '');
    setForm({
      name: item.name,
      category: item.category,
      description: item.description ?? '',
      price_per_guest: String(item.price_per_guest),
      serving_size: item.serving_size != null ? String(item.serving_size) : '',
      serving_unit: item.serving_unit ?? 'per person',
      image_url: item.image_url ?? '',
    });
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploadingImage) return;
    setModalOpen(false);
    setEditing(null);
    setSelectedMenuPhoto(null);
    setMenuPhotoPreview(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const selectMenuPhoto = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Menu image must not exceed 5 MB.');
      return;
    }
    setSelectedMenuPhoto(file);
    setMenuPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  // Upload to the existing caterer-media bucket only when the menu item is saved.
  const uploadMenuImage = async (file: File): Promise<string> => {
    if (!catererId || !userId) throw new Error('Your caterer account is unavailable.');
    setUploadingImage(true);
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${catererId}/menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('caterer-media')
        .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      return supabase.storage.from('caterer-media').getPublicUrl(path).data.publicUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!catererId || !userId) {
      setError('Your caterer account is unavailable. Please log in again.');
      return;
    }

    const name = form.name.trim();
    const selectedCategory = form.category;
    const selectedUnit = otherUnitSelected ? customServingUnit.trim() : form.serving_unit;
    if (!CATEGORIES.some((category) => category.key === selectedCategory)) {
      setError('Please choose Main Course, Appetizer, Dessert, or Drink.');
      return;
    }
    if (otherUnitSelected && !selectedUnit) {
      setError('Please enter the custom serving unit.');
      return;
    }
    const price = Number(form.price_per_guest);
    const servingSize = form.serving_size.trim()
      ? Number(form.serving_size)
      : null;

    if (!name) {
      setError('Please enter an item name.');
      return;
    }

    if (!form.price_per_guest.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Please enter a valid price greater than zero.');
      return;
    }

    if (servingSize !== null && (!Number.isFinite(servingSize) || servingSize <= 0)) {
      setError('Serving size must be greater than zero.');
      return;
    }

    if (uploadingImage) return;
    setSaving(true);
    setError('');
    setSuccess('');

    // Validate fields before uploading. Images remain local until Save.
    const payload = {
      caterer_id: catererId,
      name,
      category: selectedCategory,
      description: form.description.trim() || null,
      price_per_guest: price,
      serving_size: servingSize,
      serving_unit: selectedUnit || null,
      image_url: form.image_url || null,
    };

    try {
      if (selectedMenuPhoto) payload.image_url = await uploadMenuImage(selectedMenuPhoto);
      if (editing) {
        const { data, error: updateError } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editing.id)
          .eq('caterer_id', catererId)
          .select('id');

        if (updateError) throw updateError;

        if (data?.length !== 1) {
          throw new Error('Menu item could not be updated. Refresh and try again.');
        }

        setSuccess('Menu item updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('menu_items')
          .insert(payload);

        if (insertError) throw insertError;

        setSuccess('Menu item added successfully.');
      }

      setModalOpen(false);
      setEditing(null);
      setSelectedMenuPhoto(null);
      setMenuPhotoPreview(null);
      setForm(EMPTY_FORM);
      await loadItems();
    } catch (err) {
      console.error('Save menu item error:', err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: MenuItem) => {
    if (!catererId) return;

    setDeleting(item.id);
    setError('');
    setSuccess('');

    try {
      const { data: references, error: referenceError } = await supabase
        .from('booking_customizations')
        .select('id')
        .eq('menu_item_id', item.id)
        .limit(1);

      if (referenceError) throw referenceError;

      if (references?.length) {
        throw new Error(
          'This menu item is included in booking records and cannot be deleted. Edit the item details instead.'
        );
      }

      if (!window.confirm(
        `Delete "${item.name}" from your menu? This action cannot be undone.`
      )) return;

      const { data, error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', item.id)
        .eq('caterer_id', catererId)
        .select('id');

      if (deleteError) throw deleteError;

      if (data?.length !== 1) {
        throw new Error('Menu item could not be deleted. Refresh and try again.');
      }

      setSuccess('Menu item deleted successfully.');
      await loadItems();
    } catch (err) {
      console.error('Delete menu item error:', err);
      setError(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const formatServing = (item: MenuItem) => {
    if (!item.serving_unit) return null;

    return item.serving_size != null
      ? `${item.serving_size} ${item.serving_unit}`
      : item.serving_unit;
  };

  if (!catererId) {
    return (
      <div className="menu-page">
        <div className="menu-empty-state">
          <AlertCircle size={36} />
          <h2>Caterer account unavailable</h2>
          <p>Please make sure your caterer profile is set up correctly.</p>
        </div>
      </div>
    );
  }

  const activeCategoryInfo = getCategory(activeCategory);
  const ActiveIcon = activeCategoryInfo.icon;

  return (
    <div className="menu-page">
      <style>{`
        .menu-page{width:100%;max-width:1500px;margin:0 auto;padding:30px;color:#111827;box-sizing:border-box}
        .menu-page *{box-sizing:border-box}
        .menu-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:25px}
        .menu-header h1{font-size:26px;font-weight:750;margin:0 0 7px}
        .menu-header p{color:#64748B;margin:0;font-size:14px}
        .menu-primary{border:0;border-radius:9px;padding:12px 17px;background:#F97316;color:white;font-size:14px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;white-space:nowrap;transition:background .2s}
        .menu-primary:hover{background:#EA580C}
        .menu-primary:disabled{opacity:.6;cursor:not-allowed}
        .menu-alert{display:flex;align-items:flex-start;gap:10px;padding:13px 15px;border-radius:9px;margin-bottom:18px;font-size:13px;overflow-wrap:anywhere}
        .menu-alert.error{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}
        .menu-alert.success{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0}
        .menu-toolbar{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:20px;flex-wrap:wrap}
        .menu-tabs{display:flex;gap:8px;flex-wrap:wrap}
        .menu-tab{border:1px solid #E2E8F0;padding:10px 14px;border-radius:9px;background:white;color:#64748B;font-size:13px;font-weight:650;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
        .menu-tab.active{background:#FFF1E6;color:#C2410C;border-color:#FDBA74}
        .menu-tab-count{background:#F1F5F9;color:#64748B;border-radius:20px;padding:2px 7px;font-size:11px}
        .menu-tab.active .menu-tab-count{background:#FED7AA;color:#9A3412}
        .menu-search{display:flex;align-items:center;gap:9px;border:1px solid #E2E8F0;background:white;border-radius:9px;padding:0 12px;width:260px;color:#94A3B8}
        .menu-search input{width:100%;min-width:0;border:0;outline:0;padding:11px 0;font-size:13px;color:#1E293B;background:transparent}
        .menu-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 17px;color:#64748B;font-size:12px}
        .menu-summary strong{color:#334155}
        .menu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}
        /* Menu skeleton: same grid, card proportions and internal layout as real items. */
        .menu-skeleton-grid{width:100%}
        .menu-skeleton-card{pointer-events:none;transform:none!important;box-shadow:none!important}
        .menu-skeleton-accent{background:#E2E8F0}
        .menu-skeleton-card .caterer-skeleton-block{display:block;border-radius:7px;background:#E9EEF5;position:relative;overflow:hidden;max-width:100%;flex-shrink:0}
        .menu-skeleton-card .caterer-skeleton-block::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.66) 50%,transparent 100%);transform:translateX(-100%);animation:menu-skeleton-shimmer 1.5s ease-in-out infinite}
        .menu-skeleton-image{width:100%;height:138px;margin-bottom:12px;border-radius:9px!important}
        .menu-skeleton-copy{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
        .menu-skeleton-category{width:84px;height:11px}
        .menu-skeleton-title{width:75%;height:19px}
        .menu-skeleton-description{width:95%;height:29px}
        .menu-skeleton-action{width:34px;height:34px;border-radius:8px!important}
        .menu-skeleton-price{width:105px;height:33px;border-radius:8px!important}
        .menu-skeleton-serving{width:86px;height:33px;border-radius:8px!important}
        @keyframes menu-skeleton-shimmer{to{transform:translateX(100%)}}
        @media(prefers-reduced-motion:reduce){.menu-skeleton-card .caterer-skeleton-block::after{animation:none}}
        .menu-card{display:flex;background:white;border:1px solid #E8EDF3;border-radius:12px;overflow:hidden;min-width:0;transition:box-shadow .2s,transform .2s}
        .menu-card:hover{box-shadow:0 7px 22px rgba(15,23,42,.07);transform:translateY(-2px)}
        .menu-card-bar{width:5px;flex-shrink:0}
        .menu-card-content{padding:16px;min-width:0;flex:1}
        .menu-card-image{width:100%;height:138px;object-fit:cover;border-radius:9px;margin-bottom:12px;background:#F8FAFC}
        .menu-card-image-empty{width:100%;height:92px;border-radius:9px;margin-bottom:12px;background:#F8FAFC;display:flex;align-items:center;justify-content:center;color:#94A3B8}
        .menu-image-preview{width:100%;max-width:320px;aspect-ratio:1/1;object-fit:cover;border-radius:10px;border:1px solid #E2E8F0;margin:10px 0}
        .menu-image-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .menu-image-upload{display:inline-flex;align-items:center;gap:8px;border:1px solid #FDBA74;color:#C2410C;background:#FFF7ED;border-radius:8px;padding:10px 14px;cursor:pointer;font-size:13px;font-weight:700}
        .menu-image-upload input{display:none}
        .menu-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}
        .menu-card-title{min-width:0;flex:1}
        .menu-card-title h3{font-size:15px;font-weight:750;color:#1E293B;margin:0 0 6px;overflow-wrap:anywhere}
        .menu-category-label{font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:800;color:#F97316}
        .menu-description{font-size:12px;line-height:1.55;color:#64748B;margin:7px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .menu-actions{display:flex;gap:6px;flex-shrink:0}
        .menu-icon-button{width:34px;height:34px;border:1px solid #E2E8F0;background:white;color:#475569;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .menu-icon-button:hover{background:#F8FAFC}
        .menu-icon-button.delete{color:#DC2626;border-color:#FECACA}
        .menu-icon-button:disabled{opacity:.5;cursor:not-allowed}
        .menu-card-bottom{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid #F1F5F9;padding-top:12px}
        .menu-price{display:inline-flex;align-items:center;gap:4px;background:#FFF7ED;color:#C2410C;border:1px solid #FFEDD5;border-radius:8px;padding:7px 10px;font-size:13px;font-weight:800}
        .menu-price small{font-size:10px;font-weight:600;color:#C2410C}
        .menu-serving{display:inline-flex;align-items:center;gap:6px;background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:650}
        .menu-empty-state{min-height:320px;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:#94A3B8;padding:30px}
        .menu-empty-state h2{color:#334155;margin:14px 0 7px;font-size:18px}
        .menu-empty-state p{color:#64748B;font-size:13px;max-width:370px;line-height:1.6}
        .menu-loading{display:flex;justify-content:center;align-items:center;min-height:280px;color:#F97316}
        .menu-empty-icon{width:75px;height:75px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:5px}
        .menu-modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;justify-content:center;align-items:center;padding:20px;overflow-y:auto}
        .menu-modal{background:white;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;border-radius:15px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
        .menu-modal-header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:15px;background:white;padding:20px 24px;border-bottom:1px solid #E2E8F0}
        .menu-modal-header h2{font-size:19px;margin:0;color:#1E293B}
        .menu-modal-header p{font-size:12px;color:#64748B;margin:5px 0 0}
        .menu-close{background:#F1F5F9;color:#475569;border:0;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
        .menu-form{padding:22px 24px 25px}
        .menu-form-section{margin-bottom:23px}
        .menu-form-section h3{font-size:14px;font-weight:750;color:#334155;margin:0 0 14px}
        .menu-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
        .menu-field{display:flex;flex-direction:column;gap:7px;min-width:0}
        .menu-field.full{grid-column:1/-1}
        .menu-field label{color:#475569;font-size:12px;font-weight:700}
        .menu-field input,.menu-field select,.menu-field textarea{width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:11px 12px;font-family:inherit;font-size:13px;outline:0;color:#1E293B;background:white}
        .menu-field input:focus,.menu-field select:focus,.menu-field textarea:focus{border-color:#F97316;box-shadow:0 0 0 3px rgba(249,115,22,.1)}
        .menu-field textarea{resize:vertical;min-height:90px}
        .menu-field small{font-size:11px;color:#94A3B8}
        .menu-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .menu-category-choice{border:1px solid #E2E8F0;border-radius:9px;background:white;padding:12px;display:flex;align-items:center;gap:9px;color:#64748B;font-size:12px;font-weight:650;cursor:pointer;text-align:left}
        .menu-category-choice.selected{background:#FFF7ED;border-color:#FDBA74;color:#C2410C}
        .menu-form-footer{display:flex;justify-content:flex-end;gap:10px;padding-top:18px;border-top:1px solid #E2E8F0}
        .menu-secondary{border:1px solid #CBD5E1;background:white;color:#475569;border-radius:8px;padding:11px 17px;font-size:13px;font-weight:650;cursor:pointer}
        .menu-secondary:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:768px){.menu-page{padding:20px 15px}.menu-header{flex-direction:column;align-items:stretch}.menu-header .menu-primary{width:100%}.menu-search{width:100%}.menu-toolbar{align-items:stretch}.menu-tabs{width:100%}.menu-tab{flex:1;justify-content:center}.menu-grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}}
        @media(max-width:520px){.menu-page{padding:17px 12px}.menu-header h1{font-size:22px}.menu-grid{grid-template-columns:1fr}.menu-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.menu-tab{padding:9px 7px;font-size:11px}.menu-modal-overlay{padding:8px}.menu-modal{max-height:96vh}.menu-form{padding:18px 15px}.menu-modal-header{padding:16px}.menu-form-grid{grid-template-columns:1fr}.menu-field.full{grid-column:auto}.menu-category-grid{grid-template-columns:1fr 1fr}.menu-summary{align-items:flex-start;flex-direction:column}.menu-form-footer{flex-direction:column-reverse}.menu-form-footer button{width:100%}}
      `}</style>

      <CatererPageHeader
        icon={<UtensilsCrossed size={25} />}
        title="Menu Items"
        description="Manage your food selections, categories, prices, and serving sizes."
        action={<button type="button" className="menu-primary" onClick={openCreateModal}>
          <Plus size={17} /> Add Menu Item
        </button>}
      />

      {error && !modalOpen && (
        <div className="menu-alert error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {success && !modalOpen && (
        <div className="menu-alert success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

      <div className="menu-toolbar">
        <div className="menu-tabs">
          {categoriesWithCustom.map((category) => {
            const Icon = category.icon;
            const active = activeCategory === category.key;

            return (
              <button
                type="button"
                key={category.key}
                className={`menu-tab ${active ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.key)}
              >
                <Icon size={15} />
                {category.label}
                <span className="menu-tab-count">
                  {categoryCounts[category.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="menu-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search menu items..."
          />
        </div>
      </div>

      <div className="menu-summary">
        <span>
          Showing <strong>{visibleItems.length}</strong>{' '}
          {visibleItems.length === 1 ? 'item' : 'items'} in{' '}
          <strong>{activeCategoryInfo.label}</strong>
        </span>
        <span><strong>{items.length}</strong> total menu items</span>
      </div>

      {loading ? (
        <CatererSkeleton variant="menu" label="Loading menu items" />
      ) : visibleItems.length === 0 ? (
        <div className="menu-empty-state">
          <div
            className="menu-empty-icon"
            style={{
              background: `${activeCategoryInfo.color}15`,
              color: activeCategoryInfo.color,
            }}
          >
            <ActiveIcon size={38} />
          </div>
          <h2>{search ? 'No matching menu items' : `No ${activeCategoryInfo.label} yet`}</h2>
          <p>
            {search
              ? 'Try another search term.'
              : `Add your first ${activeCategoryInfo.label.toLowerCase()} item to your catering menu.`}
          </p>
          {!search && (
            <button type="button" className="menu-primary" onClick={openCreateModal}>
              <Plus size={16} /> Add Menu Item
            </button>
          )}
          <button
            type="button"
            className="menu-secondary"
            style={{ marginTop: 12 }}
            onClick={loadItems}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      ) : (
        <div className="menu-grid">
          {visibleItems.map((item) => {
            const category = getCategory(item.category);
            const Icon = category.icon;
            const isDeleting = deleting === item.id;
            const serving = formatServing(item);

            return (
              <article className="menu-card" key={item.id}>
                <div
                  className="menu-card-bar"
                  style={{ background: category.color }}
                />
                <div className="menu-card-content">
                  {item.image_url ? (
                    <img className="menu-card-image" src={item.image_url} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="menu-card-image-empty"><ImagePlus size={26} /></div>
                  )}
                  <div className="menu-card-top">
                    <div className="menu-card-title">
                      <div
                        className="menu-category-label"
                        style={{ color: category.color }}
                      >
                        <Icon
                          size={12}
                          style={{
                            display: 'inline',
                            verticalAlign: 'middle',
                            marginRight: 5,
                          }}
                        />
                        {category.label}
                      </div>
                      <h3>{item.name}</h3>
                      {item.description && (
                        <p className="menu-description">{item.description}</p>
                      )}
                    </div>
                    <div className="menu-actions">
                      <button
                        type="button"
                        className="menu-icon-button"
                        onClick={() => openEditModal(item)}
                        title="Edit item"
                        aria-label={`Edit ${item.name}`}
                        disabled={isDeleting}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="menu-icon-button delete"
                        onClick={() => deleteItem(item)}
                        title="Delete item"
                        aria-label={`Delete ${item.name}`}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <LoaderCircle size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="menu-card-bottom">
                    <span className="menu-price">
                      {formatPrice(Number(item.price_per_guest))}
                      <small>/ guest</small>
                    </span>
                    {serving && (
                      <span className="menu-serving">
                        <Scale size={12} />
                        {serving}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="menu-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="menu-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-modal-title"
          >
            <div className="menu-modal-header">
              <div>
                <h2 id="menu-modal-title">
                  {editing ? 'Edit Menu Item' : 'Add Menu Item'}
                </h2>
                <p>
                  {editing
                    ? 'Update your menu item details.'
                    : 'Add a new food item to your catering menu.'}
                </p>
              </div>
              <button
                type="button"
                className="menu-close"
                onClick={closeModal}
                disabled={saving || uploadingImage}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form className="menu-form" onSubmit={saveItem}>
              {error && (
                <div className="menu-alert error">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}

              <section className="menu-form-section">
                <h3>Item Details</h3>
                <div className="menu-form-grid">
                  <div className="menu-field full">
                    <label htmlFor="menu-name">Item Name *</label>
                    <input
                      id="menu-name"
                      value={form.name}
                      onChange={(event) => updateForm('name', event.target.value)}
                      placeholder="e.g. Beef Caldereta, Lechon..."
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="menu-field full">
                    <label>Category *</label>
                    <div className="menu-category-grid">
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const selected = form.category === category.key;

                        return (
                          <button
                            type="button"
                            key={category.key}
                            className={`menu-category-choice ${selected ? 'selected' : ''}`}
                            onClick={() => {
                              updateForm('category', category.key);
                            }}
                          >
                            <Icon
                              size={18}
                              style={{
                                color: selected ? category.color : '#64748B',
                              }}
                            />
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="menu-field full">
                    <label htmlFor="menu-description">Description</label>
                    <textarea
                      id="menu-description"
                      value={form.description}
                      onChange={(event) => updateForm('description', event.target.value)}
                      placeholder="Describe the dish, ingredients, flavor, or preparation..."
                      maxLength={1000}
                    />
                  </div>
                </div>
              </section>

              <section className="menu-form-section">
                <h3>Food Photo (optional)</h3>
                <div className="menu-image-actions">
                  <input
                    ref={menuImageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      event.stopPropagation();
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      if (file) selectMenuPhoto(file);
                    }}
                  />
                  <button type="button" className="menu-image-upload" disabled={uploadingImage || saving}
                    onClick={(event) => { event.preventDefault(); menuImageRef.current?.click(); }}>
                    <ImagePlus size={17} /> {uploadingImage ? 'Uploading...' : form.image_url ? 'Replace Image' : 'Select Photo'}
                  </button>
                  {(menuPhotoPreview || form.image_url) && <button type="button" className="menu-secondary" disabled={uploadingImage || saving}
                    onClick={() => { setSelectedMenuPhoto(null); setMenuPhotoPreview(null); updateForm('image_url', ''); }}>Remove Image</button>}
                </div>
                {(menuPhotoPreview || form.image_url) && <img src={menuPhotoPreview || form.image_url} alt="Menu item preview" className="menu-image-preview" />}
                <p style={{ color: '#64748B', fontSize: 12 }}>JPG, PNG, or WEBP, maximum 5 MB. Image is optional.</p>
              </section>

              <section className="menu-form-section">
                <h3>Pricing and Serving</h3>
                <div className="menu-form-grid">
                  <div className="menu-field full">
                    <label htmlFor="menu-price">Price per Guest (₱) *</label>
                    <input
                      id="menu-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.price_per_guest}
                      onChange={(event) => updateForm('price_per_guest', event.target.value)}
                      placeholder="e.g. 120"
                      required
                    />
                    <small>
                      Added to the total when customers select this menu item.
                    </small>
                  </div>

                  <div className="menu-field">
                    <label htmlFor="menu-serving-size">Serving Size</label>
                    <input
                      id="menu-serving-size"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.serving_size}
                      onChange={(event) => updateForm('serving_size', event.target.value)}
                      placeholder="e.g. 1"
                    />
                  </div>

                  <div className="menu-field">
                    <label htmlFor="menu-serving-unit">Serving Unit</label>
                    <select
                      id="menu-serving-unit"
                      value={otherUnitSelected ? '__other__' : form.serving_unit}
                      onChange={(event) => {
                        if (event.target.value === '__other__') {
                          setOtherUnitSelected(true);
                          updateForm('serving_unit', '');
                        } else {
                          setOtherUnitSelected(false);
                          updateForm('serving_unit', event.target.value);
                        }
                      }}
                    >
                      {SERVING_UNITS.map((unit) => (
                        <option value={unit} key={unit}>{unit}</option>
                      ))}
                      <option value="__other__">Other (type a unit)</option>
                    </select>
                    {otherUnitSelected && (
                      <input value={customServingUnit} maxLength={40}
                        onChange={(event) => setCustomServingUnit(event.target.value)}
                        placeholder="e.g. bilao, bowl, basket" aria-label="Custom serving unit" />
                    )}
                  </div>

                  <div className="menu-field full">
                    <small>
                      Example: 1 kg, 500 grams, 1 tub, 1 tray, or per person.
                    </small>
                  </div>
                </div>
              </section>

              <div className="menu-form-footer">
                <button
                  type="button"
                  className="menu-secondary"
                  onClick={closeModal}
                  disabled={saving || uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="menu-primary"
                  disabled={saving || uploadingImage}
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {editing ? 'Save Changes' : 'Add Menu Item'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
