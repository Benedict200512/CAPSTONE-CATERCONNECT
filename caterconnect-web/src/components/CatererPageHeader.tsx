import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type CatererPageHeaderProps = {
  title: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
  aboveTitle?: ReactNode;
  showBack?: boolean;
  className?: string;
};

export default function CatererPageHeader({
  title,
  description,
  icon,
  action,
  aboveTitle,
  showBack = true,
  className = '',
}: CatererPageHeaderProps) {
  return (
    <div className={`caterer-page-heading-block ${className}`}>
      {showBack && (
        <Link className="caterer-page-back-link" to="/caterer">
          <ChevronLeft size={18} aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
      )}
      <header className="caterer-standard-page-header">
        <span className="caterer-standard-page-icon" aria-hidden="true">{icon}</span>
        <div className="caterer-standard-page-copy">
          {aboveTitle}
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action && <div className="caterer-standard-page-action">{action}</div>}
      </header>
    </div>
  );
}
