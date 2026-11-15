"use client"

import { ASK_TITLE, askItems, askPlainText, type AskContext, type ShownAskItem } from "@/lib/ask-your-insurer"
import { cn } from "cn"
import { ChevronDown, ClipboardCopy, Printer } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"

/**
 * Questions to ask your insurer, picked for the result it follows. Collapsed
 * by default under an estimate, open on a guide. "Copy as text" and "Print"
 * record nothing and send nothing; printing uses the page's own print view.
 *
 * Takes plain data (not items with rules), so a server page can render it.
 */
export function AskYourInsurer({
  context,
  open = false,
  intro = "Picked for what you're looking at.",
  className,
}: {
  context: AskContext
  open?: boolean
  /** One line on what the questions are picked for. */
  intro?: string
  className?: string
}) {
  const items = askItems(context)
  const details = useRef<HTMLDetailsElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [fallback, setFallback] = useState<string | null>(null)
  const text = askPlainText(items)

  function copy() {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
    const manual = () => {
      setFallback(text)
      setStatus("Your browser didn't let us copy. Select the text below and copy it.")
    }
    if (!clipboard?.writeText) return manual()
    void clipboard.writeText(text).then(() => {
      setFallback(null)
      setStatus("Copied. Paste it into a note or an email.")
    }, manual)
  }

  function print() {
    // A closed <details> prints empty.
    if (details.current) details.current.open = true
    window.print()
  }

  return (
    <details ref={details} className={cn("disclosure", className)} open={open} data-shared data-testid="ask-your-insurer">
      <summary className="no-print">
        {ASK_TITLE}
        <ChevronDown className="size-4" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 pb-4 text-sm leading-relaxed">
        <p className="print-only font-semibold">{ASK_TITLE}</p>
        <p className="text-muted-foreground">
          {intro} They&apos;re questions, not advice: what fits depends on your household and your insurer.
        </p>
        <AskList items={items} />
        <div className="no-print flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={copy} data-testid="ask-copy">
            <ClipboardCopy className="size-4" aria-hidden="true" /> Copy as text
          </button>
          <button type="button" className="btn btn-quiet" onClick={print} data-testid="ask-print">
            <Printer className="size-4" aria-hidden="true" /> Print
          </button>
        </div>
        {status ? (
          <p className="no-print text-muted-foreground" role="status">
            {status}
          </p>
        ) : null}
        {fallback ? (
          <textarea
            readOnly
            className="field-input no-print min-h-48 w-full font-mono text-xs"
            value={fallback}
            aria-label={`${ASK_TITLE}, as text`}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : null}
      </div>
    </details>
  )
}

/** The numbered list on its own: on the page, and on the printed summary. */
export function AskList({ items }: { items: readonly ShownAskItem[] }) {
  return (
    <ol className="grid list-decimal gap-2.5 pl-5" data-testid="ask-items">
      {items.map((item) => (
        <li key={item.id} data-item={item.id}>
          <p className="font-medium">{item.question}</p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Why we&apos;re asking:</span>{" "}
            {item.why}
            {item.link ? (
              <>
                {" "}
                <Link href={item.link.href} className="link">
                  {item.link.text}
                </Link>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  )
}

/** For the calculator's printed page: the same list, no buttons, no disclosure. */
export function AskYourInsurerPrint({ context }: { context: AskContext }) {
  return (
    <>
      <h2 style={{ fontSize: "12pt", fontWeight: 650, marginTop: "12pt" }}>{ASK_TITLE}</h2>
      <ol style={{ margin: "4pt 0 0 14pt", listStyle: "decimal" }}>
        {askItems(context).map((item) => (
          <li key={item.id} style={{ marginBottom: "4pt" }}>
            <strong>{item.question}</strong> {item.why}
            {item.link ? ` ${item.link.text}: notaquote.fyi${item.link.href.split("#")[0]}` : null}
          </li>
        ))}
      </ol>
    </>
  )
}
