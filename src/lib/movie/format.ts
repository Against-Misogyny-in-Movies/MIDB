const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

export function formatCurrency(n: number): string {
  if (!n) return '—';
  return currencyFormatter.format(n);
}

export function countryName(iso: string): string {
  try {
    return countryNames.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

export function languageName(iso: string, fallback?: string): string {
  try {
    const resolved = languageNames.of(iso);
    // If Intl returned the raw code unchanged, it didn't recognize it — use fallback
    if (!resolved || resolved === iso) return fallback ?? iso;
    return resolved;
  } catch {
    return fallback ?? iso;
  }
}

export function formatRuntime(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
