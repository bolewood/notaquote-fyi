import type { Metadata } from "next"
import { CompareCars } from "@/components/compare-cars"

export const metadata: Metadata = {
  title: "Compare cars",
  description:
    "Put up to 15 cars side by side and see roughly what each would cost to insure for the same driver. Sort them, star favorites, and download a spreadsheet.",
}

/**
 * A static page: share links keep their data after the "#", which never
 * reaches a server, and the page reads it in the browser.
 */
export default function ComparePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <CompareCars />
    </div>
  )
}
