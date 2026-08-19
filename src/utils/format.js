/**
 * Turning what the API sends into what the panel prints.
 *
 * The API answers in raw values — ISO dates, rupee integers, id strings — so
 * every bit of formatting lives here rather than being repeated on each page.
 */

/** 1250 → "₹1,250". */
export const money = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN')}`;

/** 1840000 → "₹18.4L", for a stat tile that has no room for the full number. */
export function shortMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${amount}`;
}

/** 48210 → "48,210". */
export const count = (value) => Number(value || 0).toLocaleString('en-IN');

/** An ISO date → "17 Aug 2026". */
export function date(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** An ISO date → "17 Aug 2026 · 06:42 PM". */
export function dateTime(value) {
  if (!value) return '—';
  const at = new Date(value);
  return `${date(at)} · ${at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}`;
}

/** An ISO date → "2 hours ago". */
export function relative(value) {
  if (!value) return 'Never';

  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'Just now';

  const steps = [
    [60, 'minute'],
    [60, 'hour'],
    [24, 'day'],
    [7, 'week'],
  ];

  let amount = seconds;
  let unit = 'second';
  for (const [size, name] of steps) {
    if (amount < size) break;
    amount = Math.floor(amount / size);
    unit = name;
  }

  if (unit === 'week' && amount > 4) return date(value);
  return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
}

/** 1325 seconds → "22m 05s". */
export function duration(seconds) {
  const total = Math.max(Math.round(Number(seconds) || 0), 0);
  if (!total) return '—';

  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  }
  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

/** 1325 seconds → 22, the whole minutes that were billed. */
export const minutes = (seconds) => Math.ceil((Number(seconds) || 0) / 60);

/** "career-job" → "Career job"; ["vedic","tarot"] → "Vedic, Tarot". */
export function label(value) {
  if (Array.isArray(value)) {
    return value.map(label).join(', ');
  }
  if (!value) return '';
  const text = String(value).replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A list, or a dash when there is nothing in it. */
export const listOr = (value, fallback = '—') => {
  const text = Array.isArray(value) ? label(value) : label(value);
  return text || fallback;
};

/** Anything empty prints as a dash rather than a blank cell. */
export const orDash = (value) =>
  value === 0 || (value && String(value).trim()) ? value : '—';

/** "+91" + "9876543210" → "+91 98765 43210". */
export function phone(number, countryCode = '+91') {
  if (!number) return '—';
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 10) {
    return `${countryCode} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `${countryCode} ${digits}`;
}

/** Birth details → "15 Aug 1995 · 04:20 · Jaipur", as the drawer prints it. */
export function birthLine(birthDetails) {
  if (!birthDetails?.dateOfBirth) return '—';

  const parts = [date(birthDetails.dateOfBirth)];
  if (birthDetails.timeOfBirth) parts.push(birthDetails.timeOfBirth);
  if (birthDetails.place?.city || birthDetails.place?.formatted) {
    parts.push(birthDetails.place.city || birthDetails.place.formatted);
  }
  return parts.join(' · ');
}

/** How an account was opened, as the table prints it. */
export const signupLabel = (provider) =>
  ({ otp: 'Mobile OTP', email: 'Email', google: 'Google', apple: 'Apple', facebook: 'Facebook' })[
    provider
  ] || label(provider);
