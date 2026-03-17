import type { DuckDB, BipartiteData, GraphNode, GraphLink, FilterState } from './types'
import { VALUE_MIDPOINTS, isBoring, categorize } from './categories'

interface AppointeeRow {
  slug: string
  name: string
  title: string | null
  agency: string | null
  net_worth_low: number | null
}

interface EntryRow {
  slug: string
  description: string
  value_category_id: string | null
}

/**
 * Normalize an entity name for deduplication.
 * Matches Python normalize_name() logic exactly:
 *   - strip ticker suffixes like (AAPL) or (mrk)
 *   - collapse whitespace
 *   - lowercase, strip trailing commas/periods
 *   - replace &amp; with &, remove commas and periods
 */
function normalizeName(desc: string): string {
  let n = desc.trim()
  // Strip ticker suffix like (AAPL) or (mrk)
  n = n.replace(/\s*\([a-zA-Z]{1,5}\)\s*$/, '')
  // Collapse whitespace
  n = n.replace(/\s+/g, ' ')
  n = n.toLowerCase().trim()
  // Strip trailing commas/periods
  n = n.replace(/,+$/, '').replace(/\.+$/, '')
  // Normalize common variants
  n = n.replace(/&amp;/g, '&').replace(/,/g, '').replace(/\./g, '')
  return n
}

/**
 * Choose the "best" display name between two candidates.
 * Prefers: longer name, or capitalized over lowercase (matching Python logic).
 */
function bestName(current: string, candidate: string): string {
  if (candidate.length > current.length) return candidate
  if (candidate.length === current.length && candidate[0]?.toUpperCase() === candidate[0] && current[0]?.toLowerCase() === current[0]) {
    return candidate
  }
  return current
}

/**
 * Build a bipartite graph of appointees ↔ shared entities from DuckDB.
 *
 * Replicates the Python export_graph_data.py bipartite section:
 *   1. Query disclosure entries and appointees (with optional filter pushdown)
 *   2. Build entity→slugs mapping in TS, apply boring filter
 *   3. Keep entities shared by 3+ appointees
 *   4. Normalize and deduplicate entity names
 *   5. Categorize entities
 *   6. Take top 100 by appointee count
 *   7. Return BipartiteData
 */
export async function queryBipartiteData(
  db: DuckDB,
  filters?: FilterState,
): Promise<BipartiteData> {
  // --- Build appointee query with optional filter pushdown ---
  const appointeeConditions: string[] = []
  const appointeeParams: unknown[] = []

  if (filters?.agencies && filters.agencies.length > 0) {
    const placeholders = filters.agencies.map((_, i) => `$${appointeeParams.length + i + 1}`).join(', ')
    appointeeConditions.push(`agency IN (${placeholders})`)
    appointeeParams.push(...filters.agencies)
  }

  if (filters?.dateRange) {
    const [dateFrom, dateTo] = filters.dateRange
    if (dateFrom) {
      appointeeParams.push(dateFrom.toISOString().slice(0, 10))
      appointeeConditions.push(`date_of_appointment >= $${appointeeParams.length}`)
    }
    if (dateTo) {
      appointeeParams.push(dateTo.toISOString().slice(0, 10))
      appointeeConditions.push(`date_of_appointment <= $${appointeeParams.length}`)
    }
  }

  if (filters?.search) {
    appointeeParams.push(`%${filters.search}%`)
    appointeeConditions.push(`name ILIKE $${appointeeParams.length}`)
  }

  const appointeeWhere =
    appointeeConditions.length > 0 ? `WHERE ${appointeeConditions.join(' AND ')}` : ''

  const appointeeSql = `
    SELECT slug, name, title, agency, net_worth_low
    FROM appointees
    ${appointeeWhere}
    ORDER BY net_worth_low DESC NULLS LAST
  `

  const appointeeRows = await db.query<AppointeeRow>(appointeeSql, appointeeParams)
  const appointeeBySlug = new Map(appointeeRows.map((a) => [a.slug, a]))
  const allowedSlugs = new Set(appointeeRows.map((a) => a.slug))

  // --- Query disclosure entries ---
  // Only fetch entries for the filtered set of appointees (if any filter applied)
  let entrySql: string
  let entryParams: unknown[] = []

  if (allowedSlugs.size > 0 && appointeeConditions.length > 0) {
    // Build a values list for the IN clause
    const slugPlaceholders = [...allowedSlugs]
      .map((_, i) => `$${i + 1}`)
      .join(', ')
    entryParams = [...allowedSlugs]
    entrySql = `
      SELECT slug, description, value_category_id
      FROM disclosure_entries
      WHERE description IS NOT NULL
        AND description != ''
        AND slug IN (${slugPlaceholders})
    `
  } else {
    entrySql = `
      SELECT slug, description, value_category_id
      FROM disclosure_entries
      WHERE description IS NOT NULL
        AND description != ''
    `
  }

  const entryRows = await db.query<EntryRow>(entrySql, entryParams.length > 0 ? entryParams : undefined)

  // --- Build entity→slugs mapping and per-holding values ---
  // entity_to_slugs: raw description → Set of slugs
  // holding_value: (slug, description) → total value
  const entityToSlugs = new Map<string, Set<string>>()
  const holdingValue = new Map<string, number>() // key: `${slug}\0${desc}`
  const entityTotalValue = new Map<string, number>()

  for (const { slug, description, value_category_id } of entryRows) {
    const desc = description.trim()
    if (!desc) continue

    if (!entityToSlugs.has(desc)) {
      entityToSlugs.set(desc, new Set())
    }
    entityToSlugs.get(desc)!.add(slug)

    const val = VALUE_MIDPOINTS[value_category_id ?? ''] ?? 0
    const hvKey = `${slug}\0${desc}`
    holdingValue.set(hvKey, (holdingValue.get(hvKey) ?? 0) + val)
    entityTotalValue.set(desc, (entityTotalValue.get(desc) ?? 0) + val)
  }

  // --- Filter: non-boring entities shared by 3+ appointees ---
  const interestingEntities = new Map<string, Set<string>>()
  for (const [desc, slugs] of entityToSlugs) {
    if (!isBoring(desc) && slugs.size >= 3) {
      interestingEntities.set(desc, slugs)
    }
  }

  // --- Normalize and deduplicate entity names ---
  // norm → { bestName, mergedSlugs, totalValue, originalDescs }
  interface NormGroup {
    bestName: string
    slugs: Set<string>
    totalValue: number
    origDescs: string[]
  }
  const normGroups = new Map<string, NormGroup>()

  for (const [entity, slugs] of interestingEntities) {
    const norm = normalizeName(entity)
    const val = entityTotalValue.get(entity) ?? 0

    if (normGroups.has(norm)) {
      const group = normGroups.get(norm)!
      for (const s of slugs) group.slugs.add(s)
      group.totalValue += val
      group.origDescs.push(entity)
      group.bestName = bestName(group.bestName, entity)
    } else {
      normGroups.set(norm, {
        bestName: entity,
        slugs: new Set(slugs),
        totalValue: val,
        origDescs: [entity],
      })
    }
  }

  // --- Categorize and apply post-dedup filters ---
  // Build deduped entity list: { name, slugs, totalValue, origDescs, category }
  interface DedupdEntity {
    name: string
    slugs: Set<string>
    totalValue: number
    origDescs: string[]
    category: string
  }

  let deduped: DedupdEntity[] = []
  for (const group of normGroups.values()) {
    const category = categorize(group.bestName)
    deduped.push({
      name: group.bestName,
      slugs: group.slugs,
      totalValue: group.totalValue,
      origDescs: group.origDescs,
      category,
    })
  }

  // Apply category filter (post-categorization)
  if (filters?.categories && filters.categories.length > 0) {
    const catSet = new Set(filters.categories)
    deduped = deduped.filter((e) => catSet.has(e.category))
  }

  // Apply value filters (post-dedup)
  if (filters?.valueMin != null) {
    deduped = deduped.filter((e) => e.totalValue >= filters.valueMin!)
  }
  if (filters?.valueMax != null) {
    deduped = deduped.filter((e) => e.totalValue <= filters.valueMax!)
  }

  // Apply search filter to entity names (in addition to appointee name filter above)
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase()
    deduped = deduped.filter((e) => e.name.toLowerCase().includes(searchLower))
  }

  // --- Top 100 by appointee count (matching Python: sort by -len(slugs)) ---
  deduped.sort((a, b) => b.slugs.size - a.slugs.size)
  const topEntities = deduped.slice(0, 100)

  // --- Collect involved appointee slugs ---
  const involvedSlugs = new Set<string>()
  for (const entity of topEntities) {
    for (const s of entity.slugs) {
      // Only include slugs that are in our (possibly filtered) appointee set
      if (allowedSlugs.size === 0 || allowedSlugs.has(s)) {
        involvedSlugs.add(s)
      }
    }
  }

  // --- Build nodes and links ---
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  // Appointee nodes (in original appointee order, filtered to involved)
  for (const appt of appointeeRows) {
    if (involvedSlugs.has(appt.slug)) {
      nodes.push({
        id: appt.slug,
        type: 'appointee',
        name: appt.name,
        agency: appt.agency ?? undefined,
        title: appt.title ?? undefined,
        net_worth_low: appt.net_worth_low ?? undefined,
      })
    }
  }

  // Entity nodes and links
  for (const entity of topEntities) {
    const eid = `e:${entity.name}`
    nodes.push({
      id: eid,
      type: 'entity',
      name: entity.name,
      count: entity.slugs.size,
      total_value: entity.totalValue,
      category: entity.category,
    })

    for (const slug of entity.slugs) {
      if (involvedSlugs.has(slug)) {
        // Sum holding value across all original description variants
        const hv = entity.origDescs.reduce((sum, od) => {
          return sum + (holdingValue.get(`${slug}\0${od}`) ?? 0)
        }, 0)
        links.push({ source: slug, target: eid, value: hv })
      }
    }
  }

  return { nodes, links }
}
