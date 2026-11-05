import { cn } from "cn"
import type { ReactNode } from "react"

/**
 * Every chart sits in a figure with a short caption in plain words. The text
 * list or table it illustrates stays on the page as the accessible version;
 * the chart is an addition, not a replacement.
 */
export function ChartFigure({
  caption,
  children,
  className,
  testId,
}: {
  caption: ReactNode
  children: ReactNode
  className?: string
  testId?: string
}) {
  return (
    <figure className={cn("print-exact grid gap-2", className)} data-testid={testId}>
      {children}
      <figcaption className="text-xs leading-snug text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
