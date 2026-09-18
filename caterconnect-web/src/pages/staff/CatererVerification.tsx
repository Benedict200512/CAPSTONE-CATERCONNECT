import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, FileText, CheckCircle2, XCircle, Clock, 
  ExternalLink, Eye, X, Loader2, AlertCircle, Building2, User, Phone, Mail, MapPin 
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

  const handleViewDoc = async (doc: CatererDoc) => {
    if (!doc.file_url) return;
    setPreviewLoading(true);
    setPreviewDoc(doc);
    setPreviewUrl(null);

    try {
      const url = new URL(doc.file_url);
      const pathParts = url.pathname.split('/caterer-documents/');
      const storagePath = pathParts[1]?.split('?')[0];

      if (storagePath) {
        const { data } = await supabase.storage
          .from('caterer-documents')
          .createSignedUrl(storagePath, 60 * 60);

        if (data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
        } else {
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
    <div style={{ paddingBottom: 40 }}>
      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 17, 17, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={closePreview}>
          <div style={{ background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'scaleIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 2, letterSpacing: '-0.3px' }}>
                  {DOC_LABELS[previewDoc.document_type] ?? previewDoc.document_type}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'monospace' }}>{previewDoc.file_name}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#111', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  >
                    <ExternalLink size={14} /> Open in Tab
                  </a>
                )}
                <button style={{ background: '#111', color: '#FFF', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} onClick={closePreview}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', minHeight: 450, padding: 24 }}>
              {previewLoading ? (
                <div style={{ textAlign: 'center', color: '#6B7280', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Loader2 size={32} className="animate-spin" color="#F97316" />
                  <span style={{ fontWeight: 600 }}>Securing document preview...</span>
                </div>
              ) : !previewUrl ? (
                <div style={{ textAlign: 'center', color: '#DC2626', fontWeight: 700 }}>Unable to render secure preview link.</div>
              ) : isImage(previewDoc.file_name) ? (
                <img src={previewUrl} alt={previewDoc.file_name ?? 'document'} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              ) : isPDF(previewDoc.file_name) ? (
                <iframe src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} title={previewDoc.file_name ?? 'PDF'} />
              ) : (
                <div style={{ textAlign: 'center', color: '#4B5563' }}>
                  <FileText size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Format preview unavailable</div>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#F97316', fontWeight: 700, textDecoration: 'underline' }}>
                    Download file directly
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Caterer Verification</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Thoroughly review incoming vendor submissions and legal clearances.</p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, padding: '8px 20px', fontSize: 13, color: '#111', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316' }} />
          {caterers.length} {filter.toUpperCase()} APPLICATIONS
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content' }}>
        {[
          { key: 'pending', icon: Clock, label: 'Pending Queue', color: '#D97706' },
          { key: 'approved', icon: CheckCircle2, label: 'Approved', color: '#16A34A' },
          { key: 'rejected', icon: XCircle, label: 'Rejected', color: '#DC2626' },
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setSelected(null); }}
              style={{ 
                padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                background: filter === tab.key ? '#FFFFFF' : 'transparent',
                color: filter === tab.key ? '#111' : '#6B7280',
                boxShadow: filter === tab.key ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}
            >
              <TabIcon size={16} color={tab.color} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Split View Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT LIST PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={28} className="animate-spin" color="#F97316" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading queue...</span>
            </div>
          ) : caterers.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
              <Building2 size={36} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>No {filter} applications</div>
              <div style={{ fontSize: 13 }}>All caught up with this queue!</div>
            </div>
          ) : (
            <div>
              {caterers.map((c) => {
                const docCount = c.caterer_documents?.length ?? 0;
                const isSelected = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectCaterer(c)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.15s',
                      background: isSelected ? '#FFF7ED' : 'transparent',
                      borderLeft: isSelected ? '4px solid #F97316' : '4px solid transparent'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.business_name} style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF7ED', border: '1px solid #FFEDD5', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                        {c.business_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.business_name}</div>
                      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.profiles?.full_name ?? '—'} · {c.city ?? 'Remote'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>
                          {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: docCount >= 5 ? '#DCFCE7' : '#FEF3C7', color: docCount >= 5 ? '#166534' : '#92400E' }}>
                          {docCount}/5 docs
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT DETAIL PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 32, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: '120px 40px', color: '#9CA3AF' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ShieldCheck size={32} color="#D1D5DB" />
              </div>
              <div style={{ fontWeight: 800, color: '#111', fontSize: 18, marginBottom: 6 }}>Select an application</div>
              <div style={{ fontSize: 14 }}>Choose a vendor entity from the left list to audit credentials and approve clearance.</div>
            </div>
          ) : (
            <div>
              {/* Cover Photo */}
              {selected.cover_photo_url && (
                <div style={{ margin: '-32px -32px 24px', borderRadius: '20px 20px 0 0', overflow: 'hidden', height: 180, background: '#111' }}>
                  <img src={selected.cover_photo_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                </div>
              )}

              {/* Vendor Title & Status Badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: selected.cover_photo_url ? -40 : 0 }}>
                  {selected.logo_url ? (
                    <img src={selected.logo_url} alt={selected.business_name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 18, background: '#FFF7ED', border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28 }}>
                      {selected.business_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>{selected.business_name}</h2>
                    <div style={{ fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={14} /> {selected.profiles?.full_name ?? '—'} ({selected.profiles?.email ?? '—'})
                    </div>
                  </div>
                </div>

                <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, background: selected.verification_status === 'approved' ? '#DCFCE7' : selected.verification_status === 'rejected' ? '#FEE2E2' : '#FEF3C7', color: selected.verification_status === 'approved' ? '#166534' : selected.verification_status === 'rejected' ? '#991B1B' : '#92400E', border: `1px solid ${selected.verification_status === 'approved' ? '#BBF7D0' : selected.verification_status === 'rejected' ? '#FECACA' : '#FDE68A'}` }}>
                  {selected.verification_status}
                </span>
              </div>

              {/* Business Specs Grid */}
              <div style={{ marginBottom: 28 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vendor Metadata</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#F9FAFB', borderRadius: 16, padding: 16, border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MapPin size={16} color="#6B7280" />
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>City / Location</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{selected.city ?? '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Phone size={16} color="#6B7280" />
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Contact Phone</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{selected.contact_phone ?? '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: 'span 2', marginTop: 4, paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
                    <Mail size={16} color="#6B7280" />
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Business Email</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{selected.contact_email ?? selected.profiles?.email ?? '—'}</div>
                    </div>
                  </div>
                </div>
                {selected.business_description && (
                  <div style={{ marginTop: 12, background: '#FFFFFF', borderRadius: 14, padding: 16, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Business Overview</div>
                    <div style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6 }}>{selected.business_description}</div>
                  </div>
                )}
              </div>

              {/* Required Documents Section */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Compliance Clearances</h4>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: completedDocs >= totalRequired ? '#DCFCE7' : '#FEF3C7', color: completedDocs >= totalRequired ? '#166534' : '#92400E' }}>
                    {completedDocs} / {totalRequired} Verified Files
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {REQUIRED_DOC_TYPES.map((type) => {
                    const doc = selected.caterer_documents?.find((d) => d.document_type === type);
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 14, border: '1px solid #E5E7EB', background: doc ? '#FAFAFA' : '#FFF5F5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <FileText size={20} color={doc ? '#16A34A' : '#DC2626'} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{DOC_LABELS[type]}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{doc ? doc.file_name ?? 'Uploaded Document' : 'Missing required file'}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {doc?.file_url ? (
                            <button onClick={() => handleViewDoc(doc)} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#111', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                              <Eye size={14} /> Audit File
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>Not Submitted</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff Notes */}
              <div style={{ marginBottom: 28 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Internal Operations Notes</h4>
                <textarea
                  style={{ width: '100%', borderRadius: 14, border: '1px solid #E5E7EB', padding: 14, fontSize: 14, color: '#111', outline: 'none', background: '#F9FAFB', fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Record internal review thoughts or comments..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                  disabled={selected.verification_status !== 'pending'}
                />
              </div>

              {/* Rejection Reason Form */}
              {(showRejectForm || selected.verification_status === 'rejected') && (
                <div style={{ marginBottom: 28 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Rejection Rationale (Visible to Vendor) *</h4>
                  <textarea
                    style={{ width: '100%', borderRadius: 14, border: '1px solid #FECACA', padding: 14, fontSize: 14, color: '#111', outline: 'none', background: '#FEF2F2', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Provide detailed feedback explaining why credentials were rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    disabled={selected.verification_status !== 'pending'}
                  />
                </div>
              )}

              {/* Action Buttons */}
              {selected.verification_status === 'pending' && (
                <div>
                  {!showRejectForm ? (
                    <div style={{ display: 'flex', gap: 14 }}>
                      <button
                        style={{ flex: 1, padding: '14px', background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)' }}
                        onClick={() => updateStatus(selected.id, 'approved')}
                        disabled={updating}
                      >
                        {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Approve & Grant Free Tier
                      </button>
                      <button
                        style={{ flex: 1, padding: '14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        onClick={() => setShowRejectForm(true)}
                        disabled={updating}
                      >
                        <XCircle size={18} /> Reject Application
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 14, borderRadius: 12, fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0 }} />
                        Confirming rejection will immediately transmit feedback to the caterer.
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          style={{ flex: 1, padding: '14px', background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: (updating || !rejectionReason.trim()) ? 'not-allowed' : 'pointer', opacity: rejectionReason.trim() ? 1 : 0.6 }}
                          onClick={() => updateStatus(selected.id, 'rejected')}
                          disabled={updating || !rejectionReason.trim()}
                        >
                          {updating ? 'Processing...' : 'Confirm Final Rejection'}
                        </button>
                        <button
                          style={{ padding: '14px 24px', background: '#F3F4F6', color: '#4B5563', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status Outcome Banners */}
              {selected.verification_status === 'approved' && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <CheckCircle2 size={24} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#166534', fontSize: 15, marginBottom: 4 }}>Vendor Clearance Approved</div>
                    <div style={{ fontSize: 13, color: '#15803D', lineHeight: 1.6 }}>
                      This business is fully verified and assigned to the Free Plan tier. They are active on the live public marketplace.
                    </div>
                  </div>
                </div>
              )}

              {selected.verification_status === 'rejected' && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <XCircle size={24} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#991B1B', fontSize: 15, marginBottom: 4 }}>Application Rejected</div>
                    {selected.rejection_reason && (
                      <div style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.6 }}>
                        "{selected.rejection_reason}"
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}