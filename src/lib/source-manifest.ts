import manifestFile from "@/data/source-manifest.json"

export const MANIFEST_VERSION = manifestFile.version

export const NAIC_PARAPHRASE =
  "NAIC’s 2022/2023 Auto Insurance Database Report (December 2025) describes statewide written-premium statistics. Average expenditure divides liability, collision, and comprehensive premium by liability car-years. The combined average premium adds the three coverage-level averages and describes a policy that carries all three. NAIC says the figures leave out the driver, the vehicle, the limits, the deductible, and the state’s tort and traffic setting, so they are not a price for one person and one car. We use the 2023 per-state figures, with credit, as the typical starting point for each state when you don’t enter what you pay."

export type ManifestRow = {
  id: string
  name: string
  url: string | null
  owner: string
  licenseNote: string
  accessMethod: string
  refreshCadence: string
  lastChecked: string
  derivedFields: string[]
  catalogCode?: string
  publicationDate?: string
}

export const SOURCE_MANIFEST: ManifestRow[] = manifestFile.rows

const NAIC_ROW_IDS = ["naic-aut-pb-2023", "naic-aut-pb-2022-2023"] as const

export function manifestRow(id: string): ManifestRow | undefined {
  return SOURCE_MANIFEST.find((row) => row.id === id)
}

export function naicPublicationRows(): ManifestRow[] {
  return NAIC_ROW_IDS.map((id) => {
    const row = manifestRow(id)
    if (!row) throw new Error(`Missing manifest row ${id}`)
    return row
  })
}

export function derivedFieldLabel(row: ManifestRow): string {
  if (row.derivedFields.length === 0) return "None"
  return row.derivedFields.join("; ")
}

export function citationLabel(row: ManifestRow): string {
  const parts = [row.name]
  if (row.catalogCode) parts.push(`Catalog code ${row.catalogCode}`)
  if (row.publicationDate) parts.push(row.publicationDate)
  return parts.join(". ")
}

export function assertManifestSafe(): void {
  if (!/^manifest-\d{4}-\d{2}-\d{2}$/.test(MANIFEST_VERSION)) {
    throw new Error(`Unexpected manifest version ${MANIFEST_VERSION}`)
  }

  const required = [
    "name",
    "url",
    "owner",
    "licenseNote",
    "accessMethod",
    "refreshCadence",
    "lastChecked",
    "derivedFields",
  ] as const

  for (const row of SOURCE_MANIFEST) {
    for (const field of required) {
      if (row[field] === undefined) throw new Error(`${row.id} is missing ${field}`)
    }
    if (!row.name || !row.owner || !row.licenseNote || !row.accessMethod) {
      throw new Error(`${row.id} has an empty manifest field`)
    }
    const blob = JSON.stringify(row)
    if (/naic estimate/i.test(blob)) {
      throw new Error(`${row.id} uses a forbidden estimate label`)
    }
    if (/\$\s?\d/.test(blob)) {
      throw new Error(`${row.id} contains a dollar figure`)
    }
  }

  const supplement = manifestRow("naic-aut-pb-2023")
  const report = manifestRow("naic-aut-pb-2022-2023")
  if (!supplement || !report) throw new Error("NAIC publication rows are missing")
  if (!/not used/i.test(supplement.licenseNote) || supplement.derivedFields.length !== 0) {
    throw new Error(`${supplement.id} must say it is not used and store no fields`)
  }
  if (!/used with credit/i.test(report.licenseNote) || report.derivedFields.length === 0) {
    throw new Error(`${report.id} must say it is used with credit and list its fields`)
  }
  for (const row of [supplement, report]) {
    if (!row.catalogCode || !row.publicationDate || !row.url) {
      throw new Error(`${row.id} is missing a citation field`)
    }
  }
  if (supplement.catalogCode !== "AUT-PB 2023" || supplement.publicationDate !== "June 2025") {
    throw new Error("Supplement citation does not match AUT-PB 2023, June 2025")
  }
  if (
    report.catalogCode !== "AUT-PB 2022-2023" ||
    report.publicationDate !== "December 2025"
  ) {
    throw new Error("Report citation does not match AUT-PB 2022-2023, December 2025")
  }

  const trend = manifestRow("bls-cpi-mv-insurance")
  if (!trend || !/typical start/i.test(trend.licenseNote) || !/never applied to a premium you enter/i.test(trend.licenseNote)) {
    throw new Error("BLS row must say it only moves typical starts, never a premium you enter")
  }

  if (/\$\s?\d/.test(NAIC_PARAPHRASE) || /naic estimate/i.test(NAIC_PARAPHRASE)) {
    throw new Error("NAIC paraphrase contains a figure or an estimate claim")
  }
}
