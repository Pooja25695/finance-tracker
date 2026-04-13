import pdf = require('pdf-parse');
import fs from 'fs';
import { Transaction } from '../db/store';
import { parseDiscover } from './discover';
import { parseHdfc } from './hdfc';

function detectBank(text: string): 'discover' | 'hdfc' | 'unknown' {
  const t = text.toLowerCase();
  if (t.includes('discover') || t.includes('discovercardservices')) return 'discover';
  if (t.includes('hdfc') || t.includes('hdfcbank')) return 'hdfc';
  return 'unknown';
}

export async function parsePDF(
  filePath: string,
  cardId: string
): Promise<{ transactions: Transaction[]; bank: string; error?: string }> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    const text = data.text;
    const sourceFile = filePath.split('/').pop() || filePath;
    const bank = detectBank(text);

    let transactions: Transaction[] = [];

    if (bank === 'discover') {
      transactions = parseDiscover(text, cardId, sourceFile);
    } else if (bank === 'hdfc') {
      transactions = parseHdfc(text, cardId, sourceFile);
    } else {
      // Generic fallback — try both parsers, use whichever gets more results
      const d = parseDiscover(text, cardId, sourceFile);
      const h = parseHdfc(text, cardId, sourceFile);
      transactions = d.length >= h.length ? d : h;
    }

    return { transactions, bank };
  } catch (err: any) {
    return { transactions: [], bank: 'unknown', error: err.message };
  }
}
