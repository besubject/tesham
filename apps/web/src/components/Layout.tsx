import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@mettig/shared';
import styles from './Layout.module.scss';

function Layout(): React.JSX.Element {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.logo}>Mettig</h1>
          <p className={styles.subtitle}>Business</p>
        </div>

        <nav className={styles.sidebarNav}>
          <Link
            to="/bookings"
            className={[styles.navItem, location.pathname === '/bookings' ? styles.active : ''].filter(Boolean).join(' ')}
          >
            📅 Записи
          </Link>
          <Link
            to="/stats"
            className={[styles.navItem, location.pathname === '/stats' ? styles.active : ''].filter(Boolean).join(' ')}
          >
            📊 Статистика
          </Link>
          <Link
            to="/profile"
            className={[styles.navItem, location.pathname === '/profile' ? styles.active : ''].filter(Boolean).join(' ')}
          >
            👤 Профиль
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user?.phone}</p>
            <p className={styles.userRole}>Бизнес-кабинет</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Выход
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
