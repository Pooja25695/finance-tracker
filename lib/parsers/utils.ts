import crypto from 'crypto';

// ── Amount normalization ───────────────────────────────────────────────────
export function parseAmount(raw: string): { amount: number; type: 'debit' | 'credit' } {
  const str = raw.trim();
  const isCredit =
    /CR$/i.test(str) ||
    str.startsWith('-') ||
    (str.startsWith('(') && str.endsWith(')'));

  const cleaned = str
    .replace(/[(),\s]/g, '')
    .replace(/CR$/i, '')
    .replace(/Dr$/i, '')
    .replace(/[^0-9.]/g, '');

  const amount = parseFloat(cleaned) || 0;
  return { amount, type: isCredit ? 'credit' : 'debit' };
}

// ── Date normalization — returns YYYY-MM-DD ────────────────────────────────
export function parseDate(raw: string, statementYear?: number): string | null {
  const str = raw.trim();
  const year = statementYear || new Date().getFullYear();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // MM/DD/YYYY or DD/MM/YYYY
  const slashFull = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashFull) {
    const y = slashFull[3].length === 2 ? `20${slashFull[3]}` : slashFull[3];
    return `${y}-${slashFull[1].padStart(2, '0')}-${slashFull[2].padStart(2, '0')}`;
  }

  // MM/DD (Discover short format)
  const slashShort = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashShort) {
    return `${year}-${slashShort[1].padStart(2, '0')}-${slashShort[2].padStart(2, '0')}`;
  }

  // DD/MM/YY (HDFC short format)
  const hdfcShort = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (hdfcShort) {
    return `20${hdfcShort[3]}-${hdfcShort[2]}-${hdfcShort[1]}`;
  }

  // DD MMM YYYY or DD MMM YY (HDFC long format)
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const wordDate = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (wordDate) {
    const mon = months[wordDate[2].toLowerCase()];
    const y = wordDate[3].length === 2 ? `20${wordDate[3]}` : wordDate[3];
    if (mon) return `${y}-${mon}-${wordDate[1].padStart(2, '0')}`;
  }

  return null;
}

// ── Merchant normalization ─────────────────────────────────────────────────
export function cleanMerchant(raw: string): string {
  return raw
    .replace(/#\d+/g, '')
    .replace(/\b[A-Z]{2}\b/g, '')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/\b(LLC|INC|LTD|CO|CORP|PVT|PVT\.LTD)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── SHA256 hash for deduplication ─────────────────────────────────────────
export function makeHash(date: string, description: string, amount: number, cardId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${date}|${description.toLowerCase()}|${amount}|${cardId}`)
    .digest('hex');
}

export function generateId(): string {
  return crypto.randomUUID();
}
