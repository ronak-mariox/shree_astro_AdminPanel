/** Figures behind the dashboard tiles, the charts and the reports page. */

export const kpis = [
  {
    key: 'users',
    label: 'Total Users',
    value: '48,210',
    icon: 'users',
    tone: 'brand',
    delta: '+8.4%',
    deltaTone: 'up',
    hint: 'vs. last month',
  },
  {
    key: 'astrologers',
    label: 'Active Astrologers',
    value: '212',
    icon: 'sparkle',
    tone: 'yellow',
    delta: '+6',
    deltaTone: 'up',
    hint: '2 awaiting approval',
  },
  {
    key: 'consultations',
    label: 'Consultations Today',
    value: '1,384',
    icon: 'chat',
    tone: 'lilac',
    delta: '+12.1%',
    deltaTone: 'up',
    hint: '18 running now',
  },
  {
    key: 'revenue',
    label: 'Revenue (MTD)',
    value: '₹18.4L',
    icon: 'rupee',
    tone: 'success',
    delta: '+15.7%',
    deltaTone: 'up',
    hint: 'net of gateway fees',
  },
];

export const consultationMix = [
  { label: 'Mon', chat: 620, call: 310 },
  { label: 'Tue', chat: 704, call: 366 },
  { label: 'Wed', chat: 668, call: 402 },
  { label: 'Thu', chat: 792, call: 428 },
  { label: 'Fri', chat: 880, call: 511 },
  { label: 'Sat', chat: 1024, call: 640 },
  { label: 'Sun', chat: 946, call: 588 },
];

export const signupSplit = [
  { label: 'Mobile OTP', value: 52, color: '#F55102' },
  { label: 'Google', value: 27, color: '#FFBC01' },
  { label: 'Apple', value: 13, color: '#1F2937' },
  { label: 'Email', value: 8, color: '#9CA3AF' },
];

export const topicSplit = [
  { label: 'Career', value: 34, color: '#F55102' },
  { label: 'Marriage', value: 26, color: '#FFBC01' },
  { label: 'Health', value: 17, color: '#16A34A' },
  { label: 'Wealth', value: 14, color: '#5B3FA8' },
  { label: 'Education', value: 9, color: '#9CA3AF' },
];

export const liveActivity = [
  {
    id: 'act-1',
    icon: 'sparkle',
    tone: 'warning',
    title: 'Acharya Vikram Joshi applied as an astrologer',
    meta: 'Awaiting document verification · 12 min ago',
    action: 'astrologers',
  },
  {
    id: 'act-2',
    icon: 'card',
    tone: 'success',
    title: 'Payment of ₹2,000 captured from Ananya Ghosh',
    meta: 'pay_R7xK21mQwLd0 · 38 min ago',
    action: 'payments',
  },
  {
    id: 'act-4',
    icon: 'wallet',
    tone: 'info',
    title: 'Payout request of ₹48,600 from Guru Prasad Shastri',
    meta: 'HDFC ••4210 · 2 hrs ago',
    action: 'wallets',
  },
  {
    id: 'act-6',
    icon: 'users',
    tone: 'success',
    title: '184 new registrations today',
    meta: '96 via mobile OTP · rolling',
    action: 'users',
  },
];

export const topAstrologers = [
  { name: 'Guru Prasad Shastri', consults: 6320, earnings: 312400, rating: 5, share: 100 },
  { name: 'Dr. Suresh Menon', consults: 5140, earnings: 226800, rating: 4.9, share: 73 },
  { name: 'Pt. Rajesh Sharma', consults: 4820, earnings: 184300, rating: 4.9, share: 59 },
  { name: 'Kavita Joshi', consults: 3210, earnings: 121450, rating: 4.8, share: 39 },
  { name: 'Anita Deshpande', consults: 1180, earnings: 42600, rating: 4.6, share: 14 },
];

export const systemHealth = [
  { label: 'Authentication API', status: 'operational', latency: '82 ms', uptime: '99.99%' },
  { label: 'Kundli generation API', status: 'operational', latency: '410 ms', uptime: '99.94%' },
  { label: 'Consultation sockets', status: 'operational', latency: '61 ms', uptime: '99.97%' },
  { label: 'Razorpay webhook', status: 'degraded', latency: '1.8 s', uptime: '99.21%' },
  { label: 'Push delivery (FCM)', status: 'operational', latency: '240 ms', uptime: '99.98%' },
  { label: 'AI astrology assistant', status: 'operational', latency: '1.2 s', uptime: '99.90%' },
];

/** Saved reports on the reporting page. */
export const savedReports = [
  {
    id: 'r-1',
    name: 'Daily user activity',
    scope: 'Registrations, sessions, retention',
    frequency: 'Daily · 08:00',
    format: 'CSV',
    lastRun: '17 Aug 2026 · 08:00 AM',
  },
  {
    id: 'r-2',
    name: 'Consultation summary',
    scope: 'Volume, duration, ratings by astrologer',
    frequency: 'Weekly · Monday',
    format: 'XLSX',
    lastRun: '17 Aug 2026 · 06:00 AM',
  },
  {
    id: 'r-3',
    name: 'Transaction reconciliation',
    scope: 'Razorpay settlements vs. wallet ledger',
    frequency: 'Daily · 23:30',
    format: 'CSV',
    lastRun: '16 Aug 2026 · 11:30 PM',
  },
  {
    id: 'r-4',
    name: 'Astrologer payout statement',
    scope: 'Earnings, commission, payable',
    frequency: 'Monthly · 1st',
    format: 'PDF',
    lastRun: '01 Aug 2026 · 09:00 AM',
  },
  {
    id: 'r-5',
    name: 'Content performance',
    scope: 'Views, reads, horoscope opens',
    frequency: 'Weekly · Friday',
    format: 'CSV',
    lastRun: '15 Aug 2026 · 07:00 PM',
  },
];

export const activityTrend = [
  { label: 'Mon', value: 6420 },
  { label: 'Tue', value: 7180 },
  { label: 'Wed', value: 6980 },
  { label: 'Thu', value: 8240 },
  { label: 'Fri', value: 9110 },
  { label: 'Sat', value: 11380 },
  { label: 'Sun', value: 10240 },
];

/** Admin accounts and platform-wide switches on the settings page. */
export const adminTeam = [
  {
    id: 'ad-1',
    name: 'Vaibhav Mehra',
    email: 'admin@shreeastro.com',
    role: 'Admin',
    lastActive: 'Online now',
    status: 'active',
  },
  {
    id: 'ad-2',
    name: 'Ritu Malhotra',
    email: 'ritu@shreeastro.com',
    role: 'Content Manager',
    lastActive: '35 minutes ago',
    status: 'active',
  },
  {
    id: 'ad-3',
    name: 'Karan Doshi',
    email: 'karan@shreeastro.com',
    role: 'Finance',
    lastActive: 'Yesterday',
    status: 'active',
  },
  {
    id: 'ad-4',
    name: 'Sara Pinto',
    email: 'sara@shreeastro.com',
    role: 'Support Lead',
    lastActive: '3 days ago',
    status: 'inactive',
  },
];

export const rolePermissions = [
  { role: 'Admin', scope: 'Everything, including admin accounts and payouts' },
  { role: 'Consultation', scope: 'Consultation related actions' },
  { role: 'user', scope: 'Users related actions' },
];
