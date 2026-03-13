# Finance Dashboard (Cloudflare-ready)

This is a Cloudflare-ready React + Vite app based on your uploaded Claude prototype, rebuilt so it can actually be used as a proper app.

## What changed from the original

- `window.storage` was replaced with browser `localStorage`
- Anthropic calls were moved out of the browser and into a Cloudflare Worker API
- PWA support was added so you can install it on your phone
- The app was split into tabs/components instead of one huge JSX file
- A starting D1 schema was included for a future synced-data version

## Included tabs

- **Overview**: balances, upcoming costs, notes, snapshots, AI financial review
- **ETF Portfolio**: holdings, current prices, suggested next contribution split, AI portfolio review
- **Deemed Disposal**: 8-year trigger calendar and estimated liability planner

## Local setup

1. Install Node.js LTS
2. Open a terminal in this folder
3. Run:

```bash
npm install
npm run dev
```

Then open the local URL Vite gives you.

## Cloudflare deployment

### First-time login

```bash
npx wrangler login
```

### Add your Anthropic secret

This step is required if you want the AI analysis and screenshot import to work.

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste your Anthropic API key when prompted.

### Deploy

```bash
npm run deploy
```

That will build the React app and deploy the Worker + static assets to Cloudflare.

## Phone install

Once deployed:

- open the app URL on your phone
- in Safari, use **Share > Add to Home Screen**
- in Chrome on Android, use **Add to Home screen**

It will then open like an app.

## Suggested next upgrades

1. Move localStorage data into Cloudflare D1 so desktop and phone stay synced
2. Add a proper cashflow calendar with recurring items
3. Add manual ETF transaction entry instead of only seeded historical data
4. Add reminders for tax, NCT, insurance, birthdays, and annual bills
5. Add authentication if you want the app to be private across devices

## Notes

- The deemed disposal tab is a planning aid, not tax advice or filing software.
- The screenshot import depends on Anthropic vision extraction, so it will never be perfect.
- Current holdings still start from your seeded transaction history from the uploaded JSX file.
