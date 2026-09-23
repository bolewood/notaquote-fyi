import type { NextRequest } from "next/server"
import { handleWhatIf } from "@/lib/agent-api"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { jsonResponse } from "@/lib/agent-http"

/** GET /api/v1/whatif?car=...&to=...: what one or more changes do to a typical bill. */
export function GET(request: NextRequest) {
  return jsonResponse(handleWhatIf(SERVER_CATALOG, request.nextUrl.searchParams))
}
