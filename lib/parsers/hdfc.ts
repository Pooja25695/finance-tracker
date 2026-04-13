import { Transaction } from '../db/store';
import { parseAmount, parseDate, cleanMerchant, makeHash, generateId } from './utils';

export function parseHdfc(text: string, cardId: string, sourceFile: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // HDFC format: DD/MM/YY or DD MMM YYYY  DESCRIPTION  AMOUNT  DR/CR
  // Example: 05/03/24  AMAZON INDIA  1,299.00  Dr
  // Example: 10 Mar 2024  SWIGGY  450.00  Dr
  const txnPattern = /^(\d{2}[\/\s-]\w+[\/\s-]\w+)\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|CR|Cr|dr)?$/i;

  for (const line of lines) {
    const match = line.match(txnPattern);
    if (!match) continue;

    const [, rawDate, rawDesc, rawAmount, drCr] = match;
    const date = parseDate(rawDate);
    if (!date) continue;

    const { amount } = parseAmount(rawAmount);
    if (amount <= 0) continue;

    // Skip payments, opening/closing balance lines
    if (/payment|opening balance|closing balance|reward|cashback/i.test(rawDesc)) continue;

    const type = /CR|Cr/i.test(drCr || '') ? 'credit' : 'debit';
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
