export type HoldingType = 'stocks' | 'etfs' | 'savings' | 'gold' | 'real_estate' | 'crypto' | 'political' | 'private_capital' | 'bonds' | 'insurance' | 'business' | 'other'

/**
 * Classify a disclosure entry description into a holding type.
 * First match wins.
 */
export function classifyHolding(desc: string): HoldingType {
  const d = desc.toLowerCase()

  // Political: PACs, campaigns, party organizations
  // Note: bare "trump" excluded — it matches Trump's own business entities
  if (['pac', 'campaign', 'republican', 'democrat', 'inaugural', 'save america',
       'trump victory', 'trump for president', 'trump national committee',
       'for president', 'for congress', 'for senate'].some(w => d.includes(w))) {
    return 'political'
  }

  // ETFs and funds
  if (['etf', 'fund', 'spdr', 'ishares', 'vanguard', 'fidelity', 'index fund', 'invesco', 't. rowe', 'schwab', 'blackrock', 'dodge & cox'].some(w => d.includes(w))) {
    return 'etfs'
  }

  // Savings, bank accounts, retirement, fixed income
  if (['bank', 'savings', 'checking', 'cd ', 'money market', 'ira', 'roth', '401(k)', 'hsa', 'thrift savings', 'treasury', 'municipal', 'cash', 'annuit'].some(w => d.includes(w))) {
    return 'savings'
  }

  // Gold and precious metals
  if (['gold', 'silver', 'coins', 'precious', 'bullion'].some(w => d.includes(w))) {
    return 'gold'
  }

  // Real estate
  if (['real estate', 'property', 'rental', 'land', '529 plan'].some(w => d.includes(w))) {
    return 'real_estate'
  }

  // Cryptocurrencies
  if (['bitcoin', 'ethereum', 'crypto', 'blockchain', 'solana', 'xrp', 'nft',
       'digital asset', 'virtual currency', 'cold wallet', 'token'].some(w => d.includes(w))) {
    return 'crypto'
  }

  // Private capital: PE funds, venture capital, LP interests, fund-of-funds
  if ([' lp', ' l.p.', 'venture', 'capital partner', 'private equity', 'private investor',
       'growth fund', 'buyout', 'mezzanine', 'co-invest', 'coinvest',
       'opportunities fund', 'strategic partners'].some(w => d.includes(w))) {
    return 'private_capital'
  }

  // Bonds, debt, credit instruments
  if (['bond', ' debt', 'credit fund', 'credit partner', 'senior credit', 'fixed income',
       ' note', 'debenture', 'convertible'].some(w => d.includes(w))) {
    return 'bonds'
  }

  // Insurance products
  if (['insurance', 'life policy', 'whole life', 'term life', 'universal life'].some(w => d.includes(w))) {
    return 'insurance'
  }

  // Stocks: has ticker pattern like (AAPL), or known company names
  if (/\([a-z]{1,5}\)/.test(d)) {
    return 'stocks'
  }
  // Known company names from the categories in the codebase
  const stockKeywords = [
    'microsoft', 'apple inc', 'amazon', 'meta platforms', 'oracle', 'nvidia',
    'alphabet', 'tesla', 'walmart', 'home depot', 'procter & gamble',
    'goldman sachs', 'morgan stanley', 'exxon', 'chevron', 'pfizer',
    'johnson & johnson', 'unitedhealth', 'berkshire hathaway', 'visa inc',
    'mastercard', 'coca-cola', 'pepsico', 'costco', 'boeing', 'raytheon',
    'lockheed martin', 'general dynamics', 'northrop grumman', 'palantir',
    'broadcom', 'qualcomm', 'salesforce', 'adobe', 'intel', 'netflix',
    'at&t', 'verizon', 'comcast', 'disney', 'caterpillar', 'honeywell',
    'deere', '3m', 'union pacific', 'ford motor', 'starbucks', 'nike',
    'abbvie', 'eli lilly', 'amgen', 'merck', 'medtronic', 'cigna',
    'conocophillips', 'nextera', 'duke energy', 'southern company',
    'accenture', 'ibm', 'coinbase', 'uber', 'crowdstrike', 'servicenow',
    'blackstone', 'capital one', 'american express', 'citigroup',
    'progressive corp', 'target corp', 'lowes', "lowe's", 'chipotle',
    'mcdonalds', "mcdonald's", 'mondelez', 'fox corp', 't-mobile',
    'ge aerospace', 'eaton corp', 'prologis', 'emerson electric',
    'freeport-mcmoran', 'linde', 'phillips 66', 'kinder morgan',
    'altria group', 'philip morris', 'texas instruments', 'taiwan semiconductor',
    'applied materials', 'micron technology', 'asml', 'intuit', 'paychex',
    'cisco systems', 'palo alto networks', 'ge vernova', 'eversource',
    'constellation energy', 'thermo fisher', 'danaher', 'bristol-myers',
    'stryker', 'intuitive surgical', 'zoetis', 'cvs health', 'abbott lab',
    'l3harris', 'bae systems', 'leidos', 'huntington ingalls', 'textron',
    'illinois tool works', 'csx corp', 'johnson controls', 'tjx',
    'unilever', 'heritage foundation', 'deloitte', 'usaa',
  ]
  if (stockKeywords.some(w => d.includes(w))) {
    return 'stocks'
  }

  // Business holdings: companies/entities not matched as stocks
  if ([' inc', ' llc', 'l.l.c.', ' ltd', 'holdings', ' corp', ' ag ',
       'enterprises', 'partners llp', 'group llc', 'management llc',
       'member corp', 'managing member', 'trust', 'trustee'].some(w => d.includes(w))) {
    return 'business'
  }

  return 'other'
}

/** Tailwind-compatible hex colors for each holding type */
export const holdingTypeColors: Record<HoldingType, string> = {
  stocks: '#3b82f6',        // blue
  etfs: '#8b5cf6',          // violet
  savings: '#22c55e',       // green
  gold: '#eab308',          // gold/yellow
  real_estate: '#78716c',   // stone
  crypto: '#f97316',        // orange
  political: '#ef4444',     // red
  private_capital: '#a855f7', // purple
  bonds: '#06b6d4',         // cyan
  insurance: '#f59e0b',     // amber
  business: '#ec4899',      // pink
  other: '#737373',         // grey
}

/** Human-readable labels */
export const holdingTypeLabels: Record<HoldingType, string> = {
  stocks: 'Stocks',
  etfs: 'ETFs & Funds',
  savings: 'Savings & Fixed Income',
  gold: 'Gold & Precious Metals',
  real_estate: 'Real Estate',
  crypto: 'Cryptocurrency',
  political: 'Political Donations',
  private_capital: 'Private Capital',
  bonds: 'Bonds & Credit',
  insurance: 'Insurance',
  business: 'Business Holdings',
  other: 'Other',
}
