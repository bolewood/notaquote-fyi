import { WHAT_IF_CARS } from "@/lib/car-search"
import { STARTERS, type Starter, type StarterId, type StarterTab } from "@/lib/scenario"
import { Car, Gauge, MapPin, Shield, UserPlus, Zap } from "lucide-react"

export type Tab = StarterTab | "more"

export const TABS: { id: Tab; label: string; icon: typeof Car }[] = [
  { id: "car", label: "Another car", icon: Car },
  { id: "driver", label: "Add a driver", icon: UserPlus },
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

/** Above the tool on phones; below it on wide screens, so the estimate is in view on landing. */
export const STARTERS_PLACEMENT = "mt-6 lg:order-last lg:mt-8"

/**
 * "Not sure where to start? Pick a question." Above the tool, so the easiest
 * way in is the first thing a newcomer sees. Before the page is ready the
 * cards are drawn the same size, without a tap action.
 */
export function StarterCards({ onPick, className }: { onPick?: (item: Starter) => void; className?: string }) {
  return (
    <section aria-labelledby="starters-heading" className={className ?? "mt-6"}>
      <h2 id="starters-heading" className="text-base font-semibold tracking-tight sm:text-lg">
        Not sure where to start? Pick a question.
      </h2>
      {/* Phones: one row that scrolls sideways, with the next card peeking in. Wider screens: a grid. */}
      <div
        className="-mx-4 mt-2 flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mt-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
        data-testid="starter-row"
      >
        {STARTERS.map((item) => {
          const Icon = STARTER_ICONS[item.id]
          return (
            <button
              key={item.id}
              type="button"
              disabled={!onPick}
              className="card group grid w-[42%] shrink-0 snap-start grid-cols-[auto_1fr] content-start gap-x-2.5 gap-y-1 p-3 text-left sm:w-auto transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/50 disabled:hover:translate-y-0 sm:p-4"
              onClick={onPick ? () => onPick(item) : undefined}
              data-testid={`starter-${item.id}`}
            >
              <span className="grid size-8 place-items-center rounded-full bg-sun-soft text-sun-ink sm:row-span-2" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="self-center text-sm leading-snug font-semibold sm:text-base">{item.title}</span>
              <span className="hidden text-sm leading-snug text-muted-foreground sm:block">{item.story}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
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
    <div className="flex flex-col">
      <StarterCards className={STARTERS_PLACEMENT} />
      <div className="mt-6 grid items-start gap-5 lg:mt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6" aria-busy="true">
        <section className="card p-5 sm:p-6" aria-label="Start with your situation">
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="text-muted-foreground">1.</span> Start with your situation
          </h2>
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
        <section className="card overflow-hidden" aria-labelledby="what-if-heading-waiting">
          <div className="bg-sun-soft px-5 pt-5 pb-3 sm:px-6">
            <h2 id="what-if-heading-waiting" className="text-xl font-semibold tracking-tight">
              <span className="text-muted-foreground">2.</span> Try a change
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a different car, add a driver, move, or change coverage. Changes add up, and you can remove any of them.
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
      </div>
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
      Using an AI assistant, or a tool that can&apos;t run this page? It can get the same numbers by reading
      notaquote.fyi/llms.txt, which explains our read-only service at notaquote.fyi/api/v1.
    </p>
  )
}
