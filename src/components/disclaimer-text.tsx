import { DISCLAIMER } from "@/lib/copy"
import { cn } from "cn"

/** The one "not a quote" message. Use it once per page. */
export function DisclaimerText({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} data-testid="disclaimer">
      {DISCLAIMER}
    </p>
  )
}
