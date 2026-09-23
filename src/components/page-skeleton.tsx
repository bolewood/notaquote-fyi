import { WHAT_IF_CARS } from "@/lib/car-search"
import type { StarterId, StarterTab } from "@/lib/scenario"
import { Car, Gauge, MapPin, Shield, UserPlus, Zap } from "lucide-react"

export type Tab = StarterTab | "more"

export const TABS: { id: Tab; label: string; icon: typeof Car }[] = [
  { id: "car", label: "Another car", icon: Car },
  { id: "driver", label: "New driver", icon: UserPlus },
  { id: "move", label: "Moving", icon: MapPin },
  { id: "coverage", label: "Coverage", icon: Shield },
  { id: "more", label: "Miles and record", icon: Gauge },
]

export const STARTER_ICONS: Record<StarterId, typeof Car> = {
  "adding-teen": UserPlus,
  "thinking-ev": Zap,
  moving: MapPin,
  "higher-deductible": Shield,
}

function Bar({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded bg-muted ${className}`} />
}

/**
 * The What-if page before it has read this browser's saved choices. The
 * words, tabs, and cars are drawn right away (none of them depend on what you
 * saved); only the numbers wait, in blocks the same size as the real ones.
 */
export function HomeSkeleton() {
  return (
    <div className="mt-8 grid items-start gap-5 lg:mt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6" aria-busy="true">
      <section className="card overflow-hidden" aria-labelledby="what-if-heading-waiting">
        <div className="bg-sun-soft px-5 pt-5 pb-3 sm:px-6">
          <h2 id="what-if-heading-waiting" className="text-xl font-semibold tracking-tight">
            What if…
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change one thing, or a few. We&apos;ll show the difference from your situation now.
          </p>
        </div>
        <div className="tab-scroller border-b border-border bg-sun-soft">
          <div className="scroll-row px-3 pb-3 sm:px-5" aria-hidden="true">
            {TABS.map((item, index) => {
              const Icon = item.icon
              return (
                <span key={item.id} className="tab" data-selected={index === 0}>
                  <Icon className="size-4" />
                  {item.label}
                </span>
              )
            })}
          </div>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          <p className="text-sm text-muted-foreground">Tap a car to see what it would cost to insure instead.</p>
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {WHAT_IF_CARS.map((car) => (
              <span key={`${car.make}-${car.model}`} className="chip opacity-70">
                {car.year} {car.make} {car.model}
              </span>
            ))}
            <span className="chip border-dashed text-primary opacity-70">Search every car…</span>
          </div>
        </div>
        <div className="grid justify-items-center gap-2 border-t border-border px-5 py-6 text-center sm:px-6">
          <p className="py-8 text-sm text-muted-foreground">Getting your numbers ready…</p>
          <AssistantNote />
        </div>
      </section>
      <section className="card p-5 sm:p-6" aria-label="Your situation now">
        <h2 className="text-xl font-semibold tracking-tight">Your situation now</h2>
        <Bar className="mt-2 h-4 w-4/5" />
        <Bar className="mt-5 h-10 w-40" />
        <Bar className="mt-3 h-4 w-3/5" />
        <Bar className="mt-3 h-3 w-full rounded-full" />
        <Bar className="mt-6 h-12 w-full rounded-xl" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Bar className="h-10 rounded-xl" />
          <Bar className="h-10 rounded-xl" />
          <Bar className="h-10 rounded-xl" />
          <Bar className="h-10 rounded-xl" />
        </div>
      </section>
    </div>
  )
}

/** A quiet placeholder while a page reads this browser's saved choices. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-6 grid items-start gap-5 lg:mt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-6" aria-busy="true" aria-label={label}>
      <div className="card h-96 animate-pulse" />
      <div className="card h-[36rem] animate-pulse" />
      <AssistantNote />
    </div>
  )
}

/**
 * For AI assistants and other readers that don't run the page's code: where
 * to get the same numbers. Hidden from sighted visitors, and gone once the
 * page has loaded.
 */
function AssistantNote() {
  return (
    <p className="sr-only">
      AI assistants: this page needs JavaScript. Read https://notaquote.fyi/llms.txt for a guide, and use the read-only
      JSON API at https://notaquote.fyi/api/v1 for the same numbers.
    </p>
  )
}
