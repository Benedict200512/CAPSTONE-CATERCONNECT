import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar,
  Users,
  CreditCard,
  AlertCircle,
  Download,
  Loader2,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';

type ReportRecord = Record<string, any>;

type ReportData = {
  bookings: ReportRecord[];
  users: ReportRecord[];
  payments: ReportRecord[];
  complaints: ReportRecord[];
};

export default function Reports() {
  const [data, setData] = useState<ReportData>({
    bookings: [],
    users: [],
    payments: [],
    complaints: [],
  });

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [bookings, users, payments, complaints] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, profiles(full_name, email), caterers(business_name)')
          .order('created_at', { ascending: false })
          .limit(200),

        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),

        supabase
          .from('subscription_payments')
          .select('*, caterers(business_name)')
          .eq('status', 'confirmed')
          .order('confirmed_at', { ascending: false })
          .limit(200),

        supabase
          .from('complaints')
          .select('*, profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      setData({
        bookings: bookings.data ?? [],
        users: users.data ?? [],
        payments: payments.data ?? [],
        complaints: complaints.data ?? [],
      });

      setLoading(false);
    };

    load();
  }, []);

  const exportCSV = (type: string) => {
    setExporting(type);

    const rows: ReportRecord[] = data[type as keyof ReportData] ?? [];

    if (rows.length === 0) {
      setExporting(null);
      return;
    }

    const flat = rows.map((row) => {
      const obj: Record<string, any> = {};

      Object.entries(row).forEach(([key, value]) => {
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          Object.entries(value as Record<string, any>).forEach(
            ([nestedKey, nestedValue]) => {
              obj[`${key}_${nestedKey}`] = nestedValue;
            }
          );
        } else {
          obj[key] = value;
        }
      });

      return obj;
    });

    const headers = Object.keys(flat[0]);

    const csv = [
      headers.join(','),
      ...flat.map((row) =>
        headers
          .map((header) => JSON.stringify(row[header] ?? ''))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `caterconnect_${type}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    a.click();
    URL.revokeObjectURL(url);

    setExporting(null);
  };

  const reports = [
    {
      id: 'bookings',
      icon: Calendar,
      title: 'Booking Report',
      desc: 'Export all recent event bookings containing statuses, timelines, caterer entities, and customer data.',
      color: '#2563EB',
      bg: '#DBEAFE',
      accent:
        'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
      count: data.bookings.length,
      preview: data.bookings.slice(0, 3).map(
        (booking) =>
          `${booking.profiles?.full_name ?? 'Unknown'} → ${
            booking.caterers?.business_name ?? 'Unknown'
          }`
      ),
    },
    {
      id: 'users',
      icon: Users,
      title: 'User Directory Report',
      desc: 'Export registered user base across all roles (Customers, Caterers, Staff, Admin) with creation logs.',
      color: '#7C3AED',
      bg: '#F5F3FF',
      accent:
        'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
      count: data.users.length,
      preview: data.users.slice(0, 3).map(
        (user) =>
          `${user.full_name ?? 'Unknown'} (${user.role ?? 'Unknown'})`
      ),
    },
    {
      id: 'payments',
      icon: CreditCard,
      title: 'Revenue Report',
      desc: 'Export confirmed subscription payments organized by tier levels, caterer entities, and total amounts.',
      color: '#16A34A',
      bg: '#DCFCE7',
      accent:
        'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)',
      count: data.payments.length,
      preview: data.payments.slice(0, 3).map(
        (payment) =>
          `${payment.caterers?.business_name ?? 'Unknown'} — ₱${Number(
            payment.amount ?? 0
          ).toLocaleString()}`
      ),
    },
    {
      id: 'complaints',
      icon: AlertCircle,
      title: 'Complaint & Ticket Report',
      desc: 'Export customer and partner complaints, tracking current resolution workflows and reporting profiles.',
      color: '#DC2626',
      bg: '#FEE2E2',
      accent:
        'linear-gradient(135deg, #DC2626 0%, #F87171 100%)',
      count: data.complaints.length,
      preview: data.complaints.slice(0, 3).map(
        (complaint) =>
          `${complaint.subject ?? 'Unknown'} — Status: ${
            complaint.status ?? 'Unknown'
          }`
      ),
    },
  ];

  return (
    <div className="reports-page">
      <style>{`
        .reports-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
        }

        .reports-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 30px;
        }

        .reports-header-content {
          min-width: 0;
        }

        .reports-header h1 {
          margin: 0 0 6px;
          color: #111827;
          font-size: 28px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .reports-header p {
          margin: 0;
          color: #6B7280;
          font-size: 15px;
          line-height: 1.6;
        }

        .reports-live-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-shrink: 0;
          padding: 8px 16px;
          border: 1px solid #BBF7D0;
          border-radius: 999px;
          background: #F0FDF4;
          color: #166534;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
        }

        .report-card {
          position: relative;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
          padding: 26px;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .report-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 20px -3px rgba(0,0,0,0.06);
        }

        .report-card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .report-card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
          margin: 4px 0 15px;
        }

        .report-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          flex-shrink: 0;
          border-radius: 13px;
        }

        .report-card-heading {
          min-width: 0;
        }

        .report-card-title {
          margin: 0;
          color: #111827;
          font-size: 17px;
          line-height: 1.4;
          font-weight: 900;
          letter-spacing: -0.3px;
          overflow-wrap: anywhere;
        }

        .report-card-count {
          margin-top: 3px;
          color: #6B7280;
          font-size: 12px;
          font-weight: 600;
        }

        .report-card-description {
          flex: 1;
          margin: 0 0 20px;
          color: #4B5563;
          font-size: 13px;
          line-height: 1.7;
        }

        .report-preview {
          min-width: 0;
          margin-bottom: 20px;
          padding: 13px 15px;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
          background: #F9FAFB;
        }

        .report-preview-heading {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          color: #9CA3AF;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .report-preview-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          min-width: 0;
          padding: 7px 0;
          border-bottom: 1px solid #E5E7EB;
          color: #4B5563;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 500;
        }

        .report-preview-item:last-child {
          border-bottom: none;
        }

        .report-preview-item svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: #9CA3AF;
        }

        .report-preview-item span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .report-export-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 47px;
          padding: 13px 16px;
          border: none;
          border-radius: 12px;
          background: #111827;
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .report-export-button:hover:not(:disabled) {
          background: #27272A;
        }

        .report-export-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .report-export-button svg {
          flex-shrink: 0;
        }

        @media (max-width: 1024px) {
          .reports-grid {
            gap: 17px;
          }

          .report-card {
            padding: 22px;
          }
        }

        @media (max-width: 768px) {
          .reports-page {
            padding-bottom: 30px;
          }

          .reports-header {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 23px;
          }

          .reports-header h1 {
            font-size: 24px;
          }

          .reports-header p {
            font-size: 13px;
          }

          .reports-grid {
            gap: 15px;
          }

          .report-card {
            padding: 19px;
            border-radius: 15px;
          }

          .report-card-header {
            gap: 11px;
          }

          .report-card-icon {
            width: 43px;
            height: 43px;
            border-radius: 11px;
          }

          .report-card-icon svg {
            width: 22px;
            height: 22px;
          }

          .report-card-title {
            font-size: 15px;
          }

          .report-card-description {
            font-size: 12px;
          }

          .report-preview {
            padding: 11px 12px;
          }

          .report-export-button {
            min-height: 44px;
            padding: 12px;
            font-size: 12px;
          }
        }

        @media (max-width: 560px) {
          .reports-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }

          .report-card {
            padding: 21px;
          }

          .report-card-header {
            gap: 13px;
          }

          .report-card-icon {
            width: 48px;
            height: 48px;
          }

          .report-card-title {
            font-size: 16px;
          }

          .report-card-description {
            font-size: 13px;
          }

          .report-preview-item {
            font-size: 12px;
          }

          .reports-live-status {
            padding: 8px 13px;
            font-size: 12px;
          }
        }

        @media (max-width: 360px) {
          .reports-header h1 {
            font-size: 22px;
          }

          .report-card {
            padding: 17px;
          }

          .report-card-title {
            font-size: 14px;
          }

          .report-card-count {
            font-size: 11px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="reports-header">
        <div className="reports-header-content">
          <h1>System Reports</h1>
          <p>
            Extract real-time database analytics and metrics into
            portable CSV files.
          </p>
        </div>

        <div className="reports-live-status">
          <ShieldCheck size={16} color="#16A34A" />
          Live Database Linked
        </div>
      </div>

      {/* Reports Grid */}
      <div className="reports-grid">
        {reports.map((report) => {
          const Icon = report.icon;
          const isExporting = exporting === report.id;

          return (
            <div className="report-card" key={report.id}>
              {/* Accent Strip */}
              <div
                className="report-card-accent"
                style={{ background: report.accent }}
              />

              {/* Report Header */}
              <div className="report-card-header">
                <div
                  className="report-card-icon"
                  style={{ background: report.bg }}
                >
                  <Icon size={25} color={report.color} />
                </div>

                <div className="report-card-heading">
                  <h2 className="report-card-title">
                    {report.title}
                  </h2>

                  <div className="report-card-count">
                    {loading
                      ? 'Scanning database...'
                      : `${report.count} records available`}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="report-card-description">
                {report.desc}
              </p>

              {/* Data Preview */}
              {!loading && report.preview.length > 0 && (
                <div className="report-preview">
                  <div className="report-preview-heading">
                    <FileSpreadsheet size={13} />
                    Live Preview Snapshot
                  </div>

                  {report.preview.map((item, index) => (
                    <div
                      className="report-preview-item"
                      key={`${report.id}-${index}`}
                    >
                      <FileSpreadsheet size={13} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Export Button */}
              <button
                type="button"
                className="report-export-button"
                onClick={() => exportCSV(report.id)}
                disabled={isExporting || loading}
              >
                {isExporting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Compiling CSV File...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Export to CSV
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
