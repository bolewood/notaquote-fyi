import type { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carPages } from "@/lib/car-pages"
import { GUIDES } from "@/lib/guides"
import { GUIDES_IMAGE, pageMetadata } from "@/lib/site-meta"

export const metadata: Metadata = pageMetadata({
  title: "Guides: teen drivers, cars, and your state",
  description:
    "Plain-language guides from public data: the cheapest cars to insure for a new teen, what adding a teen driver costs, and car insurance in every state.",
  path: "/guides",
  image: GUIDES_IMAGE,
})

export default function GuidesPage() {
  const links = [
    ...GUIDES.map((guide) => ({ href: guide.path, title: guide.title, blurb: guide.blurb })),
    {
      href: "/states",
      title: "Car insurance by state",
      blurb: "Every state and DC: the typical price, the least insurance the law asks for, and what a new teen driver adds.",
    },
    // No car pages when the per-model claims data is off.
    ...(carPages(SERVER_CATALOG).length > 0
      ? [
          {
            href: "/cars",
            title: "What popular cars cost to insure",
            blurb: `${carPages(SERVER_CATALOG).length} cars, SUVs, and trucks, each with a typical price, what adding a teen costs, and why.`,
          },
        ]
      : []),
  ]
  return (
    <TrustArticle
      title="Guides"
      lead="Short, plain answers to the questions families ask most, worked out from the same public data and math as the rest of the site."
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
          ]}
        />
      }
    >
      <ul className="divide-y divide-border/70 border-y border-border/70">
        {links.map((link) => (
          <li key={link.href} className="grid gap-1 py-4">
            <Link href={link.href} className="text-lg font-semibold">
              {link.title}
            </Link>
            <p className="text-muted-foreground">{link.blurb}</p>
          </li>
        ))}
      </ul>
      <h2 id="states">State guides with rate-comparison surveys and minimum rules</h2>
      <p>
        Every state page combines NAIC&apos;s 2023 full-coverage, liability-only, and average-expenditure figures (brought up
        to today with the federal insurance price index) with verified minimum-coverage statutes. Pages for{" "}
        <Link href="/states/texas">Texas</Link>, <Link href="/states/california">California</Link>,{" "}
        <Link href="/states/colorado">Colorado</Link>, <Link href="/states/oklahoma">Oklahoma</Link>,{" "}
        <Link href="/states/north-dakota">North Dakota</Link>, and{" "}
        <Link href="/states/district-of-columbia">the District of Columbia</Link> also include sample rate-comparison tables
        from their state insurance departments, and <Link href="/states/north-carolina">North Carolina</Link> includes the
        statutory Safe Driver Incentive Plan points schedule.
      </p>
      {carPages(SERVER_CATALOG).length > 0 ? (
        <>
          <h2 id="cars">Popular car pages</h2>
          <p>
            Each model page shows a 45-year-old&apos;s full-coverage estimate, a used model-year table, HLDI claim results by
            coverage, and sample state prices:{" "}
            {carPages(SERVER_CATALOG)
              .slice(0, 10)
              .map((car, index) => (
                <span key={car.slug}>
                  {index > 0 ? ", " : ""}
                  <Link href={`/cars/${car.slug}`}>{car.shortName}</Link>
                </span>
              ))}
            , and <Link href="/cars">all {carPages(SERVER_CATALOG).length} models</Link>.
          </p>
        </>
      ) : null}
    </TrustArticle>
  )
}
