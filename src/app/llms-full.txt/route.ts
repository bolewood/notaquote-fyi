import { llmsFullText } from "@/lib/agent-docs"
import { textResponse } from "@/lib/agent-http"

// Built once at build time from the factor bundle and the state prices.
export const dynamic = "force-static"

/** GET /llms-full.txt: the guide plus every adjustment, state price, and source. */
export function GET() {
  return textResponse(llmsFullText())
}
