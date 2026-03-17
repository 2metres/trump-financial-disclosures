// Shared interface contracts for DuckDB-WASM migration
// All agents code against these types.

/** The shape DuckDB-WASM init exposes */
export interface DuckDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
}

/** What the query layer returns to components */
export interface BipartiteData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface GraphNode {
  id: string
  type: 'appointee' | 'entity'
  name: string
  // appointee fields
  agency?: string
  title?: string
  net_worth_low?: number
  // entity fields
  category?: string
  count?: number
  total_value?: number
}

export interface GraphLink {
  source: string
  target: string
  value: number
}

export interface FilterState {
  agencies: string[]
  categories: string[]
  valueMin: number | null
  valueMax: number | null
  search: string
  dateRange: [Date | null, Date | null]
}
