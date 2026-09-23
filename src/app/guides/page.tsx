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
    {
      href: "/cars",
      title: "What popular cars cost to insure",
      blurb: `${carPages(SERVER_CATALOG).length} cars, SUVs, and trucks, each with a typical price, what adding a teen costs, and why.`,
    },
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
    </TrustArticle>
  )
}
