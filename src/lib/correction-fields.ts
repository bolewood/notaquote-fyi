export const CORRECTION_PAGES = [
  { id: "calculator", label: "Calculator" },
  { id: "methodology", label: "Methodology" },
  { id: "sources", label: "Sources" },
  { id: "privacy", label: "Privacy" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "data-licenses", label: "Data licenses" },
  { id: "model-version", label: "Model version" },
] as const

export const CORRECTION_CATEGORIES = [
  { id: "wrong-minimum", label: "Wrong minimum" },
  { id: "stale-source", label: "Stale source" },
  { id: "vehicle-mapping", label: "Vehicle mapping" },
  { id: "display-error", label: "Display error" },
  { id: "other", label: "Other" },
] as const

export type CorrectionPage = (typeof CORRECTION_PAGES)[number]["id"]
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]["id"]
