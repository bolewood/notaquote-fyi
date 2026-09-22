/**
 * Cookieless product counts. Each payload is `{ kind }` and nothing else.
 * The tally stays in this browser's local storage. It is not sent, and it
 * does not set a cookie. There is no vendor script.
 */

export const COUNTS_STORAGE_KEY = "notaquote.counts.v1"

export const COUNT_KINDS = [
  "calculator_session",
  "starter_click",
  "what_if",
  "adjustment",
  "compare_session",
  "compare_add",
  "csv_download",
  "share_link_copy",
  "print",
  "trust_page_view",
] as const

export type CountKind = (typeof COUNT_KINDS)[number]

/** The only shape a count payload is allowed to have. */
export type CountPayload = {
  kind: CountKind
}

export type CountLedger = Record<CountKind, number>

export const COUNT_LABELS: Record<CountKind, string> = {
  calculator_session: "Visits to the What-if page",
  starter_click: "Common questions tried",
  what_if: "What-ifs tried",
  adjustment: "Other changes",
  compare_session: "Visits to the Compare page",
  compare_add: "Cars added to a comparison",
  csv_download: "Spreadsheets downloaded",
  share_link_copy: "Share links copied",
  print: "Pages printed",
  trust_page_view: "Visits to the help and source pages",
}

export type CountStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type CountSnapshot = {
  ledger: CountLedger | null
  failed: boolean
}

const SERVER_SNAPSHOT: CountSnapshot = { ledger: null, failed: false }

const listeners = new Set<() => void>()
let clientSnapshot: CountSnapshot | null = null
const mountBurst = new Set<string>()

export function emptyLedger(): CountLedger {
  return Object.fromEntries(COUNT_KINDS.map((kind) => [kind, 0])) as CountLedger
}

export function countPayload(kind: CountKind): CountPayload {
  return { kind }
}

export function acceptCountPayload(value: unknown): CountPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== "kind") return null
  const kind = (value as { kind: unknown }).kind
  if (typeof kind !== "string" || !isCountKind(kind)) return null
  return { kind }
}

export function isCountKind(value: string): value is CountKind {
  return (COUNT_KINDS as readonly string[]).includes(value)
}

/**
 * A payload can stand in for a scenario's dollars only when it carries more
 * than the kind. The accepted shape cannot.
 */
export function countPayloadReconstructsDollars(value: unknown): boolean {
  return acceptCountPayload(value) === null
}

export function sanitizeLedger(value: unknown): CountLedger {
  const ledger = emptyLedger()
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ledger
  const record = value as Record<string, unknown>
  for (const kind of COUNT_KINDS) {
    const count = record[kind]
    if (typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 1_000_000_000) {
      ledger[kind] = count
    }
  }
  return ledger
}

export function readLedger(storage: CountStorage | null): CountLedger | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(COUNTS_STORAGE_KEY)
    if (!raw) return emptyLedger()
    return sanitizeLedger(JSON.parse(raw))
  } catch {
    return null
  }
}

function browserStorage(): CountStorage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

function publish(next: CountSnapshot) {
  clientSnapshot = next
  for (const listener of listeners) listener()
}

export function subscribeCounts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCountSnapshot(): CountSnapshot {
  if (!clientSnapshot) {
    const ledger = readLedger(browserStorage())
    clientSnapshot = { ledger, failed: ledger === null }
  }
  return clientSnapshot
}

export function getServerCountSnapshot(): CountSnapshot {
  return SERVER_SNAPSHOT
}

export function recordCount(
  kind: CountKind,
  storage?: CountStorage | null,
): CountLedger | null {
  const payload = acceptCountPayload(countPayload(kind))
  if (!payload) return null
  const target = storage === undefined ? browserStorage() : storage
  if (!target) {
    if (storage === undefined) publish({ ledger: null, failed: true })
    return null
  }
  try {
    const ledger = readLedger(target) ?? emptyLedger()
    ledger[payload.kind] += 1
    target.setItem(COUNTS_STORAGE_KEY, JSON.stringify(ledger))
    if (storage === undefined) publish({ ledger, failed: false })
    return ledger
  } catch {
    if (storage === undefined) publish({ ledger: null, failed: true })
    return null
  }
}

/**
 * Collapses the extra effect run from Strict Mode into one tally.
 * A later turn, such as a navigation, still counts.
 */
export function recordMountedCount(
  kind: CountKind,
  storage?: CountStorage | null,
): CountLedger | null {
  if (mountBurst.has(kind)) {
    const target = storage === undefined ? browserStorage() : storage
    return readLedger(target)
  }
  mountBurst.add(kind)
  queueMicrotask(() => {
    mountBurst.delete(kind)
  })
  return recordCount(kind, storage)
}
