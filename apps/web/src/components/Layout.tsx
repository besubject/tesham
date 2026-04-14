import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@mettig/shared';
import styles from './Layout.module.scss';
import { SIDEBAR_NAV_ITEMS } from './Layout.constants';

const Layout = (): React.JSX.Element => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async (): Promise<void> => {
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
          {SIDEBAR_NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={[styles.navItem, location.pathname === item.to ? styles.active : '']
                .filter(Boolean)
                .join(' ')}
            >
              {item.icon} {item.label}
            </Link>
          ))}
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
};

export default Layout;
