
import { Outlet } from 'react-router-dom';
import CatererSidebar from '../../components/CatererSidebar';

export default function CatererLayout() {
  return (
    <div className="caterer-layout">
      <CatererSidebar />

      <main className="caterer-main">
        <Outlet />
      </main>
    </div>
  );
}
