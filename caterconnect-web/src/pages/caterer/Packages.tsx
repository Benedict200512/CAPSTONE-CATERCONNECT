
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Package as PackageIcon,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Eye,
  EyeOff,
  ImagePlus,
  X,
  LoaderCircle,
  Utensils,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';

import { supabase } from '../../lib/supabase';

import {
  packageGuestBounds,
  calculatePackagePricing,
  formatPricingMoney,
} from '../../lib/packagePricing';

import {
  setPackagePublication,
  isPublicationStatus,
  packagePublicationError,
  type PackagePublicationStatus,
} from '../../lib/packagePublication';

type PackageTier = 'bronze' | 'silver' | 'gold' | 'premium';

type CatererPackage = {
  id: string;
  tier: PackageTier;
  name: string;
  description: string | null;
  price: number;
  guest_capacity: number;
  min_guests: number | null;
  max_guests: number;
  includes: string[] | null;
  food_inclusions: string[] | null;
  event_types: string[] | null;
  image_url: string | null;
  publication_status: PackagePublicationStatus;
  created_at?: string;
};

type PackageForm = {
  name: string;
  tier: PackageTier;
  description: string;
  price: string;
  guest_capacity: string;
  min_guests: string;
  max_guests: string;
  includes: string[];
  food_inclusions: string[];
  event_types: string[];
  image_url: string;
};

type PackageTab = 'active' | 'archived';

const EMPTY_FORM: PackageForm = {
  name: '',
  tier: 'bronze',
  description: '',
  price: '',
  guest_capacity: '50',
  min_guests: '1',
  max_guests: '100',
  includes: [],
  food_inclusions: [],
  event_types: [],
  image_url: '',
};

const TIERS: PackageTier[] = ['bronze', 'silver', 'gold', 'premium'];

const EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Debut',
  'Corporate',
  'Anniversary',
  'Party',
  'Reunion',
  'Other',
];

const INCLUSION_SUGGESTIONS = [
  'Buffet setup',
  'Chafing dishes',
  'Premium tableware',
  '2 waiters',
  '5 waiters',
  'Free flowing drinks',
  'Dessert station',
  'Cleanup service',
  'Event coordinator',
];

const PACKAGE_BUCKET = 'caterer-media';
const FREE_PACKAGE_LIMIT = 3;

function packageLimitForPlan(plan: string | null | undefined) {
  return (plan ?? 'free').toLowerCase() === 'free'
    ? FREE_PACKAGE_LIMIT
    : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function currency(value: number) {
  return `₱${formatPricingMoney(value)}`;
}

function emptyToNumber(value: string, fallback: number) {
  return value.trim() === '' ? fallback : Number(value);
}

export default function CatererPackages() {
  const { session, catererData } = useAuth();
  const catererId = catererData?.id;
  const userId = session?.user?.id;
  const packageLimit = packageLimitForPlan(catererData?.subscription_plan);

  const [packages, setPackages] = useState<CatererPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const [tab, setTab] = useState<PackageTab>('active');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatererPackage | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);

  const [foodInput, setFoodInput] = useState('');
  const [customInclusion, setCustomInclusion] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [downpaymentPercent, setDownpaymentPercent] = useState(10);

  const loadPackages = useCallback(async () => {
    if (!catererId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('packages')
        .select(
          'id, tier, name, description, price, guest_capacity, min_guests, max_guests, includes, food_inclusions, event_types, image_url, publication_status, created_at'
        )
        .eq('caterer_id', catererId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;

      const rows = (data ?? []) as CatererPackage[];

      const invalidPackage = rows.find(
        (pkg) => !isPublicationStatus(pkg.publication_status)
      );

      if (invalidPackage) {
        throw new Error(
          'A package has an invalid publication status. Please contact platform support.'
        );
      }

      setPackages(rows);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [catererId]);

  const loadDownpayment = useCallback(async () => {
    if (!catererId) return;

    const { data, error: queryError } = await supabase
      .from('caterers')
      .select('downpayment_percent')
      .eq('id', catererId)
      .maybeSingle();

    if (queryError) {
      console.error('Unable to load downpayment percentage:', queryError);
      return;
    }

    if (data?.downpayment_percent != null) {
      setDownpaymentPercent(Number(data.downpayment_percent));
    }
  }, [catererId]);

  useEffect(() => {
    loadPackages();
    loadDownpayment();
  }, [loadPackages, loadDownpayment]);

  const activePackages = useMemo(
    () => packages.filter((pkg) => pkg.publication_status !== 'archived'),
    [packages]
  );

  const archivedPackages = useMemo(
    () => packages.filter((pkg) => pkg.publication_status === 'archived'),
    [packages]
  );

  // Keep the Free plan's three-package allowance visible in the dashboard.
  // The database remains authoritative for whether a write is permitted.
  const packageLimitReached =
    packageLimit !== null && packages.length >= packageLimit;

  const visiblePackages = useMemo(() => {
    const source = tab === 'active' ? activePackages : archivedPackages;
    const keyword = search.trim().toLowerCase();

    if (!keyword) return source;

    return source.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(keyword) ||
        pkg.tier.toLowerCase().includes(keyword) ||
        (pkg.description ?? '').toLowerCase().includes(keyword)
    );
  }, [tab, activePackages, archivedPackages, search]);

  const updateForm = <K extends keyof PackageForm>(
    key: K,
    value: PackageForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFoodInput('');
    setCustomInclusion('');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (pkg: CatererPackage) => {
    setEditing(pkg);

    setForm({
      name: pkg.name,
      tier: pkg.tier,
      description: pkg.description ?? '',
      price: String(pkg.price),
      guest_capacity: String(pkg.guest_capacity),
      min_guests: String(pkg.min_guests ?? 1),
      max_guests: String(pkg.max_guests),
      includes: pkg.includes ?? [],
      food_inclusions: pkg.food_inclusions ?? [],
      event_types: pkg.event_types ?? [],
      image_url: pkg.image_url ?? '',
    });

    setFoodInput('');
    setCustomInclusion('');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploading) return;

    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const addFoodInclusion = () => {
    const value = foodInput.trim();

    if (!value) return;

    if (
      form.food_inclusions.some(
        (item) => item.toLowerCase() === value.toLowerCase()
      )
    ) {
      setFoodInput('');
      return;
    }

    updateForm('food_inclusions', [...form.food_inclusions, value]);
    setFoodInput('');
  };

  const removeFoodInclusion = (value: string) => {
    updateForm(
      'food_inclusions',
      form.food_inclusions.filter((item) => item !== value)
    );
  };

  const toggleInclusion = (value: string) => {
    const exists = form.includes.includes(value);

    updateForm(
      'includes',
      exists
        ? form.includes.filter((item) => item !== value)
        : [...form.includes, value]
    );
  };

  const addCustomInclusion = () => {
    const value = customInclusion.trim();

    if (!value) return;

    if (
      !form.includes.some(
        (item) => item.toLowerCase() === value.toLowerCase()
      )
    ) {
      updateForm('includes', [...form.includes, value]);
    }

    setCustomInclusion('');
  };

  const toggleEventType = (value: string) => {
    const exists = form.event_types.includes(value);

    updateForm(
      'event_types',
      exists
        ? form.event_types.filter((item) => item !== value)
        : [...form.event_types, value]
    );
  };

  const uploadPackageImage = async (file: File) => {
    if (!catererId) {
      setError('Your caterer account is unavailable.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must not exceed 5 MB.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${catererId}/package_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PACKAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(PACKAGE_BUCKET)
        .getPublicUrl(filePath);

      updateForm('image_url', data.publicUrl);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      throw new Error('Please enter a package name.');
    }

    if (!form.price.trim()) {
      throw new Error('Please enter a package price.');
    }

    const price = Number(form.price);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Package price must be greater than zero.');
    }

    const included = Number(form.guest_capacity);
    const minimum = emptyToNumber(form.min_guests, 1);
    const maximum = Number(form.max_guests);

    packageGuestBounds({
      price,
      guest_capacity: included,
      min_guests: minimum,
      max_guests: maximum,
    });

    return {
      price,
      guest_capacity: included,
      min_guests: minimum,
      max_guests: maximum,
    };
  };

  const savePackage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!catererId || !userId) {
      setError('Your caterer account is unavailable. Please log in again.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!editing && packageLimitReached) {
        throw new Error(
          `The Free plan allows up to ${packageLimit} packages. Review your subscription to add more.`
        );
      }

      const limits = validateForm();

      const payload = {
        caterer_id: catererId,
        name: form.name.trim(),
        tier: form.tier,
        description: form.description.trim() || null,
        price: limits.price,
        guest_capacity: limits.guest_capacity,
        min_guests: limits.min_guests,
        max_guests: limits.max_guests,
        includes: form.includes.length > 0 ? form.includes : null,
        food_inclusions:
          form.food_inclusions.length > 0 ? form.food_inclusions : null,
        event_types: form.event_types.length > 0 ? form.event_types : null,
        image_url: form.image_url || null,
      };

      if (editing) {
        const { data, error: updateError } = await supabase
          .from('packages')
          .update(payload)
          .eq('id', editing.id)
          .eq('caterer_id', catererId)
          .eq('publication_status', editing.publication_status)
          .select('id');

        if (updateError) throw updateError;

        if (data?.length !== 1) {
          throw new Error(
            'Package changed or permission was denied. Refresh and try again.'
          );
        }

        setSuccess('Package updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('packages')
          .insert({
            ...payload,
            publication_status: 'unpublished',
          });

        if (insertError) throw insertError;

        setSuccess('Package created successfully as unpublished.');
      }

      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);

      await loadPackages();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePublication = async (
    pkg: CatererPackage,
    next: PackagePublicationStatus
  ) => {
    if (!catererId || !userId) {
      setError('Your account is unavailable. Please log in again.');
      return;
    }

    if (pkg.publication_status === next) return;

    let confirmation = '';

    if (next === 'archived') {
      confirmation =
        'Archive this package? It will no longer be available for new bookings. Existing accepted bookings and booking history will remain unchanged.';
    } else if (next === 'published') {
      confirmation = 'Publish this package so customers can book it?';
    } else if (next === 'unpublished') {
      confirmation =
        'Unpublish this package? Customers will no longer be able to book it.';
    }

    if (confirmation && !window.confirm(confirmation)) return;

    setChangingStatus(pkg.id);
    setError('');
    setSuccess('');

    try {
      await setPackagePublication(
        pkg.id,
        catererId,
        userId,
        pkg.publication_status,
        next
      );

      setSuccess(
        next === 'archived'
          ? 'Package archived successfully.'
          : next === 'published'
            ? 'Package published successfully.'
            : next === 'unpublished'
              ? 'Package unpublished successfully.'
              : 'Package status updated.'
      );

      await loadPackages();
    } catch (err) {
      setError(packagePublicationError(err));
    } finally {
      setChangingStatus(null);
    }
  };

  const pricingPreview = useMemo(() => {
    if (!form.price || !form.guest_capacity || !form.max_guests) return null;

    try {
      const included = Number(form.guest_capacity);
      const maximum = Number(form.max_guests);
      const minimum = emptyToNumber(form.min_guests, 1);

      const result = calculatePackagePricing(
        {
          price: form.price,
          guest_capacity: included,
          min_guests: minimum,
          max_guests: maximum,
        },
        included,
        [],
        downpaymentPercent
      );

      return result;
    } catch {
      return null;
    }
  }, [
    form.price,
    form.guest_capacity,
    form.min_guests,
    form.max_guests,
    downpaymentPercent,
  ]);

  const getStatusColor = (status: PackagePublicationStatus) => {
    if (status === 'published') {
      return { background: '#DCFCE7', color: '#15803D' };
    }

    if (status === 'archived') {
      return { background: '#F1F5F9', color: '#64748B' };
    }

    return { background: '#FFF7ED', color: '#C2410C' };
  };

  if (!catererId) {
    return (
      <div className="packages-page">
        <div className="packages-empty-state">
          <AlertCircle size={36} />
          <h2>Caterer account unavailable</h2>
          <p>Please make sure your caterer profile is set up correctly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="packages-page">
      <style>{`
        .packages-page {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 30px;
          color: #111827;
          box-sizing: border-box;
        }

        .packages-page * {
          box-sizing: border-box;
        }

        .packages-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
        }

        .packages-header h1 {
          font-size: 26px;
          font-weight: 750;
          margin: 0 0 7px;
        }

        .packages-header p {
          color: #64748b;
          margin: 0;
          font-size: 14px;
        }

        .packages-primary-button {
          border: none;
          border-radius: 9px;
          padding: 12px 17px;
          background: #F97316;
          color: white;
          font-size: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: background .2s;
          white-space: nowrap;
        }

        .packages-primary-button:hover {
          background: #EA580C;
        }

        .packages-primary-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .packages-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 15px;
          border-radius: 9px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .packages-alert.error {
          background: #FEF2F2;
          color: #B91C1C;
          border: 1px solid #FECACA;
        }

        .packages-alert.success {
          background: #F0FDF4;
          color: #15803D;
          border: 1px solid #BBF7D0;
        }

        .packages-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .packages-tabs {
          display: flex;
          gap: 7px;
          padding: 4px;
          background: #F1F5F9;
          border-radius: 10px;
        }

        .packages-tab {
          border: none;
          padding: 9px 15px;
          border-radius: 7px;
          background: transparent;
          color: #64748B;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .packages-tab.active {
          color: #F97316;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,.08);
        }

        .packages-search {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #E2E8F0;
          background: white;
          border-radius: 9px;
          padding: 0 12px;
          width: 260px;
          color: #94A3B8;
        }

        .packages-search input {
          width: 100%;
          border: none;
          outline: none;
          padding: 11px 0;
          font-size: 13px;
          color: #1E293B;
          background: transparent;
        }

        .packages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 20px;
        }

        .package-card {
          background: white;
          border: 1px solid #E8EDF3;
          border-radius: 13px;
          overflow: hidden;
          transition: box-shadow .2s, transform .2s;
        }

        .package-card:hover {
          box-shadow: 0 7px 22px rgba(15,23,42,.07);
          transform: translateY(-2px);
        }

        .package-card-image {
          height: 175px;
          background: #FFF1E6;
          position: relative;
          overflow: hidden;
        }

        .package-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .package-image-placeholder {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FDBA74;
        }

        .package-status {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 750;
          text-transform: capitalize;
        }

        .package-card-content {
          padding: 17px;
        }

        .package-tier {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 1px;
          color: #F97316;
          margin-bottom: 7px;
        }

        .package-card-content h3 {
          font-size: 17px;
          margin: 0 0 7px;
          font-weight: 750;
          color: #1E293B;
        }

        .package-description {
          color: #64748B;
          font-size: 12px;
          line-height: 1.55;
          min-height: 37px;
          margin: 0 0 14px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .package-price {
          color: #F97316;
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .package-price small {
          color: #94A3B8;
          font-size: 11px;
          font-weight: 500;
        }

        .package-card-info {
          display: flex;
          gap: 15px;
          border-top: 1px solid #F1F5F9;
          padding-top: 12px;
          margin-bottom: 14px;
          color: #64748B;
          font-size: 12px;
        }

        .package-card-info span {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .package-card-actions {
          display: flex;
          gap: 7px;
          border-top: 1px solid #F1F5F9;
          padding-top: 13px;
        }

        .package-action {
          border: 1px solid #E2E8F0;
          background: white;
          color: #475569;
          padding: 8px 10px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          flex: 1;
          min-width: 0;
        }

        .package-action:hover {
          background: #F8FAFC;
        }

        .package-action.publish {
          color: #15803D;
          border-color: #BBF7D0;
        }

        .package-action.archive {
          color: #B45309;
          border-color: #FED7AA;
        }

        .package-action:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .packages-empty-state {
          min-height: 350px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          color: #94A3B8;
          padding: 30px;
        }

        .packages-empty-state h2 {
          color: #334155;
          margin: 15px 0 7px;
          font-size: 18px;
        }

        .packages-empty-state p {
          color: #64748B;
          font-size: 13px;
          max-width: 350px;
        }

        .packages-empty-state button {
          margin-top: 10px;
        }

        .packages-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
          color: #F97316;
        }

        .package-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15,23,42,.55);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          overflow-y: auto;
        }

        .package-modal {
          background: white;
          width: 100%;
          max-width: 760px;
          max-height: 92vh;
          overflow-y: auto;
          border-radius: 15px;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }

        .package-modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          padding: 20px 24px;
          border-bottom: 1px solid #E2E8F0;
        }

        .package-modal-header h2 {
          font-size: 19px;
          margin: 0;
          color: #1E293B;
        }

        .package-modal-header p {
          font-size: 12px;
          color: #64748B;
          margin: 5px 0 0;
        }

        .package-modal-close {
          background: #F1F5F9;
          color: #475569;
          border: none;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .package-form {
          padding: 22px 24px 25px;
        }

        .package-form-section {
          margin-bottom: 24px;
        }

        .package-form-section h3 {
          font-size: 14px;
          font-weight: 750;
          color: #334155;
          margin: 0 0 14px;
        }

        .package-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .package-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .package-field.full {
          grid-column: 1 / -1;
        }

        .package-field label {
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .package-field input,
        .package-field select,
        .package-field textarea {
          width: 100%;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          padding: 11px 12px;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          color: #1E293B;
          background: white;
        }

        .package-field input:focus,
        .package-field select:focus,
        .package-field textarea:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,.1);
        }

        .package-field textarea {
          resize: vertical;
          min-height: 85px;
        }

        .package-field small {
          font-size: 11px;
          color: #94A3B8;
        }

        .package-image-upload {
          border: 1px dashed #FDBA74;
          background: #FFF7ED;
          border-radius: 10px;
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .package-image-upload img {
          width: 100%;
          height: 190px;
          object-fit: cover;
        }

        .package-image-upload label {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          color: #C2410C;
          font-size: 12px;
          padding: 25px;
        }

        .package-image-upload input {
          display: none;
        }

        .package-image-remove {
          position: absolute;
          top: 9px;
          right: 9px;
          border: none;
          background: white;
          color: #DC2626;
          border-radius: 7px;
          padding: 7px;
          cursor: pointer;
          display: flex;
        }

        .package-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .package-chip {
          border: 1px solid #E2E8F0;
          color: #475569;
          background: white;
          border-radius: 20px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .package-chip.selected {
          background: #FFF1E6;
          color: #C2410C;
          border-color: #FDBA74;
        }

        .package-added-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #FFF1E6;
          color: #C2410C;
          border-radius: 20px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 650;
        }

        .package-added-chip button {
          border: none;
          background: transparent;
          color: inherit;
          display: flex;
          padding: 0;
          cursor: pointer;
        }

        .package-add-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .package-add-row input {
          flex: 1;
          min-width: 0;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 12px;
          outline: none;
        }

        .package-add-row button {
          border: none;
          border-radius: 8px;
          background: #FFF1E6;
          color: #C2410C;
          font-weight: 700;
          padding: 0 14px;
          cursor: pointer;
        }

        .package-pricing-preview {
          border: 1px solid #FED7AA;
          background: #FFFBF7;
          padding: 15px;
          border-radius: 10px;
        }

        .package-pricing-preview h4 {
          font-size: 12px;
          color: #9A3412;
          margin: 0 0 12px;
        }

        .package-pricing-line {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #64748B;
          font-size: 12px;
          padding: 5px 0;
        }

        .package-pricing-line strong {
          color: #334155;
        }

        .package-pricing-total {
          border-top: 1px solid #FED7AA;
          margin-top: 8px;
          padding-top: 12px;
          display: flex;
          justify-content: space-between;
          color: #9A3412;
          font-size: 13px;
          font-weight: 800;
        }

        .package-form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 18px;
          border-top: 1px solid #E2E8F0;
        }

        .package-secondary-button {
          border: 1px solid #CBD5E1;
          background: white;
          color: #475569;
          border-radius: 8px;
          padding: 11px 17px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .packages-page {
            padding: 20px 15px;
          }

          .packages-header {
            flex-direction: column;
            align-items: stretch;
          }

          .packages-header .packages-primary-button {
            width: 100%;
          }

          .packages-search {
            width: 100%;
          }

          .packages-grid {
            grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          }
        }

        @media (max-width: 520px) {
          .packages-page {
            padding: 17px 12px;
          }

          .packages-header h1 {
            font-size: 22px;
          }

          .packages-grid {
            grid-template-columns: 1fr;
          }

          .package-form-grid {
            grid-template-columns: 1fr;
          }

          .package-field.full {
            grid-column: auto;
          }

          .package-modal-overlay {
            padding: 8px;
          }

          .package-modal {
            max-height: 96vh;
          }

          .package-form {
            padding: 18px 15px;
          }

          .package-modal-header {
            padding: 16px;
          }
        }
      `}</style>

      <CatererPageHeader
        icon={<PackageIcon size={25} />}
        title="Packages"
        description={(
          <>
            Manage your catering packages, pricing, and availability.
            {packageLimit === null
              ? ' Your current plan allows unlimited packages.'
              : ` Free plan: ${packages.length} of ${packageLimit} packages used.`}
          </>
        )}
        action={<button
          type="button"
          className="packages-primary-button"
          onClick={openCreateModal}
          disabled={packageLimitReached}
          title={packageLimitReached ? 'Package limit reached for the Free plan' : undefined}
        >
          <Plus size={17} />
          Create Package
        </button>}
      />

      {error && !modalOpen && (
        <div className="packages-alert error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {success && !modalOpen && (
        <div className="packages-alert success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

      <div className="packages-toolbar">
        <div className="packages-tabs">
          <button
            type="button"
            className={`packages-tab ${tab === 'active' ? 'active' : ''}`}
            onClick={() => setTab('active')}
          >
            Active Packages ({activePackages.length})
          </button>

          <button
            type="button"
            className={`packages-tab ${tab === 'archived' ? 'active' : ''}`}
            onClick={() => setTab('archived')}
          >
            Archived ({archivedPackages.length})
          </button>
        </div>

        <div className="packages-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search packages..."
          />
        </div>
      </div>

      {loading ? (
        <CatererSkeleton variant="packages" label="Loading packages" />
      ) : visiblePackages.length === 0 ? (
        <div className="packages-empty-state">
          <PackageIcon size={42} />

          <h2>
            {search
              ? 'No matching packages'
              : tab === 'archived'
                ? 'No archived packages'
                : 'No packages yet'}
          </h2>

          <p>
            {search
              ? 'Try another search term.'
              : tab === 'archived'
                ? 'Packages you archive will appear here.'
                : 'Create your first catering package to start offering services to customers.'}
          </p>

          {!search && tab === 'active' && (
            <button
              type="button"
              className="packages-primary-button"
              onClick={openCreateModal}
              disabled={packageLimitReached}
              title={packageLimitReached ? 'Package limit reached for the Free plan' : undefined}
            >
              <Plus size={16} />
              Create Your First Package
            </button>
          )}

          <button
            type="button"
            className="package-secondary-button"
            onClick={loadPackages}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      ) : (
        <div className="packages-grid">
          {visiblePackages.map((pkg) => {
            const statusStyle = getStatusColor(pkg.publication_status);
            const isChanging = changingStatus === pkg.id;

            return (
              <article className="package-card" key={pkg.id}>
                <div className="package-card-image">
                  {pkg.image_url ? (
                    <img src={pkg.image_url} alt={pkg.name} />
                  ) : (
                    <div className="package-image-placeholder">
                      <PackageIcon size={45} />
                    </div>
                  )}

                  <span
                    className="package-status"
                    style={{
                      background: statusStyle.background,
                      color: statusStyle.color,
                    }}
                  >
                    {pkg.publication_status}
                  </span>
                </div>

                <div className="package-card-content">
                  <div className="package-tier">{pkg.tier} package</div>

                  <h3>{pkg.name}</h3>

                  <p className="package-description">
                    {pkg.description || 'No package description provided.'}
                  </p>

                  <div className="package-price">
                    {currency(Number(pkg.price))}
                    <small> / package</small>
                  </div>

                  <div className="package-card-info">
                    <span>
                      <Users size={14} />
                      {pkg.guest_capacity} included
                    </span>

                    <span>
                      <Utensils size={14} />
                      {pkg.food_inclusions?.length ?? 0} food items
                    </span>
                  </div>

                  <div className="package-card-actions">
                    <button
                      type="button"
                      className="package-action"
                      onClick={() => openEditModal(pkg)}
                      disabled={isChanging}
                      title="Edit package"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>

                    {pkg.publication_status === 'published' ? (
                      <button
                        type="button"
                        className="package-action"
                        onClick={() =>
                          changePublication(pkg, 'unpublished')
                        }
                        disabled={isChanging}
                        title="Unpublish package"
                      >
                        {isChanging ? (
                          <LoaderCircle size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}
                        Unpublish
                      </button>
                    ) : pkg.publication_status === 'unpublished' ? (
                      <button
                        type="button"
                        className="package-action publish"
                        onClick={() => changePublication(pkg, 'published')}
                        disabled={isChanging}
                        title="Publish package"
                      >
                        {isChanging ? (
                          <LoaderCircle size={13} />
                        ) : (
                          <Eye size={13} />
                        )}
                        Publish
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="package-action publish"
                        onClick={() => changePublication(pkg, 'unpublished')}
                        disabled={isChanging}
                        title="Restore package"
                      >
                        {isChanging ? (
                          <LoaderCircle size={13} />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        Restore
                      </button>
                    )}

                    {pkg.publication_status !== 'archived' && (
                      <button
                        type="button"
                        className="package-action archive"
                        onClick={() => changePublication(pkg, 'archived')}
                        disabled={isChanging}
                        title="Archive package"
                      >
                        <Archive size={13} />
                      </button>
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
          className="package-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="package-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="package-modal-title"
          >
            <div className="package-modal-header">
              <div>
                <h2 id="package-modal-title">
                  {editing ? 'Edit Package' : 'Create Package'}
                </h2>
                <p>
                  {editing
                    ? 'Update your package details and pricing.'
                    : 'Add a new catering package to your business.'}
                </p>
              </div>

              <button
                type="button"
                className="package-modal-close"
                onClick={closeModal}
                disabled={saving || uploading}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form className="package-form" onSubmit={savePackage}>
              {error && (
                <div className="packages-alert error">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}

              <section className="package-form-section">
                <h3>Package Information</h3>

                <div className="package-form-grid">
                  <div className="package-field">
                    <label htmlFor="package-name">Package Name *</label>
                    <input
                      id="package-name"
                      value={form.name}
                      onChange={(event) =>
                        updateForm('name', event.target.value)
                      }
                      placeholder="e.g. Classic Wedding Package"
                      required
                      maxLength={100}
                    />
                  </div>

                  <div className="package-field">
                    <label htmlFor="package-tier">Package Tier *</label>
                    <select
                      id="package-tier"
                      value={form.tier}
                      onChange={(event) =>
                        updateForm('tier', event.target.value as PackageTier)
                      }
                    >
                      {TIERS.map((tier) => (
                        <option value={tier} key={tier}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="package-field full">
                    <label htmlFor="package-description">Description</label>
                    <textarea
                      id="package-description"
                      value={form.description}
                      onChange={(event) =>
                        updateForm('description', event.target.value)
                      }
                      placeholder="Describe what makes this package special..."
                      maxLength={1000}
                    />
                  </div>
                </div>
              </section>

              <section className="package-form-section">
                <h3>Package Image</h3>

                <div className="package-image-upload">
                  {form.image_url ? (
                    <>
                      <img src={form.image_url} alt="Package preview" />

                      <button
                        type="button"
                        className="package-image-remove"
                        onClick={() => updateForm('image_url', '')}
                        title="Remove image"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <label>
                      {uploading ? (
                        <LoaderCircle size={27} className="animate-spin" />
                      ) : (
                        <ImagePlus size={27} />
                      )}

                      <strong>
                        {uploading ? 'Uploading image...' : 'Upload package image'}
                      </strong>

                      <span>JPG, PNG, or WEBP. Maximum 5 MB.</span>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];

                          if (file) {
                            uploadPackageImage(file);
                          }

                          event.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </section>

              <section className="package-form-section">
                <h3>Pricing and Guest Capacity</h3>

                <div className="package-form-grid">
                  <div className="package-field">
                    <label htmlFor="package-price">Package Price (₱) *</label>
                    <input
                      id="package-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.price}
                      onChange={(event) =>
                        updateForm('price', event.target.value)
                      }
                      placeholder="e.g. 25000.00"
                      required
                    />
                  </div>

                  <div className="package-field">
                    <label htmlFor="guest-capacity">
                      Included Guest Capacity *
                    </label>
                    <input
                      id="guest-capacity"
                      type="number"
                      min="1"
                      step="1"
                      value={form.guest_capacity}
                      onChange={(event) =>
                        updateForm('guest_capacity', event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="package-field">
                    <label htmlFor="min-guests">Minimum Guests *</label>
                    <input
                      id="min-guests"
                      type="number"
                      min="1"
                      step="1"
                      value={form.min_guests}
                      onChange={(event) =>
                        updateForm('min_guests', event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="package-field">
                    <label htmlFor="max-guests">Maximum Guests *</label>
                    <input
                      id="max-guests"
                      type="number"
                      min="1"
                      step="1"
                      value={form.max_guests}
                      onChange={(event) =>
                        updateForm('max_guests', event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <small style={{ color: '#64748B', fontSize: 11 }}>
                  The included guest capacity is covered by the package price.
                  Additional guests are calculated using your package pricing
                  rules.
                </small>

                {pricingPreview && (
                  <div className="package-pricing-preview" style={{ marginTop: 15 }}>
                    <h4>Pricing Preview — Included Guest Capacity</h4>

                    <div className="package-pricing-line">
                      <span>Package price</span>
                      <strong>{currency(pricingPreview.fixedPrice)}</strong>
                    </div>

                    <div className="package-pricing-line">
                      <span>Price per guest (reference)</span>
                      <strong>{currency(pricingPreview.pricePerGuest)}</strong>
                    </div>

                    <div className="package-pricing-line">
                      <span>Downpayment ({downpaymentPercent}%)</span>
                      <strong>{currency(pricingPreview.downpayment)}</strong>
                    </div>

                    <div className="package-pricing-total">
                      <span>Package total</span>
                      <span>{currency(pricingPreview.total)}</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="package-form-section">
                <h3>Food Inclusions</h3>

                {form.food_inclusions.length > 0 && (
                  <div className="package-chips">
                    {form.food_inclusions.map((item) => (
                      <span className="package-added-chip" key={item}>
                        {item}
                        <button
                          type="button"
                          onClick={() => removeFoodInclusion(item)}
                          aria-label={`Remove ${item}`}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="package-add-row">
                  <input
                    value={foodInput}
                    onChange={(event) => setFoodInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addFoodInclusion();
                      }
                    }}
                    placeholder="e.g. Chicken cordon bleu"
                  />

                  <button type="button" onClick={addFoodInclusion}>
                    Add Food
                  </button>
                </div>
              </section>

              <section className="package-form-section">
                <h3>Service Inclusions</h3>

                <div className="package-chips">
                  {INCLUSION_SUGGESTIONS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`package-chip ${
                        form.includes.includes(item) ? 'selected' : ''
                      }`}
                      onClick={() => toggleInclusion(item)}
                    >
                      {form.includes.includes(item) ? 'Selected: ' : ''}
                      {item}
                    </button>
                  ))}
                </div>

                {form.includes.filter(
                  (item) => !INCLUSION_SUGGESTIONS.includes(item)
                ).length > 0 && (
                  <div className="package-chips" style={{ marginTop: 12 }}>
                    {form.includes
                      .filter(
                        (item) => !INCLUSION_SUGGESTIONS.includes(item)
                      )
                      .map((item) => (
                        <span className="package-added-chip" key={item}>
                          {item}
                          <button
                            type="button"
                            onClick={() => toggleInclusion(item)}
                            aria-label={`Remove ${item}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                <div className="package-add-row">
                  <input
                    value={customInclusion}
                    onChange={(event) =>
                      setCustomInclusion(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomInclusion();
                      }
                    }}
                    placeholder="Add a custom service inclusion..."
                  />

                  <button type="button" onClick={addCustomInclusion}>
                    Add
                  </button>
                </div>
              </section>

              <section className="package-form-section">
                <h3>Suitable Event Types</h3>

                <div className="package-chips">
                  {EVENT_TYPES.map((eventType) => (
                    <button
                      type="button"
                      key={eventType}
                      className={`package-chip ${
                        form.event_types.includes(eventType) ? 'selected' : ''
                      }`}
                      onClick={() => toggleEventType(eventType)}
                    >
                      {eventType}
                    </button>
                  ))}
                </div>
              </section>

              <div className="package-form-footer">
                <button
                  type="button"
                  className="package-secondary-button"
                  onClick={closeModal}
                  disabled={saving || uploading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="packages-primary-button"
                  disabled={saving || uploading}
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {editing ? 'Save Changes' : 'Create Package'}
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
