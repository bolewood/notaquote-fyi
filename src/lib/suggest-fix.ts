/**
 * "Suggest a fix" links. Each one opens a new GitHub issue in the public
 * repository, using one of the issue forms in .github/ISSUE_TEMPLATE and
 * prefilling a few of its fields. There is no backend: the browser just
 * follows a link, and the visitor reviews and submits the issue on GitHub.
 *
 * GitHub prefills an issue-form field when a query parameter matches the
 * field's `id`, and silently ignores parameters that match nothing. So the
 * field ids below must stay in sync with the YAML files. The test file
 * checks that for you.
 *
 * Privacy: an issue is public. These links must never carry a premium, a
 * VIN, or anything personal. Only the field ids listed here are accepted,
 * and any value that looks like a dollar amount, a VIN, an email address, or
 * a phone number is dropped rather than sent. Page links keep only the path,
 * because share links put scenario inputs (including an optional premium) in
 * the query string. Callers should pass descriptive labels ("Deductible
 * adjustment", "Texas minimum liability", "2025 Tesla Model Y"), never a
 * visitor's own numbers. Render these links with rel="noreferrer" so the
 * browser doesn't send the current page address (which may be a share link)
 * to GitHub.
 */

export const GITHUB_REPO_URL = "https://github.com/bolewood/notaquote-fyi"

export const FIX_KINDS = ["factor", "state-rule", "vehicle", "bug"] as const

export type FixKind = (typeof FIX_KINDS)[number]

/** Issue-form files and the field ids a link may prefill for each kind. */
export const FIX_TEMPLATES = {
  factor: {
    file: "1-number.yml",
    titlePrefix: "Number looks wrong: ",
    fields: ["factor", "page", "shown", "suggested", "source_url"],
  },
  "state-rule": {
    file: "2-state-rule.yml",
    titlePrefix: "State rule: ",
    fields: ["state", "rule", "shown", "suggested", "source_url"],
  },
  vehicle: {
    file: "3-vehicle.yml",
    titlePrefix: "Vehicle: ",
    fields: ["vehicle", "shown", "suggested", "source_url"],
  },
  bug: {
    file: "4-bug.yml",
    titlePrefix: "Bug: ",
    fields: ["page", "what_happened"],
  },
} as const satisfies Record<
  FixKind,
  { file: string; titlePrefix: string; fields: readonly string[] }
>

export type FixField<K extends FixKind> = (typeof FIX_TEMPLATES)[K]["fields"][number]

export type SuggestFixInput<K extends FixKind = FixKind> = {
  kind: K
  /** Short subject, e.g. "Teen driver adjustment". The kind's prefix is added for you. */
  title?: string
  fields?: Partial<Record<FixField<K>, string>>
}

/** Longest value we put in any one parameter. Keeps URLs well under GitHub's limit. */
export const FIELD_MAX = 300

const TITLE_MAX = 120

const DOLLAR_AMOUNT = /\$\s*\d/
const VIN_LIKE = /\b[A-HJ-NPR-Z0-9]{17}\b/i
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_LIKE = /(?:\d[\s().-]*){10,}/

/** True when a value looks like it could carry money or personal details. */
export function looksPersonal(value: string): boolean {
  return (
    DOLLAR_AMOUNT.test(value) ||
    VIN_LIKE.test(value) ||
    EMAIL_LIKE.test(value) ||
    PHONE_LIKE.test(value)
  )
}

/** Trim, collapse whitespace, cap the length, and drop anything that looks personal. */
export function cleanValue(value: unknown, max = FIELD_MAX): string | null {
  if (typeof value !== "string") return null
  const collapsed = value.replace(/\s+/g, " ").trim()
  if (!collapsed) return null
  if (looksPersonal(collapsed)) return null
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed
}

/**
 * A page on this site, reduced to its path. Query strings and fragments are
 * removed because share links store scenario inputs there.
 */
export function cleanPagePath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  let path: string
  try {
    path = new URL(trimmed, "https://placeholder.invalid").pathname
  } catch {
    return null
  }
  if (!path.startsWith("/")) return null
  return cleanValue(path)
}

/**
 * A public source link: http or https, no credentials, no fragment, and
 * never a page on this site (which could be a share link).
 */
export function cleanSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host.includes(".") || host === "127.0.0.1" || host.includes("notaquote")) return null
  url.hash = ""
  const href = url.toString()
  // Long digit runs are normal in URLs, so skip the phone check here.
  if (DOLLAR_AMOUNT.test(href) || VIN_LIKE.test(href) || EMAIL_LIKE.test(href)) return null
  return href.length > FIELD_MAX ? null : href
}

function cleanField(id: string, value: unknown): string | null {
  if (id === "page") return cleanPagePath(value)
  if (id === "source_url") return cleanSourceUrl(value)
  return cleanValue(value)
}

/** Build the URL that opens a prefilled GitHub issue for this kind of problem. */
export function suggestFixUrl<K extends FixKind>(input: SuggestFixInput<K>): string {
  const template = FIX_TEMPLATES[input.kind]
  const params = new URLSearchParams()
  params.set("template", template.file)

  const subject = cleanValue(input.title, TITLE_MAX - template.titlePrefix.length)
  if (subject) params.set("title", `${template.titlePrefix}${subject}`)

  const allowed: readonly string[] = template.fields
  const fields = (input.fields ?? {}) as Record<string, unknown>
  for (const id of allowed) {
    if (!(id in fields)) continue
    const value = cleanField(id, fields[id])
    if (value) params.set(id, value)
  }

  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`
}

/** Links for people who'd rather fix it themselves. */
export const CONTRIBUTING_URL = `${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`
export const ISSUES_URL = `${GITHUB_REPO_URL}/issues`
