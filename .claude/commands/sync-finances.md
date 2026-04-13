# Sync Finances

Fetch the latest credit card transactions from Gmail and update the dashboard.

## Steps

1. Use the `fetch_statement_emails` tool from the `gmail-finance` MCP server to fetch all statement emails.

2. For each email returned, extract ALL transactions from the email body. Look for:
   - Date (any format: MM/DD, DD/MM/YY, DD MMM YYYY, etc.)
   - Merchant / Description
   - Amount
   - Whether it's a debit or credit

   For **HDFC emails**: currency is INR, card_id is `hdfc-1`
   For **Discover emails**: currency is USD, card_id is `discover-1`

3. Read the existing transactions from `public/data/transactions.json` (create empty array `[]` if file doesn't exist).

4. For each new transaction, generate:
   - `id`: a UUID (use crypto.randomUUID() logic — just make a unique string)
   - `card_id`: `hdfc-1` or `discover-1`
   - `date`: normalized to YYYY-MM-DD format
   - `description`: raw merchant text from email
   - `merchant_clean`: cleaned merchant name (remove store numbers, state codes, extra spaces)
   - `amount`: positive number
   - `transaction_type`: `"debit"` or `"credit"`
   - `category`: one of: food, shopping, travel, entertainment, utilities, health, finance, education, other
   - `subcategory`: `""`
   - `is_recurring`: `false`
   - `source_file`: email subject
   - `raw_hash`: SHA-256 of `date|description_lowercase|amount|card_id` — use this to skip duplicates
   - `manually_edited`: `false`
   - `created_at`: current ISO timestamp

5. Deduplicate: skip any transaction whose `raw_hash` already exists in `transactions.json`.

6. Write the merged array back to `public/data/transactions.json`.

7. Make sure `public/data/cards.json` exists. If not, create it with:
```json
[
  {"id":"discover-1","bank_name":"Discover","card_name":"Discover Card","last_four":"","currency":"USD","color":"#f97316","created_at":"2024-01-01T00:00:00.000Z"},
  {"id":"hdfc-1","bank_name":"HDFC","card_name":"HDFC Credit Card","last_four":"","currency":"INR","color":"#8b5cf6","created_at":"2024-01-01T00:00:00.000Z"}
]
```

8. Run `npm run build` in `/Users/apple/Downloads/finance-tracker` to build the static site.

9. Commit and push to GitHub:
```bash
cd /Users/apple/Downloads/finance-tracker
git add public/data/transactions.json public/data/cards.json
git commit -m "sync: update transactions $(date +%Y-%m-%d)"
git push
```

10. Report a summary: how many new transactions were added, how many were skipped, and what the top spending categories are.
