/**
 * Shree Astro — admin panel.
 *
 * Sign-in gates the whole console; once through, a hash route selects the page
 * and the shell (ink sidebar + sticky topbar) stays put around it.
 */

import { useEffect, useState } from 'react';
import { Sidebar, Topbar } from './components/Shell';
import { Toasts } from './components/ui';
import { cx } from './utils/cx';
import { useHashRoute, useToasts } from './hooks/useHashRoute';
import { useMediaQuery } from './hooks/useMediaQuery';
import { signOut as endSession } from './services/admin';
import { getAdmin, isSignedIn, onSessionChange } from './services/session';
import AstrologersPage from './pages/AstrologersPage';
import DisputesPage from './pages/DisputesPage';
import ConsultationsPage from './pages/ConsultationsPage';
import ContentPage from './pages/ContentPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import AuditLogsPage from './pages/AuditLogsPage';
import CareersPage from './pages/CareersPage';
import NotificationsPage from './pages/NotificationsPage';
import OffersPage from './pages/OffersPage';
import OrdersPage from './pages/OrdersPage';
import PaymentsPage from './pages/PaymentsPage';
import ProductsPage from './pages/ProductsPage';
import PujaBookingsPage from './pages/PujaBookingsPage';
import PujasPage from './pages/PujasPage';
import ReportsPage from './pages/ReportsPage';
import ReviewsPage from './pages/ReviewsPage';
import SettingsPage from './pages/SettingsPage';
import TestimonialsPage from './pages/TestimonialsPage';
import UsersPage from './pages/UsersPage';
import WalletsPage from './pages/WalletsPage';

const PAGES = {
  dashboard: DashboardPage,
  notifications: NotificationsPage,
  users: UsersPage,
  astrologers: AstrologersPage,
  consultations: ConsultationsPage,
  payments: PaymentsPage,
  wallets: WalletsPage,
  content: ContentPage,
  products: ProductsPage,
  orders: OrdersPage,
  pujas: PujasPage,
  pujaBookings: PujaBookingsPage,
  offers: OffersPage,
  reviews: ReviewsPage,
  testimonials: TestimonialsPage,
  careers: CareersPage,
  disputes: DisputesPage,
  audit: AuditLogsPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  /** Read from sessionStorage, so a page refresh does not sign the admin out. */
  const [admin, setAdmin] = useState(getAdmin);
  const [collapsed, setCollapsed] = useState(false);
  /**
   * At tablet/phone widths the sidebar is an off-canvas drawer instead of a
   * column; the topbar toggle opens it there, and collapses the rail above.
   * Collapsing is a desktop-only idea, so it is ignored while narrow.
   */
  const narrow = useMediaQuery('(max-width: 900px)');
  const [navOpen, setNavOpen] = useState(false);
  const drawerOpen = narrow && navOpen;
  const railCollapsed = !narrow && collapsed;
  const [route, navigate, query] = useHashRoute('dashboard');
  const [toasts, notify] = useToasts();
  /** Bumped by the topbar's "Refresh data" button — folded into the current page's `key` below so React remounts it from scratch, same as switching routes does. */
  const [refreshTick, setRefreshTick] = useState(0);

  /**
   * A session can also end without anyone pressing anything: a refresh token
   * the API refuses is cleared by the client, from wherever the admin happened
   * to be. Listening here turns that into navigation.
   */
  useEffect(() => onSessionChange((session) => setAdmin(session?.admin ?? null)), []);

  /** While the nav drawer is open: Esc closes it and the page behind stops scrolling. */
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('is-nav-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('is-nav-locked');
    };
  }, [drawerOpen]);

  if (!admin || !isSignedIn()) {
    return <LoginPage onAuthenticated={setAdmin} />;
  }

  const Page = PAGES[route] || DashboardPage;

  const signOut = async () => {
    await endSession();
    navigate('dashboard');
  };

  return (
    <div className={cx('shell', railCollapsed && 'is-collapsed', drawerOpen && 'is-nav-open')}>
      <Sidebar
        route={route}
        onNavigate={(next) => {
          setNavOpen(false);
          navigate(next);
        }}
        collapsed={railCollapsed}
        hidden={narrow && !navOpen}
        onSignOut={() => {
          setNavOpen(false);
          signOut();
        }}
      />
      {drawerOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <Topbar
          route={route}
          collapsed={railCollapsed}
          narrow={narrow}
          navOpen={drawerOpen}
          onToggle={() =>
            narrow ? setNavOpen((open) => !open) : setCollapsed((value) => !value)
          }
          onNavigate={navigate}
          onSignOut={signOut}
          onRefresh={() => setRefreshTick((tick) => tick + 1)}
          admin={admin}
        />
        <Page
          key={`${route}-${refreshTick}-${JSON.stringify(query)}`}
          onNavigate={navigate}
          notify={notify}
          admin={admin}
          query={query}
        />
      </div>

      <Toasts items={toasts} />
    </div>
  );
}
