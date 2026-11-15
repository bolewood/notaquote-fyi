/**
 * Reading the rules file and the law snapshots from disk, and fetching a law's
 * page politely. Shared by the snapshot script, the quote checker, and the
 * offline test.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { parseSnapshot, type SnapshotMeta } from "./law"

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

async function politeWait(host: string): Promise<void> {
  const since = Date.now() - (lastHit.get(host) ?? 0)
  if (since < GAP_MS) await new Promise((resolve) => setTimeout(resolve, GAP_MS - since))
  lastHit.set(host, Date.now())
}

export type Fetched = { ok: true; body: string; isPdfText: boolean } | { ok: false; error: string; needsBrowser?: boolean }

/** One page: HTML as text, or a PDF's text (through pdftotext). One retry on a network error or a 5xx. */
export async function fetchPage(url: string): Promise<Fetched> {
  const host = new URL(url).host
  let lastError = ""
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await politeWait(host)
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const type = response.headers.get("content-type") ?? ""
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        // Bot checks answer 403/503 with a challenge page.
        const body = await response.text().catch(() => "")
        if (/Just a moment|_cf_chl_opt|you have been blocked|Enable JavaScript/i.test(body)) {
          return { ok: false, error: `HTTP ${response.status}: the site sent a bot check`, needsBrowser: true }
        }
        lastError = `HTTP ${response.status}`
        if (response.status !== 503) break
        continue
      }
      if (response.status >= 500) {
        lastError = `HTTP ${response.status}`
        continue
      }
      if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
      if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
        return pdfToText(Buffer.from(await response.arrayBuffer()))
      }
      return { ok: true, body: await response.text(), isPdfText: false }
    } catch (error) {
      lastError = error instanceof Error ? (error.name === "TimeoutError" ? `timed out after ${TIMEOUT_MS / 1000}s` : error.message) : String(error)
    }
  }
  return { ok: false, error: lastError || "fetch failed" }
}

function pdfToText(bytes: Buffer): Fetched {
  const dir = mkdtempSync(path.join(tmpdir(), "law-pdf-"))
  try {
    const file = path.join(dir, "page.pdf")
    writeFileSync(file, bytes)
    const text = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", file, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
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
