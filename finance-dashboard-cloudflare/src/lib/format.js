export function formatEur(n) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

export function parseDate(str) {
  const [d, m, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

export function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function toInputDate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
}

export function formatLongDate(date) {
  return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date - new Date()) / msPerDay);
}

export function classes(...parts) {
  return parts.filter(Boolean).join(' ');
}
