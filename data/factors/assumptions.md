# Factor engine assumptions

Checked 21 September 2026. This is an implementation note for model 0.2.0. It is not a clearance to use a premium table.

- The general base is not cleared. `runFactorEngine` returns no dollars unless the visitor has entered a current annual premium. That amount is the base for the open scenario only. Later control changes apply the ratio of the versioned factors to the factors at entry.
- Factor values are original planning relativities in hundredths. They are not the 0.1.0 sample display weights, not filed rates, and not computed from a premium, expenditure, exposure, or loss figure.
- State geography is 1.00 and thin for every state, because no state relativity is cleared. Changing state still names the geography family. The likely figure does not move from that key alone.
- Region, driver, coverage, and modeled vehicle classes can move the likely figure. An unmatched vehicle name stays at 1.00 and is thin, which widens the range.
- Trend is not applied. The BLS series CUUR0000SETE is cited in the manifest and no index value is stored.
- Credit stays locked at 1.00. There is no credit control.
- A limited or unresolved trim does not change the midpoint. It widens the range and lowers confidence from low to lower. Confidence does not rise above low while the baseline is uncleared.
- The opening screen still uses the labeled sample, including the signed Molly figures, so the first paint has dollars. Those figures are not the engine’s output.
- Engine dollars round to the nearest dollar and stay at or above 1. The sample display still rounds to the nearest ten dollars.
- Loan or lease sits in the coverage family. A deductible applies only when the package includes comprehensive and collision.
- NAIC rows cite the June 2025 supplement (AUT-PB 2023) and the December 2025 report (AUT-PB 2022-2023), say not cleared, and store no figures. The PDFs are not in the repository.
