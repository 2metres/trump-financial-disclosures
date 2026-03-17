/**
 * Fetch market capitalization data for known public companies in the disclosure data.
 *
 * Usage: bun run scripts/fetch-market-caps.ts
 * Output: public/data/market-caps.json
 *
 * Uses Yahoo Finance v7 quote API with cookie+crumb authentication.
 * Entities that aren't public stocks (PACs, trusts, private cos) are skipped.
 */

// Mapping from normalized entity name fragments (lowercase) to Yahoo Finance tickers.
// Covers companies referenced in src/lib/db/categories.ts plus common large-cap holdings.
const NAME_TO_TICKER: Record<string, string> = {
  // Tech
  'microsoft': 'MSFT',
  'apple inc': 'AAPL',
  'amazon': 'AMZN',
  'meta platforms': 'META',
  'alphabet': 'GOOGL',
  'oracle': 'ORCL',
  'nvidia': 'NVDA',
  'advanced micro': 'AMD',
  'broadcom': 'AVGO',
  'qualcomm': 'QCOM',
  'salesforce': 'CRM',
  'servicenow': 'NOW',
  'palo alto networks': 'PANW',
  'texas instruments': 'TXN',
  'uber': 'UBER',
  'paychex': 'PAYX',
  'cisco systems': 'CSCO',
  'international business machines': 'IBM',
  'adobe': 'ADBE',
  'intel': 'INTC',
  'intuit': 'INTU',
  'taiwan semiconductor': 'TSM',
  'applied materials': 'AMAT',
  'micron technology': 'MU',
  'crowdstrike': 'CRWD',
  'accenture': 'ACN',
  'asml': 'ASML',
  'netflix': 'NFLX',
  'ibm': 'IBM',

  // Finance
  'goldman sachs': 'GS',
  'morgan stanley': 'MS',
  'american express': 'AXP',
  'citigroup': 'C',
  'citibank': 'C',
  'mastercard': 'MA',
  'visa inc': 'V',
  'capital one': 'COF',
  'blackstone': 'BX',
  's&p global': 'SPGI',
  'berkshire hathaway': 'BRK-B',
  'u.s. bancorp': 'USB',
  'us bancorp': 'USB',
  'intercontinental exchange': 'ICE',
  'progressive corp': 'PGR',
  'pnc financial': 'PNC',
  'pnc bank': 'PNC',
  'truist': 'TFC',
  'discover': 'DFS',

  // Pharma/Health
  'merck': 'MRK',
  'medtronic': 'MDT',
  'johnson & johnson': 'JNJ',
  'abbott lab': 'ABT',
  'stryker': 'SYK',
  'intuitive surgical': 'ISRG',
  'eli lilly': 'LLY',
  'abbvie': 'ABBV',
  'pfizer': 'PFE',
  'unitedhealth': 'UNH',
  'amgen': 'AMGN',
  'thermo fisher': 'TMO',
  'danaher': 'DHR',
  'bristol-myers': 'BMY',
  'cigna': 'CI',
  'cvs health': 'CVS',
  'zoetis': 'ZTS',

  // Defense
  'raytheon': 'RTX',
  'rtx': 'RTX',
  'general dynamics': 'GD',
  'northrop grumman': 'NOC',
  'lockheed martin': 'LMT',
  'boeing': 'BA',
  'l3harris': 'LHX',
  'bae systems': 'BAESY',
  'leidos': 'LDOS',
  'huntington ingalls': 'HII',
  'textron': 'TXT',
  'palantir': 'PLTR',

  // Energy/Industrial
  'exxon': 'XOM',
  'chevron': 'CVX',
  'ge aerospace': 'GE',
  'ge vernova': 'GEV',
  'eaton corp': 'ETN',
  'nextera': 'NEE',
  'duke energy': 'DUK',
  'linde': 'LIN',
  'union pacific': 'UNP',
  'johnson controls': 'JCI',
  'philip morris': 'PM',
  'prologis': 'PLD',
  'caterpillar': 'CAT',
  'honeywell': 'HON',
  'deere': 'DE',
  'conocophillips': 'COP',
  'southern company': 'SO',
  'phillips 66': 'PSX',
  '3m co': 'MMM',
  'illinois tool works': 'ITW',
  'constellation energy': 'CEG',
  'kinder morgan': 'KMI',
  'freeport-mcmoran': 'FCX',
  'csx corp': 'CSX',
  'emerson electric': 'EMR',
  'altria group': 'MO',
  'ford motor': 'F',
  'eversource': 'ES',

  // Telecom/Media
  'at&t': 'T',
  'verizon': 'VZ',
  'fox corp': 'FOXA',
  'comcast': 'CMCSA',
  't-mobile': 'TMUS',
  'walt disney': 'DIS',

  // Consumer
  'walmart': 'WMT',
  'home depot': 'HD',
  'procter & gamble': 'PG',
  'pepsico': 'PEP',
  'tesla': 'TSLA',
  "lowe's": 'LOW',
  'lowes': 'LOW',
  'costco': 'COST',
  'coca-cola': 'KO',
  "mcdonald's": 'MCD',
  'mcdonalds': 'MCD',
  'starbucks': 'SBUX',
  'tjx': 'TJX',
  'target corp': 'TGT',
  'nike': 'NKE',
  'chipotle': 'CMG',
  'mondelez': 'MDLZ',
  'unilever': 'UL',

  // Crypto-adjacent
  'coinbase': 'COIN',

  // Banks (may be filtered as boring but included for completeness)
  'jpmorgan': 'JPM',
  'wells fargo': 'WFC',
  'bank of america': 'BAC',
}

interface YahooAuth {
  cookie: string
  crumb: string
}

async function getYahooAuth(): Promise<YahooAuth> {
  // Step 1: get a cookie from Yahoo
  const cookieResp = await fetch('https://fc.yahoo.com', {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  })
  const setCookie = cookieResp.headers.get('set-cookie')
  if (!setCookie) throw new Error('Failed to get Yahoo cookie')
  const cookie = setCookie.split(';')[0]

  // Step 2: get a crumb using that cookie
  const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Cookie: cookie,
    },
  })
  if (!crumbResp.ok) throw new Error(`Failed to get crumb: ${crumbResp.status}`)
  const crumb = await crumbResp.text()

  return { cookie, crumb }
}

interface QuoteResult {
  symbol: string
  shortName?: string
  longName?: string
  marketCap?: number
}

async function fetchQuoteBatch(
  tickers: string[],
  auth: YahooAuth,
): Promise<QuoteResult[]> {
  const symbols = tickers.join(',')
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(auth.crumb)}`

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Cookie: auth.cookie,
    },
  })

  if (!resp.ok) {
    console.warn(`  Batch request failed: ${resp.status}`)
    return []
  }

  const data = (await resp.json()) as any
  return (data.quoteResponse?.result ?? []) as QuoteResult[]
}

interface MarketCapEntry {
  ticker: string
  market_cap: number
  name: string
  fetched_at: string
}

type MarketCapData = Record<string, MarketCapEntry>

async function main() {
  console.log('Authenticating with Yahoo Finance...')
  const auth = await getYahooAuth()
  console.log('Got auth cookie + crumb')

  // Collect unique tickers
  const tickers = [...new Set(Object.values(NAME_TO_TICKER))]
  console.log(`Fetching market caps for ${tickers.length} tickers...\n`)

  const results: MarketCapData = {}

  // Yahoo v7 quote supports batching up to ~20 symbols at a time
  const BATCH_SIZE = 15
  const DELAY_MS = 300

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE)
    const quotes = await fetchQuoteBatch(batch, auth)

    for (const q of quotes) {
      if (q.marketCap && q.marketCap > 0) {
        results[q.symbol] = {
          ticker: q.symbol,
          market_cap: q.marketCap,
          name: q.shortName || q.longName || q.symbol,
          fetched_at: new Date().toISOString(),
        }
        console.log(`  ${q.symbol}: $${(q.marketCap / 1e9).toFixed(1)}B (${q.shortName || q.longName})`)
      } else {
        console.log(`  ${q.symbol}: SKIPPED (no market cap)`)
      }
    }

    // Log any tickers that weren't in the response
    const returnedSymbols = new Set(quotes.map((q) => q.symbol))
    for (const t of batch) {
      if (!returnedSymbols.has(t)) {
        console.log(`  ${t}: SKIPPED (not found)`)
      }
    }

    if (i + BATCH_SIZE < tickers.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  // Build name-to-ticker index (only for tickers we got data for)
  const nameIndex: Record<string, string> = {}
  for (const [fragment, ticker] of Object.entries(NAME_TO_TICKER)) {
    if (results[ticker]) {
      nameIndex[fragment] = ticker
    }
  }

  const output = {
    _generated: new Date().toISOString(),
    _description: 'Market cap data for entity nodes. tickers keyed by symbol, nameIndex maps entity name fragments to tickers.',
    tickers: results,
    nameIndex,
  }

  const outPath = new URL('../public/data/market-caps.json', import.meta.url).pathname
  await Bun.write(outPath, JSON.stringify(output, null, 2))

  console.log(`\nWrote ${Object.keys(results).length} market caps to ${outPath}`)
}

main().catch(console.error)
