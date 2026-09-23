import type { NextRequest } from "next/server"
import { handleCars } from "@/lib/agent-api"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { jsonResponse } from "@/lib/agent-http"

/** GET /api/v1/cars?q=civic&year=2022: cars and their ids. */
export function GET(request: NextRequest) {
  return jsonResponse(handleCars(SERVER_CATALOG, request.nextUrl.searchParams))
}
