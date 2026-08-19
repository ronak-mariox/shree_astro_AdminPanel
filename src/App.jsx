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
import { signOut as endSession } from './services/admin';
import { getAdmin, isSignedIn, onSessionChange } from './services/session';
import AstrologersPage from './pages/AstrologersPage';
import ConsultationsPage from './pages/ConsultationsPage';
import ContentPage from './pages/ContentPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import WalletsPage from './pages/WalletsPage';

const PAGES = {
  dashboard: DashboardPage,
  users: UsersPage,
  astrologers: AstrologersPage,
  consultations: ConsultationsPage,
  payments: PaymentsPage,
  wallets: WalletsPage,
  content: ContentPage,
  audit: AuditLogsPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  /** Read from sessionStorage, so a page refresh does not sign the admin out. */
  const [admin, setAdmin] = useState(getAdmin);
  const [collapsed, setCollapsed] = useState(false);
  const [route, navigate] = useHashRoute('dashboard');
  const [toasts, notify] = useToasts();

  /**
   * A session can also end without anyone pressing anything: a refresh token
   * the API refuses is cleared by the client, from wherever the admin happened
   * to be. Listening here turns that into navigation.
   */
  useEffect(() => onSessionChange((session) => setAdmin(session?.admin ?? null)), []);

  if (!admin || !isSignedIn()) {
    return <LoginPage onAuthenticated={setAdmin} />;
  }

  const Page = PAGES[route] || DashboardPage;

  const signOut = async () => {
    await endSession();
    navigate('dashboard');
  };

  return (
    <div className={cx('shell', collapsed && 'is-collapsed')}>
      <Sidebar
        route={route}
        onNavigate={navigate}
        collapsed={collapsed}
        onSignOut={signOut}
      />

      <div className="main">
        <Topbar
          route={route}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          onNavigate={navigate}
          onSignOut={signOut}
          admin={admin}
        />
        <Page key={route} onNavigate={navigate} notify={notify} admin={admin} />
      </div>

      <Toasts items={toasts} />
    </div>
  );
}
