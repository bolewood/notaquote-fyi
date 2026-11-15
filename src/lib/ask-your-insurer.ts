/**
 * "Questions to ask your insurer": a short checklist that follows an
 * estimate, so a visitor leaves with something to do next. Each item says
 * what to ask and, in one plain line, why we're asking. Nothing here is
 * advice to buy, drop, or switch anything.
 *
 * Items are chosen from plain data about what the visitor is looking at, so
 * a server page can pass the context to the client component as is. No new
 * math, no new data, and nothing is stored or sent.
 */
import { SITE_ORIGIN } from "./copy"
import { ratingRule } from "./rating-rules"
import { hasPhysicalDamage, type CoverageId, type Incidents, type Scenario, type StateCode } from "./scenario"

/**
 * What the checklist knows about the result it follows. Every field is
 * optional except `teen`: a page with no situation (a guide) leaves the rest
 * out, and items that need them stay hidden or fall back to general wording.
 */
export type AskContext = {
  /** A 16–18-year-old driver: added to the parent's policy, or on their own. */
  teen: "added" | "own" | null
  state?: StateCode
  coverage?: CoverageId
  /** On a loan or lease the lender requires collision and comprehensive, so there's nothing to drop. */
  loanLease?: boolean
  incidents?: Incidents
}

export type AskItem = {
  id: string
  question: string
  /** One plain line: why the question matters. Never "do this". */
  why: string
  /** A page that says more. */
  link?: { href: string; text: string }
  shownWhen: (context: AskContext) => boolean
}

/** What the component renders and copies: an item without its rule, safe to pass anywhere. */
export type ShownAskItem = Omit<AskItem, "shownWhen">

const isTeen = (context: AskContext) => context.teen !== null
const onParentPolicy = (context: AskContext) => context.teen === "added"

/** In the order they're shown. The last one always shows. */
export const ASK_ITEMS: readonly AskItem[] = [
  {
    id: "teen-car",
    question: "Which car will you rate our teen on, and can we assign them to a specific car?",
    why: "Some insurers price a new driver on the household's most expensive car to insure, whoever drives it. Others go by the car they mainly drive, and the difference can be large.",
    shownWhen: onParentPolicy,
  },
  {
    id: "good-student",
    question: "Do you give a discount for good grades? What grades or test scores count, and how often do you need proof?",
    why: "Many insurers offer one, but what counts and how long it lasts differ from one company to the next.",
    shownWhen: isTeen,
  },
  {
    id: "drivers-ed",
    question: "Is there a discount for finishing a driver's ed course? Which courses qualify?",
    why: "Some insurers accept only certain courses, so it helps to know before your teen signs up for one.",
    shownWhen: isTeen,
  },
  {
    id: "distant-student",
    question: "If our teen goes to college far from home and doesn't take a car, is there a discount?",
    why: "A driver who's away most of the year rarely drives your cars. Some insurers price that in, and some only past a set distance from home.",
    shownWhen: onParentPolicy,
  },
  {
    id: "drop-physical-damage",
    question:
      "What would it cost to drop collision and comprehensive (the coverage that fixes your own car) on the car our teen drives?",
    why: "On an older car, it helps to know the saving. The trade-off: if that car is wrecked or stolen, you pay for the repairs or a replacement yourself.",
    shownWhen: (context) =>
      isTeen(context) && !context.loanLease && (context.coverage === undefined || hasPhysicalDamage(context.coverage)),
  },
  {
    id: "usage-based",
    question:
      "Do you have a program that prices how we drive, through a phone app or a small device in the car? Can it raise our price as well as lower it?",
    why: "These programs look at things like hard braking and late-night trips. Some only give discounts; others can charge more.",
    shownWhen: isTeen,
  },
  {
    id: "new-driver-surcharge",
    question: "When will the extra charge for a new driver start to come down?",
    why: "Prices usually drop as a teen gains experience and keeps a clean record, but each insurer has its own schedule.",
    shownWhen: isTeen,
  },
  {
    id: "credit-renewal",
    question: "Do you check credit again at renewal if my score has improved?",
    why: "Many insurers use credit when they set a price, and some look at it again only if you ask.",
    // Only where the state's rule has been reviewed and isn't a ban. An unreviewed state is never read as "allowed".
    shownWhen: (context) => {
      if (!context.state) return false
      const rule = ratingRule(context.state, "credit")
      return rule !== undefined && rule.status !== "banned"
    },
  },
  {
    id: "defensive-driving",
    question: "Would a defensive-driving course remove or reduce the extra charge for a ticket or accident?",
    why: "Some insurers lower that charge, or give a discount, after an approved course. It's worth asking before you sign up for one.",
    shownWhen: (context) => context.incidents !== undefined && context.incidents !== "clean",
  },
  {
    id: "other-companies",
    question: "Ask two or three other companies for the same coverage.",
    why: "For the same driver and car, companies' prices can be far apart. Getting a few quotes is usually the biggest thing you control.",
    link: { href: "/what-we-dont-ask#why-insurers-disagree", text: "Why companies' prices differ so much" },
    shownWhen: () => true,
  },
]

/** The items that fit this result, in order, without their rules. */
export function askItems(context: AskContext, items: readonly AskItem[] = ASK_ITEMS): ShownAskItem[] {
  return items.filter((item) => item.shownWhen(context)).map(({ id, question, why, link }) => (link ? { id, question, why, link } : { id, question, why }))
}

/** What the checklist knows about an estimate for this scenario. */
export function askContext(
  scenario: Pick<Scenario, "age" | "state" | "coverage" | "loanLease" | "incidents">,
  teenOnParentPolicy: boolean,
): AskContext {
  return {
    teen: scenario.age === "16-18" ? (teenOnParentPolicy ? "added" : "own") : null,
    state: scenario.state,
    coverage: scenario.coverage,
    loanLease: scenario.loanLease,
    incidents: scenario.incidents,
  }
}

export const ASK_TITLE = "Questions to ask your insurer"

/** The checklist as plain text, for the clipboard. */
export function askPlainText(items: readonly ShownAskItem[]): string {
  const lines = [ASK_TITLE, ""]
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`)
    lines.push(`   Why we're asking: ${item.why}`)
    if (item.link) lines.push(`   ${item.link.text}: ${SITE_ORIGIN}${item.link.href}`)
    lines.push("")
  })
  lines.push("From NotAQuote.FYI. We don't sell insurance or recommend any company.")
  return lines.join("\n")
}
