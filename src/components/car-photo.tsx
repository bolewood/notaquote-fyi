import Image from "next/image"
import Link from "next/link"
import { cn } from "cn"
import { licenseLabel, type CarPhoto } from "@/lib/car-photos"

/**
 * The big photo at the top of a car page, with its credit right under it (CC BY and CC BY-SA ask for
 * one wherever a photo is shown). The caption says what's verified: the generation, not the trim.
 */
export function CarHeroPhoto({ photo, carName, className }: { photo: CarPhoto; carName: string; className?: string }) {
  const { credit } = photo
  // The generation is verified; the exact model year in the photo isn't, so the caption doesn't claim one.
  const what = `A ${carName} from the ${photo.generationYears} generation`
  return (
    <figure className={cn("grid gap-2", className)} data-testid="car-photo">
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={what}
        sizes="(min-width: 720px) 672px, calc(100vw - 2rem)"
        loading="eager"
        fetchPriority="high"
        className="aspect-video w-full rounded-2xl bg-muted object-cover ring-1 ring-border"
      />
      <figcaption className="text-xs leading-snug text-muted-foreground">
        {what}. Photo:{" "}
        <a href={credit.source} rel="noreferrer">
          {credit.author}
        </a>
        ,{" "}
        {credit.licenseUrl ? (
          <a href={credit.licenseUrl} rel="noreferrer">
            {licenseLabel(credit)}
          </a>
        ) : (
          licenseLabel(credit)
        )}
        ,{" "}
        <span data-shared="">
          via Wikimedia Commons, cropped (<Link href="/photo-credits">credits</Link>).
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * A small photo beside a car's name in a list or table. Decorative (the name is right next to it), so
 * it has no alt text; the list it's in carries a link to the credits.
 */
export function CarThumb({ photo, className }: { photo: CarPhoto | null; className?: string }) {
  if (!photo) return <span aria-hidden="true" className={cn("inline-block aspect-[3/2] w-16 shrink-0 rounded-md bg-muted", className)} />
  return (
    <Image
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt=""
      sizes="64px"
      className={cn("aspect-[3/2] w-16 shrink-0 rounded-md bg-muted object-cover", className)}
    />
  )
}

/** One line under a list of thumbnails: where the credits are. */
export function PhotoCreditsNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} data-shared="">
      Photos from Wikimedia Commons contributors. <Link href="/photo-credits">Photo credits</Link>.
    </p>
  )
}

/** A generation's photo in the "by generation" list, or an empty frame when the library has none yet. */
export function GenerationPhoto({ photo, alt, className }: { photo: CarPhoto | null; alt: string; className?: string }) {
  if (!photo)
    return (
      <span
        aria-hidden="true"
        data-shared=""
        className={cn("grid aspect-[3/2] w-full place-items-center rounded-lg bg-muted text-xs text-muted-foreground", className)}
      >
        No photo yet
      </span>
    )
  return (
    <Image
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt={alt}
      sizes="(min-width: 640px) 128px, 96px"
      className={cn("aspect-[3/2] w-full rounded-lg bg-muted object-cover", className)}
    />
  )
}
