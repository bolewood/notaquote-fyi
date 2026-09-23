import type { NextRequest } from "next/server"
import { handleNotFound } from "@/lib/agent-api"
import { jsonResponse } from "@/lib/agent-http"

/** Anything else under /api: a JSON 404 that points to the index. */
export function GET(request: NextRequest) {
  return jsonResponse(handleNotFound(request.nextUrl.pathname))
}
