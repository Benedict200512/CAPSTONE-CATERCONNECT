import './StaffUnified.css';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, Calendar, ChevronDown, ChevronUp, Loader2, X,
  Users, Store, MapPin, Tag, Wallet, ShieldCheck, Clock,
  Layers, CheckCircle2, XCircle, Activity
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  all:              { label: 'All', icon: Layers, color: '#2563EB' },
  pending:          { label: 'Pending', icon: Clock, color: '#D97706' },
  confirmed:        { label: 'Confirmed', icon: CheckCircle2, color: '#16A34A' },
  awaiting_payment: { label: 'Awaiting Payment', icon: Wallet, color: '#0284C7' },
  paid:             { label: 'Paid', icon: ShieldCheck, color: '#059669' },
  ongoing:          { label: 'Ongoing', icon: Activity, color: '#7C3AED' },
  completed:        { label: 'Completed', icon: CheckCircle2, color: '#15803D' },
  cancelled:        { label: 'Cancelled', icon: XCircle, color: '#6B7280' },
  rejected:         { label: 'Rejected', icon: XCircle, color: '#DC2626' },
};

const STATUS_FILTERS = Object.keys(STATUS_CONFIG);

const STATUS_BADGE: Record<string, string> = {
  pending:          'badge-pending',
  confirmed:        'badge-approved',
  awaiting_payment: 'badge-review',
  paid:             'badge-paid',
  ongoing:          'badge-ongoing',
  completed:        'badge-completed',
  cancelled:        'badge-cancelled',
  rejected:         'badge-rejected',
};

export default function BookingMonitor() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      let query = supabase
        .from('bookings')
        .select('id, event_date, guest_count, total_cost, downpayment_amount, status, created_at, event_type, venue, profiles(full_name, email, avatar_url), caterers(business_name, logo_url)')
        .order('created_at', { ascending: false })
        .limit(150);

      if (filter !== 'all') query = query.eq('status', filter);

      const { data } = await query;
      setBookings(data ?? []);

      const statuses = [
        'pending', 'confirmed', 'awaiting_payment', 'paid',
        'ongoing', 'completed', 'cancelled', 'rejected'
      ];

      const countRes = await Promise.all(
        statuses.map(s =>
          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('status', s)
        )
      );

      const c: Record<string, number> = {};

      statuses.forEach((s, i) => {
        c[s] = countRes[i].count ?? 0;
      });

      c.all = Object.values(c).reduce((a, b) => a + b, 0);
      setCounts(c);
      setLoading(false);
    };

    load();
  }, [filter]);

  const filtered = bookings.filter(b => {
    if (!search) return true;

    const q = search.toLowerCase();

    return (
      (b.profiles as any)?.full_name?.toLowerCase().includes(q) ||
      (b.caterers as any)?.business_name?.toLowerCase().includes(q)
    );
  });

  const totalAmount = filtered.reduce(
    (s, b) => s + Number(b.total_cost ?? 0),
    0
  );

  return (
    <div className="booking-monitor-page cc-staff-unified">

      {/* Responsive Header */}
      <div className="booking-header">
        <div className="booking-heading">
          <h1>Booking Monitor</h1>
          <p>Track all bookings across the platform in real time</p>
        </div>

        <div className="booking-header-stats">
          <div className="booking-stat-pill">
            <span className="booking-stat-number orange">
              {counts.all ?? '—'}
            </span>
            <span className="booking-stat-label">Total Bookings</span>
          </div>

          <div className="booking-stat-pill">
            <span className="booking-stat-number green">
              ₱{totalAmount.toLocaleString()}
            </span>
            <span className="booking-stat-label">Total Value Shown</span>
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="booking-status-filters">
        {STATUS_FILTERS.map(sf => {
          const config = STATUS_CONFIG[sf] || {
            label: sf,
            icon: Layers,
            color: '#6B7280'
          };

          const IconComponent = config.icon;
          const isActive = filter === sf;

          return (
            <button
              key={sf}
              className={`booking-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setFilter(sf)}
            >
              <IconComponent
                size={14}
                color={isActive ? '#FFFFFF' : config.color}
              />

              <span>{config.label}</span>

              {counts[sf] !== undefined && (
                <span className="booking-tab-count">
                  {counts[sf]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="booking-search">
        <Search size={18} color="#9CA3AF" />

        <input
          type="text"
          placeholder="Search by customer or caterer name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Booking Table */}
      <div className="booking-table-container">

        {loading ? (
          <div className="booking-empty-state">
            <Loader2
              size={36}
              color="#EA580C"
              className="animate-spin"
            />
            <span>Loading bookings ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="booking-empty-state">
            <div className="booking-empty-icon">
              <Calendar size={32} color="#D1D5DB" />
            </div>

            <div>
              <div className="booking-empty-title">
                No bookings found
              </div>

              <div className="booking-empty-description">
                {filter !== 'all'
                  ? 'No bookings match this status filter.'
                  : 'Bookings will appear here once customers start booking.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="booking-table-scroll">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Caterer</th>
                  <th>Event Date</th>
                  <th className="center">Guests</th>
                  <th>Total</th>
                  <th>Downpayment</th>
                  <th>Status</th>
                  <th>Booked On</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="booking-table-row"
                    onClick={() =>
                      setSelected(selected?.id === b.id ? null : b)
                    }
                  >
                    {/* Customer */}
                    <td>
                      <div className="booking-person-cell">
                        {(b.profiles as any)?.avatar_url ? (
                          <img
                            src={(b.profiles as any).avatar_url}
                            alt=""
                            className="booking-customer-avatar"
                          />
                        ) : (
                          <div className="booking-customer-avatar-fallback">
                            {((b.profiles as any)?.full_name ?? 'C')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}

                        <div className="booking-person-info">
                          <div className="booking-person-name">
                            {(b.profiles as any)?.full_name ?? '—'}
                          </div>
                          <div className="booking-person-email">
                            {(b.profiles as any)?.email ?? ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Caterer */}
                    <td>
                      <div className="booking-person-cell">
                        {(b.caterers as any)?.logo_url ? (
                          <img
                            src={(b.caterers as any).logo_url}
                            alt=""
                            className="booking-caterer-avatar"
                          />
                        ) : (
                          <div className="booking-caterer-avatar-fallback">
                            {((b.caterers as any)?.business_name ?? 'C')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}

                        <span className="booking-caterer-name">
                          {(b.caterers as any)?.business_name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Event Date */}
                    <td className="booking-date-cell">
                      {b.event_date
                        ? new Date(b.event_date).toLocaleDateString(
                            'en-PH',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }
                          )
                        : '—'}
                    </td>

                    {/* Guests */}
                    <td className="booking-guests-cell">
                      {b.guest_count ?? '—'}
                    </td>

                    {/* Total */}
                    <td className="booking-total-cell">
                      ₱{Number(b.total_cost ?? 0).toLocaleString()}
                    </td>

                    {/* Downpayment */}
                    <td className="booking-downpayment-cell">
                      ₱{Number(b.downpayment_amount ?? 0).toLocaleString()}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`badge ${
                          STATUS_BADGE[b.status] ?? 'badge-pending'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Booked On */}
                    <td className="booking-created-cell">
                      {new Date(b.created_at).toLocaleDateString(
                        'en-PH',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }
                      )}
                    </td>

                    {/* Expand */}
                    <td className="booking-expand-cell">
                      <button
                        className="booking-expand-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setSelected(selected?.id === b.id ? null : b);
                        }}
                      >
                        {selected?.id === b.id ? (
                          <ChevronUp size={16} color="#4B5563" />
                        ) : (
                          <ChevronDown size={16} color="#4B5563" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded Booking Details */}
      {selected && (
        <div className="booking-detail-panel">

          <div className="booking-detail-header">
            <div className="booking-detail-heading">
              <h2>Booking Detail Overview</h2>
              <span>ID: {selected.id}</span>
            </div>

            <button
              className="booking-close-btn"
              onClick={() => setSelected(null)}
            >
              <X size={14} />
              Close View
            </button>
          </div>

          <div className="booking-detail-grid">

            {/* Customer */}
            <div className="booking-detail-card">
              {(selected.profiles as any)?.avatar_url ? (
                <img
                  src={(selected.profiles as any).avatar_url}
                  alt=""
                  className="booking-detail-avatar"
                />
              ) : (
                <div className="booking-detail-avatar-fallback blue">
                  {((selected.profiles as any)?.full_name ?? 'C')
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div className="booking-detail-info">
                <div className="booking-detail-label">
                  <Users size={12} />
                  Customer
                </div>

                <div className="booking-detail-value">
                  {(selected.profiles as any)?.full_name ?? '—'}
                </div>

                <div className="booking-detail-subtext">
                  {(selected.profiles as any)?.email ?? ''}
                </div>
              </div>
            </div>

            {/* Caterer */}
            <div className="booking-detail-card">
              {(selected.caterers as any)?.logo_url ? (
                <img
                  src={(selected.caterers as any).logo_url}
                  alt=""
                  className="booking-detail-avatar square"
                />
              ) : (
                <div className="booking-detail-avatar-fallback purple">
                  {((selected.caterers as any)?.business_name ?? 'C')
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div className="booking-detail-info">
                <div className="booking-detail-label">
                  <Store size={12} />
                  Caterer Partner
                </div>

                <div className="booking-detail-value">
                  {(selected.caterers as any)?.business_name ?? '—'}
                </div>
              </div>
            </div>

            {/* Event Date */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon orange-bg">
                <Calendar size={20} color="#EA580C" />
              </div>

              <div>
                <div className="booking-detail-label">Event Date</div>
                <div className="booking-detail-value">
                  {selected.event_date
                    ? new Date(selected.event_date).toLocaleDateString(
                        'en-PH',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        }
                      )
                    : '—'}
                </div>
              </div>
            </div>

            {/* Guests */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon blue-bg">
                <Users size={20} color="#2563EB" />
              </div>

              <div>
                <div className="booking-detail-label">Guest Count</div>
                <div className="booking-detail-value">
                  {selected.guest_count ?? '—'} guests
                </div>
              </div>
            </div>

            {/* Event Type */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon green-bg">
                <Tag size={20} color="#16A34A" />
              </div>

              <div>
                <div className="booking-detail-label">Event Type</div>
                <div className="booking-detail-value">
                  {selected.event_type ?? '—'}
                </div>
              </div>
            </div>

            {/* Venue */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon red-bg">
                <MapPin size={20} color="#DC2626" />
              </div>

              <div className="booking-detail-info">
                <div className="booking-detail-label">Venue Location</div>
                <div className="booking-detail-value">
                  {selected.venue ?? '—'}
                </div>
              </div>
            </div>

            {/* Total Cost */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon orange-bg">
                <Wallet size={20} color="#EA580C" />
              </div>

              <div>
                <div className="booking-detail-label">Total Cost</div>
                <div className="booking-detail-value orange-text">
                  ₱{Number(selected.total_cost ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Downpayment */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon purple-bg">
                <ShieldCheck size={20} color="#7C3AED" />
              </div>

              <div>
                <div className="booking-detail-label">
                  Downpayment Required
                </div>
                <div className="booking-detail-value purple-text">
                  ₱{Number(selected.downpayment_amount ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="booking-detail-card">
              <div className="booking-detail-icon gray-bg">
                <Clock size={20} color="#4B5563" />
              </div>

              <div>
                <div className="booking-detail-label">Current Status</div>
                <div className="booking-detail-status">
                  <span
                    className={`badge ${
                      STATUS_BADGE[selected.status] ?? 'badge-pending'
                    }`}
                  >
                    {selected.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .booking-monitor-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .booking-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }

        .booking-heading h1 {
          font-size: 26px;
          font-weight: 800;
          color: #111;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .booking-heading p {
          font-size: 14px;
          color: #6B7280;
          margin: 0;
          line-height: 1.5;
        }

        .booking-header-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .booking-stat-pill {
          background: white;
          border: 1px solid #E8E4DE;
          border-radius: 16px;
          padding: 12px 22px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.03);
          min-width: 130px;
        }

        .booking-stat-number {
          display: block;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .booking-stat-number.orange { color: #EA580C; }
        .booking-stat-number.green { color: #16A34A; }

        .booking-stat-label {
          display: block;
          font-size: 11px;
          color: #6B7280;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 3px;
        }

        .booking-status-filters {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          width: 100%;
        }

        .booking-tab-btn {
          white-space: nowrap;
          font-size: 12.5px;
          padding: 8px 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          flex-shrink: 0;
          border: 1px solid #E8E4DE;
          border-radius: 10px;
          background: #FFFFFF;
          color: #4B5563;
          cursor: pointer;
          transition: all 0.2s;
        }

        .booking-tab-btn:hover {
          background: #FFF7ED;
          border-color: #FED7AA;
        }

        .booking-tab-btn.active {
          background: #EA580C;
          color: #FFFFFF;
          border-color: #EA580C;
        }

        .booking-tab-count {
          margin-left: 4px;
          background: #F3F4F6;
          color: #6B7280;
          border-radius: 10px;
          padding: 1px 6px;
          font-size: 10.5px;
          font-weight: 700;
        }

        .booking-tab-btn.active .booking-tab-count {
          background: rgba(255,255,255,0.25);
          color: #FFFFFF;
        }

        .booking-search {
          position: relative;
          margin-bottom: 20px;
          width: 100%;
          max-width: 400px;
        }

        .booking-search svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .booking-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 16px 12px 44px;
          border-radius: 12px;
          border: 1px solid #E8E4DE;
          outline: none;
          font-size: 14px;
          background: #FFFFFF;
          color: #111;
          min-height: 44px;
        }

        .booking-search input:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.10);
        }

        .booking-table-container {
          width: 100%;
          background: #FFFFFF;
          border-radius: 20px;
          border: 1px solid #E8E4DE;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        .booking-table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .booking-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
          text-align: left;
        }

        .booking-table thead {
          background: #F9FAFB;
        }

        .booking-table th {
          padding: 16px 18px;
          font-size: 11px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          border-bottom: 1px solid #E8E4DE;
        }

        .booking-table th.center,
        .booking-table td.booking-guests-cell {
          text-align: center;
        }

        .booking-table td {
          padding: 16px 18px;
          border-bottom: 1px solid #E8E4DE;
          vertical-align: middle;
        }

        .booking-table-row {
          cursor: pointer;
          transition: background 0.15s;
        }

        .booking-table-row:hover {
          background: #F9FAFB;
        }

        .booking-person-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 150px;
        }

        .booking-customer-avatar,
        .booking-customer-avatar-fallback {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
          border: 1.5px solid #E5E7EB;
        }

        .booking-customer-avatar-fallback,
        .booking-caterer-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          background: #DBEAFE;
          color: #2563EB;
        }

        .booking-person-info {
          min-width: 0;
        }

        .booking-person-name {
          font-weight: 700;
          font-size: 13px;
          color: #111;
          white-space: nowrap;
        }

        .booking-person-email {
          font-size: 11px;
          color: #9CA3AF;
          white-space: nowrap;
        }

        .booking-caterer-avatar,
        .booking-caterer-avatar-fallback {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          flex-shrink: 0;
          object-fit: cover;
          border: 1px solid #E5E7EB;
        }

        .booking-caterer-avatar-fallback {
          background: #F5F3FF;
          color: #7C3AED;
          font-size: 12px;
        }

        .booking-caterer-name {
          font-weight: 700;
          font-size: 13px;
          color: #111;
          white-space: nowrap;
        }

        .booking-date-cell {
          white-space: nowrap;
          font-size: 12px;
          font-weight: 600;
          color: #4B5563;
        }

        .booking-guests-cell {
          font-weight: 700;
          font-size: 13px;
          color: #111;
        }

        .booking-total-cell {
          font-weight: 800;
          color: #EA580C;
          font-size: 13px;
          white-space: nowrap;
        }

        .booking-downpayment-cell {
          color: #6B7280;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .booking-created-cell {
          font-size: 11px;
          color: #9CA3AF;
          white-space: nowrap;
        }

        .booking-expand-cell {
          text-align: right;
        }

        .booking-expand-btn {
          background: #FAF8F5;
          border: 1px solid #E8E4DE;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .booking-expand-btn:hover,
        .booking-close-btn:hover {
          background: #FFF7ED;
          border-color: #FED7AA;
        }

        .booking-empty-state {
          padding: 64px 20px;
          text-align: center;
          color: #9CA3AF;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .booking-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #FAF8F5;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #E8E4DE;
        }

        .booking-empty-title {
          font-size: 17px;
          font-weight: 800;
          color: #111;
          margin-bottom: 4px;
        }

        .booking-empty-description {
          font-size: 13px;
          color: #6B7280;
          line-height: 1.5;
        }

        .booking-detail-panel {
          width: 100%;
          box-sizing: border-box;
          background: #FFFFFF;
          border-radius: 20px;
          border: 1px solid #E8E4DE;
          border-left: 4px solid #EA580C;
          margin-top: 24px;
          padding: 28px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }

        .booking-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #E8E4DE;
        }

        .booking-detail-heading {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .booking-detail-heading h2 {
          font-size: 20px;
          font-weight: 800;
          color: #111;
          margin: 0 0 4px;
        }

        .booking-detail-heading span {
          font-size: 11px;
          color: #9CA3AF;
          font-family: monospace;
          overflow-wrap: anywhere;
        }

        .booking-close-btn {
          flex-shrink: 0;
          background: #FAF8F5;
          border: 1px solid #E8E4DE;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #4B5563;
        }

        .booking-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
          gap: 14px;
        }

        .booking-detail-card {
          min-width: 0;
          box-sizing: border-box;
          background: #FAF8F5;
          border-radius: 14px;
          padding: 16px;
          border: 1px solid #E8E4DE;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .booking-detail-avatar,
        .booking-detail-avatar-fallback {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #FED7AA;
          flex-shrink: 0;
        }

        .booking-detail-avatar.square,
        .booking-detail-avatar-fallback.purple {
          border-radius: 10px;
        }

        .booking-detail-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
        }

        .booking-detail-avatar-fallback.blue {
          background: #DBEAFE;
          color: #2563EB;
        }

        .booking-detail-avatar-fallback.purple {
          background: #F5F3FF;
          color: #7C3AED;
        }

        .booking-detail-info {
          flex: 1;
          min-width: 0;
        }

        .booking-detail-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #9CA3AF;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .booking-detail-value {
          font-size: 13px;
          font-weight: 800;
          color: #111;
          margin-top: 2px;
          overflow-wrap: anywhere;
        }

        .booking-detail-subtext {
          font-size: 11px;
          color: #6B7280;
          overflow-wrap: anywhere;
        }

        .booking-detail-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid transparent;
        }

        .orange-bg { background: #FFF7ED; border-color: #FED7AA; }
        .blue-bg { background: #EFF6FF; border-color: #BFDBFE; }
        .green-bg { background: #F0FDF4; border-color: #BBF7D0; }
        .red-bg { background: #FEF2F2; border-color: #FECACA; }
        .purple-bg { background: #F5F3FF; border-color: #DDD6FE; }
        .gray-bg { background: #F3F4F6; border-color: #E5E7EB; }

        .orange-text { color: #EA580C; }
        .purple-text { color: #7C3AED; }

        .booking-detail-status {
          margin-top: 5px;
        }

        /* Tablet */
        @media (max-width: 1024px) {
          .booking-header {
            align-items: flex-start;
          }

          .booking-header-stats {
            width: 100%;
          }

          .booking-stat-pill {
            flex: 1;
          }

          .booking-detail-panel {
            padding: 22px;
          }

          .booking-table {
            min-width: 1000px;
          }
        }

        /* Mobile and small tablet */
        @media (max-width: 768px) {
          .booking-monitor-page {
            padding-bottom: 24px;
          }

          .booking-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            margin-bottom: 20px;
          }

          .booking-heading h1 {
            font-size: 23px;
          }

          .booking-heading p {
            font-size: 13px;
          }

          .booking-header-stats {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .booking-stat-pill {
            min-width: 0;
            padding: 12px 8px;
            border-radius: 13px;
          }

          .booking-stat-number {
            font-size: 18px;
          }

          .booking-stat-label {
            font-size: 9px;
          }

          .booking-status-filters {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 8px;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
          }

          .booking-tab-btn {
            flex-shrink: 0;
            font-size: 12px;
            padding: 8px 11px;
          }

          .booking-search {
            max-width: none;
          }

          .booking-table-container {
            border-radius: 15px;
          }

          .booking-table {
            min-width: 1000px;
          }

          .booking-table th,
          .booking-table td {
            padding: 13px 14px;
          }

          .booking-detail-panel {
            margin-top: 18px;
            padding: 18px;
            border-radius: 16px;
          }

          .booking-detail-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .booking-detail-heading h2 {
            font-size: 18px;
          }

          .booking-close-btn {
            justify-content: center;
            width: 100%;
            box-sizing: border-box;
            min-height: 40px;
          }

          .booking-detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .booking-detail-card {
            padding: 12px;
            gap: 9px;
          }

          .booking-detail-icon,
          .booking-detail-avatar,
          .booking-detail-avatar-fallback {
            width: 36px;
            height: 36px;
          }

          .booking-detail-label {
            font-size: 9px;
          }

          .booking-detail-value {
            font-size: 12px;
          }

          .booking-detail-subtext {
            font-size: 10px;
          }
        }

        /* Small mobile */
        @media (max-width: 480px) {
          .booking-heading h1 {
            font-size: 21px;
          }

          .booking-stat-number {
            font-size: 16px;
          }

          .booking-detail-panel {
            padding: 14px;
          }

          .booking-detail-grid {
            grid-template-columns: 1fr;
          }

          .booking-detail-card {
            padding: 14px;
          }

          .booking-empty-state {
            padding: 45px 16px;
          }

          .booking-empty-title {
            font-size: 15px;
          }

          .booking-empty-description {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
