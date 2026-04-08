import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@mettig/shared';
import './Layout.css';

function Layout(): React.JSX.Element {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Mettig</h1>
          <p className="subtitle">Business</p>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/bookings"
            className={`nav-item ${location.pathname === '/bookings' ? 'active' : ''}`}
          >
            📅 Записи
          </Link>
          <Link
            to="/stats"
            className={`nav-item ${location.pathname === '/stats' ? 'active' : ''}`}
          >
            📊 Статистика
          </Link>
          <Link
            to="/profile"
            className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            👤 Профиль
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <p className="user-name">{user?.phone}</p>
            <p className="user-role">Бизнес-кабинет</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Выход
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
