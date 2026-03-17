import type { DuckDB } from './types'
import { VALUE_MIDPOINTS } from './categories'
import { classifyHolding, type HoldingType } from './holding-types'

export interface WealthHolding {
  name: string
  value: number
  type: HoldingType
}

export interface WealthTypeGroup {
  name: string
  type: HoldingType
  children: WealthHolding[]
  value?: number
}

export interface WealthAppointee {
  name: string
  agency: string
  children: WealthTypeGroup[]
  value?: number
}

export interface WealthAgency {
  name: string
  children: WealthAppointee[]
}

export interface WealthHierarchy {
  name: string
  children: WealthAgency[]
}

interface RawRow {
  slug: string
  appointee_name: string
  agency: string
  description: string
  value_category_id: string | null
  net_worth_low: number | null
}

export async function queryWealthData(db: DuckDB): Promise<WealthHierarchy> {
  const sql = `
    SELECT
      a.slug,
      a.name AS appointee_name,
      COALESCE(a.agency, 'Unknown') AS agency,
      e.description,
      e.value_category_id,
      a.net_worth_low
    FROM appointees a
    JOIN disclosure_entries e ON a.slug = e.slug
    WHERE e.description IS NOT NULL AND e.description != ''
    ORDER BY a.net_worth_low DESC NULLS LAST
  `
  const rows = await db.query<RawRow>(sql)

  // Group by appointee, then by holding type
  // For each appointee, deduplicate holdings by description, sum values
  const appointeeMap = new Map<string, {
    name: string
    agency: string
    net_worth_low: number
    holdings: Map<string, { desc: string; value: number; type: HoldingType }>
  }>()

  for (const row of rows) {
    if (!appointeeMap.has(row.slug)) {
      appointeeMap.set(row.slug, {
        name: row.appointee_name,
        agency: row.agency,
        net_worth_low: row.net_worth_low ?? 0,
        holdings: new Map(),
      })
    }
    const appt = appointeeMap.get(row.slug)!
    const desc = row.description.trim()
    const val = VALUE_MIDPOINTS[row.value_category_id ?? ''] ?? 0
    const holdingType = classifyHolding(desc)

    // For political entries with no value, assign minimum $1,000
    const effectiveVal = (holdingType === 'political' && val === 0) ? 1000 : val

    if (appt.holdings.has(desc)) {
      appt.holdings.get(desc)!.value += effectiveVal
    } else {
      appt.holdings.set(desc, { desc, value: effectiveVal, type: holdingType })
    }
  }

  // Sort appointees by net worth, take top 200
  const sortedAppointees = [...appointeeMap.entries()]
    .sort((a, b) => b[1].net_worth_low - a[1].net_worth_low)
    .slice(0, 200)

  // Build appointee nodes
  const appointeeNodes: WealthAppointee[] = sortedAppointees.map(([_slug, appt]) => {
    const typeGroups = new Map<HoldingType, WealthHolding[]>()
    for (const h of appt.holdings.values()) {
      if (h.value <= 0) continue
      if (!typeGroups.has(h.type)) typeGroups.set(h.type, [])
      typeGroups.get(h.type)!.push({ name: h.desc, value: h.value, type: h.type })
    }

    const groupChildren: WealthTypeGroup[] = [...typeGroups.entries()].map(([type, holdings]) => ({
      name: type,
      type,
      children: holdings.sort((a, b) => b.value - a.value),
    }))

    return {
      name: appt.name,
      agency: appt.agency,
      children: groupChildren.sort((a, b) => {
        const aSum = a.children.reduce((s, c) => s + c.value, 0)
        const bSum = b.children.reduce((s, c) => s + c.value, 0)
        return bSum - aSum
      }),
    }
  })

  // Group by agency
  const agencyMap = new Map<string, WealthAppointee[]>()
  for (const appt of appointeeNodes) {
    const agency = appt.agency
    if (!agencyMap.has(agency)) agencyMap.set(agency, [])
    agencyMap.get(agency)!.push(appt)
  }

  const agencyNodes: WealthAgency[] = [...agencyMap.entries()]
    .map(([name, appointees]) => ({ name, children: appointees }))
    .sort((a, b) => {
      const aVal = a.children.reduce((s, c) => s + c.children.reduce((s2, g) => s2 + g.children.reduce((s3, h) => s3 + h.value, 0), 0), 0)
      const bVal = b.children.reduce((s, c) => s + c.children.reduce((s2, g) => s2 + g.children.reduce((s3, h) => s3 + h.value, 0), 0), 0)
      return bVal - aVal
    })

  return { name: 'All Agencies', children: agencyNodes }
}
