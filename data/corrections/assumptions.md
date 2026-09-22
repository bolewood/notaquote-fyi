# Suggest-a-fix and count assumptions

Checked 22 September 2026. This is the builder's assumption log for the community feedback loop and the local counts.

## Suggest a fix

- There is no corrections backend. The earlier Supabase queue never went live (no credentials were ever configured) and has been removed, along with its `/api/corrections` route.
- `/corrections` ("Help make this better") links to GitHub issue forms in `.github/ISSUE_TEMPLATE/`: a number looks wrong, a state rule is missing or wrong, a vehicle is missing or classified wrong, something's broken, and a question. The visitor reviews and submits the issue on GitHub. Nothing is sent from this site.
- Links are built by `suggestFixUrl()` in `src/lib/suggest-fix.ts`. It uses GitHub's `template` query parameter to pick the form and prefills fields by their `id`. GitHub silently ignores a parameter that matches no field, so `src/lib/suggest-fix.test.ts` checks every prefilled id against the YAML.
- Issues are public, so a link may only prefill the field ids listed for its form, and callers pass only the site's own labels and values, never anything the visitor typed. As a safety net, values that look like a dollar amount (including fullwidth dollar signs), a VIN (even with spaces or dashes), an email address, or a phone number are dropped. The net can't catch a bare number, a name, or a street address; the tests pin those limits down. Liability minimums go in as "30/60/15". A page is reduced to its path, because share links keep scenario inputs (including an optional premium) in the query string. A source link can't point at this site. Links use `rel="noreferrer"` so the browser doesn't pass the current page address to GitHub.
- Reporting needs a free GitHub account, and the repository must be public for visitors to reach the forms.
- Form labels (`data`, `factors`, `state-rules`, `vehicles`, `bug`) are only applied if they exist in the repository. GitHub doesn't create missing labels.

## Counts

- Counts are not sent. Each payload is `{ "kind": "<one kind>" }`. The kinds are `calculator_session`, `persona_click`, `adjustment`, `save`, `share_link_copy`, `worksheet_print`, and `trust_page_view`. The browser keeps a tally of those seven numbers in `localStorage` under `notaquote.counts.v1`. The Privacy page shows that tally. There is no cookie, no advertising pixel, no session replay, no fingerprint, and no third-party script.
- The optional premium, a VIN, and scenario dollars are not arguments to the count recorder. A share-link copy records that the button was used. It does not record the link. An adjustment records that a control changed. It does not record the new value.
- Comparisons remain in `notaquote.comparisons.v1` on this browser. That store is separate from the count tally.
