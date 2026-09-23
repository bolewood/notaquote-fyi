import type { NextRequest } from "next/server"
import { handleIndex } from "@/lib/agent-api"
import { jsonResponse } from "@/lib/agent-http"

/** GET /api/v1: every endpoint, its parameters, and an example of each. */
export function GET(request: NextRequest) {
  return jsonResponse(handleIndex(request.nextUrl.searchParams))
}
