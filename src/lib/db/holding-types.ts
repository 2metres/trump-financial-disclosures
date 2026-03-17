/** Matcher: substring match, regex, or a list of substrings */
type Matcher = string | RegExp | string[]

interface CategoryDef {
  label: string
  color: string
  matchers: Matcher[]
}

/**
 * Ordered category definitions. First match wins.
 * Each category has matchers: plain strings do .includes(), RegExps do .test().
 * An array matcher means "any of these substrings".
 */
const categories = {
  political: {
    label: 'Political Donations',
    color: '#ef4444',
    matchers: [
      ['pac', 'campaign', 'republican', 'democrat', 'inaugural', 'save america',
       'trump victory', 'trump for president', 'trump national committee',
       'for president', 'for congress', 'for senate', 'for governor',
       'america first policy', 'center for renewing america',
       'american cornerstone institute', 'maha action', 'rnc', 'team kennedy',
       'transition'],
    ],
  },
  etfs: {
    label: 'ETFs & Funds',
    color: '#8b5cf6',
    matchers: [
      // word-boundary "etf" to avoid matching "netflix"
      /\betf\b/,
      ['fund', 'spdr', 'ishares', 'vanguard', 'fidelity', 'invesco',
       't. rowe', 'schwab', 'blackrock', 'dodge & cox',
       'putnam large cap', 'portfolio 20'],
    ],
  },
  savings: {
    label: 'Savings & Fixed Income',
    color: '#22c55e',
    matchers: [
      ['bank', 'savings', 'checking', 'cd ', 'money market', 'ira', 'roth',
       '401(k)', '401k', '403b', '403(b)', 'hsa', 'thrift savings',
       'treasury', 'municipal', 'cash', 'annuit',
       'brokerage', 'pension', 'deferred comp', 'defined benefit',
       'retirement system', 'tiaa',
       // banks without "bank" in name
       'wells fargo', 'chase', 'jp morgan', 'jpmorgan', 'merrill lynch',
       'truist', 'credit union', 'navy federal'],
    ],
  },
  gold: {
    label: 'Gold & Precious Metals',
    color: '#eab308',
    matchers: [
      // word-boundary "gold" to avoid matching "goldman"
      /\bgold\b/,
      ['silver', 'coins', 'precious', 'bullion'],
    ],
  },
  real_estate: {
    label: 'Real Estate',
    color: '#78716c',
    matchers: [
      ['real estate', 'property', 'rental', 'land', '529 plan'],
    ],
  },
  crypto: {
    label: 'Cryptocurrency',
    color: '#f97316',
    matchers: [
      ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'solana', 'xrp', 'nft',
       'digital asset', 'virtual currency', 'cold wallet', 'token'],
    ],
  },
  private_capital: {
    label: 'Private Capital',
    color: '#a855f7',
    matchers: [
      [' lp', ' l.p.', 'venture', 'capital partner', 'private equity',
       'private investor', 'growth fund', 'buyout', 'mezzanine',
       'co-invest', 'coinvest', 'opportunities fund', 'strategic partners',
       'receivable', 'management fee'],
    ],
  },
  bonds: {
    label: 'Bonds & Credit',
    color: '#06b6d4',
    matchers: [
      ['bond', ' debt', 'credit fund', 'credit partner', 'senior credit',
       'fixed income', ' note', 'debenture', 'convertible'],
    ],
  },
  insurance: {
    label: 'Insurance',
    color: '#f59e0b',
    matchers: [
      ['insurance', 'life policy', 'whole life', 'term life', 'universal life'],
    ],
  },
  liabilities: {
    label: 'Loans & Liabilities',
    color: '#dc2626',
    matchers: [
      ['mortgage', 'mohela', 'nelnet', 'sallie mae', 'aidvantage',
       'edfinancial', 'sofi', 'best egg', 'upstart', 'mr. cooper',
       'pennymac', 'penny mac', 'freedom mortgage', 'rocket mortgage',
       'united wholesale', 'student loan',
       'department of education'],
    ],
  },
  stocks: {
    label: 'Stocks',
    color: '#3b82f6',
    matchers: [
      // ticker pattern like (AAPL)
      /\([a-z]{1,5}\)/,
      // known company names
      ['microsoft', 'apple inc', 'amazon', 'meta platforms', 'oracle', 'nvidia',
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
       // previously missing
       'general motors', 'kroger', 'dollar general', 'anduril', 'ginkgo bioworks',
       'liberty energy', 'invenergy', 'booz allen'],
    ],
  },
  business: {
    label: 'Business Holdings',
    color: '#ec4899',
    matchers: [
      [' inc', ' llc', 'l.l.c.', ' ltd', 'holdings', ' corp', ' ag ',
       'enterprises', ' llp', 'group llc', 'management llc',
       'member corp', 'managing member', 'trust', 'trustee'],
    ],
  },
  other: {
    label: 'Other',
    color: '#737373',
    matchers: [],
  },
} as const satisfies Record<string, CategoryDef>

export type HoldingType = keyof typeof categories

/** Test a single matcher against a lowercased description */
function matchOne(d: string, m: Matcher): boolean {
  if (typeof m === 'string') return d.includes(m)
  if (m instanceof RegExp) return m.test(d)
  return m.some(s => d.includes(s))
}

/**
 * Classify a disclosure entry description into a holding type.
 * First match wins — category order matters.
 */
export function classifyHolding(desc: string): HoldingType {
  const d = desc.toLowerCase()
  for (const [type, def] of Object.entries(categories)) {
    if (def.matchers.length === 0) continue
    if (def.matchers.some(m => matchOne(d, m))) {
      return type as HoldingType
    }
  }
  return 'other'
}

/** Tailwind-compatible hex colors for each holding type */
export const holdingTypeColors: Record<HoldingType, string> =
  Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.color])) as Record<HoldingType, string>

/** Human-readable labels */
export const holdingTypeLabels: Record<HoldingType, string> =
  Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.label])) as Record<HoldingType, string>
