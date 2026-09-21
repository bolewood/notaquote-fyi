import { DISCLAIMER } from "@/lib/copy"
import { cn } from "cn"

export function DisclaimerText({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm leading-snug text-foreground", className)}>
      {DISCLAIMER}
    </p>
  )
}
