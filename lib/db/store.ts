import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

function read<T>(name: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(name: string, data: unknown) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Card {
  id: string;
  bank_name: string;
  card_name: string;
  last_four: string;
  currency: 'USD' | 'INR';
  color: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  card_id: string;
  date: string;           // YYYY-MM-DD
  description: string;
  merchant_clean: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  category: string;
  subcategory: string;
  is_recurring: boolean;
  source_file: string;
  raw_hash: string;
  manually_edited: boolean;
  created_at: string;
}

export interface UploadRecord {
  id: string;
  filename: string;
  card_id: string;
  uploaded_at: string;
  transactions_found: number;
  transactions_duped: number;
  status: 'success' | 'partial' | 'failed';
  error_message?: string;
}

// ── Cards ──────────────────────────────────────────────────────────────────

export function getCards(): Card[] {
  return read<Card[]>('cards', []);
}

export function saveCard(card: Card) {
  const cards = getCards();
  const idx = cards.findIndex(c => c.id === card.id);
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  write('cards', cards);
}

export function deleteCard(id: string) {
  const cards = getCards().filter(c => c.id !== id);
  write('cards', cards);
  // also remove all transactions for this card
  const txns = getTransactions().filter(t => t.card_id !== id);
  write('transactions', txns);
}

// ── Transactions ───────────────────────────────────────────────────────────

export function getTransactions(): Transaction[] {
  return read<Transaction[]>('transactions', []);
}

export function saveTransactions(newTxns: Transaction[]): { added: number; duped: number } {
  const existing = getTransactions();
  const existingHashes = new Set(existing.map(t => t.raw_hash));
  const toAdd = newTxns.filter(t => !existingHashes.has(t.raw_hash));
  write('transactions', [...existing, ...toAdd]);
  return { added: toAdd.length, duped: newTxns.length - toAdd.length };
}

export function updateTransaction(id: string, patch: Partial<Transaction>) {
  const txns = getTransactions();
  const idx = txns.findIndex(t => t.id === id);
  if (idx >= 0) {
    txns[idx] = { ...txns[idx], ...patch, manually_edited: true };
    write('transactions', txns);
  }
}

// ── Upload History ─────────────────────────────────────────────────────────

export function getUploads(): UploadRecord[] {
  return read<UploadRecord[]>('uploads', []);
}

export function saveUpload(record: UploadRecord) {
  const uploads = getUploads();
  uploads.unshift(record);
  write('uploads', uploads);
}
