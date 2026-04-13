#!/usr/bin/env node
/**
 * One-time Gmail authorization script.
 * Run this once to get a token. After that, the MCP server uses it automatically.
 */

import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');

// READONLY scope only
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
const { client_id, client_secret } = raw.installed || raw.web;
const auth = new OAuth2Client(client_id, client_secret, 'http://localhost:3000/oauth2callback');

const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n🔐 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for you to approve...\n');

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    const code = url.searchParams.get('code');
    if (code) {
      res.end('<h2>✅ Authorized! You can close this tab and return to the terminal.</h2>');
      server.close();
      resolve(code);
    }
  });
  server.listen(3000);
  server.on('error', reject);
});

const { tokens } = await auth.getToken(code);
fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
console.log('✅ token.json saved! You are all set.\n');
