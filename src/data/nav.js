/**
 * The panel's navigation, grouped the way the FRD groups the admin modules:
 * platform overview, the two directories of people, the money, the content
 * that goes out, and the operational back-of-house.
 */

export const navGroups = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
  {
    label: 'People',
    items: [
      { key: 'users', label: 'Users', icon: 'users' },
      { key: 'astrologers', label: 'Astrologers', icon: 'sparkle' },
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
    label: 'Commerce',
    items: [
      { key: 'products', label: 'Products', icon: 'bag' },
      { key: 'orders', label: 'Orders', icon: 'package' },
      { key: 'pujas', label: 'Pujas', icon: 'flame' },
      { key: 'pujaBookings', label: 'Puja Bookings', icon: 'calendar' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { key: 'offers', label: 'Offers & Coupons', icon: 'tag' },
      { key: 'reviews', label: 'Reviews', icon: 'star' },
      { key: 'testimonials', label: 'Testimonials', icon: 'messageSquare' },
      { key: 'careers', label: 'Careers', icon: 'briefcase' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'disputes', label: 'Disputes', icon: 'inbox' },
      { key: 'reports', label: 'Reports', icon: 'chart' },
      { key: 'audit', label: 'Audit Logs', icon: 'shield' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

/** Flat lookup — the topbar reads the crumb trail off this. */
export const routeTitles = {
  dashboard: { title: 'Dashboard', group: 'Overview' },
  notifications: { title: 'Notifications', group: 'Overview' },
  users: { title: 'User Management', group: 'People' },
  astrologers: { title: 'Astrologer Management', group: 'People' },
  consultations: { title: 'Consultation Monitoring', group: 'People' },
  payments: { title: 'Payment Management', group: 'Money' },
  wallets: { title: 'Wallet Management', group: 'Money' },
  content: { title: 'Content Management', group: 'Content' },
  products: { title: 'Products', group: 'Commerce' },
  orders: { title: 'Orders', group: 'Commerce' },
  pujas: { title: 'Pujas', group: 'Commerce' },
  pujaBookings: { title: 'Puja Bookings', group: 'Commerce' },
  offers: { title: 'Offers & Coupons', group: 'Growth' },
  reviews: { title: 'Reviews', group: 'Growth' },
  testimonials: { title: 'Testimonials', group: 'Growth' },
  careers: { title: 'Careers', group: 'Growth' },
  disputes: { title: 'Disputes & Support', group: 'Operations' },
  reports: { title: 'Reporting & Monitoring', group: 'Operations' },
  audit: { title: 'Audit Logs', group: 'Operations' },
  settings: { title: 'Platform Administration', group: 'Operations' },
};
