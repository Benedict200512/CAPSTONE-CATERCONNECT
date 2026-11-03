
import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  Crown,
  RefreshCw,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import CatererSkeleton from './CatererSkeleton';
import {
  loadMonthlyBookingQuota,
  type MonthlyQuota,
} from '../lib/monthBookingQouta';

const PLAN_DETAILS: Record<
  string,
  {
    name: string;
    color: string;
    background: string;
    border: string;
    icon: typeof Tag;
  }
> = {
  free: {
    name: 'Free Plan',
    color: '#64748B',
    background: '#F8FAFC',
    border: '#9CA3AF',
    icon: Tag,
  },
  basic: {
    name: 'Basic Plan',
    color: '#3B82F6',
    background: '#EFF6FF',
    border: '#2563EB',
    icon: BadgeCheck,
  },
  standard: {
    name: 'Standard Plan',
    color: '#D97706',
    background: '#FFFBEB',
    border: '#F97316',
    icon: Zap,
  },
  premium: {
    name: 'Premium Plan',
    color: '#C084FC',
    background: '#2E1065',
    border: '#8B5CF6',
    icon: Crown,
  },
};

export default function SubscriptionCard() {
  const { catererData, session } = useAuth();
  const navigate = useNavigate();

  const [quota, setQuota] = useState<MonthlyQuota | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const planId = catererData?.subscription_plan ?? 'free';
  const plan = PLAN_DETAILS[planId] ?? PLAN_DETAILS.free;
  const PlanIcon = plan.icon;

  const expiresAt = catererData?.subscription_expires_at ?? null;

  const refreshQuota = useCallback(async () => {
    if (!catererData?.id || !session?.user.id) {
      setQuota({
        status: 'unavailable',
        message: 'Sign in with your caterer account to view monthly usage.',
      });
      return;
    }

    setRefreshing(true);

    try {
      const result = await loadMonthlyBookingQuota(
        catererData.id,
        session.user.id
      );

      setQuota(result);
    } catch {
      setQuota({
        status: 'unavailable',
        message: 'Monthly usage could not be loaded. Please try again.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [catererData?.id, session?.user.id]);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not available';
    }

    return parsedDate.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
  };

  const isPaidPlan = planId !== 'free';

  const isExpired =
    isPaidPlan &&
    (!expiresAt || Date.parse(expiresAt) <= Date.now());

  const usagePercentage =
    quota?.status === 'ready' && quota.limit !== null && quota.limit > 0
      ? Math.min(100, (quota.used / quota.limit) * 100)
      : 0;

  return (
    <section
      className="subscription-card"
      style={{
        '--subscription-color': plan.color,
        '--subscription-background': plan.background,
        '--subscription-border': plan.border,
        border: `2px solid ${plan.border}`,
      } as React.CSSProperties}
    >
      <div className="subscription-card-header">
        <div>
          <span className="subscription-eyebrow">
            YOUR SUBSCRIPTION
          </span>

          <h2>Your Subscription</h2>

          <p className="subscription-description">
            Manage your plan and monthly booking allowance.
          </p>
        </div>

        <div className="subscription-plan-icon">
          <PlanIcon size={25} />
        </div>
      </div>

      <div className="subscription-plan-info">
        <div>
          <span className="subscription-label">CURRENT PLAN</span>

          <h3>{plan.name}</h3>

          {isExpired && (
            <span className="subscription-expired">
              Subscription expired
            </span>
          )}
        </div>

        <button
          type="button"
          className="subscription-upgrade-button"
          onClick={() => navigate('/caterer/subscription')}
        >
          {planId === 'premium' ? 'Manage Plan' : 'Upgrade Plan'}
          <TrendingUp size={16} />
        </button>
      </div>

      <div className="subscription-divider" />

      <div className="subscription-quota">
        <div className="subscription-quota-heading">
          <div>
            <span className="subscription-label">
              MONTHLY ACCEPTED BOOKINGS
            </span>

            <h3>Booking Usage</h3>
          </div>

          <button
            type="button"
            className="subscription-refresh-button"
            onClick={() => void refreshQuota()}
            disabled={refreshing}
            aria-label="Refresh monthly booking usage"
            title="Refresh monthly booking usage"
          >
            <RefreshCw
              size={17}
              className={refreshing ? 'subscription-spinning' : ''}
            />
          </button>
        </div>

        {!quota ? (
          <CatererSkeleton variant="subscription" label="Loading monthly booking usage" />
        ) : quota.status !== 'ready' ? (
          <p className="subscription-message">
            {quota.message}
          </p>
        ) : (
          <>
            <div className="subscription-usage-numbers">
              <strong>
                {quota.used} / {quota.limit ?? 'Unlimited'}
              </strong>

              <span>
                {quota.remaining === null
                  ? 'Unlimited remaining'
                  : `${quota.remaining} remaining`}
              </span>
            </div>

            {quota.limit !== null && (
              <div
                className="subscription-progress-track"
                role="progressbar"
                aria-valuenow={Math.min(100, usagePercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Monthly accepted booking usage"
              >
                <div
                  className="subscription-progress-fill"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
            )}

            <p className="subscription-month">
              {quota.month.slice(0, 7)} · Asia/Manila
            </p>
          </>
        )}
      </div>

      <div className="subscription-divider" />

      <div className="subscription-renewal">
        <div className="subscription-renewal-icon">
          <CalendarDays size={19} />
        </div>

        <div>
          <span className="subscription-label">
            {isPaidPlan ? 'SUBSCRIPTION EXPIRATION' : 'SUBSCRIPTION STATUS'}
          </span>

          <p>
            {isPaidPlan && expiresAt
              ? formatDate(expiresAt)
              : isPaidPlan
                ? 'Expiration date unavailable'
                : 'Free plan · No renewal date'}
          </p>
        </div>
      </div>
    </section>
  );
}
