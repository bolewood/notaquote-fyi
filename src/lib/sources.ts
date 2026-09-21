export type SourceRow = {
  name: string
  use: string
  url: string | null
  status: string
}

export const SOURCE_ROWS: SourceRow[] = [
  {
    name: "NHTSA vPIC",
    use: "Year, make, and model metadata for a later vehicle catalog.",
    url: "https://api.nhtsa.gov/",
    status: "Not snapshotted. No catalog is loaded. No figures are taken from this source.",
  },
  {
    name: "FuelEconomy.gov",
    use: "Fuel type and vehicle-menu fields for a later catalog snapshot.",
    url: "https://www.fueleconomy.gov/feg/ws/index.shtml",
    status: "Not snapshotted. Not used in the sample display.",
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
    status:
      "Not researched. Dollar minimums load with the sourced state-rules table, which is not in this version. No statutory dollar amounts are shown.",
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
