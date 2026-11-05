import type { ReactNode } from 'react';

export type CatererSkeletonVariant =
  | 'dashboard' | 'dashboard-calendar' | 'booking-rows' | 'availability'
  | 'packages' | 'menu' | 'profile' | 'conversation-list' | 'report-content'
  | 'trend-chart' | 'notifications' | 'complaints' | 'subscription'
  | 'subscription-current' | 'subscription-history'
  | 'message-thread' | 'booking-detail' | 'customer-profile';

function Block({ className = '' }: { className?: string }) {
  return <span className={`caterer-skeleton-block ${className}`} aria-hidden="true" />;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`caterer-skeleton-card ${className}`}>{children}</div>;
}

function Rows({ count = 4, kind = 'row' }: { count?: number; kind?: string }) {
  return <div className={`caterer-skeleton-rows is-${kind}`}>
    {Array.from({ length: count }, (_, index) => (
      <div className="caterer-skeleton-row" key={index}>
        <Block className="is-avatar" />
        <div className="caterer-skeleton-row-copy">
          <Block className="is-line is-medium" />
          <Block className="is-line is-short" />
          {kind === 'conversation' && <Block className="is-line is-tiny" />}
        </div>
        <div className="caterer-skeleton-row-meta">
          <Block className="is-line is-small" />
          {kind === 'booking' && <Block className="is-chip" />}
          {kind === 'notification' && <Block className="is-line is-short" />}
        </div>
      </div>
    ))}
  </div>;
}

function SkeletonContent({ variant, calendarCellCount = 42 }: { variant: CatererSkeletonVariant; calendarCellCount?: number }) {
  switch (variant) {
    case 'dashboard':
      return <>
        <div className="caterer-skeleton-dashboard-header">
          <Block className="is-icon" />
          <div><Block className="is-line is-date" /><Block className="is-line is-title" /><Block className="is-line is-medium" /></div>
          <div className="caterer-skeleton-header-actions"><Block className="is-control" /><Block className="is-icon" /></div>
        </div>
        <div className="caterer-skeleton-stat-grid">
          {Array.from({ length: 4 }, (_, i) => <Card key={i} className="is-stat"><Block className="is-icon" /><Block className="is-line is-medium" /><Block className="is-line is-value" /><Block className="is-line is-short" /></Card>)}
        </div>
        <div className="dashboard-main-grid">
          <div className="dashboard-left-stack">
          <Card className="is-dashboard-subscription dashboard-combined-subscription">
            <div className="caterer-skeleton-plan"><Block className="is-line is-short" /><div><Block className="is-icon" /><Block className="is-line is-medium" /></div><Block className="is-line is-short" /></div>
            <div className="caterer-skeleton-quota"><div><div className="caterer-skeleton-quota-heading"><Block className="is-line is-short" /><Block className="is-line is-medium" /></div><Block className="is-icon is-small-icon" /></div><div className="caterer-skeleton-usage-counts"><Block className="is-line is-short" /><Block className="is-line is-short" /></div><Block className="is-progress" /><Block className="is-line is-tiny" /></div>
          </Card>
          <Card className="dashboard-trends-panel">
            <div className="caterer-skeleton-calendar-heading"><div><Block className="is-line is-short" /><Block className="is-line is-medium" /><Block className="is-line is-long" /></div><Block className="is-icon" /></div>
            <div className="caterer-skeleton-trend">{Array.from({ length: 5 }, (_, i) => <div className="caterer-skeleton-trend-column" key={i}><Block className="is-line is-small" /><Block className="is-trend-bar" /><Block className="is-line is-short" /></div>)}</div>
            <Block className="is-line is-short" /><Block className="is-control is-wide" />
          </Card>
          </div>
          <Card className="is-dashboard-calendar dashboard-availability-card">
            <div className="caterer-skeleton-calendar-heading"><div><Block className="is-line is-short" /><Block className="is-line is-medium" /><Block className="is-line is-long" /></div><Block className="is-control is-wide" /></div>
            <div className="caterer-skeleton-month"><Block className="is-icon is-small-icon" /><Block className="is-line is-medium" /><Block className="is-icon is-small-icon" /></div>
            <div className="caterer-skeleton-weekdays">{Array.from({ length: 7 }, (_, i) => <Block key={i} />)}</div>
            <div className="caterer-skeleton-calendar">{Array.from({ length: calendarCellCount }, (_, i) => <Block key={i} />)}</div>
            <div className="caterer-skeleton-calendar-footer"><Block className="is-line is-medium" /><Block className="is-line is-long" /></div>
          </Card>
        </div>
          <Card className="dashboard-recent-bookings">
            <div className="caterer-skeleton-panel-heading"><Block className="is-line is-medium" /><Block className="is-control is-small-control" /></div>
            <div className="caterer-skeleton-recent-header">{Array.from({ length: 5 }, (_, i) => <Block className="is-line is-short" key={i} />)}</div>
            {Array.from({ length: 3 }, (_, row) => <div className="caterer-skeleton-recent-row" key={row}>{Array.from({ length: 5 }, (_, column) => <div key={column}><Block className="is-line is-medium" /><Block className="is-line is-short" /></div>)}</div>)}
          </Card>
      </>;
    case 'dashboard-calendar':
      return <><div className="caterer-skeleton-weekdays">{Array.from({ length: 7 }, (_, i) => <Block key={i} />)}</div><div className="caterer-skeleton-calendar">{Array.from({ length: calendarCellCount }, (_, i) => <Block key={i} />)}</div><div className="caterer-skeleton-calendar-footer"><Block className="is-line is-medium" /><Block className="is-line is-long" /></div></>;
    case 'booking-rows':
      return <div className="caterer-skeleton-booking-list">{Array.from({ length: 4 }, (_, i) => <Card className="is-booking-card" key={i}><div><Block className="is-avatar" /><div><Block className="is-line is-medium" /><Block className="is-line is-short" /></div><Block className="is-chip" /></div><div className="caterer-skeleton-booking-details">{Array.from({ length: 4 }, (_, j) => <Block className="is-line is-medium" key={j} />)}</div><div><Block className="is-line is-small" /><Block className="is-control is-small-control" /></div></Card>)}</div>;
    case 'availability':
      return <>
        <Card className="is-capacity"><Block className="is-icon" /><div><Block className="is-line is-medium" /><Block className="is-line is-long" /><Block className="is-line is-medium" /></div><div className="caterer-skeleton-capacity-control"><Block className="is-line is-short" /><Block className="is-control" /></div></Card>
        <div className="caterer-skeleton-availability-grid">
          <Card className="is-month-calendar"><div className="caterer-skeleton-month"><Block className="is-line is-medium" /><Block className="is-icon is-small-icon" /></div><div className="caterer-skeleton-weekdays">{Array.from({ length: 7 }, (_, i) => <Block key={i} />)}</div><div className="caterer-skeleton-calendar">{Array.from({ length: calendarCellCount }, (_, i) => <Block key={i} />)}</div><Block className="is-line is-long" /><Block className="is-line is-medium" /></Card>
          <Card className="is-selected-date"><Block className="is-line is-short" /><Block className="is-line is-title" /><Block className="is-line is-medium" /><Block className="is-chip" /><Block className="is-line is-long" /><Block className="is-control is-wide" /></Card>
        </div>
      </>;
    case 'packages':
      return <div className="caterer-skeleton-package-grid">{Array.from({ length: 3 }, (_, i) => <Card key={i} className="is-package"><Block className="is-image" /><div><Block className="is-line is-tiny" /><Block className="is-line is-medium" /><Block className="is-line is-long" /><Block className="is-line is-long" /><Block className="is-line is-price" /><Block className="is-control" /></div></Card>)}</div>;
    case 'menu':
      // Match the actual Caterer Menu cards: image, category/title/actions,
      // optional description, divider, price and serving unit.
      // Menu.tsx supplies the corresponding scoped skeleton styles.
      return (
        <div className="menu-grid menu-skeleton-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <article className="menu-card menu-skeleton-card" key={i} aria-hidden="true">
              <div className="menu-card-bar menu-skeleton-accent" />
              <div className="menu-card-content">
                <Block className="menu-skeleton-image" />
                <div className="menu-card-top">
                  <div className="menu-card-title menu-skeleton-copy">
                    <Block className="menu-skeleton-category" />
                    <Block className="menu-skeleton-title" />
                    <Block className="menu-skeleton-description" />
                  </div>
                  <div className="menu-actions">
                    <Block className="menu-skeleton-action" />
                    <Block className="menu-skeleton-action" />
                  </div>
                </div>
                <div className="menu-card-bottom">
                  <Block className="menu-skeleton-price" />
                  <Block className="menu-skeleton-serving" />
                </div>
              </div>
            </article>
          ))}
        </div>
      );
    case 'profile':
      return <><div className="caterer-skeleton-page-heading"><Block className="is-icon" /><div><Block className="is-line is-title" /><Block className="is-line is-long" /></div><Block className="is-chip" /></div>
        <Card className="is-profile-appearance"><div><Block className="is-line is-medium" /><Block className="is-line is-long" /></div><Block className="is-cover" /><div className="caterer-skeleton-logo"><Block className="is-image is-logo" /><div><Block className="is-line is-medium" /><Block className="is-line is-long" /><Block className="is-control" /></div></div></Card>
        <Card className="is-profile-form"><Block className="is-line is-medium" /><Block className="is-line is-long" /><div className="caterer-skeleton-form-grid">{Array.from({ length: 4 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-field" /></div>)}</div></Card>
        <Card className="is-profile-form"><Block className="is-line is-medium" /><Block className="is-line is-long" /><div className="caterer-skeleton-form-grid">{Array.from({ length: 4 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-field" /></div>)}</div></Card>
        <Card className="is-profile-form"><Block className="is-line is-medium" /><Block className="is-line is-long" /><div className="caterer-skeleton-form-grid">{Array.from({ length: 3 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-field" /></div>)}</div></Card>
        <Card className="is-profile-form"><Block className="is-line is-medium" /><Block className="is-line is-long" /><div className="caterer-skeleton-choice-row">{Array.from({ length: 4 }, (_, i) => <Block className="is-chip" key={i} />)}</div><Block className="is-line is-medium" /><div className="caterer-skeleton-form-grid">{Array.from({ length: 3 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-field" /></div>)}</div></Card>
        <Card className="is-profile-documents"><Block className="is-line is-medium" /><Block className="is-line is-long" /><div className="caterer-skeleton-document-grid">{Array.from({ length: 3 }, (_, i) => <div key={i}><Block className="is-icon" /><Block className="is-line is-medium" /><Block className="is-field" /><Block className="is-control" /></div>)}</div></Card>
      </>;
    case 'conversation-list': return <div className="caterer-skeleton-conversations"><Rows count={5} kind="conversation" /></div>;
    case 'message-thread': return <div className="caterer-skeleton-thread"><Block className="is-chat-bubble" /><Block className="is-chat-bubble is-right" /><Block className="is-chat-bubble is-short-bubble" /><Block className="is-chat-bubble is-right" /></div>;
    case 'booking-detail': return <div className="caterer-skeleton-detail">{Array.from({ length: 6 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-field" /></div>)}</div>;
    case 'customer-profile': return <div className="caterer-skeleton-customer"><Block className="is-avatar is-large" /><Block className="is-line is-medium" />{Array.from({ length: 4 }, (_, i) => <Block className="is-field" key={i} />)}</div>;
    case 'report-content':
      return <>
        <section className="caterer-skeleton-report-section"><div className="caterer-skeleton-report-heading"><Block className="is-icon" /><div><Block className="is-line is-medium" /><Block className="is-line is-long" /></div></div><Card className="is-featured-report"><Block className="is-line is-medium" /><Block className="is-line is-report-total" /><Block className="is-line is-short" /><div><Block className="is-line is-medium" /><Block className="is-line is-medium" /></div><Block className="is-progress" /></Card><div className="caterer-skeleton-report-status">{Array.from({ length: 6 }, (_, i) => <Card key={i}><Block className="is-icon" /><Block className="is-line is-value" /><Block className="is-line is-medium" /><Block className="is-progress" /></Card>)}</div></section>
        <div className="caterer-skeleton-two-columns"><Card className="is-report-chart"><Block className="is-line is-medium" /><Block className="is-line is-short" /><Block className="is-chart" /><Block className="is-line is-medium" /></Card><Card className="is-report-popular"><Block className="is-line is-medium" /><Block className="is-line is-long" />{Array.from({ length: 4 }, (_, i) => <div className="caterer-skeleton-package-row" key={i}><Block className="is-rank" /><div><Block className="is-line is-medium" /><Block className="is-line is-short" /></div><Block className="is-progress" /></div>)}</Card></div>
        <div className="caterer-skeleton-report-finance"><div><Block className="is-line is-medium" /><Block className="is-line is-long" /><Block className="is-price" /><Block className="is-line is-long" /></div><div><Block className="is-line is-medium" /><Block className="is-line is-long" /><Block className="is-price" /><Block className="is-line is-long" /></div></div>
        <div className="caterer-skeleton-two-columns"><Card><Block className="is-line is-medium" /><Block className="is-line is-short" /><Block className="is-field" /></Card><Card><Block className="is-line is-medium" /><Block className="is-line is-short" /><Block className="is-price" /><div className="caterer-skeleton-two-columns"><Block className="is-field" /><Block className="is-field" /></div></Card></div>
      </>;
    case 'trend-chart':
      return <div className="caterer-skeleton-trend">{Array.from({ length: 5 }, (_, i) => <div className="caterer-skeleton-trend-column" key={i}><Block className="is-line is-small" /><Block className="is-trend-bar" /><Block className="is-line is-short" /></div>)}</div>;
    case 'notifications': return <div className="caterer-skeleton-notifications"><Rows count={5} kind="notification" /></div>;
    case 'complaints': return <div className="caterer-skeleton-complaints">{Array.from({ length: 3 }, (_, i) => <Card className="is-complaint" key={i}><div><Block className="is-line is-medium" /><Block className="is-chip" /></div><Block className="is-line is-long" /><Block className="is-line is-medium" /><div><Block className="is-line is-short" /><Block className="is-chip is-small-chip" /></div></Card>)}</div>;
    case 'subscription': return <div className="caterer-skeleton-subscription"><div><Block className="is-line is-medium" /><Block className="is-line is-short" /></div><Block className="is-line is-medium" /><Block className="is-progress" /><Block className="is-line is-tiny" /></div>;
    case 'subscription-current': return <div className="caterer-skeleton-subscription-current"><div className="caterer-skeleton-subscription-top"><Block className="is-line is-short" /><Block className="is-chip" /></div><div className="caterer-skeleton-subscription-plan"><Block className="is-icon" /><div><Block className="is-line is-medium" /><Block className="is-line is-short" /></div></div><div className="caterer-skeleton-subscription-meta">{Array.from({ length: 3 }, (_, i) => <div key={i}><Block className="is-line is-short" /><Block className="is-line is-medium" /></div>)}</div><Block className="is-progress" /></div>;
    case 'subscription-history': return <div className="caterer-skeleton-subscription-history"><div className="caterer-skeleton-subscription-history-head">{Array.from({ length: 5 }, (_, i) => <Block className="is-line is-short" key={i} />)}</div>{Array.from({ length: 4 }, (_, row) => <div className="caterer-skeleton-subscription-history-row" key={row}>{Array.from({ length: 5 }, (_, column) => <Block className="is-line is-medium" key={column} />)}</div>)}</div>;
  }
}

export default function CatererSkeleton({ variant, className = '', label = 'Loading content', calendarCellCount }: { variant: CatererSkeletonVariant; className?: string; label?: string; calendarCellCount?: number }) {
  return <div className={`caterer-skeleton caterer-skeleton-${variant}${variant === 'dashboard' ? ' caterer-dashboard' : ''} ${className}`.trim()} role="status" aria-label={label}>
    <span className="caterer-skeleton-sr-only">{label}</span><SkeletonContent variant={variant} calendarCellCount={calendarCellCount} />
  </div>;
}
