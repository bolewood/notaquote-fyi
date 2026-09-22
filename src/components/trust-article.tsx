import { DisclaimerText } from "@/components/disclaimer-text"
import { cn } from "cn"

/**
 * A reading page: a title, an optional one-line lead, and the body in one
 * comfortable type scale. The "not a quote" message closes the page once.
 */
export function TrustArticle({
  title,
  lead,
  children,
  closingDisclaimer = true,
  wide = false,
}: {
  title: string
  lead?: React.ReactNode
  children: React.ReactNode
  closingDisclaimer?: boolean
  /** For pages with wide tables. The text still keeps a readable width. */
  wide?: boolean
}) {
  return (
    <article className={cn("mx-auto w-full px-4 pt-10 pb-16 sm:pt-14 lg:px-6", wide ? "max-w-5xl" : "max-w-2xl")}>
      <header className={cn(wide && "max-w-2xl")}>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {lead ? <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{lead}</p> : null}
      </header>
      <div className="prose-page mt-8">{children}</div>
      {closingDisclaimer ? (
        <div className={cn("mt-14 border-t border-border pt-6", wide && "max-w-2xl")}>
          <DisclaimerText />
        </div>
      ) : null}
    </article>
  )
}
