import { llmsText } from "@/lib/agent-docs"
import { textResponse } from "@/lib/agent-http"

// Built once at build time from the API's own parameter lists and examples.
export const dynamic = "force-static"

/** GET /llms.txt: a short guide for AI assistants. */
export function GET() {
  return textResponse(llmsText())
}
