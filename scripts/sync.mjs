#!/usr/bin/env node
/**
 * Finance Tracker - Sync Script
 *
 * What this does:
 * 1. Connects to Gmail (read-only) and downloads HDFC/Discover PDF statements
 * 2. Parses transactions from each PDF
 * 3. Categorizes each transaction
 * 4. Saves everything to data/transactions.json and data/cards.json
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH        = path.join(ROOT, 'token.json');
const DATA_DIR          = path.join(ROOT, 'public', 'data');
const PDF_DIR           = path.join(ROOT, 'data', 'pdfs');   // PDFs stay outside public
const TRANSACTIONS_PATH = path.join(DATA_DIR, 'transactions.json');
const CARDS_PATH        = path.join(DATA_DIR, 'cards.json');

// ── Auth ───────────────────────────────────────────────────────────────────
function getAuth() {
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret } = raw.installed || raw.web;
  const auth = new OAuth2Client(client_id, client_secret, 'http://localhost:3000/oauth2callback');
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  return auth;
}

// ── Gmail: fetch PDF attachments ───────────────────────────────────────────
async function fetchPDFs(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const query = '(from:discover OR subject:HDFC OR subject:"credit card statement" OR subject:"e-statement") has:attachment filename:pdf';

  console.log('📧 Searching Gmail for statements...');
  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 30 });
  const messages = listRes.data.messages || [];
  console.log(`   Found ${messages.length} matching emails`);

  fs.mkdirSync(PDF_DIR, { recursive: true });
  const downloaded = [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const parts = full.data.payload?.parts || [];
    const subject = full.data.payload?.headers?.find(h => h.name === 'Subject')?.value || 'unknown';

    for (const part of parts) {
      if (!part.filename?.endsWith('.pdf')) continue;
      if (!part.body?.attachmentId) continue;

      const outPath = path.join(PDF_DIR, part.filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
      if (fs.existsSync(outPath)) {
        console.log(`   ⏭  Skipping (already downloaded): ${part.filename}`);
        downloaded.push(outPath);
        continue;
      }

      const att = await gmail.users.messages.attachments.get({
        userId: 'me', messageId: msg.id, id: part.body.attachmentId,
      });
      fs.writeFileSync(outPath, Buffer.from(att.data.data, 'base64'));
      console.log(`   ✅ Downloaded: ${part.filename}`);
      downloaded.push(outPath);
    }
  }

  return downloaded;
}

// ── Utils ──────────────────────────────────────────────────────────────────
function parseAmount(raw) {
  const str = raw.trim();
  const isCredit = /CR$/i.test(str) || str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  const cleaned = str.replace(/[(),\s]/g,'').replace(/CR$/i,'').replace(/Dr$/i,'').replace(/[^0-9.]/g,'');
  return { amount: parseFloat(cleaned) || 0, type: isCredit ? 'credit' : 'debit' };
}

function parseDate(raw, year) {
  const str = raw.trim();
  const y = year || new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const slashFull = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashFull) { const yr = slashFull[3].length===2?`20${slashFull[3]}`:slashFull[3]; return `${yr}-${slashFull[1].padStart(2,'0')}-${slashFull[2].padStart(2,'0')}`; }
  const slashShort = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashShort) return `${y}-${slashShort[1].padStart(2,'0')}-${slashShort[2].padStart(2,'0')}`;
  const hdfcShort = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (hdfcShort) return `20${hdfcShort[3]}-${hdfcShort[2]}-${hdfcShort[1]}`;
  const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const wordDate = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (wordDate) { const mon=months[wordDate[2].toLowerCase()]; const yr=wordDate[3].length===2?`20${wordDate[3]}`:wordDate[3]; if(mon) return `${yr}-${mon}-${wordDate[1].padStart(2,'0')}`; }
  return null;
}

function cleanMerchant(raw) {
  return raw.replace(/#\d+/g,'').replace(/\b[A-Z]{2}\b/g,'').replace(/\b\d{5,}\b/g,'').replace(/\b(LLC|INC|LTD|CO|CORP|PVT)\b/gi,'').replace(/\s{2,}/g,' ').trim();
}

function categorize(merchant) {
  const m = merchant.toLowerCase();
  const rules = {
    food: ['swiggy','zomato','doordash','ubereats','mcdonald','burger','pizza','kfc','starbucks','coffee','cafe','restaurant','whole foods','bigbasket','blinkit'],
    shopping: ['amazon','flipkart','myntra','target','walmart','costco','best buy','nike','zara','ebay','nykaa'],
    travel: ['indigo','air india','spicejet','united','delta','airbnb','oyo','makemytrip','booking.com','uber','lyft','ola','irctc'],
    entertainment: ['netflix','spotify','hotstar','prime video','apple tv','hulu','disney','steam','bookmyshow','pvr'],
    utilities: ['electricity','bescom','airtel','jio','vodafone','at&t','verizon','comcast','gas','water','broadband'],
    health: ['apollo','medplus','pharmeasy','cvs','walgreens','hospital','clinic','doctor','dental','pharmacy','gym','cult.fit'],
    finance: ['interest charge','annual fee','late fee','finance charge','emi','insurance'],
    education: ['udemy','coursera','linkedin learning','byju','unacademy','school','college','tuition'],
  };
  for (const [cat, keywords] of Object.entries(rules)) {
    if (keywords.some(k => m.includes(k))) return cat;
  }
  return 'other';
}

// ── Parse PDF ─────────────────────────────────────────────────────────────
async function parsePDF(filePath, cardId) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  const text = data.text;
  const filename = path.basename(filePath);
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  const isHDFC = /hdfc/i.test(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  const discoverPattern = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})\s*$/;
  const hdfcPattern = /^(\d{2}[\/\s-]\w+[\/\s-]\w+)\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|CR|Cr|dr)?$/i;

  for (const line of lines) {
    const match = isHDFC ? line.match(hdfcPattern) : line.match(discoverPattern);
    if (!match) continue;

    const [, rawDate, rawDesc, rawAmount, drCr] = match;
    const date = parseDate(rawDate, year);
    if (!date) continue;

    const { amount, type: defaultType } = parseAmount(rawAmount);
    if (amount <= 0) continue;
    if (/payment|thank you|opening balance|closing balance|reward|cashback/i.test(rawDesc)) continue;

    const type = drCr ? (/CR|Cr/i.test(drCr) ? 'credit' : 'debit') : defaultType;
    const merchant_clean = cleanMerchant(rawDesc);
    const category = categorize(merchant_clean);
    const raw_hash = crypto.createHash('sha256').update(`${date}|${rawDesc.toLowerCase()}|${amount}|${cardId}`).digest('hex');

    transactions.push({
      id: crypto.randomUUID(),
      card_id: cardId,
      date,
      description: rawDesc,
      merchant_clean,
      amount,
      transaction_type: type,
      category,
      subcategory: '',
      is_recurring: false,
      source_file: filename,
      raw_hash,
      manually_edited: false,
      created_at: new Date().toISOString(),
    });
  }

  return transactions;
}

// ── Ensure cards exist ─────────────────────────────────────────────────────
function ensureCards() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CARDS_PATH)) {
    const cards = [
      { id: 'discover-1', bank_name: 'Discover', card_name: 'Discover Card', last_four: '', currency: 'USD', color: '#f97316', created_at: new Date().toISOString() },
      { id: 'hdfc-1',     bank_name: 'HDFC',     card_name: 'HDFC Credit Card', last_four: '', currency: 'INR', color: '#8b5cf6', created_at: new Date().toISOString() },
    ];
    fs.writeFileSync(CARDS_PATH, JSON.stringify(cards, null, 2));
  }
  return JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n💰 Finance Tracker Sync\n');

  // 1. Fetch PDFs from Gmail
  const auth = getAuth();
  const pdfFiles = await fetchPDFs(auth);

  if (pdfFiles.length === 0) {
    console.log('\n⚠️  No statement PDFs found in Gmail.');
    console.log('   Make sure your HDFC/Discover statements are emailed to this account.\n');
    return;
  }

  // 2. Ensure cards exist
  const cards = ensureCards();

  // 3. Parse all PDFs
  console.log('\n📄 Parsing PDFs...');
  const existing = fs.existsSync(TRANSACTIONS_PATH)
    ? JSON.parse(fs.readFileSync(TRANSACTIONS_PATH, 'utf-8'))
    : [];
  const existingHashes = new Set(existing.map(t => t.raw_hash));

  let totalAdded = 0;
  let totalDuped = 0;

  for (const filePath of pdfFiles) {
    const filename = path.basename(filePath);
    const isHDFC = /hdfc/i.test(filename) || /hdfc/i.test(fs.readFileSync(filePath).toString('utf-8', 0, 500));
    const card = cards.find(c => isHDFC ? c.bank_name === 'HDFC' : c.bank_name === 'Discover');
    const cardId = card?.id || 'discover-1';

    const txns = await parsePDF(filePath, cardId);
    const newTxns = txns.filter(t => !existingHashes.has(t.raw_hash));

    totalAdded += newTxns.length;
    totalDuped += txns.length - newTxns.length;
    newTxns.forEach(t => existingHashes.add(t.raw_hash));
    existing.push(...newTxns);

    console.log(`   ${filename}: ${newTxns.length} new, ${txns.length - newTxns.length} duplicate`);
  }

  // 4. Save
  fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(existing, null, 2));

  console.log(`\n✅ Sync complete!`);
  console.log(`   Added: ${totalAdded} transactions`);
  console.log(`   Skipped: ${totalDuped} duplicates`);
  console.log(`   Total: ${existing.length} transactions\n`);
}

main().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
