import { SOURCE_COUNT } from "@/lib/copy"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"
import { BookOpenCheck, Code2, LockKeyhole } from "lucide-react"
import Link from "next/link"

/** "How we know", in one quiet line: sources, privacy, open source. */
export function TrustStrip() {
  const item = "inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground"
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="How we know">
      <li>
        <Link href="/sources" className={item}>
          <BookOpenCheck className="size-4 text-sun-ink" aria-hidden="true" />
          {SOURCE_COUNT} public sources, each linked
        </Link>
      </li>
      <li>
        <Link href="/privacy" className={item}>
          <LockKeyhole className="size-4 text-sun-ink" aria-hidden="true" />
          No sign-up. Nothing leaves your browser.
        </Link>
      </li>
      <li>
        <a href={GITHUB_REPO_URL} rel="noreferrer" className={item}>
          <Code2 className="size-4 text-sun-ink" aria-hidden="true" />
          Open source
        </a>
      </li>
    </ul>
  )
}
