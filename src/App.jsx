/**
 * Shree Astro — admin panel.
 *
 * Sign-in gates the whole console; once through, a hash route selects the page
 * and the shell (ink sidebar + sticky topbar) stays put around it.
 */

import { useState } from 'react';
import { Sidebar, Topbar } from './components/Shell';
import { Toasts } from './components/ui';
import { cx } from './utils/cx';
import { useHashRoute, useToasts } from './hooks/useHashRoute';
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
  const [signedIn, setSignedIn] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [route, navigate] = useHashRoute('dashboard');
  const [toasts, notify] = useToasts();

  if (!signedIn) {
    return <LoginPage onAuthenticated={() => setSignedIn(true)} />;
  }

  const Page = PAGES[route] || DashboardPage;
  const signOut = () => {
    setSignedIn(false);
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
        />
        <Page key={route} onNavigate={navigate} notify={notify} />
      </div>

      <Toasts items={toasts} />
    </div>
  );
}
