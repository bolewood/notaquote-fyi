import Link from "next/link"
import { DATA_BUNDLE_VERSION, MODEL_VERSION, PUBLISHER } from "@/lib/copy"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid w-full max-w-7xl gap-2 px-4 py-5 text-sm lg:px-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/methodology" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            How it works
          </Link>
          <Link href="/sources" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Sources
          </Link>
          <Link href="/privacy" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Privacy
          </Link>
          <Link href="/disclaimer" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Not a quote
          </Link>
          <Link href="/data-licenses" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Data licenses
          </Link>
          <Link href="/model-version" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            What&apos;s changed (version {MODEL_VERSION})
          </Link>
          <Link href="/corrections" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Spot something wrong? Tell us
          </Link>
          <a href={GITHUB_REPO_URL} rel="noreferrer" className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring">
            Source code on GitHub
          </a>
        </nav>
        <p className="text-muted-foreground">
          Free and open source, from {PUBLISHER}. Your choices stay in this browser. Data {DATA_BUNDLE_VERSION}.
        </p>
      </div>
    </footer>
  )
}
