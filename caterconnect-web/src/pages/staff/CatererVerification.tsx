import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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

  const load = async () => {
    setLoading(true);
      const { data, error } = await supabase
  .from('caterers')
  .select('*, profiles!user_id(full_name, email), caterer_documents(*)')
  .eq('verification_status', filter)
  .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load caterers:', error);
      }
    setCaterers((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const selectCaterer = (c: Caterer) => {
    setSelected(c);
    setRejectionReason(c.rejection_reason ?? '');
    setStaffNotes(c.staff_notes ?? '');
    setShowRejectForm(false);
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      alert('Please provide a rejection reason before rejecting.');
      return;
    }
    setUpdating(true);
    const { error } = await supabase.from('caterers').update({
      verification_status: status,
      rejection_reason: status === 'rejected' ? rejectionReason.trim() : null,
      staff_notes: staffNotes.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile?.id ?? null,
      ...(status === 'approved' && { subscription_plan: 'free' }),
    }).eq('id', id);

    setUpdating(false);
    if (error) {
      alert('Error updating status: ' + error.message);
      return;
    }
    setSelected(null);
    setRejectionReason('');
    setStaffNotes('');
    setShowRejectForm(false);
    load();
  };

  // Generate a fresh signed URL and open/preview the document
  const handleViewDoc = async (doc: CatererDoc) => {
    if (!doc.file_url) return;
    setPreviewLoading(true);
    setPreviewDoc(doc);
    setPreviewUrl(null);

    // Extract storage path from the existing signed URL
    // file_url format: https://xxx.supabase.co/storage/v1/object/sign/caterer-documents/PATH?token=...
    try {
      const url = new URL(doc.file_url);
      const pathParts = url.pathname.split('/caterer-documents/');
      const storagePath = pathParts[1]?.split('?')[0];

      if (storagePath) {
        const { data } = await supabase.storage
          .from('caterer-documents')
          .createSignedUrl(storagePath, 60 * 60); // 1 hour fresh URL

        if (data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
        } else {
          // Fall back to original URL
          setPreviewUrl(doc.file_url);
        }
      } else {
        setPreviewUrl(doc.file_url);
      }
    } catch {
      setPreviewUrl(doc.file_url);
    }
    setPreviewLoading(false);
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const isImage = (fileName: string | null) => {
    if (!fileName) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const isPDF = (fileName: string | null) => {
    if (!fileName) return false;
    return /\.pdf$/i.test(fileName);
  };

  const completedDocs = selected?.caterer_documents?.length ?? 0;
  const totalRequired = REQUIRED_DOC_TYPES.length;

  return (
    <div style={s.page}>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={s.modalOverlay} onClick={closePreview}>
          <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>
                  {DOC_LABELS[previewDoc.document_type] ?? previewDoc.document_type}
                </div>
                <div style={s.modalFileName}>{previewDoc.file_name}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    ↗ Open in New Tab
                  </a>
                )}
                <button className="btn btn-black btn-sm" onClick={closePreview}>✕ Close</button>
              </div>
            </div>
            <div style={s.modalBody}>
              {previewLoading ? (
                <div style={s.previewLoading}>⏳ Loading document...</div>
              ) : !previewUrl ? (
                <div style={s.previewLoading}>❌ Could not load document.</div>
              ) : isImage(previewDoc.file_name) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.file_name ?? 'document'}
                  style={s.previewImage}
                />
              ) : isPDF(previewDoc.file_name) ? (
                <iframe
                  src={previewUrl}
                  style={s.previewPDF}
                  title={previewDoc.file_name ?? 'PDF'}
                />
              ) : (
                <div style={s.previewLoading}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                  <div>This file type cannot be previewed.</div>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#F97316', marginTop: 8, display: 'block' }}>
                    Click to download / open
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Caterer Verification</h1>
          <p style={s.pageSub}>Review caterer applications and verify business documents</p>
        </div>
        <div style={s.headerStat}>
          <span style={s.headerStatNum}>{caterers.length}</span>
          <span style={s.headerStatLabel}>{filter} applications</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {[
          { key: 'pending',  icon: '⏳', label: 'Pending'  },
          { key: 'approved', icon: '✅', label: 'Approved' },
          { key: 'rejected', icon: '❌', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelected(null); }}
            style={{ ...s.tab, ...(filter === tab.key ? s.tabActive : {}) }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div style={s.splitView}>

        {/* LEFT — caterer list */}
        <div style={s.listPanel}>
          {loading ? (
            <div style={s.empty}>⏳ Loading...</div>
          ) : caterers.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div>No {filter} applications</div>
            </div>
          ) : (
            caterers.map((c) => {
              const docCount = c.caterer_documents?.length ?? 0;
              return (
                <div
                  key={c.id}
                  onClick={() => selectCaterer(c)}
                  style={{ ...s.listItem, ...(selected?.id === c.id ? s.listItemActive : {}) }}
                >
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={c.business_name}
                      style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={s.listAvatar}>{c.business_name.charAt(0).toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.listName}>{c.business_name}</div>
                    <div style={s.listSub}>{c.profiles?.full_name ?? '—'} · {c.city ?? 'No city'}</div>
                    <div style={s.listMeta}>
                      <span style={s.listDate}>
                        {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: docCount >= 5 ? '#16A34A' : docCount > 0 ? '#D97706' : '#9CA3AF' }}>
                        {docCount}/5 docs
                      </span>
                    </div>
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: 18 }}>›</span>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT — detail panel */}
        <div style={s.detailPanel}>
          {!selected ? (
            <div style={s.noSelection}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👈</div>
              <div style={{ fontWeight: 800, color: '#111', fontSize: 16, marginBottom: 6 }}>Select an application</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Click a caterer from the list to review their details and take action</div>
            </div>
          ) : (
            <div>
              {/* Detail header */}
              <div style={s.detailHeader}>
                {/* Cover photo */}
                {selected.cover_photo_url && (
                  <div style={{ margin: '-24px -24px 20px', borderRadius: '16px 16px 0 0', overflow: 'hidden', height: 160 }}>
                    <img
                      src={selected.cover_photo_url}
                      alt="cover"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {selected.logo_url ? (
                    <img
                      src={selected.logo_url}
                      alt={selected.business_name}
                      style={{
                        width: 54, height: 54, borderRadius: 14,
                        objectFit: 'cover', flexShrink: 0,
                        border: '3px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        marginTop: selected.cover_photo_url ? -28 : 0,
                      }}
                    />
                  ) : (
                    <div style={{ ...s.detailAvatar, marginTop: selected.cover_photo_url ? -28 : 0 }}>
                      {selected.business_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h2 style={s.detailName}>{selected.business_name}</h2>
                    <div style={s.detailOwner}>{selected.profiles?.full_name} · {selected.profiles?.email}</div>
                  </div>
                  <span className={`badge badge-${selected.verification_status}`}>
                    {selected.verification_status}
                  </span>
                </div>
              </div>

              {/* Business info */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Business Information</div>
                <div style={s.infoGrid}>
                  {[
                    { label: 'Business Name',  value: selected.business_name },
                    { label: 'City / Area',    value: selected.city ?? '—' },
                    { label: 'Phone',          value: selected.contact_phone ?? '—' },
                    { label: 'Email',          value: selected.contact_email ?? '—' },
                    { label: 'Applied On',     value: new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) },
                    { label: 'Plan',           value: selected.subscription_plan.toUpperCase() },
                  ].map((row) => (
                    <div key={row.label} style={s.infoCell}>
                      <span style={s.infoCellLabel}>{row.label}</span>
                      <span style={s.infoCellValue}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {selected.business_description && (
                  <div style={s.descBox}>
                    <div style={s.descLabel}>Description</div>
                    <div style={s.descText}>{selected.business_description}</div>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div style={s.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={s.sectionLabel}>Verification Documents</div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: completedDocs >= totalRequired ? '#DCFCE7' : '#FEF3C7',
                    color: completedDocs >= totalRequired ? '#166534' : '#92400E',
                  }}>
                    {completedDocs}/{totalRequired} submitted
                  </span>
                </div>

                {/* Document cards — clickable to preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {REQUIRED_DOC_TYPES.map((type) => {
                    const doc = selected.caterer_documents?.find((d) => d.document_type === type);
                    const icon = type === 'business_permit' ? '🏢' : type === 'sanitary_permit' ? '🧪' : type === 'government_id' ? '🪪' : type === 'business_registration' ? '📋' : '🏠';

                    return (
                      <div
                        key={type}
                        style={{
                          ...s.docCard,
                          ...(doc ? s.docCardUploaded : s.docCardMissing),
                        }}
                      >
                        <div style={s.docCardIcon}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={s.docCardLabel}>{DOC_LABELS[type]}</div>
                          {doc ? (
                            <div style={s.docCardFile}>📄 {doc.file_name ?? 'Uploaded'}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#DC2626' }}>Not uploaded</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {doc?.file_url ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleViewDoc(doc)}
                              style={{ cursor: 'pointer' }}
                            >
                              👁 View
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span>
                          )}
                          <span className={`badge ${doc ? 'badge-pending' : 'badge-rejected'}`}>
                            {doc ? doc.status : 'missing'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff Notes */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Staff Notes (Internal — not visible to caterer)</div>
                <textarea
                  style={s.textarea}
                  placeholder="Add internal notes about this application..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                  disabled={selected.verification_status !== 'pending'}
                />
              </div>

              {/* Rejection Reason */}
              {(showRejectForm || selected.verification_status === 'rejected') && (
                <div style={s.section}>
                  <div style={s.sectionLabel}>
                    Rejection Reason <span style={{ color: '#DC2626' }}>* required</span>
                  </div>
                  <textarea
                    style={{ ...s.textarea, borderColor: '#DC2626' }}
                    placeholder="Explain clearly why this application is rejected. This will be shown to the caterer..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    disabled={selected.verification_status !== 'pending'}
                  />
                </div>
              )}

              {/* Action buttons — only shown for pending */}
              {selected.verification_status === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  {!showRejectForm ? (
                    <div style={s.actionRow}>
                      <button
                        className="btn btn-success"
                        style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 14 }}
                        onClick={() => updateStatus(selected.id, 'approved')}
                        disabled={updating}
                      >
                        {updating ? '⏳ Processing...' : '✅ Approve Application'}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 14 }}
                        onClick={() => setShowRejectForm(true)}
                        disabled={updating}
                      >
                        ❌ Reject Application
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={s.rejectWarning}>
                        ⚠️ You are about to reject this application. Make sure the rejection reason is complete and clear before confirming.
                      </div>
                      <div style={s.actionRow}>
                        <button
                          className="btn btn-danger"
                          style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 14, opacity: rejectionReason.trim() ? 1 : 0.5 }}
                          onClick={() => updateStatus(selected.id, 'rejected')}
                          disabled={updating || !rejectionReason.trim()}
                        >
                          {updating ? '⏳ Processing...' : '❌ Confirm Rejection'}
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '12px 24px' }}
                          onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result banners */}
              {selected.verification_status === 'approved' && (
                <div style={s.approvedBanner}>
                  <span style={{ fontSize: 24 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 900, color: '#166534', fontSize: 15 }}>Application Approved</div>
                    <div style={{ fontSize: 13, color: '#15803D', marginTop: 4 }}>
                      This caterer is verified and has been placed on the Free Plan. They can now create up to 3 packages and receive up to 5 booking requests per month.
                    </div>
                    {staffNotes && (
                      <div style={{ fontSize: 12, color: '#166534', marginTop: 8, opacity: 0.8 }}>
                        Staff notes: {staffNotes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selected.verification_status === 'rejected' && (
                <div style={s.rejectedBanner}>
                  <span style={{ fontSize: 24 }}>❌</span>
                  <div>
                    <div style={{ fontWeight: 900, color: '#991B1B', fontSize: 15 }}>Application Rejected</div>
                    {selected.rejection_reason && (
                      <div style={{ fontSize: 13, color: '#B91C1C', marginTop: 4, lineHeight: 1.6 }}>
                        {selected.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Replace just the pageHeader section styles at the bottom with:
const s: Record<string, React.CSSProperties> = {
  page: { height: '100%' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 4 },
  pageSub: { fontSize: 14, color: '#6B7280' },
  headerStat: { background: 'white', border: '1px solid #E8E4DE', borderRadius: 12, padding: '10px 20px', textAlign: 'center' },
  headerStatNum: { display: 'block', fontSize: 24, fontWeight: 900, color: '#F97316' },
  headerStatLabel: { display: 'block', fontSize: 12, color: '#6B7280', marginTop: 2 },
  tabs: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: { padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8EAED', background: 'white', fontSize: 13, fontWeight: 700, color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive: { background: '#111', color: 'white', border: '1.5px solid #111' },
  splitView: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' },
  listPanel: { background: 'white', borderRadius: 16, border: '1px solid #E8EAED', overflow: 'hidden', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' },
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' },
  listItemActive: { background: '#FEF3E8', borderLeft: '3px solid #F97316' },
  listAvatar: { width: 42, height: 42, borderRadius: 12, background: '#F97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, flexShrink: 0 },
  listName: { fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 2 },
  listSub: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  listMeta: { display: 'flex', gap: 10, alignItems: 'center' },
  listDate: { fontSize: 11, color: '#9CA3AF' },
  empty: { padding: '60px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  detailPanel: { background: 'white', borderRadius: 16, border: '1px solid #E8EAED', padding: '24px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' },
  noSelection: { textAlign: 'center', padding: '100px 40px', color: '#9CA3AF' },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #E5E7EB' },
  detailAvatar: { width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, flexShrink: 0 },
  detailName: { fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 4 },
  detailOwner: { fontSize: 13, color: '#6B7280' },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 0 },
  infoCell: { display: 'flex', flexDirection: 'column', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' },
  infoCellLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' },
  infoCellValue: { fontSize: 14, color: '#111', fontWeight: 600 },
  descBox: { marginTop: 12, background: '#F9FAFB', borderRadius: 10, padding: '12px 14px', border: '1px solid #E5E7EB' },
  descLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' },
  descText: { fontSize: 14, color: '#374151', lineHeight: 1.7 },
  docCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E5E7EB' },
  docCardUploaded: { background: '#F0FDF4', borderColor: '#86EFAC' },
  docCardMissing: { background: '#FEF2F2', borderColor: '#FECACA' },
  docCardIcon: { fontSize: 22, width: 40, height: 40, background: 'white', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #E5E7EB' },
  docCardLabel: { fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 },
  docCardFile: { fontSize: 11, color: '#6B7280' },
  textarea: { width: '100%', borderRadius: 10, border: '1.5px solid #E8EAED', padding: '12px 14px', fontSize: 14, color: '#111', resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' },
  actionRow: { display: 'flex', gap: 10 },
  rejectWarning: { background: '#FEF3C7', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400E', border: '1px solid #FDE68A' },
  approvedBanner: { display: 'flex', alignItems: 'flex-start', gap: 14, background: '#F0FDF4', borderRadius: 14, padding: '16px', border: '1px solid #86EFAC', marginTop: 8 },
  rejectedBanner: { display: 'flex', alignItems: 'flex-start', gap: 14, background: '#FEF2F2', borderRadius: 14, padding: '16px', border: '1px solid #FECACA', marginTop: 8 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { background: 'white', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 2 },
  modalFileName: { fontSize: 12, color: '#6B7280' },
  modalBody: { flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', minHeight: 400 },
  previewImage: { maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', padding: 16 },
  previewPDF: { width: '100%', height: '75vh', border: 'none' },
  previewLoading: { textAlign: 'center', color: '#6B7280', fontSize: 14, padding: 40 },
};