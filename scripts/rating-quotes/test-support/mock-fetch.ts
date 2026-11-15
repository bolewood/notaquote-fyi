/**
 * Loaded with `node --import tsx --import ./scripts/rating-quotes/test-support/mock-fetch.ts` by
 * live-check.test.ts, so the real live checker runs without the network.
 *
 * MOCK_FETCH is JSON: { "<host>": { "status": 410, "body"?: "<html>..." } | { "errorCode": "ENOTFOUND" } }.
 * A listed host answers that way (a 200 with a body serves that body). Any other URL gets its saved copy back (data/state-rules/law), one <p> per
 * paragraph inside <main>, so it passes and the test sees only the failure it set up.
 */
import { loadSnapshots } from "../store"

const failures = JSON.parse(process.env.MOCK_FETCH ?? "{}") as Record<string, { status?: number; errorCode?: string; body?: string }>
const snapshots = loadSnapshots()

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const failure = failures[new URL(url).host]
  if (failure?.errorCode) throw new TypeError("fetch failed", { cause: { code: failure.errorCode } })
  if (failure?.status) return new Response(failure.body ?? "This page was permanently deleted", { status: failure.status, headers: { "content-type": "text/html" } })
  const saved = snapshots.get(url)
  if (!saved) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } })
  const paragraphs = saved.body.split(/\n+/).map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
  return new Response(`<html><body><main>${paragraphs.join("")}</main></body></html>`, { status: 200, headers: { "content-type": "text/html" } })
}) as typeof fetch
