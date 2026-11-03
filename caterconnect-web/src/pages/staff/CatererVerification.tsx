
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, FileText, CheckCircle2, XCircle, Clock,
  ExternalLink, Eye, X, Loader2, AlertCircle, Building2,
  User, Phone, Mail, MapPin
} from 'lucide-react';

type CatererDoc = {
  id: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  status: string;
};

type Caterer = {
  id: string;
  business_name: string;
  business_description: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  verification_status: string;
  rejection_reason: string | null;
  staff_notes: string | null;
  subscription_plan: string;
  created_at: string;
  logo_url: string | null;
  cover_photo_url: string | null;
  profiles: { full_name: string; email: string } | null;
  caterer_documents: CatererDoc[];
};

const DOC_LABELS: Record<string, string> = {
  business_permit: 'Business Permit',
  sanitary_permit: 'Sanitary Permit',
  government_id: 'Government-issued ID',
  business_registration: 'Business Registration Certificate',
  proof_of_address: 'Proof of Address',
};

const REQUIRED_DOC_TYPES = [
  'business_permit',
  'sanitary_permit',
  'government_id',
  'business_registration',
  'proof_of_address',
];

const STORAGE_BUCKET = 'caterer-documents';

export default function CatererVerification() {
  const { profile } = useAuth();

  const [caterers, setCaterers] = useState<Caterer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState<Caterer | null>(null);
  const [updating, setUpdating] = useState(false);

  const [rejectionReason, setRejectionReason] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<CatererDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Load caterer applications and their uploaded documents.
  const load = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('caterers')
        .select(`
          *,
          profiles!user_id (
            full_name,
            email
          ),
          caterer_documents (
            id,
            document_type,
            file_url,
            file_name,
            status
          )
        `)
        .eq('verification_status', filter)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load caterers:', error);
        alert('Failed to load caterer applications: ' + error.message);
        setCaterers([]);
        return;
      }

      const rows = (data as unknown as Caterer[]) ?? [];
      setCaterers(rows);

      // Keep the selected application updated after refreshing.
      if (selected) {
        const updatedSelected = rows.find((c) => c.id === selected.id);

        if (updatedSelected) {
          setSelected(updatedSelected);
        } else {
          setSelected(null);
        }
      }
    } catch (error: any) {
      console.error('Unexpected loading error:', error);
      alert('Unable to load applications: ' + error.message);
      setCaterers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const selectCaterer = (c: Caterer) => {
    setSelected(c);
    setRejectionReason(c.rejection_reason ?? '');
    setStaffNotes(c.staff_notes ?? '');
    setShowRejectForm(false);
    setPreviewDoc(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  // Convert either a stored object path or an older Supabase URL
  // into the object path required by createSignedUrl().
  const getStoragePath = (fileUrl: string) => {
    const value = fileUrl.trim();

    if (!value) {
      throw new Error('The document storage path is empty.');
    }

    // Handle full Supabase public or signed storage URLs.
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);

      const marker = `/${STORAGE_BUCKET}/`;
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex === -1) {
        throw new Error(
          'The file URL does not belong to the caterer-documents bucket.'
        );
      }

      return decodeURIComponent(
        url.pathname.substring(markerIndex + marker.length)
      );
    }

    // Handle stored object paths such as:
    // user-id/document-name.pdf
    return decodeURIComponent(
      value
        .replace(/^\/+/, '')
        .replace(new RegExp(`^${STORAGE_BUCKET}/`), '')
    );
  };

  // Generate a temporary secure URL for a private document.
  const handleViewDoc = async (doc: CatererDoc) => {
    if (!doc.file_url) {
      alert('This document has no stored file path.');
      return;
    }

    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);

    try {
      const storagePath = getStoragePath(doc.file_url);

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('Supabase did not return a signed URL.');
      }

      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error('Document preview error:', error);

      setPreviewError(
        error?.message ?? 'Unable to generate a secure document URL.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const isImage = (fileName: string | null) => {
    if (!fileName) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
  };

  const isPDF = (fileName: string | null) => {
    if (!fileName) return false;
    return /\.pdf$/i.test(fileName);
  };

  // Count unique required document types that have actual file paths.
  const getCompletedDocCount = (docs: CatererDoc[] | undefined) => {
    return REQUIRED_DOC_TYPES.filter((type) =>
      docs?.some(
        (doc) => doc.document_type === type && !!doc.file_url
      )
    ).length;
  };

  const completedDocs = getCompletedDocCount(
    selected?.caterer_documents
  );

  const totalRequired = REQUIRED_DOC_TYPES.length;

  // Approve or reject an application.
  const updateStatus = async (
    id: string,
    status: 'approved' | 'rejected'
  ) => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      alert('Please provide a rejection reason before rejecting.');
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('caterers')
        .update({
          verification_status: status,
          rejection_reason:
            status === 'rejected' ? rejectionReason.trim() : null,
          staff_notes: staffNotes.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.id ?? null,
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setSelected(null);
      setRejectionReason('');
      setStaffNotes('');
      setShowRejectForm(false);

      await load();

      alert(
        status === 'approved'
          ? 'Caterer application approved successfully.'
          : 'Caterer application rejected successfully.'
      );
    } catch (error: any) {
      console.error('Status update error:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const filterTabs = [
    {
      key: 'pending',
      icon: Clock,
      label: 'Pending Queue',
      color: '#D97706',
    },
    {
      key: 'approved',
      icon: CheckCircle2,
      label: 'Approved',
      color: '#16A34A',
    },
    {
      key: 'rejected',
      icon: XCircle,
      label: 'Rejected',
      color: '#DC2626',
    },
  ];

  return (
    <div className="verification-page">

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="verification-modal-overlay"
          onClick={closePreview}
        >
          <div
            className="verification-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="verification-preview-header">
              <div className="verification-preview-title">
                <h3>
                  {DOC_LABELS[previewDoc.document_type] ??
                    previewDoc.document_type}
                </h3>
                <p>{previewDoc.file_name ?? 'Uploaded Document'}</p>
              </div>

              <div className="verification-preview-actions">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="verification-open-button"
                  >
                    <ExternalLink size={15} />
                    <span>Open in Tab</span>
                  </a>
                )}

                <button
                  className="verification-close-button"
                  onClick={closePreview}
                  aria-label="Close document preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="verification-preview-content">
              {previewLoading ? (
                <div className="verification-loading">
                  <Loader2 size={32} className="animate-spin" />
                  <span>Securing document preview...</span>
                </div>
              ) : previewError ? (
                <div className="verification-preview-error">
                  <AlertCircle size={28} />
                  <strong>Unable to open document</strong>
                  <p>{previewError}</p>
                  <small>
                    Check the file path and Storage permissions in Supabase.
                  </small>
                </div>
              ) : !previewUrl ? (
                <div className="verification-preview-error">
                  Unable to render secure preview link.
                </div>
              ) : isImage(previewDoc.file_name) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.file_name ?? 'document'}
                  className="verification-preview-image"
                />
              ) : isPDF(previewDoc.file_name) ? (
                <iframe
                  src={previewUrl}
                  className="verification-preview-pdf"
                  title={previewDoc.file_name ?? 'PDF'}
                />
              ) : (
                <div className="verification-format-unavailable">
                  <FileText size={48} />
                  <strong>Format preview unavailable</strong>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download file directly
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="verification-page-header">
        <div>
          <h1>Caterer Verification</h1>
          <p>
            Thoroughly review incoming vendor submissions and legal
            clearances.
          </p>
        </div>

        <div className="verification-application-count">
          <span className="verification-count-dot" />
          {caterers.length} {filter.toUpperCase()} APPLICATIONS
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="verification-filter-wrapper">
        <div className="verification-filter-tabs">
          {filterTabs.map((tab) => {
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key);
                  setSelected(null);
                }}
                className={`verification-filter-button ${
                  filter === tab.key ? 'active' : ''
                }`}
              >
                <TabIcon size={16} color={tab.color} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive Split View */}
      <div className="verification-layout">

        {/* Application List */}
        <div className="verification-list-panel">
          <div className="verification-list-heading">
            <div>
              <h3>Applications</h3>
              <p>Select an application to review</p>
            </div>
            <span>{caterers.length}</span>
          </div>

          {loading ? (
            <div className="verification-empty-state">
              <Loader2
                size={30}
                className="animate-spin"
                color="#F97316"
              />
              <span>Loading queue...</span>
            </div>
          ) : caterers.length === 0 ? (
            <div className="verification-empty-state">
              <Building2 size={38} color="#D1D5DB" />
              <strong>No {filter} applications</strong>
              <span>All caught up with this queue!</span>
            </div>
          ) : (
            <div className="verification-application-list">
              {caterers.map((c) => {
                const docCount = getCompletedDocCount(
                  c.caterer_documents
                );

                const isSelected = selected?.id === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCaterer(c)}
                    className={`verification-application-item ${
                      isSelected ? 'selected' : ''
                    }`}
                  >
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.business_name}
                        className="verification-business-logo"
                      />
                    ) : (
                      <div className="verification-business-placeholder">
                        {c.business_name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="verification-application-info">
                      <strong>{c.business_name}</strong>

                      <span className="verification-owner-location">
                        {c.profiles?.full_name ?? '—'} · {c.city ?? 'Remote'}
                      </span>

                      <div className="verification-application-meta">
                        <span>
                          {new Date(c.created_at).toLocaleDateString(
                            'en-PH',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}
                        </span>

                        <span
                          className={`verification-doc-count ${
                            docCount >= totalRequired
                              ? 'complete'
                              : 'incomplete'
                          }`}
                        >
                          {docCount}/{totalRequired} docs
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Application Details */}
        <div className="verification-detail-panel">
          {!selected ? (
            <div className="verification-select-placeholder">
              <div className="verification-select-icon">
                <ShieldCheck size={32} />
              </div>
              <strong>Select an application</strong>
              <p>
                Choose a vendor entity from the application list to audit
                credentials and approve clearance.
              </p>
            </div>
          ) : (
            <div className="verification-detail-content">

              {/* Cover Photo */}
              {selected.cover_photo_url && (
                <div className="verification-cover-photo">
                  <img
                    src={selected.cover_photo_url}
                    alt="Business cover"
                  />
                </div>
              )}

              {/* Business Title */}
              <div className="verification-business-header">
                <div className="verification-business-heading">
                  {selected.logo_url ? (
                    <img
                      src={selected.logo_url}
                      alt={selected.business_name}
                      className="verification-detail-logo"
                    />
                  ) : (
                    <div className="verification-detail-logo-placeholder">
                      {selected.business_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="verification-business-title">
                    <h2>{selected.business_name}</h2>

                    <div className="verification-owner-email">
                      <User size={14} />
                      <span>
                        {selected.profiles?.full_name ?? '—'}
                      </span>
                      <span className="verification-owner-email-address">
                        ({selected.profiles?.email ?? '—'})
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`verification-status-badge ${selected.verification_status}`}
                >
                  {selected.verification_status}
                </span>
              </div>

              {/* Business Information */}
              <section className="verification-section">
                <h4>Vendor Metadata</h4>

                <div className="verification-metadata-grid">
                  <div className="verification-metadata-item">
                    <MapPin size={17} />
                    <div>
                      <span>City / Location</span>
                      <strong>{selected.city ?? '—'}</strong>
                    </div>
                  </div>

                  <div className="verification-metadata-item">
                    <Phone size={17} />
                    <div>
                      <span>Contact Phone</span>
                      <strong>{selected.contact_phone ?? '—'}</strong>
                    </div>
                  </div>

                  <div className="verification-metadata-item email">
                    <Mail size={17} />
                    <div>
                      <span>Business Email</span>
                      <strong>
                        {selected.contact_email ??
                          selected.profiles?.email ??
                          '—'}
                      </strong>
                    </div>
                  </div>
                </div>

                {selected.business_description && (
                  <div className="verification-business-description">
                    <span>Business Overview</span>
                    <p>{selected.business_description}</p>
                  </div>
                )}
              </section>

              {/* Required Documents */}
              <section className="verification-section">
                <div className="verification-doc-heading">
                  <h4>Compliance Clearances</h4>

                  <span
                    className={`verification-doc-progress ${
                      completedDocs >= totalRequired ? 'complete' : ''
                    }`}
                  >
                    {completedDocs} / {totalRequired} Uploaded Files
                  </span>
                </div>

                <div className="verification-document-list">
                  {REQUIRED_DOC_TYPES.map((type) => {
                    const doc = selected.caterer_documents?.find(
                      (d) =>
                        d.document_type === type &&
                        !!d.file_url
                    );

                    return (
                      <div
                        key={type}
                        className={`verification-document-item ${
                          doc ? 'submitted' : 'missing'
                        }`}
                      >
                        <div className="verification-document-info">
                          <FileText
                            size={20}
                            className="verification-document-icon"
                          />

                          <div>
                            <strong>{DOC_LABELS[type]}</strong>

                            <span>
                              {doc
                                ? `${doc.file_name ?? 'Uploaded Document'} · ${
                                    doc.status ?? 'pending'
                                  }`
                                : 'Missing required file'}
                            </span>
                          </div>
                        </div>

                        <div className="verification-document-action">
                          {doc?.file_url ? (
                            <button
                              type="button"
                              onClick={() => handleViewDoc(doc)}
                              className="verification-audit-button"
                            >
                              <Eye size={14} />
                              <span>Audit File</span>
                            </button>
                          ) : (
                            <span className="verification-not-submitted">
                              Not Submitted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Staff Notes */}
              <section className="verification-section">
                <h4>Internal Operations Notes</h4>

                <textarea
                  className="verification-textarea"
                  placeholder="Record internal review thoughts or comments..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                  disabled={selected.verification_status !== 'pending'}
                />
              </section>

              {/* Rejection Reason */}
              {(showRejectForm ||
                selected.verification_status === 'rejected') && (
                <section className="verification-section">
                  <h4 className="verification-rejection-heading">
                    Rejection Rationale (Visible to Vendor) *
                  </h4>

                  <textarea
                    className="verification-textarea rejection"
                    placeholder="Provide detailed feedback explaining why credentials were rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    disabled={selected.verification_status !== 'pending'}
                  />
                </section>
              )}

              {/* Action Buttons */}
              {selected.verification_status === 'pending' && (
                <div className="verification-actions">
                  {!showRejectForm ? (
                    <div className="verification-action-row">
                      <button
                        className="verification-approve-button"
                        onClick={() =>
                          updateStatus(selected.id, 'approved')
                        }
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        Approve & Grant Free Tier
                      </button>

                      <button
                        className="verification-reject-button"
                        onClick={() => setShowRejectForm(true)}
                        disabled={updating}
                      >
                        <XCircle size={18} />
                        Reject Application
                      </button>
                    </div>
                  ) : (
                    <div className="verification-rejection-confirm">
                      <div className="verification-warning">
                        <AlertCircle size={19} />
                        <span>
                          Confirming rejection will immediately transmit
                          feedback to the caterer.
                        </span>
                      </div>

                      <div className="verification-action-row">
                        <button
                          className="verification-confirm-rejection"
                          onClick={() =>
                            updateStatus(selected.id, 'rejected')
                          }
                          disabled={updating || !rejectionReason.trim()}
                        >
                          {updating
                            ? 'Processing...'
                            : 'Confirm Final Rejection'}
                        </button>

                        <button
                          className="verification-cancel-button"
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectionReason('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Approved Banner */}
              {selected.verification_status === 'approved' && (
                <div className="verification-outcome approved">
                  <CheckCircle2 size={24} />
                  <div>
                    <strong>Vendor Clearance Approved</strong>
                    <p>
                      This business is fully verified and assigned to the
                      Free Plan tier. They are active on the live public
                      marketplace.
                    </p>
                  </div>
                </div>
              )}

              {/* Rejected Banner */}
              {selected.verification_status === 'rejected' && (
                <div className="verification-outcome rejected">
                  <XCircle size={24} />
                  <div>
                    <strong>Application Rejected</strong>
                    {selected.rejection_reason && (
                      <p>"{selected.rejection_reason}"</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Responsive Styles */}
      <style>{`
        .verification-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          color: #111827;
        }

        .verification-page *,
        .verification-modal-overlay * {
          box-sizing: border-box;
        }

        .verification-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 28px;
        }

        .verification-page-header h1 {
          margin: 0 0 6px;
          font-size: clamp(22px, 2.5vw, 28px);
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #111;
        }

        .verification-page-header p {
          margin: 0;
          color: #6B7280;
          font-size: 14px;
          line-height: 1.5;
        }

        .verification-application-count {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 16px;
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          background: #FFF;
          color: #111;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .verification-count-dot {
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #F97316;
        }

        .verification-filter-wrapper {
          width: 100%;
          overflow-x: auto;
          margin-bottom: 22px;
          padding-bottom: 3px;
        }

        .verification-filter-tabs {
          display: flex;
          gap: 6px;
          width: max-content;
          min-width: min(100%, 420px);
          padding: 5px;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          background: #F3F4F6;
        }

        .verification-filter-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: #6B7280;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .verification-filter-button.active {
          background: #FFF;
          color: #111;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .verification-layout {
          display: grid;
          grid-template-columns: minmax(280px, 350px) minmax(0, 1fr);
          align-items: start;
          gap: 20px;
          width: 100%;
          min-width: 0;
        }

        .verification-list-panel,
        .verification-detail-panel {
          min-width: 0;
          background: #FFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.025);
          overflow: hidden;
        }

        .verification-list-panel {
          max-height: calc(100vh - 245px);
          overflow-y: auto;
        }

        .verification-list-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 17px 18px;
          border-bottom: 1px solid #F3F4F6;
          background: #FFF;
        }

        .verification-list-heading h3 {
          margin: 0 0 3px;
          color: #111;
          font-size: 14px;
          font-weight: 850;
        }

        .verification-list-heading p {
          margin: 0;
          color: #9CA3AF;
          font-size: 12px;
        }

        .verification-list-heading > span {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          border-radius: 20px;
          background: #FFF1E6;
          color: #C2410C;
          font-size: 12px;
          font-weight: 800;
        }

        .verification-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 220px;
          padding: 35px 20px;
          color: #9CA3AF;
          text-align: center;
          font-size: 13px;
        }

        .verification-empty-state strong {
          color: #111;
          font-size: 15px;
        }

        .verification-application-list {
          display: flex;
          flex-direction: column;
        }

        .verification-application-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-width: 0;
          padding: 15px 16px;
          border: none;
          border-bottom: 1px solid #F3F4F6;
          border-left: 4px solid transparent;
          background: #FFF;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
        }

        .verification-application-item:hover {
          background: #F9FAFB;
        }

        .verification-application-item.selected {
          border-left-color: #F97316;
          background: #FFF7ED;
        }

        .verification-business-logo,
        .verification-business-placeholder {
          width: 46px;
          height: 46px;
          flex-shrink: 0;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
          object-fit: cover;
        }

        .verification-business-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          border-color: #FFEDD5;
          background: #FFF7ED;
          color: #F97316;
          font-size: 18px;
          font-weight: 900;
        }

        .verification-application-info {
          flex: 1;
          min-width: 0;
        }

        .verification-application-info > strong {
          display: block;
          margin-bottom: 3px;
          overflow: hidden;
          color: #111;
          font-size: 14px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .verification-owner-location {
          display: block;
          margin-bottom: 7px;
          overflow: hidden;
          color: #6B7280;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .verification-application-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          color: #9CA3AF;
          font-size: 11px;
        }

        .verification-doc-count {
          padding: 3px 7px;
          border-radius: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .verification-doc-count.complete {
          background: #DCFCE7;
          color: #166534;
        }

        .verification-doc-count.incomplete {
          background: #FEF3C7;
          color: #92400E;
        }

        .verification-detail-panel {
          max-height: calc(100vh - 245px);
          overflow-y: auto;
          padding: 26px;
        }

        .verification-select-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 360px;
          padding: 50px 25px;
          text-align: center;
        }

        .verification-select-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 66px;
          height: 66px;
          margin-bottom: 16px;
          border: 1px solid #E5E7EB;
          border-radius: 50%;
          background: #F9FAFB;
          color: #D1D5DB;
        }

        .verification-select-placeholder strong {
          color: #111;
          font-size: 17px;
          font-weight: 850;
        }

        .verification-select-placeholder p {
          max-width: 360px;
          margin: 7px 0 0;
          color: #9CA3AF;
          font-size: 13px;
          line-height: 1.6;
        }

        .verification-detail-content {
          min-width: 0;
        }

        .verification-cover-photo {
          height: 175px;
          margin: -26px -26px 24px;
          overflow: hidden;
          background: #111;
        }

        .verification-cover-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.9;
        }

        .verification-business-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 26px;
        }

        .verification-business-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .verification-detail-logo,
        .verification-detail-logo-placeholder {
          width: 66px;
          height: 66px;
          flex-shrink: 0;
          border: 3px solid #FFF;
          border-radius: 16px;
          object-fit: cover;
          box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }

        .verification-detail-logo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FFF7ED;
          color: #F97316;
          font-size: 26px;
          font-weight: 900;
        }

        .verification-business-title {
          min-width: 0;
        }

        .verification-business-title h2 {
          margin: 0 0 6px;
          overflow-wrap: anywhere;
          color: #111;
          font-size: clamp(18px, 2vw, 23px);
          font-weight: 900;
          letter-spacing: -0.4px;
        }

        .verification-owner-email {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          color: #6B7280;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .verification-status-badge {
          flex-shrink: 0;
          padding: 6px 11px;
          border: 1px solid;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .verification-status-badge.pending {
          border-color: #FDE68A;
          background: #FEF3C7;
          color: #92400E;
        }

        .verification-status-badge.approved {
          border-color: #BBF7D0;
          background: #DCFCE7;
          color: #166534;
        }

        .verification-status-badge.rejected {
          border-color: #FECACA;
          background: #FEE2E2;
          color: #991B1B;
        }

        .verification-section {
          margin-bottom: 25px;
        }

        .verification-section h4 {
          margin: 0 0 11px;
          color: #9CA3AF;
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .verification-metadata-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          background: #F9FAFB;
        }

        .verification-metadata-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
          color: #6B7280;
        }

        .verification-metadata-item svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .verification-metadata-item > div {
          min-width: 0;
        }

        .verification-metadata-item span,
        .verification-business-description > span {
          display: block;
          margin-bottom: 4px;
          color: #9CA3AF;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .verification-metadata-item strong {
          display: block;
          color: #111;
          font-size: 13px;
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .verification-metadata-item.email {
          grid-column: 1 / -1;
          padding-top: 12px;
          border-top: 1px solid #E5E7EB;
        }

        .verification-business-description {
          margin-top: 12px;
          padding: 15px;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
          background: #FFF;
        }

        .verification-business-description p {
          margin: 0;
          color: #4B5563;
          font-size: 13px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .verification-doc-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 12px;
        }

        .verification-doc-heading h4 {
          margin: 0;
        }

        .verification-doc-progress {
          padding: 4px 10px;
          border-radius: 20px;
          background: #FEF3C7;
          color: #92400E;
          font-size: 11px;
          font-weight: 850;
        }

        .verification-doc-progress.complete {
          background: #DCFCE7;
          color: #166534;
        }

        .verification-document-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .verification-document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
        }

        .verification-document-item.submitted {
          background: #FAFAFA;
        }

        .verification-document-item.missing {
          background: #FFF5F5;
        }

        .verification-document-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .verification-document-icon {
          flex-shrink: 0;
          color: #16A34A;
        }

        .verification-document-item.missing .verification-document-icon {
          color: #DC2626;
        }

        .verification-document-info > div {
          min-width: 0;
        }

        .verification-document-info strong {
          display: block;
          margin-bottom: 4px;
          color: #111;
          font-size: 13px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .verification-document-info span {
          display: block;
          color: #6B7280;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .verification-document-action {
          flex-shrink: 0;
        }

        .verification-audit-button,
        .verification-open-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 11px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background: #FFF;
          color: #111;
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
        }

        .verification-audit-button:hover,
        .verification-open-button:hover {
          border-color: #F97316;
          color: #EA580C;
        }

        .verification-not-submitted {
          color: #DC2626;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .verification-textarea {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 90px;
          padding: 13px;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          outline: none;
          background: #F9FAFB;
          color: #111;
          font: inherit;
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
        }

        .verification-textarea:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }

        .verification-textarea:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .verification-section h4.verification-rejection-heading {
          color: #DC2626;
        }

        .verification-textarea.rejection {
          border-color: #FECACA;
          background: #FEF2F2;
        }

        .verification-action-row {
          display: flex;
          gap: 12px;
          width: 100%;
        }

        .verification-approve-button,
        .verification-reject-button,
        .verification-confirm-rejection,
        .verification-cancel-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          padding: 12px 15px;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 850;
          text-align: center;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
        }

        .verification-approve-button,
        .verification-reject-button {
          flex: 1;
        }

        .verification-approve-button {
          background: #16A34A;
          color: #FFF;
          box-shadow: 0 3px 7px rgba(22,163,74,0.15);
        }

        .verification-reject-button {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: #DC2626;
        }

        .verification-confirm-rejection {
          flex: 1;
          background: #DC2626;
          color: #FFF;
        }

        .verification-cancel-button {
          padding-right: 20px;
          padding-left: 20px;
          background: #F3F4F6;
          color: #4B5563;
        }

        .verification-approve-button:disabled,
        .verification-reject-button:disabled,
        .verification-confirm-rejection:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .verification-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
          padding: 13px;
          border: 1px solid #FDE68A;
          border-radius: 11px;
          background: #FFFBEB;
          color: #92400E;
          font-size: 12px;
          line-height: 1.5;
        }

        .verification-warning svg {
          flex-shrink: 0;
          color: #D97706;
        }

        .verification-outcome {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 17px;
          border: 1px solid;
          border-radius: 14px;
        }

        .verification-outcome > svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .verification-outcome strong {
          display: block;
          margin-bottom: 5px;
          font-size: 14px;
          font-weight: 900;
        }

        .verification-outcome p {
          margin: 0;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .verification-outcome.approved {
          border-color: #BBF7D0;
          background: #F0FDF4;
          color: #166534;
        }

        .verification-outcome.approved > svg {
          color: #16A34A;
        }

        .verification-outcome.rejected {
          border-color: #FECACA;
          background: #FEF2F2;
          color: #991B1B;
        }

        .verification-outcome.rejected > svg {
          color: #DC2626;
        }

        /* Document Preview Modal */
        .verification-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(17,17,17,0.75);
          backdrop-filter: blur(8px);
        }

        .verification-preview-modal {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          border-radius: 18px;
          background: #FFF;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
          animation: verificationScaleIn 0.2s ease-out;
        }

        .verification-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 17px 20px;
          border-bottom: 1px solid #E5E7EB;
          background: #FAFAFA;
        }

        .verification-preview-title {
          min-width: 0;
        }

        .verification-preview-title h3 {
          margin: 0 0 4px;
          color: #111;
          font-size: 16px;
          font-weight: 900;
        }

        .verification-preview-title p {
          margin: 0;
          overflow-wrap: anywhere;
          color: #6B7280;
          font-family: monospace;
          font-size: 11px;
        }

        .verification-preview-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-shrink: 0;
        }

        .verification-close-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: #111;
          color: #FFF;
          cursor: pointer;
        }

        .verification-preview-content {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          padding: 20px;
          overflow: auto;
          background: #F3F4F6;
        }

        .verification-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #6B7280;
          font-size: 13px;
          font-weight: 650;
          text-align: center;
        }

        .verification-loading svg {
          color: #F97316;
        }

        .verification-preview-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          max-width: 500px;
          color: #DC2626;
          font-size: 13px;
          font-weight: 750;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .verification-preview-error p {
          margin: 0;
          font-weight: 500;
        }

        .verification-preview-error small {
          color: #6B7280;
          font-weight: 500;
        }

        .verification-preview-image {
          display: block;
          max-width: 100%;
          max-height: 70vh;
          border-radius: 10px;
          object-fit: contain;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .verification-preview-pdf {
          width: 100%;
          height: 70vh;
          border: none;
          border-radius: 10px;
          background: #FFF;
        }

        .verification-format-unavailable {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #6B7280;
          text-align: center;
        }

        .verification-format-unavailable a {
          color: #F97316;
          font-size: 13px;
          font-weight: 800;
        }

        @keyframes verificationScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Tablet */
        @media (max-width: 1100px) {
          .verification-layout {
            grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
            gap: 14px;
          }

          .verification-detail-panel {
            padding: 20px;
          }

          .verification-cover-photo {
            margin: -20px -20px 20px;
          }

          .verification-business-header {
            flex-wrap: wrap;
          }
        }

        /* Smaller tablets and mobile */
        @media (max-width: 800px) {
          .verification-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          .verification-list-panel {
            max-height: 350px;
          }

          .verification-detail-panel {
            max-height: none;
            overflow: visible;
          }

          .verification-select-placeholder {
            min-height: 220px;
          }
        }

        /* Mobile */
        @media (max-width: 560px) {
          .verification-page-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
          }

          .verification-page-header p {
            font-size: 13px;
          }

          .verification-application-count {
            padding: 8px 12px;
            font-size: 11px;
          }

          .verification-filter-wrapper {
            margin-bottom: 16px;
          }

          .verification-filter-tabs {
            width: 100%;
            min-width: 0;
          }

          .verification-filter-button {
            flex: 1;
            gap: 5px;
            padding: 10px 8px;
            font-size: 11px;
          }

          .verification-layout {
            gap: 14px;
          }

          .verification-list-panel {
            max-height: 300px;
          }

          .verification-detail-panel {
            padding: 16px;
          }

          .verification-cover-photo {
            height: 135px;
            margin: -16px -16px 18px;
          }

          .verification-business-header {
            flex-direction: column;
            gap: 12px;
            margin-bottom: 22px;
          }

          .verification-business-heading {
            align-items: flex-start;
            gap: 10px;
            width: 100%;
          }

          .verification-detail-logo,
          .verification-detail-logo-placeholder {
            width: 54px;
            height: 54px;
            border-radius: 13px;
          }

          .verification-business-title h2 {
            font-size: 18px;
          }

          .verification-owner-email {
            font-size: 11px;
          }

          .verification-status-badge {
            align-self: flex-start;
          }

          .verification-metadata-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 13px;
            padding: 13px;
          }

          .verification-metadata-item.email {
            grid-column: auto;
            padding-top: 12px;
            border-top: 1px solid #E5E7EB;
          }

          .verification-document-item {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
            padding: 12px;
          }

          .verification-document-action {
            width: 100%;
          }

          .verification-audit-button {
            width: 100%;
            min-height: 38px;
          }

          .verification-not-submitted {
            display: block;
            padding-left: 2px;
          }

          .verification-action-row {
            flex-direction: column;
          }

          .verification-approve-button,
          .verification-reject-button,
          .verification-confirm-rejection,
          .verification-cancel-button {
            width: 100%;
            min-height: 46px;
          }

          .verification-doc-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .verification-modal-overlay {
            padding: 10px;
          }

          .verification-preview-modal {
            max-height: 94vh;
            border-radius: 14px;
          }

          .verification-preview-header {
            align-items: flex-start;
            padding: 13px;
          }

          .verification-preview-title h3 {
            font-size: 14px;
          }

          .verification-open-button {
            width: 36px;
            height: 36px;
            padding: 0;
          }

          .verification-open-button span {
            display: none;
          }

          .verification-preview-content {
            min-height: 220px;
            padding: 10px;
          }

          .verification-preview-pdf {
            height: 68vh;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .verification-preview-modal {
            animation: none;
          }

          .verification-filter-button,
          .verification-application-item,
          .verification-audit-button {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
