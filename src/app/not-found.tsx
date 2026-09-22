import type { Metadata } from "next"
import Link from "next/link"
import { TrustArticle } from "@/components/trust-article"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <TrustArticle
      title="We couldn't find that page"
      lead="It may have moved, or the link lost a piece on the way. Here's where most people are headed."
      closingDisclaimer={false}
    >
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Try a what-if
        </Link>
        <Link href="/compare" className="btn">
          Compare cars
        </Link>
        <Link href="/methodology" className="btn btn-quiet">
          How it works
        </Link>
      </div>
    </TrustArticle>
  )
}
