import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import {
  Camera,
  Save,
  Store,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  LoaderCircle,
  ImagePlus,
  UploadCloud,
  FileText,
  ShieldCheck,
  Building2,
  IdCard,
  ClipboardList,
  User,
  Eye,
  RefreshCw,
  Info,
  Star,
} from 'lucide-react';
import './CatererBusinessProfile.css';

type Caterer = {
  id: string;
  user_id: string;
  business_name: string;
  business_description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  city: string | null;
  verification_status: string;
  downpayment_percent: number;
  accepted_payment_methods: string[] | null;
  accepted_payment_details: Record<string, string> | null;
  avg_rating: number | null;
  review_count: number | null;
  rejection_reason: string | null;
  created_at: string | null;
};

type CatererDoc = {
  id: string;
  caterer_id: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  status: string;
};

const REQUIRED_DOCS = [
  {
    type: 'business_permit',
    label: 'Business Permit',
    description: 'Your valid business permit issued by the local government.',
    icon: Building2,
  },
  {
    type: 'sanitary_permit',
    label: 'Sanitary Permit',
    description: 'Your current sanitary permit for food preparation and catering.',
    icon: ShieldCheck,
  },
  {
    type: 'government_id',
    label: 'Government-issued ID',
    description: 'A valid government-issued identification of the business owner.',
    icon: IdCard,
  },
  {
    type: 'business_registration',
    label: 'Business Registration Certificate',
    description: 'Your DTI, SEC, or other applicable registration certificate.',
    icon: ClipboardList,
  },
  {
    type: 'proof_of_address',
    label: 'Proof of Address',
    description: 'A document that verifies your business address.',
    icon: MapPin,
  },
];

const PAYMENT_OPTIONS = [
  {
    key: 'gcash',
    label: 'GCash',
    description: 'Mobile wallet payment',
  },
  {
    key: 'maya',
    label: 'Maya',
    description: 'Mobile wallet payment',
  },
  {
    key: 'bpi',
    label: 'BPI Online / QR',
    description: 'Bank transfer via BPI',
  },
  {
    key: 'bdo',
    label: 'BDO Online / QR',
    description: 'Bank transfer via BDO',
  },
  {
    key: 'card',
    label: 'Credit / Debit Card',
    description: 'Card payment',
  },
];

const IMAGE_BUCKETS = {
  logo: 'caterer-logos',
  cover: 'caterer-covers',
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

export default function CatererBusinessProfile() {
  const navigate = useNavigate();
  const { profile, reloadAccount } = useAuth();

  const [caterer, setCaterer] = useState<Caterer | null>(null);
  const [docs, setDocs] = useState<CatererDoc[]>([]);

  const [fullName, setFullName] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');

  const [form, setForm] = useState({
    business_name: '',
    business_description: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    city: '',
  });

  const [downpayment, setDownpayment] = useState('25');

  const [acceptedMethods, setAcceptedMethods] = useState<string[]>([
    'gcash',
    'maya',
    'bpi',
    'bdo',
    'card',
  ]);

  const [paymentDetails, setPaymentDetails] = useState<
    Record<string, string>
  >({});

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [logoPreview, setLogoPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [documentLinks, setDocumentLinks] = useState<
    Record<string, string>
  >({});

  // Only unsubmitted and rejected caterers need to complete
  // the full verification requirements before saving.
  const requiresVerification =
    caterer?.verification_status === 'unsubmitted' ||
    caterer?.verification_status === 'rejected';

  const uploadedCount = useMemo(
    () =>
      REQUIRED_DOCS.filter((item) =>
        docs.some(
          (doc) =>
            doc.document_type === item.type && Boolean(doc.file_url)
        )
      ).length,
    [docs]
  );

  useEffect(() => {
    void loadBusinessProfile();
  }, [profile?.id]);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }

      if (coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [logoPreview, coverPreview]);

  async function loadBusinessProfile() {
    try {
      setLoading(true);
      setError('');

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        throw new Error(
          'Please log in again to access your business profile.'
        );
      }

      const { data, error: fetchError } = await supabase
        .from('caterers')
        .select(`
          id,
          user_id,
          business_name,
          business_description,
          logo_url,
          cover_photo_url,
          contact_phone,
          contact_email,
          address,
          city,
          verification_status,
          downpayment_percent,
          accepted_payment_methods,
          accepted_payment_details,
          avg_rating,
          review_count,
          rejection_reason,
          created_at
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error(
          'Your caterer business record could not be found.'
        );
      }

      const row = data as Caterer;

      setCaterer(row);

      setForm({
        business_name: row.business_name || '',
        business_description: row.business_description || '',
        contact_phone: row.contact_phone || '',
        contact_email: row.contact_email || '',
        address: row.address || '',
        city: row.city || '',
      });

      setDownpayment(String(row.downpayment_percent ?? 25));

      setAcceptedMethods(
        row.accepted_payment_methods ?? [
          'gcash',
          'maya',
          'bpi',
          'bdo',
          'card',
        ]
      );

      setPaymentDetails(row.accepted_payment_details ?? {});

      setLogoPreview(row.logo_url || '');
      setCoverPreview(row.cover_photo_url || '');

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      setFullName(profileData?.full_name || '');
      setPersonalPhone(profileData?.phone_number || '');

      await loadDocuments(row.id);
    } catch (err) {
      console.error('Business profile loading error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your business profile.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(catererId: string) {
    const { data, error: docsError } = await supabase
      .from('caterer_documents')
      .select(
        'id, caterer_id, document_type, file_url, file_name, status'
      )
      .eq('caterer_id', catererId);

    if (docsError) throw docsError;

    const rows = (data ?? []) as CatererDoc[];

    setDocs(rows);

    const links: Record<string, string> = {};

    for (const doc of rows) {
      if (!doc.file_url) continue;

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('caterer-documents')
          .createSignedUrl(doc.file_url, 60 * 10);

      if (!signedError && signedData?.signedUrl) {
        links[doc.document_type] = signedData.signedUrl;
      }
    }

    setDocumentLinks(links);
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSuccess('');
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'cover'
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      setError('Please select a JPG, PNG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image size must not exceed 5 MB.');
      event.target.value = '';
      return;
    }

    const preview = URL.createObjectURL(file);

    if (type === 'logo') {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setCoverFile(file);
      setCoverPreview(preview);
    }

    setError('');
    setSuccess('');
  }

  async function uploadImage(
    file: File,
    bucket: string,
    catererId: string
  ) {
    const extension =
      file.name.split('.').pop()?.toLowerCase() || 'jpg';

    const path = `${catererId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }

  function togglePaymentMethod(key: string) {
    setAcceptedMethods((current) => {
      if (current.includes(key)) {
        if (current.length <= 1) {
          setError(
            'Please keep at least one payment method enabled.'
          );
          return current;
        }

        return current.filter((method) => method !== key);
      }

      return [...current, key];
    });

    setError('');
    setSuccess('');
  }

  async function handleDocumentUpload(
    event: ChangeEvent<HTMLInputElement>,
    documentType: string
  ) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || !caterer) return;

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      setError('Documents must be JPG, PNG, or PDF files.');
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      setError('Each document must not exceed 10 MB.');
      return;
    }

    try {
      setUploadingDoc(documentType);
      setError('');
      setSuccess('');

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Your login session has expired.');
      }

      const extension =
        file.name.split('.').pop()?.toLowerCase() || 'jpg';

      const storagePath =
        `${authData.user.id}/${documentType}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('caterer-documents')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(
          `Storage upload failed: ${uploadError.message}`
        );
      }

      const existing = docs.find(
        (doc) => doc.document_type === documentType
      );

      if (existing) {
        const { error: updateError } = await supabase
          .from('caterer_documents')
          .update({
            file_url: storagePath,
            file_name: file.name,
            status: 'pending',
          })
          .eq('id', existing.id)
          .eq('caterer_id', caterer.id);

        if (updateError) {
          throw new Error(
            `Document record update failed: ${updateError.message}`
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from('caterer_documents')
          .insert({
            caterer_id: caterer.id,
            document_type: documentType,
            file_url: storagePath,
            file_name: file.name,
            status: 'pending',
          });

        if (insertError) {
          throw new Error(
            `Document record creation failed: ${insertError.message}`
          );
        }
      }

      await loadDocuments(caterer.id);

      setSuccess(
        'Document uploaded successfully. It is now pending review.'
      );
    } catch (err) {
      console.error('Document upload error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload this document.'
      );
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!caterer) return;

    setError('');
    setSuccess('');

    // Do not save while a document is still uploading.
    if (uploadingDoc !== null) {
      setError('Please wait for the document upload to finish.');
      return;
    }

    // Full validation applies only to unsubmitted and rejected caterers.
    if (requiresVerification) {
      const requiredFields: {
        label: string;
        value: string;
      }[] = [
        { label: 'Business Name', value: form.business_name },
        {
          label: 'Business Description',
          value: form.business_description,
        },
        { label: 'Business Phone', value: form.contact_phone },
        { label: 'Business Email', value: form.contact_email },
        { label: 'Business Address', value: form.address },
        { label: 'City / Area', value: form.city },
        { label: 'Full Name', value: fullName },
        { label: 'Personal Phone Number', value: personalPhone },
      ];

      const missingFields = requiredFields
        .filter((field) => !field.value.trim())
        .map((field) => field.label);

      if (missingFields.length > 0) {
        setError(
          `Please complete the following required fields: ${missingFields.join(', ')}.`
        );
        return;
      }

      // Check business images.
      if (!logoFile && !caterer.logo_url) {
        setError('Please upload your Business Logo.');
        return;
      }

      if (!coverFile && !caterer.cover_photo_url) {
        setError('Please upload your Business Cover Photo.');
        return;
      }

      // Check payment methods.
      if (acceptedMethods.length === 0) {
        setError('Please select at least one accepted payment method.');
        return;
      }

      const missingPaymentDetails = acceptedMethods.filter(
        (method) => !paymentDetails[method]?.trim()
      );

      if (missingPaymentDetails.length > 0) {
        const missingLabels = missingPaymentDetails.map(
          (method) =>
            PAYMENT_OPTIONS.find(
              (option) => option.key === method
            )?.label || method
        );

        setError(
          `Please provide account details for: ${missingLabels.join(', ')}.`
        );
        return;
      }

      // Check downpayment.
      const downpaymentValue = Number(downpayment);

      if (
        !Number.isFinite(downpaymentValue) ||
        downpaymentValue < 1 ||
        downpaymentValue > 100
      ) {
        setError('Please enter a valid downpayment percentage.');
        return;
      }

      // Check all five documents.
      const missingDocuments = REQUIRED_DOCS.filter(
        (requiredDoc) =>
          !docs.some(
            (doc) =>
              doc.document_type === requiredDoc.type &&
              Boolean(doc.file_url)
          )
      );

      if (missingDocuments.length > 0) {
        setError(
          `Please upload all required verification documents. Missing: ${missingDocuments
            .map((doc) => doc.label)
            .join(', ')}.`
        );
        return;
      }
    }

    // Business name is always required, including normal saves.
    if (!form.business_name.trim()) {
      setError('Business name is required.');
      return;
    }

    if (acceptedMethods.length === 0) {
      setError('Please select at least one accepted payment method.');
      return;
    }

    try {
      setSaving(true);

      let logoUrl = caterer.logo_url;
      let coverUrl = caterer.cover_photo_url;

      if (logoFile || coverFile) {
        setUploadingImage(true);
      }

      // Upload new logo.
      if (logoFile) {
        logoUrl = await uploadImage(
          logoFile,
          IMAGE_BUCKETS.logo,
          caterer.id
        );
      }

      // Upload new cover photo.
      if (coverFile) {
        coverUrl = await uploadImage(
          coverFile,
          IMAGE_BUCKETS.cover,
          caterer.id
        );
      }

      // Save personal information.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone_number: personalPhone.trim() || null,
        })
        .eq('id', caterer.user_id);

      if (profileError) throw profileError;

      // Prepare the business profile update.
      const businessUpdates: Record<string, unknown> = {
        business_name: form.business_name.trim(),
        business_description:
          form.business_description.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        downpayment_percent: Number(downpayment),
        accepted_payment_methods: acceptedMethods,
        accepted_payment_details: paymentDetails,
        logo_url: logoUrl,
        cover_photo_url: coverUrl,
      };

      // Only change verification status when submitting
      // an unsubmitted or rejected business profile.
      if (requiresVerification) {
        businessUpdates.verification_status = 'pending';
        businessUpdates.rejection_reason = null;
      }

      const { data: updatedData, error: updateError } =
        await supabase
          .from('caterers')
          .update(businessUpdates)
          .eq('id', caterer.id)
          .eq('user_id', caterer.user_id)
          .select()
          .single();

      if (updateError) throw updateError;

      setCaterer((previous) =>
        previous ? { ...previous, ...updatedData } : previous
      );

      setLogoFile(null);
      setCoverFile(null);

      setLogoPreview(updatedData.logo_url || '');
      setCoverPreview(updatedData.cover_photo_url || '');

      if (requiresVerification) {
        // Submission completed. Return to the dashboard.
        await reloadAccount();
        navigate('/caterer', {
          state: {
            verificationSubmitted: true,
          },
        });
      } else {
        // Normal save for pending and approved caterers.
        setSuccess(
          'Your business profile has been updated successfully.'
        );
      }
    } catch (err) {
      console.error('Business profile save error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save your business profile.'
      );
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  }

  function getStatus(status: string) {
    switch (status) {
      case 'unsubmitted':
        return {
          label: 'Not submitted',
          className: 'unsubmitted',
          icon: Info,
        };

      case 'pending':
        return {
          label: 'Pending review',
          className: 'pending',
          icon: Clock,
        };

      case 'approved':
        return {
          label: 'Approved',
          className: 'approved',
          icon: CheckCircle,
        };

      case 'rejected':
        return {
          label: 'Rejected',
          className: 'rejected',
          icon: XCircle,
        };

      default:
        return {
          label: 'Status unavailable',
          className: 'pending',
          icon: Info,
        };
    }
  }

  if (loading) {
    return <CatererSkeleton variant="profile" label="Loading business profile" />;
  }

  if (!caterer) {
    return (
      <div className="business-profile-page">
        <div className="business-profile-alert error">
          {error || 'Business profile not found.'}

          <button
            type="button"
            onClick={() => void loadBusinessProfile()}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const verification = getStatus(caterer.verification_status);
  const VerificationIcon = verification.icon;

  return (
    <div className="business-profile-page">
      <CatererPageHeader
        icon={<Store size={25} />}
        title="Business Profile"
        description="Manage your business details, payments, and verification documents."
        action={<div
          className={`verification-status ${verification.className}`}
        >
          <VerificationIcon size={17} />

          <span>
            {caterer.verification_status === 'approved'
              ? 'Verified Business'
              : verification.label}
          </span>
        </div>}
      />

      {error && (
        <div className="business-profile-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="business-profile-alert success">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {caterer.verification_status === 'rejected' &&
        caterer.rejection_reason && (
          <div className="business-profile-alert rejection">
            <strong>Verification needs attention</strong>

            <p>{caterer.rejection_reason}</p>

            <span>
              Replace or update the relevant documents, then submit
              your completed profile again for review.
            </span>
          </div>
        )}

      <form onSubmit={handleSave}>
        <section className="business-profile-card appearance-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Business Appearance</h2>
              <p>
                Make your business recognizable to customers.
              </p>
            </div>
          </div>

          <div className="business-cover-editor">
            {coverPreview ? (
              <img src={coverPreview} alt="Business cover" />
            ) : (
              <div className="cover-placeholder">
                <ImagePlus size={34} />
                <span>Add a cover photo</span>
                <small>Recommended landscape image</small>
              </div>
            )}

            <label className="cover-upload-button">
              <Camera size={17} />
              Change Cover

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) =>
                  handleImageChange(event, 'cover')
                }
              />
            </label>
          </div>

          <div className="business-logo-editor">
            <div className="business-logo-preview">
              {logoPreview ? (
                <img src={logoPreview} alt="Business logo" />
              ) : (
                <Store size={36} />
              )}
            </div>

            <div className="logo-editor-copy">
              <strong>Business Logo</strong>

              <p>
                Use a clear square image. JPG, PNG, or WEBP, up to
                5 MB.
              </p>

              <label className="secondary-upload-button">
                <Camera size={15} />
                Upload Logo

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) =>
                    handleImageChange(event, 'logo')
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Business Information</h2>
              <p>
                Tell customers about your catering services.
              </p>
            </div>
          </div>

          <div className="business-profile-form-grid">
            <div className="business-profile-field full-width">
              <label htmlFor="business_name">
                Business Name <span>*</span>
              </label>

              <input
                id="business_name"
                name="business_name"
                value={form.business_name}
                onChange={handleInputChange}
                required
                placeholder="e.g. Maria's Catering Services"
              />
            </div>

            <div className="business-profile-field full-width">
              <label htmlFor="business_description">
                Business Description
              </label>

              <textarea
                id="business_description"
                name="business_description"
                value={form.business_description}
                onChange={handleInputChange}
                rows={4}
                placeholder="Describe your catering services, specialties, and experience..."
              />
            </div>
          </div>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Contact & Location</h2>
              <p>
                Provide the details customers can use to reach you.
              </p>
            </div>
          </div>

          <div className="business-profile-form-grid">
            <div className="business-profile-field">
              <label htmlFor="contact_phone">
                <Phone size={15} />
                Business Phone
              </label>

              <input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                value={form.contact_phone}
                onChange={handleInputChange}
                placeholder="09XXXXXXXXX"
              />
            </div>

            <div className="business-profile-field">
              <label htmlFor="contact_email">
                <Mail size={15} />
                Business Email
              </label>

              <input
                id="contact_email"
                name="contact_email"
                type="email"
                value={form.contact_email}
                onChange={handleInputChange}
                placeholder="business@email.com"
              />
            </div>

            <div className="business-profile-field full-width">
              <label htmlFor="address">
                <MapPin size={15} />
                Business Address
              </label>

              <input
                id="address"
                name="address"
                value={form.address}
                onChange={handleInputChange}
                placeholder="Complete business address"
              />
            </div>

            <div className="business-profile-field">
              <label htmlFor="city">City / Area</label>

              <input
                id="city"
                name="city"
                value={form.city}
                onChange={handleInputChange}
                placeholder="e.g. Lapu-Lapu City"
              />
            </div>
          </div>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Booking Policy</h2>
              <p>
                Set the downpayment percentage customers must pay.
              </p>
            </div>
          </div>

          <div className="downpayment-options">
            {['10', '25', '50'].map((value) => (
              <button
                key={value}
                type="button"
                className={`downpayment-option ${
                  downpayment === value ? 'selected' : ''
                }`}
                onClick={() => setDownpayment(value)}
              >
                <strong>{value}%</strong>
                <span>Downpayment</span>
              </button>
            ))}
          </div>

          <p className="business-profile-help">
            <Info size={15} />
            This percentage is used when calculating the booking
            downpayment.
          </p>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Accepted Payment Methods</h2>
              <p>
                Choose the payment channels you accept from customers.
              </p>
            </div>
          </div>

          <div className="payment-method-grid">
            {PAYMENT_OPTIONS.map((option) => {
              const selected = acceptedMethods.includes(option.key);

              return (
                <button
                  type="button"
                  key={option.key}
                  className={`payment-method-option ${
                    selected ? 'selected' : ''
                  }`}
                  onClick={() =>
                    togglePaymentMethod(option.key)
                  }
                >
                  <span className="payment-check">
                    {selected ? (
                      <CheckCircle size={19} />
                    ) : (
                      <span />
                    )}
                  </span>

                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="payment-details">
            <h3>Payment Account Details</h3>

            <p>
              Enter the account number or payment details customers
              should use.
            </p>

            <div className="business-profile-form-grid">
              {acceptedMethods.map((key) => {
                const option = PAYMENT_OPTIONS.find(
                  (item) => item.key === key
                );

                if (!option) return null;

                return (
                  <div
                    className="business-profile-field"
                    key={key}
                  >
                    <label htmlFor={`payment-${key}`}>
                      {option.label} Account / Number
                    </label>

                    <input
                      id={`payment-${key}`}
                      value={paymentDetails[key] || ''}
                      onChange={(event) =>
                        setPaymentDetails((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder="Enter account details"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Personal Information</h2>
              <p>Your account contact information.</p>
            </div>
          </div>

          <div className="business-profile-form-grid">
            <div className="business-profile-field">
              <label htmlFor="full_name">
                <User size={15} />
                Full Name
              </label>

              <input
                id="full_name"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="Your full name"
              />
            </div>

            <div className="business-profile-field">
              <label htmlFor="personal_phone">
                <Phone size={15} />
                Personal Phone Number
              </label>

              <input
                id="personal_phone"
                type="tel"
                value={personalPhone}
                onChange={(event) =>
                  setPersonalPhone(event.target.value)
                }
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>
        </section>

        <section className="business-profile-card documents-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Business Verification Documents</h2>
              <p>
                Upload the required documents for Platform Staff
                review.
              </p>
            </div>

            <span className="document-count">
              {uploadedCount}/{REQUIRED_DOCS.length} uploaded
            </span>
          </div>

          <div className="document-progress">
            <div className="document-progress-label">
              <strong>Verification Progress</strong>

              <span>
                {Math.round(
                  (uploadedCount / REQUIRED_DOCS.length) * 100
                )}
                %
              </span>
            </div>

            <div className="document-progress-track">
              <div
                style={{
                  width: `${
                    (uploadedCount / REQUIRED_DOCS.length) * 100
                  }%`,
                }}
              />
            </div>

            <p>
              {uploadedCount === REQUIRED_DOCS.length
                ? 'All required documents have been uploaded.'
                : 'Upload all five required documents to complete your verification submission.'}
            </p>
          </div>

          <div className="document-list">
            {REQUIRED_DOCS.map((item) => {
              const doc = docs.find(
                (entry) => entry.document_type === item.type
              );

              const status = doc ? getStatus(doc.status) : null;
              const StatusIcon = status?.icon;
              const DocumentIcon = item.icon;

              const isUploading = uploadingDoc === item.type;
              const signedLink = documentLinks[item.type];

              return (
                <div className="document-item" key={item.type}>
                  <div className="document-icon">
                    <DocumentIcon size={22} />
                  </div>

                  <div className="document-information">
                    <strong>{item.label}</strong>

                    <p>{item.description}</p>

                    {doc ? (
                      <div
                        className={`document-status ${status?.className}`}
                      >
                        {StatusIcon && <StatusIcon size={14} />}
                        {status?.label}
                      </div>
                    ) : (
                      <span className="document-missing">
                        Not uploaded yet
                      </span>
                    )}

                    {doc?.file_name && (
                      <span className="document-filename">
                        <FileText size={13} />
                        {doc.file_name}
                      </span>
                    )}
                  </div>

                  <div className="document-actions">
                    {signedLink && (
                      <a
                        className="document-view-button"
                        href={signedLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye size={15} />
                        View
                      </a>
                    )}

                    <label
                      className={`document-upload-button ${
                        isUploading ? 'disabled' : ''
                      }`}
                    >
                      {isUploading ? (
                        <LoaderCircle
                          className="spin"
                          size={16}
                        />
                      ) : (
                        <UploadCloud size={16} />
                      )}

                      {isUploading
                        ? 'Uploading'
                        : doc
                          ? 'Replace'
                          : 'Upload'}

                      <input
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                        hidden
                        disabled={uploadingDoc !== null}
                        onChange={(event) =>
                          void handleDocumentUpload(
                            event,
                            item.type
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="document-info-note">
            <Info size={18} />

            <p>
              Accepted formats: JPG, PNG, and PDF. Maximum file size:
              10 MB. Documents are private and will only be accessible
              to authorized users. Replacing a document sends it back
              for review.
            </p>
          </div>
        </section>

        <section className="business-profile-card">
          <div className="business-profile-section-heading">
            <div>
              <h2>Business Overview</h2>
              <p>
                Read-only information about your business account.
              </p>
            </div>
          </div>

          <div className="business-overview-grid">
            <div className="business-overview-item">
              <span>
                <Star size={14} />
                Average Rating
              </span>

              <strong>
                {Number(caterer.avg_rating || 0).toFixed(1)} / 5
              </strong>
            </div>

            <div className="business-overview-item">
              <span>Total Reviews</span>
              <strong>{caterer.review_count || 0}</strong>
            </div>

            <div className="business-overview-item">
              <span>Verification</span>
              <strong>{verification.label}</strong>
            </div>

            <div className="business-overview-item">
              <span>Member Since</span>

              <strong>
                {caterer.created_at
                  ? new Date(
                      caterer.created_at
                    ).toLocaleDateString('en-PH', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </strong>
            </div>
          </div>
        </section>

        <div className="business-profile-save-area">
          <div>
            <strong>
              {requiresVerification
                ? 'Ready to submit your business for verification?'
                : 'Ready to save your changes?'}
            </strong>

            <span>
              {requiresVerification
                ? 'Complete all required information and upload all five documents before submitting.'
                : 'Your updates will be reflected in your business profile.'}
            </span>
          </div>

          <button
            type="submit"
            className="business-profile-save-button"
            disabled={saving || uploadingDoc !== null}
          >
            {saving ? (
              <>
                <LoaderCircle className="spin" size={18} />
                {uploadingImage
                  ? 'Uploading images...'
                  : requiresVerification
                    ? 'Submitting for review...'
                    : 'Saving changes...'}
              </>
            ) : (
              <>
                <Save size={18} />
                {requiresVerification
                  ? 'Submit Business Profile'
                  : 'Save Business Profile'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
