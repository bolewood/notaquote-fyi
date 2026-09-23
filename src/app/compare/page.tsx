import type { Metadata } from "next"
import { CompareCars } from "@/components/compare-cars"
import { pageMetadata } from "@/lib/site-meta"

export const metadata: Metadata = pageMetadata({
  title: "Compare what cars cost to insure",
  description:
    "Put up to 15 cars side by side and see roughly what each costs to insure for the same driver, like a new 16-year-old. Sort, star, and download.",
  path: "/compare",
  image: null,
})

/**
 * A static page: share links keep their data after the "#", which never
 * reaches a server, and the page reads it in the browser. The words at the
 * top don't depend on anything saved, so they're in the page from the start.
 */
export default function ComparePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <section className="no-print max-w-3xl pt-8 sm:pt-12">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.6rem]">
          Which car costs the least to insure?
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          Add up to 15 cars and we&apos;ll price each one for the same driver. Sort them, star the favorites, and narrow the
          list down together.
        </p>
      </section>
      <CompareCars />
    </div>
  )
}
