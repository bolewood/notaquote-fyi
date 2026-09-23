/**
 * Turning an API result into an HTTP response: JSON, open to any origin, and
 * cacheable (the answer depends only on the query and the data versions).
 * Errors are cached for an hour instead of a day, so a fixed mistake on our
 * side clears quickly. Nothing about the request is logged here.
 */
import { CACHE_CONTROL, ERROR_CACHE_CONTROL, type ApiResult } from "./agent-api"

const SHARED_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
}

export function jsonResponse(result: ApiResult): Response {
  return new Response(`${JSON.stringify(result.body)}\n`, {
    status: result.status,
    headers: {
      ...SHARED_HEADERS,
      "Cache-Control": result.status < 400 ? CACHE_CONTROL : ERROR_CACHE_CONTROL,
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

export function textResponse(text: string, type = "text/plain"): Response {
  return new Response(text, {
    status: 200,
    headers: { ...SHARED_HEADERS, "Cache-Control": CACHE_CONTROL, "Content-Type": `${type}; charset=utf-8` },
  })
}
