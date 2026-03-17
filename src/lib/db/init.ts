import * as duckdb from '@duckdb/duckdb-wasm'
import type { DuckDB } from './types'

// CDN bundles via jsDelivr — avoids needing to configure Vite to copy WASM assets
const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()

const base = import.meta.env.BASE_URL

const PARQUET_FILES = [
  { name: 'appointees.parquet', path: `${base}data/appointees.parquet`, table: 'appointees' },
  {
    name: 'disclosure_entries.parquet',
    path: `${base}data/disclosure_entries.parquet`,
    table: 'disclosure_entries',
  },
  { name: 'documents.parquet', path: `${base}data/documents.parquet`, table: 'documents' },
] as const

/** Singleton promise — only one initialization can run at a time. */
let dbPromise: Promise<DuckDB> | null = null

async function initialize(): Promise<DuckDB> {
  // Pick the best available bundle for the current browser
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  // The worker script URL comes from the bundle. We need a real Worker, not a
  // module worker, because duckdb-wasm ships a classic-script worker.
  const workerUrl = bundle.mainWorker
  if (!workerUrl) {
    throw new Error('duckdb-wasm: no suitable worker URL found for this browser')
  }

  // Create the worker from the CDN URL via a Blob so that same-origin policy
  // is satisfied even when the main worker lives on jsdelivr.
  const workerRes = await fetch(workerUrl)
  const workerBlob = await workerRes.blob()
  const workerBlobUrl = URL.createObjectURL(workerBlob)
  const worker = new Worker(workerBlobUrl)

  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  await db.open({ path: ':memory:' })

  const conn = await db.connect()

  try {
    // Fetch each Parquet file and register as in-memory buffer
    for (const file of PARQUET_FILES) {
      const res = await fetch(file.path)
      const buf = new Uint8Array(await res.arrayBuffer())
      await db.registerFileBuffer(file.name, buf)
      await conn.query(`CREATE TABLE ${file.table} AS SELECT * FROM '${file.name}'`)
    }

    // Read-only in production to prevent accidental mutations
    if (import.meta.env.PROD) {
      await conn.query("SET access_mode = 'read_only'")
    }
  } catch (err) {
    await conn.close()
    await db.terminate()
    URL.revokeObjectURL(workerBlobUrl)
    throw err
  }

  const handle: DuckDB = {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      if (params && params.length > 0) {
        // Use a prepared statement when parameters are supplied
        const stmt = await conn.prepare(sql)
        try {
          const table = await stmt.query(...params)
          return arrowToObjects<T>(table)
        } finally {
          await stmt.close()
        }
      }
      const table = await conn.query(sql)
      return arrowToObjects<T>(table)
    },

    async close(): Promise<void> {
      await conn.close()
      await db.terminate()
      URL.revokeObjectURL(workerBlobUrl)
      dbPromise = null
    },
  }

  return handle
}

/**
 * Convert an Apache Arrow Table to a plain array of JS objects.
 * Each row becomes `{ columnName: value, ... }`.
 */
function arrowToObjects<T>(table: { schema: { fields: { name: string }[] }; toArray(): unknown[] }): T[] {
  // `table.toArray()` returns an array of Proxy-like row objects from Arrow.
  // We materialise each row into a plain object by iterating the schema fields.
  const fields = table.schema.fields.map((f) => f.name)
  const rows = table.toArray()
  return rows.map((row: unknown) => {
    const obj: Record<string, unknown> = {}
    for (const field of fields) {
      const r = row as Record<string, unknown>
      const v = r[field]
      // Arrow deserializes BIGINT as JS BigInt — convert to Number for math/D3 compat
      obj[field] = typeof v === 'bigint' ? Number(v) : v
    }
    return obj as T
  })
}

/**
 * Return the shared DuckDB instance, initialising it lazily on first call.
 * Subsequent calls return the same `Promise` (and therefore the same instance).
 */
export function getDB(): Promise<DuckDB> {
  if (!dbPromise) {
    dbPromise = initialize().catch((err) => {
      // Reset so callers can retry after a transient failure
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}
