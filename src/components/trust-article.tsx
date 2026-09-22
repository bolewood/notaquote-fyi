import { DisclaimerText } from "@/components/disclaimer-text"
import { cn } from "cn"

/**
 * A reading page: a title, an optional one-line lead, and the body in one
 * comfortable type scale. It shares the app's container and left edge, so
 * every page lines up under the logo. The "not a quote" message closes the
 * page once.
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
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-16 sm:pt-12 lg:px-6">
      <article className={cn(wide ? "max-w-5xl" : "max-w-2xl")}>
        <header className="max-w-2xl">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.6rem]">{title}</h1>
          {lead ? <p className="mt-3 text-lg leading-relaxed text-pretty text-muted-foreground">{lead}</p> : null}
        </header>
        <div className="prose-page mt-8">{children}</div>
        {closingDisclaimer ? (
          <div className="mt-14 max-w-2xl border-t border-border pt-6">
            <DisclaimerText />
          </div>
        ) : null}
      </article>
    </div>
  )
}
