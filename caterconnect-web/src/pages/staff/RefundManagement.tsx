import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Wallet, Search, Clock, CheckCircle2, XCircle, 
  Loader2, X, Building2, User, FileText, DollarSign, ShieldAlert, CheckCircle 
} from 'lucide-react';

type RefundBooking = {
  id: string;
  event_date: string;
  total_cost: number;
  downpayment_amount: number;
  refund_status: 'none' | 'pending' | 'processed' | 'failed';
  refund_amount: number;
  refund_account_details: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  profiles: { full_name: string; email: string; phone_number: string | null } | null;
  caterers: { id: string; business_name: string; logo_url: string | null; account_standing: string } | null;
};

export default function RefundManagement() {
  const [refunds, setRefunds] = useState<RefundBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'processed' | 'failed' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RefundBooking | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transferRef, setTransferRef] = useState('');

  const loadRefunds = async () => {
    setLoading(true);
    let query = supabase
      .from('bookings')
      .select('id, event_date, total_cost, downpayment_amount, refund_status, refund_amount, refund_account_details, cancellation_reason, cancelled_at, cancelled_by, profiles(full_name, email, phone_number), caterers(id, business_name, logo_url, account_standing)')
      .neq('refund_status', 'none')
      .order('cancelled_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('refund_status', filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error loading refunds:', error);
    }
    setRefunds((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRefunds();
  }, [filter]);

  const handleProcessRefund = async (bookingId: string, catererId: string) => {
    if (!transferRef.trim()) {
      alert('Please enter the GCash transfer reference number or transaction ID before marking as processed.');
      return;
    }

    if (!confirm(`Confirm GCash transfer with Ref: "${transferRef.trim()}"? This will mark the refund as processed and flag the caterer with a debt.`)) return;
    
    setProcessing(true);
    
    // 1. Mark booking refund as processed
    const { error: refundError } = await supabase
      .from('bookings')
      .update({
        refund_status: 'processed',
        refunded_at: new Date().toISOString(),
        caterer_notes: `Refund disbursed via GCash. Ref: ${transferRef.trim()}`,
      })
      .eq('id', bookingId);

    if (refundError) {
      alert('Failed to update refund status: ' + refundError.message);
      setProcessing(false);
      return;
    }

    // 2. Automatically flag the caterer as 'owing_debt' for the Pay-or-Get-Banned workflow
    if (catererId) {
      const { error: catererError } = await supabase
        .from('caterers')
        .update({ account_standing: 'owing_debt' })
        .eq('id', catererId);

      if (catererError) {
        console.error('Error updating caterer standing:', catererError);
      }
    }

    setProcessing(false);
    setTransferRef('');
    setSelected(null);
    
    // Automatically switch filter to 'processed' so you see the result instantly in the table
    setFilter('processed');
    loadRefunds();
    
    alert('Refund successfully processed and caterer flagged with debt!');
  };

  const handleUpdateCatererStanding = async (catererId: string, newStanding: 'good_standing' | 'suspended' | 'banned', actionLabel: string) => {
    if (!confirm(`Are you sure you want to change this caterer's standing to "${actionLabel.toUpperCase()}"?`)) return;

    setProcessing(true);
    const { error } = await supabase
      .from('caterers')
      .update({ account_standing: newStanding })
      .eq('id', catererId);

    setProcessing(false);
    if (error) {
      alert('Failed to update caterer standing: ' + error.message);
    } else {
      alert(`Caterer successfully marked as ${actionLabel}.`);
      loadRefunds();
      if (selected && selected.caterers) {
        setSelected({
          ...selected,
          caterers: { ...selected.caterers, account_standing: newStanding }
        });
      }
    }
  };

  const handleRejectRefund = async (bookingId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setProcessing(true);
    const { error } = await supabase
      .from('bookings')
      .update({
        refund_status: 'failed',
        caterer_notes: `Refund rejected: ${rejectReason.trim()}`,
      })
      .eq('id', bookingId);

    setProcessing(false);
    if (error) {
      alert('Failed to reject refund: ' + error.message);
      return;
    }

    setShowRejectModal(false);
    setRejectReason('');
    setSelected(null);
    setFilter('failed');
    loadRefunds();
  };

  const filtered = refunds.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.profiles as any)?.full_name?.toLowerCase().includes(q) ||
      (r.caterers as any)?.business_name?.toLowerCase().includes(q) ||
      r.refund_account_details?.toLowerCase().includes(q)
    );
  });

  const pendingTotal = refunds
    .filter(r => r.refund_status === 'pending')
    .reduce((sum, r) => sum + Number(r.refund_amount || r.downpayment_amount || 0), 0);

  const processedTotal = refunds
    .filter(r => r.refund_status === 'processed')
    .reduce((sum, r) => sum + Number(r.refund_amount || r.downpayment_amount || 0), 0);

  return (
    <div style={{ paddingBottom: 40, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Process Refunds & Vendor Debts</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Verify GCash accounts, disburse customer refunds, and manage vendor account standings.</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Pending Disbursements</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>₱{pendingTotal.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Total Processed</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>₱{processedTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Segmented Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'pending', icon: Clock, label: 'Pending Requests', color: '#D97706' },
          { key: 'processed', icon: CheckCircle2, label: 'Processed', color: '#16A34A' },
          { key: 'failed', icon: XCircle, label: 'Rejected / Failed', color: '#DC2626' },
          { key: 'all', icon: Wallet, label: 'All Refunds', color: '#2563EB' },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key as any); setSelected(null); }}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#111' : '#6B7280',
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}
            >
              <TabIcon size={16} color={tab.color} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 420 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text"
          placeholder="Search customer, caterer, or GCash number..."
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 14, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14, background: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} 
        />
      </div>

      {/* Refunds Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Loader2 size={36} color="#F97316" className="animate-spin" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading refund requests...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB' }}>
              <Wallet size={32} color="#D1D5DB" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No refund requests found</div>
              <div style={{ fontSize: 14, color: '#6B7280' }}>No items match your active filter criteria.</div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Caterer & Standing</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>GCash Receiving #</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Refund Amount</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const isProcessed = r.refund_status === 'processed';
                  const isPending = r.refund_status === 'pending';
                  const statusBg = isProcessed ? '#DCFCE7' : isPending ? '#FEF3C7' : '#FEE2E2';
                  const statusColor = isProcessed ? '#166534' : isPending ? '#92400E' : '#991B1B';
                  
                  const standing = (r.caterers as any)?.account_standing || 'good_standing';
                  const standingBg = standing === 'good_standing' ? '#DCFCE7' : standing === 'owing_debt' ? '#FEF3C7' : '#FEE2E2';
                  const standingColor = standing === 'good_standing' ? '#166534' : standing === 'owing_debt' ? '#92400E' : '#991B1B';

                  return (
                    <tr key={r.id} style={{ cursor: 'pointer', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.15s' }}
                      onClick={() => { setSelected(selected?.id === r.id ? null : r); setTransferRef(''); setShowRejectModal(false); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{(r.profiles as any)?.full_name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>{(r.profiles as any)?.email ?? ''}</div>
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{(r.caterers as any)?.business_name ?? '—'}</div>
                        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, background: standingBg, color: standingColor, textTransform: 'uppercase' }}>
                          {standing.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#F97316' }}>
                        {r.refund_account_details ?? 'Not provided'}
                      </td>
                      <td style={{ padding: '18px 24px', fontWeight: 900, color: '#111', fontSize: 15 }}>
                        ₱{Number(r.refund_amount || r.downpayment_amount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 800, background: statusBg, color: statusColor, textTransform: 'uppercase' }}>
                          {r.refund_status}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                        <button style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#4B5563', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                          onClick={e => { e.stopPropagation(); setSelected(selected?.id === r.id ? null : r); setTransferRef(''); setShowRejectModal(false); }}>
                          {selected?.id === r.id ? 'Close' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Review Card Drawer */}
      {selected && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', borderLeft: '4px solid #F97316', marginTop: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #E5E7EB' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 4 }}>Refund Verification & Vendor Debt Enforcement</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>Booking ID: {selected.id}</div>
            </div>
            <button style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#4B5563' }}
              onClick={() => setSelected(null)}>
              <X size={14} /> Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={13} /> Customer Info
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{(selected.profiles as any)?.full_name ?? '—'}</div>
              <div style={{ fontSize: 12.5, color: '#6B7280' }}>{(selected.profiles as any)?.email ?? ''}</div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={13} /> Caterer Partner & Standing
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginTop: 2 }}>
                {(selected.caterers as any)?.business_name ?? '—'}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Standing:</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: (selected.caterers as any)?.account_standing === 'good_standing' ? '#DCFCE7' : '#FEF3C7', color: (selected.caterers as any)?.account_standing === 'good_standing' ? '#166534' : '#92400E', textTransform: 'uppercase' }}>
                  {((selected.caterers as any)?.account_standing || 'good_standing').replace('_', ' ')}
                </span>
              </div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>GCash Receiving Number</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#F97316', fontFamily: 'monospace', marginTop: 4 }}>
                {selected.refund_account_details ?? 'No number provided'}
              </div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Refund Amount</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111', marginTop: 4 }}>
                ₱{Number(selected.downpayment_amount || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB', marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={13} /> Cancellation Reason
            </div>
            <div style={{ fontSize: 13.5, color: '#374151', marginTop: 4 }}>
              "{selected.cancellation_reason ?? 'No reason provided'}"
            </div>
          </div>

          {/* Pay or Get Banned Management Controls for Staff (Only shown if standing is NOT good_standing) */}
          {(selected.caterers as any)?.id && (selected.caterers as any)?.account_standing !== 'good_standing' && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#92400E', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} /> Pay-or-Get-Banned Enforcement Panel
              </div>
              <div style={{ fontSize: 13, color: '#B45309', marginBottom: 14, lineHeight: 1.5 }}>
                If the caterer has transferred their debt to the platform staff's GCash account, clear their debt. If they refuse to pay within 48-72 hours, suspend or ban their account.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleUpdateCatererStanding((selected.caterers as any).id, 'good_standing', 'Good Standing')}
                  disabled={processing}
                  style={{ background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle size={14} /> Clear Debt (Restore Good Standing)
                </button>
                <button
                  onClick={() => handleUpdateCatererStanding((selected.caterers as any).id, 'suspended', 'Suspended')}
                  disabled={processing}
                  style={{ background: '#D97706', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Suspend Account
                </button>
                <button
                  onClick={() => handleUpdateCatererStanding((selected.caterers as any).id, 'banned', 'Permanently Banned')}
                  disabled={processing}
                  style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Ban Permanently
                </button>
              </div>
            </div>
          )}

          {selected.refund_status === 'pending' && (
            <div>
              {!showRejectModal ? (
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 8 }}>
                    Step 1: Execute manual GCash transfer to customer <span style={{ color: '#F97316', fontFamily: 'monospace' }}>{selected.refund_account_details || 'Customer Number'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                    Step 2: Enter the GCash transaction reference number below. This marks the refund as processed and flags the caterer with a debt.
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Enter GCash Ref No. (e.g., TRF-987654)"
                      value={transferRef}
                      onChange={e => setTransferRef(e.target.value)}
                      style={{ flex: 1, minWidth: 260, padding: '12px 16px', borderRadius: 12, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', background: '#FFF' }}
                    />
                    <button
                      onClick={() => handleProcessRefund(selected.id, (selected.caterers as any)?.id)}
                      disabled={processing || !transferRef.trim()}
                      style={{ background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 800, cursor: processing || !transferRef.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: transferRef.trim() ? 1 : 0.6 }}
                    >
                      {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Pay Customer & Flag Debt
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#991B1B', marginBottom: 8 }}>Provide Rejection Rationale</div>
                  <textarea
                    rows={3}
                    placeholder="E.g., Cancellation was requested within the non-refundable window..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #FCA5A5', outline: 'none', fontSize: 13.5, background: '#FFF', marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleRejectRefund(selected.id)}
                      disabled={processing || !rejectReason.trim()}
                      style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                      style={{ background: '#FFF', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {selected.refund_status === 'processed' && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 16, color: '#166534', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#16A34A" /> This refund has been successfully paid out to the customer. The caterer has been flagged with an outstanding balance.
            </div>
          )}
        </div>
      )}
    </div>
  );
}