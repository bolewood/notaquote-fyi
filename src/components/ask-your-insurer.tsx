"use client"

import { ASK_TITLE, askItems, askPlainText, type AskContext, type ShownAskItem } from "@/lib/ask-your-insurer"
import { cn } from "cn"
import { ChevronDown, ClipboardCopy, Printer } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"

/**
 * What happened on the last "Copy as text". The manual case is only a flag:
 * the text box always shows the current list, so it can't fall behind when
 * the situation changes. "Copied" remembers which text it copied, and is
 * shown only while that's still the list on the page.
 */
export type CopyState = { kind: "copied"; text: string } | { kind: "manual" } | null

type Clipboard = { writeText(text: string): Promise<void> } | undefined

/** Copy the text, or say a manual copy is needed. Never throws. */
export async function copyChecklist(text: string, clipboard: Clipboard): Promise<CopyState> {
  if (!clipboard?.writeText) return { kind: "manual" }
  try {
    await clipboard.writeText(text)
    return { kind: "copied", text }
  } catch {
    return { kind: "manual" }
  }
}

/**
 * Questions to ask your insurer, picked for the result it follows. Collapsed
 * by default under an estimate, open on a guide. "Copy as text" and "Print"
 * record nothing and send nothing; printing uses the page's own print view.
 *
 * Takes plain data (not items with rules), so a server page can render it.
 */
export function AskYourInsurer(props: { context: AskContext; open?: boolean; intro?: string; className?: string }) {
  const details = useRef<HTMLDetailsElement>(null)
  const [copyState, setCopyState] = useState<CopyState>(null)

  function copy(text: string) {
    void copyChecklist(text, typeof navigator === "undefined" ? undefined : navigator.clipboard).then(setCopyState)
  }

  function print() {
    // A closed <details> prints empty.
    if (details.current) details.current.open = true
    window.print()
  }

  return <AskYourInsurerView {...props} detailsRef={details} copyState={copyState} onCopy={copy} onPrint={print} />
}

/** The checklist as drawn, for a given copy state. No state of its own. */
export function AskYourInsurerView({
  context,
  open = false,
  intro = "Picked for what you're looking at.",
  className,
  copyState,
  onCopy,
  onPrint,
  detailsRef,
}: {
  context: AskContext
  open?: boolean
  /** One line on what the questions are picked for. */
  intro?: string
  className?: string
  copyState: CopyState
  onCopy: (text: string) => void
  onPrint: () => void
  detailsRef?: React.Ref<HTMLDetailsElement>
}) {
  const items = askItems(context)
  const text = askPlainText(items)
  const copied = copyState?.kind === "copied" && copyState.text === text
  const manual = copyState?.kind === "manual"
  return (
    <details ref={detailsRef} className={cn("disclosure", className)} open={open} data-shared data-testid="ask-your-insurer">
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
          <button type="button" className="btn" onClick={() => onCopy(text)} data-testid="ask-copy">
            <ClipboardCopy className="size-4" aria-hidden="true" /> Copy as text
          </button>
          <button type="button" className="btn btn-quiet" onClick={onPrint} data-testid="ask-print">
            <Printer className="size-4" aria-hidden="true" /> Print
          </button>
        </div>
        {copied || manual ? (
          <p className="no-print text-muted-foreground" role="status">
            {copied ? "Copied. Paste it into a note or an email." : "Your browser didn't let us copy. Select the text below and copy it."}
          </p>
        ) : null}
        {manual ? (
          <textarea
            readOnly
            className="field-input no-print min-h-48 w-full font-mono text-xs"
            value={text}
            aria-label={`${ASK_TITLE}, as text`}
            data-testid="ask-copy-text"
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
