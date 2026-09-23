import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { JsonLdScript } from "@/components/json-ld"
import { breadcrumbJsonLd, type Crumb } from "@/lib/site-meta"

/** The trail above a page's title ("Home › States › Ohio"), with its BreadcrumbList. The last crumb is this page. */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd(crumbs)} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1
            return (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.path} className="rounded-sm hover:text-foreground hover:underline">
                      {crumb.name}
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
