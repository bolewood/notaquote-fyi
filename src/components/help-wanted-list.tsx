import { HELP_WANTED, helpWantedUrl } from "@/lib/help-wanted"
import { ArrowUpRight } from "lucide-react"

/** The five numbers that most need a source, each with where to look and a ready-made form. */
export function HelpWantedList({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="grid gap-3" aria-label="Numbers that need a public source">
      {HELP_WANTED.map((item, index) => (
        <li key={item.id} className={compact ? "grid gap-0.5" : "grid gap-1 rounded-2xl bg-card p-4 ring-1 ring-border"}>
          <p className="font-semibold">
            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
            {item.title}
          </p>
          {compact ? null : <p className="text-sm leading-relaxed text-muted-foreground">{item.hint}</p>}
          <p className="text-sm">
            <a href={helpWantedUrl(item)} rel="noreferrer" className="inline-flex items-center gap-1">
              {compact ? "Found it? Tell us" : "Found it in your state's rate guide? Tell us"}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </p>
        </li>
      ))}
    </ol>
  )
}
