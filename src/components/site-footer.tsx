import Link from "next/link"
import { BUNDLE_VERSION, MODEL_VERSION, PUBLISHER } from "@/lib/copy"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-4 text-sm lg:px-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/disclaimer" className="focus-visible:ring-ring rounded-sm focus-visible:ring-3">
            Disclaimer
          </Link>
          <Link
            href="/data-licenses"
            className="focus-visible:ring-ring rounded-sm focus-visible:ring-3"
          >
            Data licenses
          </Link>
          <Link
            href="/model-version"
            className="focus-visible:ring-ring rounded-sm focus-visible:ring-3"
          >
            Model version {MODEL_VERSION}
          </Link>
        </nav>
        <p>{PUBLISHER}</p>
        <p className="text-muted-foreground">
          Displayed dollars are a sample range. Data bundle {BUNDLE_VERSION}. The
          baseline is not cleared.
        </p>
      </div>
    </footer>
  )
}
