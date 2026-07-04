import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        flex: 1, marginLeft: 'var(--sidebar-w)',
        padding: '32px 36px', minHeight: '100vh',
        background: '#F4F6F9',
      }}>
        <Outlet />
      </main>
    </div>
  );
}