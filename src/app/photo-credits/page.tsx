import type { Metadata } from "next"
import Link from "next/link"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carPageBySlug } from "@/lib/car-pages"
import { photoCount, photoCredits, photoName, type CreditedPhoto } from "@/lib/photo-credits"
import { pageMetadata } from "@/lib/site-meta"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"

export const metadata: Metadata = pageMetadata({
  title: "Photo credits",
  description: "Who took each car photo we use, and the open license it's shared under. All come from Wikimedia Commons.",
  path: "/photo-credits",
})

/** "2013", "2018 and 2022", "2013, 2018 and 2022". */
function yearList(years: number[]): string {
  if (years.length < 2) return String(years[0] ?? "")
  return `${years.slice(0, -1).join(", ")} and ${years.at(-1)}`
}

function Credit({ photo }: { photo: CreditedPhoto }) {
  const { credit } = photo
  return (
    <li>
      <a href={credit.source} rel="noreferrer">
        {photoName(credit.title)}
      </a>{" "}
      by {credit.author},{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} rel="noreferrer">
          {credit.license}
        </a>
      ) : (
        credit.license.toLowerCase() === "public domain" ? "in the public domain" : credit.license
      )}
      .{" "}
      {photo.years.length > 0
        ? `For the ${yearList(photo.years)} model ${photo.years.length > 1 ? "years" : "year"}.`
        : `For the ${photo.generationYears} generation.`}
    </li>
  )
}

export default function PhotoCreditsPage() {
  const cars = photoCredits()
    .map((car) => {
      const page = carPageBySlug(SERVER_CATALOG, car.slug)
      return { ...car, name: page?.shortName ?? car.slug, hasPage: page !== null }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <TrustArticle
      title="Photo credits"
      lead="The car photos we use come from Wikimedia Commons, where photographers share their pictures under open licenses. Here's who took each one."
    >
      <h2>How we use them</h2>
      <p>
        Each photo shows the generation of the car sold in the model years listed with it. A few show a version sold in
        another country, or one from just before or after a mid-cycle restyle. We resize each one, save it in a
        smaller file format (WebP), and crop it to fit the page; we don&apos;t change anything else. The photos aren&apos;t covered by this
        project&apos;s own licenses (see <Link href="/data-licenses">Data licenses</Link>): each keeps the license shown
        next to it. To reuse one, follow its link to Commons and use it on those terms.
      </p>
      <p>
        We picked {photoCount(cars)} photos for {cars.length} cars, matching each one to the right generation of the car.
        If a photo shows the wrong car or a credit is wrong,{" "}
        <Link href="/corrections">tell us</Link>. The full list, with the exact file versions, is in{" "}
        <a href={`${GITHUB_REPO_URL}/blob/main/data/photos/images.json`} rel="noreferrer">
          the project&apos;s source code
        </a>
        .
      </p>

      <h2>Credits by car</h2>
      {cars.map((car) => (
        <section key={car.slug} aria-labelledby={`credits-${car.slug}`}>
          <h3 id={`credits-${car.slug}`}>{car.hasPage ? <Link href={`/cars/${car.slug}`}>{car.name}</Link> : car.name}</h3>
          <ul className="bullets">
            {car.photos.map((photo) => (
              <Credit key={photo.src} photo={photo} />
            ))}
          </ul>
        </section>
      ))}
    </TrustArticle>
  )
}
