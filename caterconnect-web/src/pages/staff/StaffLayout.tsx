import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../../components/Sidebar';

export default function StaffLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="portal-layout">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <main className="portal-main">
        <header className="portal-mobile-header">
          <button
            type="button"
            className="portal-menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <span className="portal-mobile-brand">
            CATER<span>CONNECT</span>
          </span>
        </header>

        <div className="portal-page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
