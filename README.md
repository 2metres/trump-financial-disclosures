# Follow the Money

Interactive visualization of financial disclosures filed by Trump administration appointees.

![screenshot](screenshot.png)

## What this is

Every presidential appointee must file a financial disclosure (OGE Form 278e or 278-T) listing their assets, income sources, and liabilities. This project takes 143,330 disclosure entries from 1,581 appointees across 62 federal agencies and makes them searchable and visible.

Two views:

- **Holdings Network** -- a bipartite force-directed graph linking appointees to their disclosed holdings, color-coded by sector (defense, fossil, crypto, finance, pharma, tech, etc.). Filter by category to isolate who holds what.
- **Wealth Map** -- a zoomable treemap showing the scale of disclosed wealth, grouped by agency and appointee, broken into 13 holding types: stocks, ETFs, savings, gold, real estate, crypto, political donations, private capital, bonds, insurance, liabilities, business holdings, and other.

All data loads and queries run client-side via DuckDB-WASM. No server, no API calls.

## Why it matters

Financial disclosures exist so the public can spot conflicts of interest. But raw filings are dense, scattered, and hard to cross-reference. This tool lets you see patterns at a glance: which agencies are staffed by people with fossil fuel portfolios, who holds defense stocks while overseeing defense policy, where crypto wealth concentrates in government.

## Tech stack

- **Svelte 5** + **Vite** + **TypeScript**
- **D3.js** -- force layout, treemap, scales, transitions
- **DuckDB-WASM** -- in-browser SQL over Parquet files
- **Tailwind CSS v4**

## Getting started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Data source

Disclosure data from [ProPublica's Trump Town](https://projects.propublica.org/trump-town/) project, which collects and publishes OGE Forms 278e and 278-T filed by executive branch appointees.

## License

MIT
