import type { Metadata } from "next"
import Link from "next/link"
import { TrustArticle } from "@/components/trust-article"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <TrustArticle title="We couldn't find that page">
      <p>It may have moved, or the link may be missing a piece.</p>
      <p>
        <Link href="/" className="link">
          Try a what-if
        </Link>{" "}
        or{" "}
        <Link href="/compare" className="link">
          compare cars
        </Link>
        .
      </p>
    </TrustArticle>
  )
}
