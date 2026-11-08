import './AdminUnified.css';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { assignStaffRole } from '../../lib/profileRoles';
import { createStaffAccount } from '../../lib/staffProvisioning';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle,
  CreditCard,
  Package,
  Calendar,
  Loader2,
  Shield,
  Mail,
  UserPlus,
  X,
  User,
  Lock,
} from 'lucide-react';

type StaffAccount = {
  id: string;
  role: 'staff' | 'admin';
  full_name: string | null;
  email: string | null;
  created_at: string | null;
};

const PLAN_DETAILS = [
  {
    plan: 'Free',
    price: 0,
    bookings: 5,
    packages: 3,
    color: '#C2410C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    accent: 'linear-gradient(135deg, #F97316, #FDBA74)',
  },
  {
    plan: 'Basic',
    price: 299,
    bookings: 20,
    packages: null,
    color: '#C2410C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    accent: 'linear-gradient(135deg, #F97316, #FDBA74)',
  },
  {
    plan: 'Standard',
    price: 499,
    bookings: 50,
    packages: null,
    color: '#C2410C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    accent: 'linear-gradient(135deg, #F97316, #FDBA74)',
  },
  {
    plan: 'Premium',
    price: 999,
    bookings: null,
    packages: null,
    color: '#C2410C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    accent: 'linear-gradient(135deg, #F97316, #FDBA74)',
  },
];

export default function PlatformSettings() {
  const { profile } = useAuth();

  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [confirmStaffPassword, setConfirmStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    let active = true;

    supabase
      .from('profiles')
      .select('*')
      .in('role', ['staff', 'admin'])
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;

        if (loadError) {
          setError('Unable to load staff accounts. Please refresh and try again.');
        } else {
          setStaffList(data ?? []);
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (savingRole || profile?.role !== 'admin' || userId === profile.id) {
      return;
    }

    setSavingRole(userId);
    setMessage('');
    setError('');

    try {
      const result = await assignStaffRole(userId, newRole);

      setStaffList((previous) =>
        previous.map((account) =>
          account.id === result.id
            ? { ...account, role: result.role as 'staff' | 'admin' }
            : account
        )
      );

      setMessage('Account role updated successfully.');
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : typeof cause === 'object' && cause !== null && 'message' in cause
            ? String(cause.message)
            : 'Unable to update the role. Please try again.'
      );
    } finally {
      setSavingRole(null);
    }
  };

  const handleCreateStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (creatingStaff || profile?.role !== 'admin') return;

    if (staffPassword !== confirmStaffPassword) {
      setStaffError('Passwords must match.');
      return;
    }

    if (
      staffPassword.length < 12 ||
      new TextEncoder().encode(staffPassword).length > 72
    ) {
      setStaffError(
        'Use at least 12 characters and no more than 72 UTF-8 bytes.'
      );
      return;
    }

    setCreatingStaff(true);
    setStaffError('');
    setMessage('');

    try {
      await createStaffAccount(fullName, email, staffPassword);

      setFullName('');
      setEmail('');
      setShowAddStaff(false);

      setMessage(
        'Staff account created. They can sign in with their email and password.'
      );

      const { data, error: refreshError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['staff', 'admin'])
        .order('created_at', { ascending: false });

      if (refreshError) {
        setError(
          'Staff account created, but the table could not refresh. Refresh this page; do not create it again.'
        );
      } else {
        setStaffList(data ?? []);
        setError('');
      }
    } catch (cause: unknown) {
      setStaffError(
        cause instanceof Error
          ? cause.message
          : 'Unable to create staff account. Check the account list before retrying.'
      );
    } finally {
      setStaffPassword('');
      setConfirmStaffPassword('');
      setCreatingStaff(false);
    }
  };

  const closeStaffForm = () => {
    if (creatingStaff) return;

    setStaffPassword('');
    setConfirmStaffPassword('');
    setStaffError('');
    setShowAddStaff(false);
  };

  return (
    <div className="platform-settings-page">
      <style>{`
        .platform-settings-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          color: #111827;
        }

        .platform-settings-page *,
        .platform-settings-page *::before,
        .platform-settings-page *::after {
          box-sizing: border-box;
        }

        .platform-settings-header {
          margin-bottom: 32px;
        }

        .platform-settings-header h1 {
          margin: 0 0 6px;
          font-size: 28px;
          line-height: 1.25;
          font-weight: 900;
          color: #111;
          letter-spacing: -0.5px;
        }

        .platform-settings-header p {
          margin: 0;
          color: #6B7280;
          font-size: 15px;
          line-height: 1.5;
        }

        .platform-settings-message {
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .platform-settings-error {
          color: #B91C1C;
          background: #FEF2F2;
          border: 1px solid #FECACA;
        }

        .platform-settings-success {
          color: #15803D;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
        }

        .platform-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .platform-section-title {
          font-size: 20px;
          font-weight: 900;
          color: #111;
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .platform-section-title svg {
          flex-shrink: 0;
          color: #F97316;
        }

        .platform-add-staff-button {
          min-height: 42px;
          background: #F97316;
          color: #FFF;
          border: none;
          border-radius: 12px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .platform-add-staff-button:hover:not(:disabled) {
          background: #EA580C;
        }

        .platform-add-staff-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .platform-staff-card {
          background: #FFFFFF;
          border-radius: 20px;
          border: 1px solid #E5E7EB;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          overflow: hidden;
          margin-bottom: 40px;
          min-width: 0;
        }

        .platform-loading-state,
        .platform-empty-state {
          padding: 60px 24px;
          text-align: center;
          color: #9CA3AF;
        }

        .platform-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .platform-table-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .platform-staff-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
        }

        .platform-staff-table thead tr {
          background: #F9FAFB;
          border-bottom: 1px solid #E5E7EB;
        }

        .platform-staff-table th {
          padding: 16px 20px;
          font-size: 12px;
          font-weight: 800;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .platform-staff-table td {
          padding: 18px 20px;
          vertical-align: middle;
          border-bottom: 1px solid #F3F4F6;
        }

        .platform-staff-table tbody tr:last-child td {
          border-bottom: none;
        }

        .platform-staff-table tbody tr {
          transition: background 0.2s;
        }

        .platform-staff-table tbody tr:hover {
          background: #F9FAFB;
        }

        .platform-user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 180px;
        }

        .platform-user-avatar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .platform-user-name {
          font-size: 14px;
          font-weight: 800;
          color: #111;
          overflow-wrap: anywhere;
        }

        .platform-user-email {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #4B5563;
          font-size: 14px;
          white-space: nowrap;
        }

        .platform-user-email svg {
          flex-shrink: 0;
        }

        .platform-role-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .platform-joined-date {
          font-size: 13px;
          color: #6B7280;
          font-weight: 500;
          white-space: nowrap;
        }

        .platform-role-select {
          max-width: 100%;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          background: #F9FAFB;
          color: #111;
          font-weight: 700;
          cursor: pointer;
        }

        .platform-role-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .platform-subscription-section {
          margin-bottom: 24px;
        }

        .platform-subscription-heading {
          margin-bottom: 16px;
        }

        .platform-plan-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .platform-plan-card {
          position: relative;
          min-width: 0;
          background: #FFFFFF;
          border-radius: 20px;
          border: 1px solid #E5E7EB;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          padding: 24px;
          overflow: hidden;
        }

        .platform-plan-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .platform-plan-name {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 4px 0 8px;
        }

        .platform-plan-price {
          font-size: 32px;
          line-height: 1.2;
          font-weight: 900;
          color: #111;
          margin-bottom: 20px;
          letter-spacing: -1px;
          overflow-wrap: anywhere;
        }

        .platform-plan-period {
          font-size: 13px;
          font-weight: 600;
          color: #9CA3AF;
          letter-spacing: 0;
        }

        .platform-plan-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid #F3F4F6;
          padding-top: 16px;
        }

        .platform-plan-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #4B5563;
        }

        .platform-plan-feature svg {
          flex-shrink: 0;
          color: #9CA3AF;
        }

        .platform-plan-feature strong {
          color: #111;
          font-weight: 800;
        }

        .platform-architecture-notice {
          background: #FFFBEB;
          border: 1px solid #FDE68A;
          border-radius: 16px;
          padding: 18px 24px;
          font-size: 14px;
          color: #92400E;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.01);
        }

        .platform-architecture-notice svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: #D97706;
        }

        .platform-architecture-notice span {
          line-height: 1.6;
          font-weight: 500;
        }

        /* Modal */
        .platform-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17,24,39,0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          overflow-y: auto;
        }

        .platform-modal {
          background: #FFF;
          max-width: 480px;
          width: 100%;
          max-height: calc(100dvh - 40px);
          overflow-y: auto;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }

        .platform-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 16px;
        }

        .platform-modal-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .platform-modal-icon {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #FFF7ED;
          color: #F97316;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .platform-modal-heading h2 {
          font-size: 18px;
          font-weight: 900;
          color: #111;
          margin: 0;
        }

        .platform-modal-heading p {
          font-size: 12px;
          color: #6B7280;
          margin: 2px 0 0;
          line-height: 1.4;
        }

        .platform-modal-close {
          border: 1px solid #E5E7EB;
          background: #FFF;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #4B5563;
        }

        .platform-modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .platform-modal-description {
          font-size: 13.5px;
          color: #4B5563;
          line-height: 1.6;
          margin: 0 0 20px;
        }

        .platform-staff-form {
          display: grid;
          gap: 16px;
        }

        .platform-form-field {
          min-width: 0;
        }

        .platform-form-field label {
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 7px;
          color: #374151;
        }

        .platform-form-field label svg {
          color: #6B7280;
          flex-shrink: 0;
        }

        .platform-form-field input {
          width: 100%;
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid #D1D5DB;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          background: #FFF;
          color: #111;
          font-family: inherit;
        }

        .platform-form-field input:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }

        .platform-form-field input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .platform-staff-form-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #991B1B;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          overflow-wrap: anywhere;
        }

        .platform-staff-form-error svg {
          flex-shrink: 0;
        }

        .platform-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          border-top: 1px solid #E5E7EB;
          padding-top: 16px;
        }

        .platform-modal-action-button {
          flex: 1;
          min-height: 44px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .platform-modal-cancel {
          background: #F3F4F6;
          color: #374151;
          border: 1px solid #E5E7EB;
        }

        .platform-modal-submit {
          background: #F97316;
          color: #FFF;
          border: none;
        }

        .platform-modal-action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1200px) {
          .platform-plan-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .platform-settings-page {
            padding-bottom: 28px;
          }

          .platform-settings-header {
            margin-bottom: 24px;
          }

          .platform-settings-header h1 {
            font-size: 24px;
          }

          .platform-settings-header p {
            font-size: 14px;
          }

          .platform-section-heading {
            align-items: flex-start;
          }

          .platform-section-title {
            font-size: 18px;
          }

          .platform-add-staff-button {
            width: 100%;
          }

          .platform-staff-card {
            border-radius: 16px;
            margin-bottom: 32px;
          }

          .platform-staff-table th,
          .platform-staff-table td {
            padding: 14px 16px;
          }

          .platform-plan-grid {
            gap: 14px;
          }

          .platform-plan-card {
            padding: 20px;
            border-radius: 16px;
          }

          .platform-plan-price {
            font-size: 28px;
          }

          .platform-architecture-notice {
            padding: 16px;
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .platform-settings-header h1 {
            font-size: 22px;
          }

          .platform-section-title {
            font-size: 17px;
          }

          .platform-plan-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .platform-plan-card {
            padding: 20px;
          }

          .platform-plan-price {
            margin-bottom: 16px;
          }

          .platform-architecture-notice {
            gap: 10px;
            padding: 14px;
            font-size: 12px;
          }

          .platform-modal-overlay {
            padding: 12px;
            align-items: center;
          }

          .platform-modal {
            padding: 20px;
            border-radius: 18px;
            max-height: calc(100dvh - 24px);
          }

          .platform-modal-heading h2 {
            font-size: 16px;
          }

          .platform-modal-heading p {
            font-size: 11px;
          }

          .platform-modal-description {
            font-size: 13px;
          }

          .platform-modal-actions {
            flex-direction: column-reverse;
          }

          .platform-modal-action-button {
            width: 100%;
          }
        }
      `}</style>

      {/* Header */}
      <div className="platform-settings-header">
        <h1>Platform Settings</h1>
        <p>
          View existing staff and administrator accounts and subscription tiers.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="platform-settings-message platform-settings-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="platform-settings-message platform-settings-success" role="status">
          {message}
        </div>
      )}

      {/* Staff & Admin Section */}
      <div className="platform-section-heading">
        <h2 className="platform-section-title">
          <Shield size={22} />
          Staff & Admin Accounts
        </h2>

        <button
          type="button"
          className="platform-add-staff-button"
          onClick={() => setShowAddStaff(true)}
          disabled={profile?.role !== 'admin'}
        >
          <UserPlus size={16} />
          Add Staff Account
        </button>
      </div>

      {/* Staff Table */}
      <div className="platform-staff-card">
        {loading ? (
          <div className="platform-loading-state">
            <Loader2
              size={32}
              color="#F97316"
              className="animate-spin"
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Loading authorized profiles...
            </span>
          </div>
        ) : staffList.length === 0 ? (
          <div className="platform-empty-state">
            No administrative or staff accounts found.
          </div>
        ) : (
          <div className="platform-table-wrapper">
            <table className="platform-staff-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Contact Email</th>
                  <th>Current Role</th>
                  <th>Joined Date</th>
                  <th>Permissions</th>
                </tr>
              </thead>

              <tbody>
                {staffList.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="platform-user-profile">
                        <div
                          className="platform-user-avatar"
                          style={{
                            background:
                              u.role === 'admin' ? '#FFF7ED' : '#F0FDF4',
                            border: `1px solid ${
                              u.role === 'admin' ? '#FFEDD5' : '#BBF7D0'
                            }`,
                            color: u.role === 'admin' ? '#F97316' : '#16A34A',
                          }}
                        >
                          {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                        </div>

                        <strong className="platform-user-name">
                          {u.full_name ?? '—'}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <div className="platform-user-email">
                        <Mail size={14} color="#9CA3AF" />
                        <span>{u.email}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className="platform-role-badge"
                        style={{
                          background:
                            u.role === 'admin' ? '#FFF7ED' : '#F0FDF4',
                          color: u.role === 'admin' ? '#F97316' : '#16A34A',
                          borderColor:
                            u.role === 'admin' ? '#FFEDD5' : '#BBF7D0',
                        }}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="platform-joined-date">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>

                    <td>
                      <select
                        className="platform-role-select"
                        aria-label={`Permissions for ${
                          u.full_name ?? u.email ?? 'account'
                        }`}
                        disabled={
                          savingRole !== null ||
                          profile?.role !== 'admin' ||
                          u.id === profile.id
                        }
                        value={u.role}
                        onChange={(event) =>
                          void handleRoleChange(u.id, event.target.value)
                        }
                      >
                        <option value="admin">System Administrator</option>
                        <option value="staff">Platform Staff</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Tiers */}
      <div className="platform-subscription-section">
        <div className="platform-subscription-heading">
          <h2 className="platform-section-title">
            <CreditCard size={22} />
            Subscription Tiers Configuration
          </h2>
        </div>

        <div className="platform-plan-grid">
          {PLAN_DETAILS.map((p) => (
            <div key={p.plan} className="platform-plan-card">
              <div
                className="platform-plan-accent"
                style={{ background: p.accent }}
              />

              <div
                className="platform-plan-name"
                style={{ color: p.color }}
              >
                {p.plan} Tier
              </div>

              <div className="platform-plan-price">
                {p.price === 0 ? 'Free' : `₱${p.price}`}

                {p.price !== 0 && (
                  <span className="platform-plan-period"> / mo</span>
                )}
              </div>

              <div className="platform-plan-features">
                <div className="platform-plan-feature">
                  <Package size={16} />
                  <span>
                    Packages:{' '}
                    <strong>
                      {p.packages === null ? 'Unlimited' : p.packages}
                    </strong>
                  </span>
                </div>

                <div className="platform-plan-feature">
                  <Calendar size={16} />
                  <span>
                    Bookings:{' '}
                    <strong>
                      {p.bookings === null ? 'Unlimited' : `${p.bookings}/mo`}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Notice */}
      <div className="platform-architecture-notice">
        <AlertTriangle size={20} />

        <span>
          Plan pricing rules and system limits are hardcoded at the backend
          level. Contact your core developer or database manager to adjust
          billing structures or tier restrictions.
        </span>
      </div>

      {/* Add Staff Account Modal */}
      {showAddStaff && (
        <div
          className="platform-modal-overlay"
          role="presentation"
          onClick={closeStaffForm}
        >
          <div
            className="platform-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-title"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="platform-modal-header">
              <div className="platform-modal-heading">
                <div className="platform-modal-icon">
                  <UserPlus size={20} />
                </div>

                <div>
                  <h2 id="add-staff-title">Add Staff Account</h2>
                  <p>Provision a new administrative or staff user</p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close staff account form"
                disabled={creatingStaff}
                onClick={closeStaffForm}
                className="platform-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="platform-modal-description">
              Create a new staff account with an initial password. Existing
              user accounts cannot be converted. Staff will sign in through
              the standard portal login page.
            </p>

            <form
              onSubmit={handleCreateStaff}
              className="platform-staff-form"
            >
              {/* Full Name */}
              <div className="platform-form-field">
                <label htmlFor="staff-full-name">
                  <User size={14} />
                  Full Name
                </label>

                <input
                  id="staff-full-name"
                  required
                  maxLength={150}
                  autoComplete="name"
                  value={fullName}
                  disabled={creatingStaff}
                  placeholder="e.g. Benedict Alicante"
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              {/* Email */}
              <div className="platform-form-field">
                <label htmlFor="staff-email">
                  <Mail size={14} />
                  Email Address
                </label>

                <input
                  id="staff-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  disabled={creatingStaff}
                  placeholder="staff@caterconnect.ph"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {/* Password */}
              <div className="platform-form-field">
                <label htmlFor="staff-password">
                  <Lock size={14} />
                  Password (min 12 characters)
                </label>

                <input
                  id="staff-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={staffPassword}
                  disabled={creatingStaff}
                  placeholder="Enter initial password"
                  onChange={(event) =>
                    setStaffPassword(event.target.value)
                  }
                />
              </div>

              {/* Confirm Password */}
              <div className="platform-form-field">
                <label htmlFor="staff-confirm-password">
                  <Lock size={14} />
                  Confirm Password
                </label>

                <input
                  id="staff-confirm-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={confirmStaffPassword}
                  disabled={creatingStaff}
                  placeholder="Confirm initial password"
                  onChange={(event) =>
                    setConfirmStaffPassword(event.target.value)
                  }
                />
              </div>

              {/* Form Error */}
              {staffError && (
                <div className="platform-staff-form-error" role="alert">
                  <AlertTriangle size={16} />
                  <span>{staffError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="platform-modal-actions">
                <button
                  type="button"
                  disabled={creatingStaff}
                  onClick={closeStaffForm}
                  className="platform-modal-action-button platform-modal-cancel"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creatingStaff ||
                    profile?.role !== 'admin' ||
                    !fullName.trim() ||
                    !email.trim() ||
                    !staffPassword ||
                    !confirmStaffPassword
                  }
                  className="platform-modal-action-button platform-modal-submit"
                >
                  {creatingStaff ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <UserPlus size={16} />
                  )}

                  {creatingStaff ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
