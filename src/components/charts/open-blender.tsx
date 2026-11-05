import { cn } from "cn"
import Link from "next/link"
import { ChartFigure } from "./figure"

/**
 * The site's method in one picture: insurers blend their ingredients with
 * private formulas; ours is a see-through blender. Four labeled ingredients
 * pour in, and out comes an estimate with a range. Text labels only (no
 * logos), so nothing implies anyone endorses the site. The labels are real
 * links, numbered to match the streams in the drawing.
 */
export const BLENDER_INGREDIENTS = [
  { n: 1, title: "Typical state price", source: "NAIC + the government's price index", href: "/methodology#starting-price", color: "var(--primary)", ours: false },
  { n: 2, title: "Your car", source: "HLDI loss data", href: "/methodology#the-car", color: "var(--hldi-better-strong)", ours: false },
  {
    n: 3,
    title: "Your driver and coverage",
    source: "State insurance department price surveys",
    href: "/methodology#adjustments",
    color: "var(--sun-ink)",
    ours: false,
  },
  { n: 4, title: "Our own estimates", source: "Clearly marked as ours", href: "/methodology#sourced-vs-guess", color: "var(--chart-assumed)", ours: true },
] as const

export const BLENDER_CAPTION =
  "Insurers blend these ingredients with private formulas. Ours is see-through: every ingredient is listed, and where we had to guess, we say so."

const STREAM_X = [50, 150, 250, 350]

/** The drawing alone: a see-through blender with four streams pouring in and a range coming out. */
export function BlenderDrawing({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 400 270"
      className={cn("block h-auto w-full", className)}
      style={{ aspectRatio: "400 / 270" }}
      data-testid="open-blender"
    >
      <title>
        A see-through blender. Four ingredients pour in: 1, the typical state price; 2, your car; 3, your driver and coverage;
        and 4, our own estimates, drawn dashed because they&apos;re ours. Out comes your estimate, with a range.
      </title>
      {/* The streams, numbered like the labels. */}
      {BLENDER_INGREDIENTS.map((item, index) => {
        const x = STREAM_X[index]
        const mouth = 172 + index * 19
        return (
          <g key={item.n}>
            <path
              d={`M${x} 30 C ${x} 70, ${mouth} 60, ${mouth} 98`}
              fill="none"
              stroke={item.color}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={item.ours ? "2 9" : undefined}
            />
            <circle cx={x} cy={16} r={11} fill="var(--card)" stroke={item.color} strokeWidth={2.5} strokeDasharray={item.ours ? "3 3" : undefined} />
            <text x={x} y={20.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--foreground)">
              {item.n}
            </text>
          </g>
        )
      })}
      {/* The jar: open at the top, see-through, with the ingredients visible inside. */}
      <path d="M150 96 L250 96 L236 196 L164 196 Z" fill="var(--primary)" fillOpacity={0.06} stroke="var(--foreground)" strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M156 140 Q 175 132 200 140 T 244 138 L 240 168 L 160 168 Z" fill="var(--primary)" fillOpacity={0.18} />
      <path d="M160 168 Q 180 160 200 168 T 240 166 L 236 196 L 164 196 Z" fill="var(--sun-ink)" fillOpacity={0.22} />
      <path d="M158 156 Q 200 146 242 156" fill="none" stroke="var(--chart-assumed)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
      <path d="M172 104 L 166 150" stroke="var(--card)" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
      {/* The base, with a dial. */}
      <rect x={154} y={196} width={92} height={36} rx={6} fill="var(--foreground)" fillOpacity={0.85} />
      <circle cx={200} cy={214} r={8} fill="var(--card)" />
      <line x1={200} y1={214} x2={205} y2={209} stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
      {/* Out comes an estimate with a range. */}
      <path d="M238 180 C 268 180, 280 196, 292 226" fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
      <path d="M286 220 L 293 229 L 298 218" fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={270} y={240} width={120} height={10} rx={5} fill="var(--chart-grid)" />
      <rect x={292} y={240} width={70} height={10} rx={5} fill="var(--primary)" fillOpacity={0.3} />
      <circle cx={322} cy={245} r={7} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
      <text x={318} y={266} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
        Your estimate, with a range
      </text>
    </svg>
  )
}

/** The labels, as real links, numbered like the streams. */
function IngredientList({ compact }: { compact: boolean }) {
  return (
    <ol className={cn("grid gap-2 text-sm", compact ? "gap-1" : "sm:grid-cols-2 lg:grid-cols-4")} aria-label="What goes in">
      {BLENDER_INGREDIENTS.map((item) => (
        <li key={item.n} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-xs font-bold"
            style={{ border: `2px ${item.ours ? "dashed" : "solid"} ${item.color}` }}
          >
            {item.n}
          </span>
          <span className="grid leading-snug">
            <Link href={item.href} className="link font-semibold">
              {item.title}
            </Link>
            <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>{item.source}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * "full" for the top of /methodology; "compact" beside the homepage hero on
 * wide screens; "thumbnail" is a small link to /methodology for phones.
 */
export function OpenBlender({ variant = "full", className }: { variant?: "full" | "compact" | "thumbnail"; className?: string }) {
  if (variant === "thumbnail") {
    return (
      <Link href="/methodology" className={cn("plain flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border hover:ring-primary/50", className)}>
        <span className="w-20 shrink-0" aria-hidden="true">
          <BlenderDrawing />
        </span>
        <span className="grid gap-0.5 text-sm leading-snug">
          <span className="link font-semibold">How the math works</span>
          <span className="text-muted-foreground">A see-through blender: every ingredient listed, and our guesses marked.</span>
        </span>
      </Link>
    )
  }
  return (
    <ChartFigure className={cn(variant === "compact" ? "gap-1" : "gap-3", className)} caption={BLENDER_CAPTION}
      captionClassName={cn("text-base text-foreground", variant === "compact" ? "leading-normal" : "leading-relaxed")}
      testId={`blender-${variant}`}
    >
      {variant === "compact" ? (
        // Beside the homepage question: the drawing and the labels side by side, so it's no taller than the question.
        <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-4">
          <div className="grid gap-1">
            <BlenderDrawing />
            <p className="text-center text-sm font-semibold">
              <span aria-hidden="true">→ </span>Your estimate, with a range
            </p>
          </div>
          <IngredientList compact />
        </div>
      ) : (
        <>
          <IngredientList compact={false} />
          <div className="mx-auto w-full max-w-md">
            <BlenderDrawing />
          </div>
        </>
      )}
    </ChartFigure>
  )
}
