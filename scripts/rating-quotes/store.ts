/**
 * Reading the rules file and the law snapshots from disk, and fetching a law's
 * page politely. Shared by the snapshot script, the quote checker, and the
 * offline test.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { classifyResponse, FETCH_RETRIES, parseSnapshot, retryDelayMs, SITE_RULES, type FetchFailure, type SnapshotMeta } from "./law"

export const ROOT = path.resolve(__dirname, "../..")
export const RULES_PATH = path.join(ROOT, "data/state-rules/rating-rules.json")
export const LAW_DIR = path.join(ROOT, "data/state-rules/law")

export function readRulesFile() {
  return JSON.parse(readFileSync(RULES_PATH, "utf8"))
}

export type Snapshot = { file: string; state: string; meta: SnapshotMeta; body: string }

/** Every snapshot under data/state-rules/law, by URL. Throws if two files claim the same URL. */
export function loadSnapshots(dir: string = LAW_DIR): Map<string, Snapshot> {
  const out = new Map<string, Snapshot>()
  let states: string[] = []
  try {
    states = readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory())
  } catch {
    return out
  }
  for (const state of states) {
    for (const name of readdirSync(path.join(dir, state))) {
      if (!name.endsWith(".md")) continue
      const file = path.join(dir, state, name)
      const relative = path.relative(ROOT, file)
      let parsed: ReturnType<typeof parseSnapshot>
      try {
        parsed = parseSnapshot(readFileSync(file, "utf8"))
      } catch (error) {
        throw new Error(`${relative}: ${(error as Error).message}`)
      }
      const already = out.get(parsed.meta.url)
      if (already) throw new Error(`${relative} and ${already.file} both save ${parsed.meta.url}. Keep one.`)
      out.set(parsed.meta.url, { file: relative, state, ...parsed })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Fetching

const USER_AGENT = "notaquote-fyi-law-checker/1.0 (+https://github.com/bolewood/notaquote-fyi)"
const TIMEOUT_MS = 30_000
const GAP_MS = 1_500
const lastHit = new Map<string, number>()

/** Tests set RATING_CHECK_NO_WAIT=1 so a mocked failure doesn't sit through the polite gaps and retry pauses. */
const NO_WAIT = process.env.RATING_CHECK_NO_WAIT === "1"

async function politeWait(host: string): Promise<void> {
  if (NO_WAIT) return
  const since = Date.now() - (lastHit.get(host) ?? 0)
  if (since < GAP_MS) await new Promise((resolve) => setTimeout(resolve, GAP_MS - since))
  lastHit.set(host, Date.now())
}

export type Fetched = { ok: true; body: string; isPdfText: boolean } | ({ ok: false } & FetchFailure)

/**
 * One page: HTML as text, or a PDF's text (through pdftotext). A network error
 * or a 5xx is retried FETCH_RETRIES times with growing pauses; a bot check
 * (403, 429, or a challenge page) comes back as needsBrowser; anything else
 * that fails is an error the live check treats as fatal.
 */
export async function fetchPage(url: string): Promise<Fetched> {
  const host = new URL(url).host
  let lastError = ""
  let lastStatus: number | undefined
  let lastCode: string | undefined
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    if (attempt > 0 && !NO_WAIT) await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)))
    await politeWait(host)
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const type = response.headers.get("content-type") ?? ""
      const isPdf = type.includes("pdf") || url.toLowerCase().endsWith(".pdf")
      if (response.ok && isPdf) return pdfToText(Buffer.from(await response.arrayBuffer()), !SITE_RULES[host]?.pdfColumns)
      const body = await response.text().catch(() => "")
      const outcome = classifyResponse(response.status, body)
      if (outcome === "ok") return { ok: true, body, isPdfText: false }
      if (outcome === "needs-browser") return { ok: false, error: `HTTP ${response.status}: the site sent a bot check`, status: response.status, needsBrowser: true }
      if (outcome === "dead") return { ok: false, error: `HTTP ${response.status}: the link looks dead; fix the rule's URL`, status: response.status }
      lastError = `HTTP ${response.status}`
      lastStatus = response.status
      lastCode = undefined
    } catch (error) {
      lastError = error instanceof Error ? (error.name === "TimeoutError" ? `timed out after ${TIMEOUT_MS / 1000}s` : error.message) : String(error)
      // Node's fetch puts the network error's code (ENOTFOUND, UNABLE_TO_VERIFY_LEAF_SIGNATURE, ...) on `cause`.
      const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined
      lastCode = typeof cause?.code === "string" ? cause.code : undefined
      lastStatus = undefined
      if (lastCode) lastError = `${lastError} (${lastCode})`
    }
  }
  return { ok: false, error: `${lastError || "fetch failed"} (after ${FETCH_RETRIES} retries)`, status: lastStatus, errorCode: lastCode }
}

/** A PDF's text. `layout` keeps the printed layout (good for one-column statutes); off, columns come out in reading order. */
function pdfToText(bytes: Buffer, layout = true): Fetched {
  const dir = mkdtempSync(path.join(tmpdir(), "law-pdf-"))
  try {
    const file = path.join(dir, "page.pdf")
    writeFileSync(file, bytes)
    const text = execFileSync("pdftotext", [...(layout ? ["-layout"] : []), "-enc", "UTF-8", file, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
    return { ok: true, body: text, isPdfText: true }
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT"
    return { ok: false, error: missing ? "this is a PDF and pdftotext isn't installed (install poppler / poppler-utils)" : `pdftotext failed: ${(error as Error).message}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Value after a flag: `--state TX` → "TX". */
export function flagValue(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag)
  if (at < 0) return undefined
  const value = args[at + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`)
  return value
}
