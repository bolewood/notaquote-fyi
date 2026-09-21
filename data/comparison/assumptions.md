# Comparison, share, and worksheet assumptions

Checked 21 September 2026. This is the builder’s assumption log for sprint 5. It is not a review and it is not a sign-off.

- Saved scenarios live in `localStorage` under `notaquote.comparisons.v1`. There is no account and no server profile. The file stores inputs and, when the visitor entered one, the optional annual premium. It does not store a computed low, likely, or high.
- Saving the same inputs and the same anchor again replaces that row. A different anchor is a second row. The list keeps eight rows.
- One scenario is still one driver and one car. The household-policy flag stays a yes/no. There is no roster.
- Refresh keeps the saved list. The open field still clears on a reload that is not a share link, which is the sprint 4 rule.
- A share link is a query string on `/`. It records the inputs, model version, and data-bundle version. It does not record low, likely, high, or monthly. The optional premium is included only when the baseline is not cleared, and the page calls that amount the visitor’s anchor.
- Opening a link decodes it on the server so the first paint is the recomputed scenario, with the disclaimer. Dollar keys in a hand-edited link are ignored. If the model or data-bundle version is not the one on this page, the page says so and still runs the current engine. Model version stays `0.2.0`.
- The worksheet is the browser print dialog. Screen chrome is hidden. The sheet lists assumptions, coverage limits, source dates, both versions, the disclaimer, and blank lines for a licensed professional’s figure. No image, partner mark, or code into another site.
- The labeled sample still does not widen when a trim match is limited. That sample is not the engine. An anchored range still widens.
- The methodology sentence that said a limited trim leaves the confidence line low now says the line says lower.
- Manifest rows on Sources are stacked so the license note, including “Not cleared,” wraps inside the article.
