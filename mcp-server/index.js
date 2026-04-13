#!/usr/bin/env node
/**
 * Finance Tracker - Gmail Read-Only MCP Server
 *
 * SCOPE: gmail.readonly ONLY — cannot send, delete, or modify anything.
 *
 * Tools:
 * - fetch_statement_emails: Returns transaction email bodies from HDFC and Discover
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const TOKEN_PATH       = path.join(__dirname, '..', 'token.json');

// ── Auth ───────────────────────────────────────────────────────────────────
function getAuth() {
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret } = raw.installed || raw.web;
  const auth = new OAuth2Client(client_id, client_secret, 'http://localhost:3000/oauth2callback');
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8')));
  return auth;
}

// ── Decode email body ──────────────────────────────────────────────────────
function decodeBody(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractText(payload) {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  // Multipart — prefer text/plain, fallback to text/html
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    const html  = payload.parts.find(p => p.mimeType === 'text/html');
    const part  = plain || html;
    if (part?.body?.data) return decodeBody(part.body.data);

    // Nested multipart
    for (const p of payload.parts) {
      const text = extractText(p);
      if (text) return text;
    }
  }

  return '';
}

// ── Fetch emails ───────────────────────────────────────────────────────────
async function fetchStatementEmails(auth, maxEmails, afterDate, beforeDate) {
  const gmail = google.gmail({ version: 'v1', auth });

  const baseQuery = [
    'from:discover',
    'from:hdfc',
    'subject:"credit card statement"',
    'subject:"e-statement"',
    'subject:"monthly statement"',
    'subject:"account statement"',
  ].join(' OR ');

  // Gmail date filter: after:YYYY/MM/DD before:YYYY/MM/DD
  const dateParts = [];
  if (afterDate)  dateParts.push(`after:${afterDate.replace(/-/g, '/')}`);
  if (beforeDate) dateParts.push(`before:${beforeDate.replace(/-/g, '/')}`);
  const query = dateParts.length
    ? `(${baseQuery}) ${dateParts.join(' ')}`
    : baseQuery;

  // Paginate — Gmail API maxResults is capped at 500 per page
  const PAGE_SIZE = 500;
  const messages = [];
  let pageToken = undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(PAGE_SIZE, maxEmails - messages.length),
      ...(pageToken ? { pageToken } : {}),
    });
    const batch = listRes.data.messages || [];
    messages.push(...batch);
    pageToken = listRes.data.nextPageToken;
  } while (pageToken && messages.length < maxEmails);

  const results = [];

  for (const msg of messages.slice(0, maxEmails)) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const headers = full.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from    = headers.find(h => h.name === 'From')?.value || '';
    const date    = headers.find(h => h.name === 'Date')?.value || '';
    const body    = extractText(full.data.payload);

    if (body.trim()) {
      results.push({ subject, from, date, body });
    }
  }

  return results;
}

// ── MCP Server ─────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'finance-tracker-gmail', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fetch_statement_emails',
      description: 'Fetches credit card statement emails from Gmail for HDFC and Discover. Returns email subject, sender, date, and full text body. READ-ONLY.',
      inputSchema: {
        type: 'object',
        properties: {
          max_emails: {
            type: 'number',
            description: 'Max emails to fetch (default: 20)',
            default: 20,
          },
          after_date: {
            type: 'string',
            description: 'Fetch emails after this date (YYYY-MM-DD). Uses Gmail after: filter.',
          },
          before_date: {
            type: 'string',
            description: 'Fetch emails before this date (YYYY-MM-DD). Uses Gmail before: filter.',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'fetch_statement_emails') {
    const auth = getAuth();
    const max        = request.params.arguments?.max_emails  || 20;
    const afterDate  = request.params.arguments?.after_date  || null;
    const beforeDate = request.params.arguments?.before_date || null;
    const emails = await fetchStatementEmails(auth, max, afterDate, beforeDate);
    return {
      content: [{ type: 'text', text: JSON.stringify(emails, null, 2) }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
