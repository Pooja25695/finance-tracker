import { Transaction } from '../db/store';
import { parseAmount, parseDate, cleanMerchant, makeHash, generateId } from './utils';

export function parseDiscover(text: string, cardId: string, sourceFile: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract statement year from text
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const statementYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // Pattern: MM/DD  MERCHANT NAME  AMOUNT
  const txnPattern = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})\s*$/;

  for (const line of lines) {
    const match = line.match(txnPattern);
    if (!match) continue;

    const [, rawDate, rawDesc, rawAmount] = match;
    const date = parseDate(rawDate, statementYear);
    if (!date) continue;

    const { amount, type } = parseAmount(rawAmount);
    if (amount <= 0) continue;

    // Skip payments and credits
    if (/payment|thank you|credit balance|rewards/i.test(rawDesc)) continue;

    const merchant_clean = cleanMerchant(rawDesc);
    const raw_hash = makeHash(date, rawDesc, amount, cardId);

    transactions.push({
      id: generateId(),
      card_id: cardId,
      date,
      description: rawDesc,
      merchant_clean,
      amount,
      transaction_type: type,
      category: 'uncategorized',
      subcategory: '',
      is_recurring: false,
      source_file: sourceFile,
      raw_hash,
      manually_edited: false,
      created_at: new Date().toISOString(),
    });
  }

  return transactions;
}
