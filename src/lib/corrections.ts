/**
 * Structured corrections queue. Supabase may store this row and nothing else.
 * Visitor scenarios, premiums, and the factor engine do not go there.
 * No keys are invented here. If the operator credentials are absent, the
 * queue is not live and nothing is saved.
 */

import {
  CORRECTION_CATEGORIES,
  CORRECTION_PAGES,
  type CorrectionCategory,
  type CorrectionPage,
} from "./correction-fields"
import { isStateCode, type StateCode } from "./scenario"

export { CORRECTION_CATEGORIES, CORRECTION_PAGES }
export type { CorrectionCategory, CorrectionPage }

export type CorrectionRow = {
  state: StateCode
  page: CorrectionPage
  sourceUrl: string
  category: CorrectionCategory
}

export type CorrectionInsert = {
  state: StateCode
  page: CorrectionPage
  source_url: string
  category: CorrectionCategory
}

const CORRECTION_KEYS = ["state", "page", "sourceUrl", "category"] as const

export type SubmitResult =
  | { saved: true }
  | { saved: false; reason: "not-live" | "invalid" | "not-saved" }

export function correctionsQueueLive(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = env.SUPABASE_URL?.trim() ?? ""
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  if (!url || !key) return false
  if (key.length < 20) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return false
    if (parsed.username || parsed.password) return false
    if (!parsed.hostname) return false
  } catch {
    return false
  }
  return true
}

export function parseSourceUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 500) return null
  if (/\s/.test(trimmed)) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.username || url.password) return null
  if (!url.hostname.includes(".")) return null
  return url.toString()
}

function isPage(value: string): value is CorrectionPage {
  return CORRECTION_PAGES.some((page) => page.id === value)
}

function isCategory(value: string): value is CorrectionCategory {
  return CORRECTION_CATEGORIES.some((category) => category.id === value)
}

export function parseCorrection(
  input: unknown,
): { ok: true; row: CorrectionRow } | { ok: false; reason: "invalid" } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "invalid" }
  }
  const record = input as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== CORRECTION_KEYS.length) return { ok: false, reason: "invalid" }
  for (const key of keys) {
    if (!(CORRECTION_KEYS as readonly string[]).includes(key)) {
      return { ok: false, reason: "invalid" }
    }
  }
  const state = record.state
  const page = record.page
  const sourceUrl = record.sourceUrl
  const category = record.category
  if (typeof state !== "string" || !isStateCode(state)) return { ok: false, reason: "invalid" }
  if (typeof page !== "string" || !isPage(page)) return { ok: false, reason: "invalid" }
  if (typeof sourceUrl !== "string") return { ok: false, reason: "invalid" }
  if (typeof category !== "string" || !isCategory(category)) return { ok: false, reason: "invalid" }
  const parsedUrl = parseSourceUrl(sourceUrl)
  if (!parsedUrl) return { ok: false, reason: "invalid" }
  return {
    ok: true,
    row: { state, page, sourceUrl: parsedUrl, category },
  }
}

/** The only columns this queue writes. No scenario, premium, or identity fields. */
export function correctionInsertBody(row: CorrectionRow): CorrectionInsert {
  return {
    state: row.state,
    page: row.page,
    source_url: row.sourceUrl,
    category: row.category,
  }
}

export function correctionHttpStatus(result: SubmitResult): number {
  if (result.saved) return 201
  if (result.reason === "not-live") return 503
  if (result.reason === "not-saved") return 502
  return 400
}

function queueEndpoint(env: NodeJS.ProcessEnv): string {
  const base = new URL(env.SUPABASE_URL!.trim())
  base.pathname = "/rest/v1/corrections"
  base.search = ""
  base.hash = ""
  return base.toString()
}

export async function submitCorrection(
  input: unknown,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  if (!correctionsQueueLive(env)) return { saved: false, reason: "not-live" }
  const parsed = parseCorrection(input)
  if (!parsed.ok) return { saved: false, reason: "invalid" }
  const key = env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  try {
    const response = await fetchImpl(queueEndpoint(env), {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(correctionInsertBody(parsed.row)),
    })
    if (!response.ok) return { saved: false, reason: "not-saved" }
    return { saved: true }
  } catch {
    return { saved: false, reason: "not-saved" }
  }
}
