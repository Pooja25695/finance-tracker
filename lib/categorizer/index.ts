// ── Category rules ─────────────────────────────────────────────────────────
const RULES: Record<string, { keywords: string[]; color: string; icon: string }> = {
  food: {
    icon: '🍔',
    color: '#f59e0b',
    keywords: [
      'swiggy', 'zomato', 'doordash', 'ubereats', 'grubhub', 'postmates',
      'mcdonald', 'burger', 'pizza', 'kfc', 'subway', 'domino',
      'starbucks', 'dunkin', 'coffee', 'cafe', 'restaurant', 'dining',
      'whole foods', 'trader joe', 'safeway', 'kroger', 'walmart grocery',
      'bigbasket', 'grofers', 'blinkit', 'dunzo', 'instamart',
      'sushi', 'chipotle', 'panera', 'chick-fil',
    ],
  },
  shopping: {
    icon: '🛍️',
    color: '#8b5cf6',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa',
      'target', 'walmart', 'costco', 'best buy', 'apple store',
      'nike', 'adidas', 'zara', 'h&m', 'nordstrom', 'macy',
      'ebay', 'etsy', 'shopify', 'shein',
    ],
  },
  travel: {
    icon: '✈️',
    color: '#3b82f6',
    keywords: [
      'indigo', 'air india', 'spicejet', 'vistara', 'goair',
      'united', 'delta', 'american airlines', 'southwest', 'jetblue',
      'airbnb', 'oyo', 'makemytrip', 'goibibo', 'booking.com', 'expedia',
      'marriott', 'hilton', 'hyatt', 'ihg',
      'uber', 'lyft', 'ola', 'rapido', 'taxi', 'hertz', 'enterprise',
      'irctc', 'redbus',
    ],
  },
  entertainment: {
    icon: '🎬',
    color: '#ec4899',
    keywords: [
      'netflix', 'spotify', 'hotstar', 'prime video', 'apple tv',
      'hulu', 'disney', 'hbo', 'youtube premium',
      'steam', 'playstation', 'xbox', 'nintendo',
      'bookmyshow', 'pvr', 'inox', 'movie', 'theater', 'concert',
      'audible', 'kindle',
    ],
  },
  utilities: {
    icon: '⚡',
    color: '#14b8a6',
    keywords: [
      'electricity', 'bescom', 'msedcl', 'tata power', 'adani electricity',
      'airtel', 'jio', 'vodafone', 'bsnl', 'act fibernet',
      'at&t', 'verizon', 't-mobile', 'comcast', 'xfinity',
      'gas', 'water', 'utility', 'broadband', 'internet',
    ],
  },
  health: {
    icon: '💊',
    color: '#10b981',
    keywords: [
      'apollo', 'medplus', 'netmeds', 'pharmeasy', '1mg',
      'cvs', 'walgreens', 'rite aid',
      'hospital', 'clinic', 'doctor', 'dental', 'pharmacy',
      'gym', 'cult.fit', 'fitpass', 'healthifyme',
    ],
  },
  finance: {
    icon: '💳',
    color: '#6366f1',
    keywords: [
      'interest charge', 'annual fee', 'late fee', 'finance charge',
      'emi', 'loan', 'insurance', 'lic', 'hdfc life', 'sbi life',
    ],
  },
  education: {
    icon: '📚',
    color: '#f97316',
    keywords: [
      'udemy', 'coursera', 'linkedin learning', 'pluralsight',
      'byju', 'unacademy', 'vedantu', 'upgrad',
      'school', 'college', 'university', 'tuition', 'books',
    ],
  },
};

// ── User overrides store ───────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

const OVERRIDES_PATH = path.join(process.cwd(), 'data', 'overrides.json');

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveOverride(merchant: string, category: string) {
  const overrides = loadOverrides();
  overrides[merchant.toLowerCase()] = category;
  fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true });
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
}

// ── Main categorize function ───────────────────────────────────────────────
export function categorize(merchant: string): string {
  const m = merchant.toLowerCase();

  // Check user overrides first
  const overrides = loadOverrides();
  if (overrides[m]) return overrides[m];

  // Keyword matching
  for (const [category, { keywords }] of Object.entries(RULES)) {
    if (keywords.some(k => m.includes(k))) return category;
  }

  return 'other';
}

export function getCategoryMeta(category: string) {
  return RULES[category] || { icon: '📦', color: '#6b7280' };
}

export function getAllCategories() {
  return Object.entries(RULES).map(([name, meta]) => ({
    name,
    icon: meta.icon,
    color: meta.color,
  }));
}
