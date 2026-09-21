import {
  CATALOG_RETRIEVED_ON,
  CATALOG_VERSION,
  FUEL_ECONOMY_CATALOG_URL,
  FUEL_ECONOMY_DOCS_URL,
  NHTSA_CATALOG_URL,
} from "./catalog-meta"
import { formatCatalogDate } from "./catalog"
import {
  sourcedStateRules,
  STATE_RULES_VERSION,
  unsourcedStateRules,
} from "./state-rules"

export type SourceRow = {
  name: string
  use: string
  url: string | null
  status: string
}

const retrieved = formatCatalogDate(CATALOG_RETRIEVED_ON)

export const SOURCE_ROWS: SourceRow[] = [
  {
    name: "NHTSA vPIC",
    use: "Year, make, and model for the vehicle catalog snapshot.",
    url: NHTSA_CATALOG_URL,
    status: `Snapshotted ${retrieved} as ${CATALOG_VERSION}. Passenger car, truck, and multipurpose passenger vehicle models. No VINs and no premium figures.`,
  },
  {
    name: "FuelEconomy.gov",
    use: "Model names used as trims in the vehicle catalog snapshot.",
    url: FUEL_ECONOMY_CATALOG_URL,
    status: `Snapshotted ${retrieved} as ${CATALOG_VERSION}. Year, make, and model name only. Description: ${FUEL_ECONOMY_DOCS_URL}. Fuel-cost figures are not stored.`,
  },
  {
    name: "BLS CPI, motor vehicle insurance",
    use: "A public trend index, once a baseline exists to adjust.",
    url: "https://www.bls.gov/cpi/",
    status: "Not snapshotted. The sample display does not apply a trend index.",
  },
  {
    name: "State statutes and insurance departments",
    use: "Required liability, PIP, uninsured-motorist rules, and credit rules.",
    url: null,
    status: `${STATE_RULES_VERSION}. ${sourcedStateRules().length} rows cite a page opened on 21 September 2026. ${unsourcedStateRules().length} rows have no source URL and no dollar minimum. Credit is unreviewed and the factor is 1.00 on every row. The reviewer field is unsigned. No premium figures are included.`,
  },
  {
    name: "NAIC Auto Insurance Database",
    use: "Not used. No reuse decision is recorded for a baseline.",
    url: "https://content.naic.org/publications",
    status: "Not cleared. No tables, averages, or premium figures are included.",
  },
  {
    name: "SERFF and state filing portals",
    use: "Not used.",
    url: null,
    status: "No filing data is included.",
  },
  {
    name: "IIHS/HLDI",
    use: "Not used.",
    url: null,
    status: "Loss tables are not copied and are not linked as a data feed.",
  },
]
