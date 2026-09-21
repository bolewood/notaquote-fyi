import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { BUNDLE_VERSION, MODEL_VERSION } from "@/lib/copy"
import {
  AGE_WEIGHT,
  COVERAGE_WEIGHT,
  CREDIT_FACTOR,
  DEDUCTIBLE_WEIGHT,
  FLAG_WEIGHT,
  formatDollars,
  INCIDENT_WEIGHT,
  MILEAGE_WEIGHT,
  OTHER_STATE_WEIGHT,
  PRESET_STATE_WEIGHT,
  REGION_WEIGHT,
  SAMPLE_BASE_ANNUAL,
  SPREAD_BASE_HIGH,
  SPREAD_BASE_LOW,
  SPREAD_MODEL_Y_HIGH,
  SPREAD_NEW_DRIVER_HIGH,
  SPREAD_NEW_DRIVER_LOW,
  SPREAD_ONE_INCIDENT_HIGH,
  SPREAD_OTHER_STATE_HIGH,
  SPREAD_REPEAT_INCIDENT_HIGH,
  SPREAD_REPEAT_INCIDENT_LOW,
  SPREAD_STATE_MINIMUM_HIGH,
  SPREAD_UNCLEARED_HIGH,
  SPREAD_UNCLEARED_LOW,
  VEHICLE_WEIGHT,
  YEAR_WEIGHT_MID,
  YEAR_WEIGHT_OLDER,
  YEAR_WEIGHT_RECENT,
  YEARS_WEIGHT,
} from "@/lib/sample-range"

export const metadata: Metadata = {
  title: "Methodology",
}

const FLAG_LABELS: Record<keyof typeof FLAG_WEIGHT, string> = {
  teen: "Teen driver, when checked",
  goodStudent: "Good student, when checked",
  driverTraining: "Driver training, when checked",
  householdPolicy: "Household policy, when checked",
  loanLease: "Loan or lease, when checked",
}

export default function MethodologyPage() {
  return (
    <TrustArticle title="Methodology">
      <p>
        NotAQuote.FYI is a planning calculator for one driver and one vehicle.
        The home page opens on a finished sample scenario. The calculation is
        not paid placement. Nothing in the range is a carrier ranking, a
        coverage recommendation, or an offer to bind a policy.
      </p>
      <h2 className="text-base font-semibold">Working formula</h2>
      <p>
        The working formula for a later baseline is: premium midpoint = base
        premium × geography × driver × coverage × vehicle × trend × lawful
        sensitivity factors.
      </p>
      <p>
        This version does not run that formula on a cleared baseline. Trend is
        not applied. The only sensitivity factor in the product is credit, and
        it is locked at {CREDIT_FACTOR.toFixed(2)}. There is no credit control.
        For a California scenario the page says the credit rule is unreviewed.
      </p>
      <h2 className="text-base font-semibold">What the dollars are</h2>
      <p>
        The labeled sample likely figure starts from an arbitrary baseline of{" "}
        {formatDollars(SAMPLE_BASE_ANNUAL)} and multiplies the sample display
        weights below. {formatDollars(SAMPLE_BASE_ANNUAL)} is not a published
        premium. The words on the calculator are “Sample range. Baseline not
        cleared.”
      </p>
      <p>
        Low and high are a wide band around that likely figure because the
        baseline is not cleared. The bar under the numbers is modeled
        uncertainty with three markers. It is not a histogram of policies.
        Licensed rating data would be more precise. This tool does not claim
        otherwise.
      </p>
      <h2 className="text-base font-semibold">How the band widens</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Start at {SPREAD_BASE_LOW} times the likely figure through{" "}
          {SPREAD_BASE_HIGH} times it.
        </li>
        <li>
          Because the baseline is not cleared, subtract {SPREAD_UNCLEARED_LOW}{" "}
          from the low ratio and add {SPREAD_UNCLEARED_HIGH} to the high ratio.
        </li>
        <li>
          Age 16–18 or under 1 year licensed: subtract {SPREAD_NEW_DRIVER_LOW}{" "}
          from the low ratio and add {SPREAD_NEW_DRIVER_HIGH} to the high ratio.
        </li>
        <li>One incident: add {SPREAD_ONE_INCIDENT_HIGH} to the high ratio.</li>
        <li>
          Two or more incidents: subtract {SPREAD_REPEAT_INCIDENT_LOW} from the
          low ratio and add {SPREAD_REPEAT_INCIDENT_HIGH} to the high ratio.
        </li>
        <li>
          A state other than Illinois, Texas, or California: add{" "}
          {SPREAD_OTHER_STATE_HIGH} to the high ratio. Those three states are
          the only ones with a sample geography weight other than the flat{" "}
          {OTHER_STATE_WEIGHT.toFixed(2)}.
        </li>
        <li>
          State-minimum package: add {SPREAD_STATE_MINIMUM_HIGH} to the high
          ratio, because the statutory dollars are not loaded.
        </li>
        <li>
          Tesla Model Y Long Range stand-in: add {SPREAD_MODEL_Y_HIGH} to the
          high ratio as a sample for repair-cost uncertainty. This is not a loss
          table.
        </li>
      </ul>
      <p>
        Figures from the sample baseline are rounded to the nearest ten dollars.
        The monthly planning midpoint is the sample likely figure divided by 12,
        rounded to the nearest dollar.
      </p>
      <h2 className="text-base font-semibold">Sample display weights</h2>
      <p>
        An unchecked flag contributes 1. A deductible contributes 1 when the
        package has no comprehensive or collision. Model years 2022 through 2026
        use {YEAR_WEIGHT_RECENT.toFixed(2)}. Years 2019 through 2021 use{" "}
        {YEAR_WEIGHT_MID.toFixed(2)}. Years 2018 and earlier in this list use{" "}
        {YEAR_WEIGHT_OLDER.toFixed(2)}.
      </p>
      <WeightTable
        caption="Age band sample display weights"
        rows={Object.entries(AGE_WEIGHT).map(([key, weight]) => ({ key, weight }))}
      />
      <WeightTable
        caption="Years licensed sample display weights"
        rows={Object.entries(YEARS_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <WeightTable
        caption="Incident sample display weights"
        rows={Object.entries(INCIDENT_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <WeightTable
        caption="Mileage sample display weights"
        rows={Object.entries(MILEAGE_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <WeightTable
        caption="Flag sample display weights"
        rows={(
          Object.entries(FLAG_WEIGHT) as [keyof typeof FLAG_WEIGHT, number][]
        ).map(([key, weight]) => ({
          key: FLAG_LABELS[key],
          weight,
        }))}
      />
      <WeightTable
        caption="Preset state sample display weights"
        rows={[
          ...Object.entries(PRESET_STATE_WEIGHT).map(([key, weight]) => ({
            key,
            weight: weight ?? OTHER_STATE_WEIGHT,
          })),
          { key: "Any other state", weight: OTHER_STATE_WEIGHT },
        ]}
      />
      <WeightTable
        caption="Region class sample display weights"
        rows={Object.entries(REGION_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <WeightTable
        caption="Coverage sample display weights"
        rows={Object.entries(COVERAGE_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <WeightTable
        caption="Deductible sample display weights, physical damage only"
        rows={Object.entries(DEDUCTIBLE_WEIGHT).map(([key, weight]) => ({
          key: `$${Number(key).toLocaleString("en-US")}`,
          weight,
        }))}
      />
      <WeightTable
        caption="Vehicle stand-in sample display weights"
        rows={Object.entries(VEHICLE_WEIGHT).map(([key, weight]) => ({
          key,
          weight,
        }))}
      />
      <h2 className="text-base font-semibold">Coverage assumptions</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          State minimum: this state’s required liability. Dollar minimums load
          with the sourced state-rules table, which is not in this version. No
          comprehensive or collision.
        </li>
        <li>
          Standard liability: 100/300/100. No comprehensive or collision.
        </li>
        <li>
          Full coverage: 100/300/100, plus comprehensive and collision.
        </li>
        <li>
          High limits: 250/500/250, plus comprehensive and collision.
        </li>
        <li>Deductible choices: $500, $1,000, and $2,000. The opening deductible is $1,000.</li>
      </ul>
      <h2 className="text-base font-semibold">Presets</h2>
      <p>
        Molly opens the page: age 40–64, 10 or more years licensed, clean
        record, 7,500–15,000 miles, household policy, Illinois urban as a
        stand-in for Springfield, 2023 Ford F-150, full coverage, $1,000
        deductible. Jayden is 16–18, under 1 year licensed, clean, under 7,500
        miles, teen driver, good student, driver training, household policy,
        Texas suburban, 2023 Toyota RAV4, full coverage. Ava is 26–39, 4–9
        years licensed, clean, 7,500–15,000 miles, no driver flags, California
        urban, 2023 Tesla Model Y Long Range, full coverage, credit factor
        locked. Those driver bands are planning assumptions for the preset, not
        a record of a person.
      </p>
      <p>
        The vehicle list is three stand-ins. The NHTSA catalog is not loaded.
        Honda Civic and Hyundai Ioniq 5 N are not in this version. Trim
        confidence is not available.
      </p>
      <h2 className="text-base font-semibold">Optional current premium</h2>
      <p>
        An empty field uses the sample baseline. An annual amount from 1 to
        100,000 replaces that baseline for the open page. The likely figure
        starts at the amount entered, then moves in proportion if a control
        changes afterward. Clearing the field returns to the sample baseline.
        Choosing Molly, Jayden, or Ava clears the field. The amount stays in
        the page while it is open. This version does not store it or send it.
      </p>
      <h2 className="text-base font-semibold">Version</h2>
      <p>
        Model {MODEL_VERSION}. Data bundle {BUNDLE_VERSION}. The model version
        page is the changelog.
      </p>
    </TrustArticle>
  )
}

function WeightTable({
  caption,
  rows,
}: {
  caption: string
  rows: { key: string; weight: number }[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="py-2 text-left font-medium">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-1 pr-3 font-medium">
              Key
            </th>
            <th scope="col" className="py-1 font-medium">
              Sample display weight
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border">
              <th scope="row" className="py-1 pr-3 font-normal">
                {row.key}
              </th>
              <td className="py-1 font-mono">{row.weight.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
