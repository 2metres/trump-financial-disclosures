// OGE 278e value category midpoints
export const VALUE_MIDPOINTS: Record<string, number> = {
  '1': 8_000,
  '2': 32_500,
  '3': 75_000,
  '4': 175_000,
  '5': 375_000,
  '6': 750_000,
  '7': 3_000_000,
  '8': 15_000_000,
  '9': 37_500_000,
  '10': 75_000_000,
}

// Generic financial instruments that create noise in the graph
// Broad-market fund families and products (blanket filter)
const BORING_FUND_FAMILIES: string[] = [
  'Vanguard',
  'Fidelity',
  'Schwab',
  'BlackRock',
  'T. Rowe',
  'Invesco',
  'Dodge & Cox',
]

// Broad-market index/bond patterns — these are generic, not sector bets
const BORING_BROAD_MARKET: string[] = [
  'S&P 500',
  'Total Stock Market',
  'Total Bond',
  'Total International',
  'Russell 2000',
  'MSCI EAFE',
  'MSCI Emerging',
  'Developed Markets',
  'Bond Fund',
  'Money Market',
  'Target Date',
  'Index Fund',
  'Dividend Appreciation',
  'Dividend Growth',
  'Dividend Equity',
  'Mid-Cap Index',
  'Small-Cap Index',
  'Growth Index',
  'Value Index',
  'International Index',
  'International Equity',
  'Government Money',
]

export const BORING_PATTERNS: string[] = [
  'IRA',
  'Roth',
  'U.S. Bank',
  'BROKERAGE',
  'Bank of America',
  'JPMorgan',
  'iShares',
  'SPDR',
  '401(k)',
  '401k',
  'Cash',
  'Savings',
  'Checking',
  'Treasury',
  'Municipal',
  'Thrift Savings',
  'Federal Employees',
  'TIAA',
  'Annuit',
  'CD ',
  'HSA',
  'MOHELA',
  'NelNet',
  'PENNYMAC',
  'Mr. Cooper',
  'SOFI',
  'aidvantage',
  'Wells Fargo',
  'Chase bank',
  'Chase',
  'family trust',
  'Family trust',
]

/**
 * Returns true for generic financial instruments that create noise.
 * Matches Python is_boring() logic exactly.
 */
function matchesAny(descLower: string, normalized: string, patterns: string[]): boolean {
  return patterns.some((b) => {
    const bl = b.toLowerCase()
    return descLower.includes(bl) || normalized.includes(bl)
  })
}

export function isBoring(desc: string): boolean {
  const trimmed = desc.trim()
  // Bare ticker symbol only (no company name) — too ambiguous to display
  if (/^[A-Z]{1,5}$/.test(trimmed)) {
    return true
  }
  if (/^[A-Z]{1,5}\s+[A-Z]{2}$/.test(trimmed)) {
    return true
  }

  const descLower = trimmed.toLowerCase()
  const normalized = descLower.replace(/[,.]/g, '').replace(/\s+/g, ' ')

  // Always boring: bank accounts, retirement, loans, etc.
  if (matchesAny(descLower, normalized, BORING_PATTERNS)) {
    return true
  }

  // Broad-market products are boring regardless of provider
  if (matchesAny(descLower, normalized, BORING_BROAD_MARKET)) {
    return true
  }

  // Fund family products are boring ONLY if they're broad-market (caught above)
  // or generic (no sector keyword). Sector ETFs like "Health Care Select Sector
  // SPDR Fund" pass through because they represent specific sector bets.
  // Fund families without a sector indicator are boring.
  if (matchesAny(descLower, normalized, BORING_FUND_FAMILIES)) {
    // Check if it's a sector-specific fund — let those through
    const sectorKeywords = [
      'health care', 'healthcare', 'energy', 'financ', 'technology', 'tech',
      'defense', 'aerospace', 'industrial', 'biotech', 'pharma', 'real estate',
      'reit', 'commodity', 'gold', 'silver', 'oil', 'natural gas', 'clean energy',
      'solar', 'uranium', 'cannabis', 'crypto', 'blockchain', 'cyber', 'ai ',
      'artificial intelligence', 'semiconductor', 'infrastructure',
    ]
    const isSector = sectorKeywords.some((k) => descLower.includes(k) || normalized.includes(k))
    if (!isSector) {
      return true
    }
  }

  return false
}

/**
 * Assign a category to an entity based on keyword matching.
 * Matches Python categorize() logic exactly.
 */
export function categorize(desc: string): string {
  // Normalize: lowercase, strip commas/periods so "Apple, Inc." matches "apple inc"
  const d = desc.toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ')

  // Political: campaigns, PACs, party orgs, inaugurals
  if (
    ['republican national', 'democrat', 'trump', 'inaugural', 'save america'].some((w) =>
      d.includes(w),
    )
  ) {
    return 'political'
  }
  if (/\bpac\b/.test(d) || d.includes('for president')) {
    return 'political'
  }

  // Policy: think tanks, advocacy institutes
  if (
    [
      'heritage foundation',
      'america first policy',
      'cornerstone institute',
      'conservative partnership',
      'center for renewing',
      'federalist society',
    ].some((w) => d.includes(w))
  ) {
    return 'policy'
  }

  // Crypto
  if (['bitcoin', 'ethereum', 'coinbase', 'crypto', 'solana', 'xrp'].some((w) => d.includes(w))) {
    return 'crypto'
  }

  // Government
  if (
    [
      'department of education',
      'commonwealth of virginia',
      'state of florida',
      'u.s. department',
    ].some((w) => d.includes(w))
  ) {
    return 'government'
  }

  // Real assets
  if (['gold coins', 'silver coins', 'real estate', '529 plan'].some((w) => d.includes(w))) {
    return 'real_assets'
  }

  // Defense/Aerospace
  if (
    [
      'raytheon',
      'rtx',
      'general dynamics',
      'northrop grumman',
      'lockheed martin',
      'boeing',
      'l3harris',
      'bae systems',
      'leidos',
      'huntington ingalls',
      'textron',
      'palantir',
    ].some((w) => d.includes(w))
  ) {
    return 'defense'
  }

  // Finance: banks, lenders, insurance, financial services
  if (
    [
      'goldman sachs',
      'morgan stanley',
      'american express',
      'citibank',
      'citigroup',
      'usaa',
      'mortgage',
      'pnc bank',
      'pnc financial',
      'truist',
      'northwestern mutual',
      'mastercard',
      'visa inc',
      'navy federal',
      'capital one',
      'citizens bank',
      'discover',
      'blackstone',
      'deloitte',
      'sallie mae',
      'edfinancial',
      's&p global',
      'berkshire hathaway',
      'u.s. bancorp',
      'intercontinental exchange',
      'progressive corp',
    ].some((w) => d.includes(w))
  ) {
    return 'finance'
  }

  // Pharma/Health
  if (
    [
      'merck',
      'medtronic',
      'johnson & johnson',
      'abbott lab',
      'stryker',
      'intuitive surgical',
      'eli lilly',
      'abbvie',
      'pfizer',
      'unitedhealth',
      'amgen',
      'thermo fisher',
      'danaher',
      'bristol-myers',
      'cigna',
      'cvs health',
      'zoetis',
    ].some((w) => d.includes(w))
  ) {
    return 'pharma'
  }

  // Tech
  if (
    [
      'microsoft',
      'apple inc',
      'amazon',
      'meta platforms',
      'oracle',
      'nvidia',
      'advanced micro',
      'broadcom',
      'qualcomm',
      'salesforce',
      'alphabet',
      'servicenow',
      'palo alto networks',
      'texas instruments',
      'uber',
      'paychex',
      'cisco systems',
      'ibm',
      'international business machines',
      'adobe',
      'intel',
      'intuit',
      'taiwan semiconductor',
      'applied materials',
      'micron technology',
      'crowdstrike',
      'accenture',
      'asml',
      'netflix',
    ].some((w) => d.includes(w))
  ) {
    return 'tech'
  }

  // Energy/Industrial
  if (
    [
      'exxon',
      'chevron',
      'ge aerospace',
      'ge vernova',
      'eaton corp',
      'eversource',
      'nextera',
      'duke energy',
      'linde',
      'union pacific',
      'johnson controls',
      'philip morris',
      'prologis',
      'caterpillar',
      'honeywell',
      'deere',
      'conocophillips',
      'southern company',
      'phillips 66',
      '3m co',
      'illinois tool works',
      'constellation energy',
      'kinder morgan',
      'freeport-mcmoran',
      'csx corp',
      'emerson electric',
      'altria group',
      'ford motor',
    ].some((w) => d.includes(w))
  ) {
    return 'energy'
  }

  // Telecom/Media
  if (
    [
      'at&t',
      'verizon',
      'fox corp',
      'comcast',
      't-mobile',
      'walt disney',
    ].some((w) => d.includes(w))
  ) {
    return 'telecom'
  }

  // Consumer
  if (
    [
      'walmart',
      'home depot',
      'procter & gamble',
      'pepsico',
      'tesla',
      'lowes',
      "lowe's",
      'costco',
      'coca-cola',
      "mcdonald's",
      'mcdonalds',
      'starbucks',
      'tjx',
      'target corp',
      'nike',
      'chipotle',
      'mondelez',
      'unilever',
    ].some((w) => d.includes(w))
  ) {
    return 'consumer'
  }

  return 'other'
}
