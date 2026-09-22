import { Calculator } from "@/components/calculator"
import { TrustStrip } from "@/components/trust-strip"

/**
 * A static page: share links keep their data after the "#", which never
 * reaches a server, and the page reads it in the browser. The words at the
 * top don't depend on anything saved, so they're in the page from the start.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <section className="max-w-3xl pt-8 sm:pt-12">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.6rem]">
          What would a new car, a teen driver, or a move do to your car insurance?
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          Change one thing and see roughly what you&apos;d pay, worked out from public data. It&apos;s free, and there&apos;s
          nothing to sign up for.
        </p>
        <div className="mt-5">
          <TrustStrip />
        </div>
      </section>
      <Calculator />
    </div>
  )
}
