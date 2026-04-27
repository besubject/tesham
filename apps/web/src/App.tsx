import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@mettig/shared';
import { LoginPage } from './pages/login';
import { BookingsPage } from './pages/bookings';
import { StatsPage } from './pages/stats';
import { AnalyticsPage } from './pages/analytics';
import { ClientsPage } from './pages/clients';
import { ClientCardPage } from './pages/client-card';
import { BroadcastsPage } from './pages/broadcasts';
import { ProfilePage } from './pages/profile';
import { BusinessLinkPage } from './pages/link';
import { PublicBookingPage } from './pages/public-booking';
import Layout from './components/Layout';

globalThis.__METTIG_TOKEN_NAMESPACE__ = 'mettig_web';

const queryClient = new QueryClient();

const ProtectedRoute = (): React.JSX.Element => {
  // Каждое поле — отдельный selector. Если возвращать объект одним селектором,
  // Zustand сравнивает по ссылке и видит новый {} на каждом рендере → infinite loop.
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        Загрузка...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const App = (): React.JSX.Element => {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public routes — no auth required */}
          <Route path="/b/:slug" element={<PublicBookingPage />} />
          <Route path="/b/:slug/:staffSlug" element={<PublicBookingPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:clientId" element={<ClientCardPage />} />
              <Route path="/broadcasts" element={<BroadcastsPage />} />
              <Route path="/link" element={<BusinessLinkPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/" element={<Navigate to="/bookings" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
