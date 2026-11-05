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
  captionClassName,
  testId,
}: {
  caption: ReactNode
  children: ReactNode
  className?: string
  /** A caption that's part of the story (the blender) reads as body text. */
  captionClassName?: string
  testId?: string
}) {
  return (
    <figure className={cn("print-exact grid gap-2", className)} data-testid={testId}>
      {children}
      <figcaption className={captionClassName ?? "text-xs leading-snug text-muted-foreground"}>{caption}</figcaption>
    </figure>
  )
}
