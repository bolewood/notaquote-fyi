import type { Metadata } from "next"
import Link from "next/link"
import { TrustArticle } from "@/components/trust-article"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <TrustArticle title="That page is not in this version.">
      <p>
        The calculator is on the home page. It opens on a sample range for one
        driver and one vehicle.
      </p>
      <p>
        <Link href="/" className="underline underline-offset-4">
          Back to the calculator
        </Link>
      </p>
    </TrustArticle>
  )
}
