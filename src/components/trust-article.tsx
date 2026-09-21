import { DisclaimerText } from "@/components/disclaimer-text"

export function TrustArticle({
  title,
  children,
  closingDisclaimer = true,
}: {
  title: string
  children: React.ReactNode
  closingDisclaimer?: boolean
}) {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">{children}</div>
      {closingDisclaimer ? (
        <div className="mt-8 border-t border-border pt-4">
          <DisclaimerText />
        </div>
      ) : null}
    </article>
  )
}
