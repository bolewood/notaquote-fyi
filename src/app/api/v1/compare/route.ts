import type { NextRequest } from "next/server"
import { handleCompare } from "@/lib/agent-api"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { jsonResponse } from "@/lib/agent-http"

/** GET /api/v1/compare?state=IL&age=16-18&cars=...: up to 15 cars for one driver, cheapest first. */
export function GET(request: NextRequest) {
  return jsonResponse(handleCompare(SERVER_CATALOG, request.nextUrl.searchParams))
}
