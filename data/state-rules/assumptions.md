# State-rules assumptions

Version: `state-rules-2026-09-21`

Checked: 21 September 2026

This note is source research for the `state_rules` table. It is not a legal conclusion, not coverage advice, and not a premium baseline. No NAIC premium, expenditure, exposure, or loss figure is in the table. The reviewer field is null on every row. This file does not sign the sprint production-grade.

## What a row is allowed to say

A dollar amount is recorded only when a statute or insurance-department page opened on 21 September 2026 stated that amount. A row with no source URL has null bodily-injury and property-damage fields. The calculator then says the sourced table has no figure yet and does not print a dollar sign.

`pipRequired`, `noFault`, `umRequired`, and `uimRequired` are true when an opened page described that item as required with no written removal. `required-unless-written-deletion` and `required-unless-written-rejection` mean the page says the policy is not to be issued unless the coverage is included, and a written deletion or rejection removes it. Those values are not false. False means the opened page said the purchase is optional. Pennsylvania says purchase of uninsured and underinsured motorist coverage is optional. New York describes supplementary uninsured/underinsured coverage as coverage that can be purchased. Null means this check did not record the point.

Credit is `unreviewed` and the factor is `1.00` on all 51 rows, including the rows with no source. No state is hard-coded as a no-credit state.

Standard liability, full coverage, and high limits stay the locked assumptions: 100/300/100 and 250/500/250. The sample range does not multiply by these statutory dollars. It stays labeled baseline not cleared.

## Pages opened

California liability: Vehicle Code section 16056, paragraph (a)(2), for a policy or bond issued or renewed on or after 1 January 2025: $30,000 / $60,000 / $15,000. Paragraph (a)(1) still states $15,000 / $30,000 / $5,000. Paragraph (d) states a further increase on or after 1 January 2035. The row uses paragraph (a)(2) only. The DMV insurance-requirements page states the same three figures. Insurance Code section 11580.2 says the policy is not to be issued unless uninsured-motorist coverage is in it, unless a named insured deletes it in writing. The same page says an uninsured motor vehicle includes an underinsured motor vehicle. The row marks both required unless deleted in writing. It does not add a separate dollar for that coverage. No PIP or no-fault figure was on the pages opened.

Texas liability: Transportation Code section 601.072(a-1): $30,000 / $60,000 / $25,000, effective 1 January 2011. Subsection (b) permits excluding the first $250 / $500 / $250. Those exclusions are not subtracted. Insurance Code sections 1952.101 and 1952.152 say the insurer may not issue the policy unless uninsured or underinsured motorist coverage and personal injury protection are provided, and that a written rejection removes them. The row marks those coverages required unless rejected in writing.

Florida property damage: section 324.022 states $10,000. The same section says the requirement may be met by at least $30,000 combined property-damage and bodily-injury liability. That combined amount is not recorded as a bodily-injury minimum. Bodily injury stays null. Section 627.730 names the Florida Motor Vehicle No-Fault Law. Section 627.736 states required personal injury protection of $10,000 in medical and disability benefits and $5,000 in death benefits. No uninsured-motorist section was opened, so those flags stay null.

New York: the Department of Financial Services page “How much auto insurance must I carry?” states $25,000 / $50,000 / $10,000, mandatory no-fault coverage of $50,000, and required uninsured-motorist bodily-injury coverage at the same minimums. Supplementary uninsured/underinsured coverage is described as something that can be purchased and that must be offered, so UIM is not marked required. Vehicle and Traffic Law section 311 did not load. The row cites the department page that opened, not a statute this check could not read.

Pennsylvania: the PennDOT insurance-law FAQ and Title 75 section 1702 both state $15,000 / $30,000 / $5,000. Section 1711(a) requires a medical benefit of $5,000, so PIP is marked required. No-fault is not marked. Section 1731(a) says purchase of uninsured and underinsured motorist coverages is optional, so those flags are false.

Illinois: 625 ILCS 5/7-203 states $25,000 / $50,000 / $20,000. 215 ILCS 5/143a requires uninsured-motorist bodily-injury coverage at those limits, so UM is marked required. Underinsured motorist coverage, PIP, and no-fault were not recorded from the pages opened.

## What was not done

The other 45 jurisdictions, including Ohio, have a row and no source URL. Ohio is the example of a blank. This check did not guess a minimum for them.

The special consumer-notice sentence is drafted beside State minimum and on the disclaimer page. It is marked “For counsel, not a legal conclusion.” It does not hide the calculator.

No permission letter was drafted.
