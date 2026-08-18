/**
 * The panel's navigation, grouped the way the FRD groups the admin modules:
 * platform overview, the two directories of people, the money, the content
 * that goes out, and the operational back-of-house.
 */

export const navGroups = [
  {
    label: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'People',
    items: [
      { key: 'users', label: 'Users', icon: 'users' },
      { key: 'astrologers', label: 'Astrologers', icon: 'sparkle', count: 6 },
      { key: 'consultations', label: 'Consultations', icon: 'chat' },
    ],
  },
  {
    label: 'Money',
    items: [
      { key: 'payments', label: 'Payments', icon: 'card' },
      { key: 'wallets', label: 'Wallets', icon: 'wallet' },
    ],
  },
  {
    label: 'Content',
    items: [
      { key: 'content', label: 'Content Library', icon: 'file' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'reports', label: 'Reports', icon: 'chart' },
      { key: 'audit', label: 'Audit Logs', icon: 'shield' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

/** Flat lookup — the topbar reads the crumb trail off this. */
export const routeTitles = {
  dashboard: { title: 'Dashboard', group: 'Overview' },
  users: { title: 'User Management', group: 'People' },
  astrologers: { title: 'Astrologer Management', group: 'People' },
  consultations: { title: 'Consultation Monitoring', group: 'People' },
  payments: { title: 'Payment Management', group: 'Money' },
  wallets: { title: 'Wallet Management', group: 'Money' },
  content: { title: 'Content Management', group: 'Content' },
  reports: { title: 'Reporting & Monitoring', group: 'Operations' },
  audit: { title: 'Audit Logs', group: 'Operations' },
  settings: { title: 'Platform Administration', group: 'Operations' },
};

export const admin = {
  name: 'Vaibhav Mehra',
  email: 'admin@shreeastro.com',
  role: 'Admin',
};
