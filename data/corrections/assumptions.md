# Corrections queue and count assumptions

Checked 21 September 2026. This is the builder’s assumption log for sprint 6. It is not a review and it is not a sign-off.

- Supabase is the only intended store for a correction row. This environment has no `SUPABASE_URL` and no `SUPABASE_SERVICE_ROLE_KEY`, and the Supabase connection is not authenticated. The queue is not live. The form is disabled and says so. A POST to `/api/corrections` returns `saved: false` and does not write a row.
- No key is committed. The service-role key, if an operator adds one later, stays on the server. The browser does not receive it. The client does not use a public anon key.
- A row, when a live queue accepts one, has four columns: `state` (postal code), `page` (a fixed page id), `source_url` (one http or https URL), and `category` (`wrong-minimum`, `stale-source`, `vehicle-mapping`, `display-error`, or `other`). The labels on the form are Wrong minimum, Stale source, Vehicle mapping, Display error, and Other. There is no name, email, phone, carrier, premium, VIN, note, or scenario.
- The page field is which page on this site the correction refers to, chosen from a list. It is not a free-text note. “Other” is a category with no extra sentence.
- Counts are not sent. Each payload is `{ "kind": "<one kind>" }`. The kinds are `calculator_session`, `persona_click`, `adjustment`, `save`, `share_link_copy`, `worksheet_print`, and `trust_page_view`. The browser keeps a tally of those seven numbers in `localStorage` under `notaquote.counts.v1`. The Privacy page shows that tally. There is no cookie, no advertising pixel, no session replay, no fingerprint, and no third-party script.
- The optional premium, a VIN, and scenario dollars are not arguments to the count recorder. A share-link copy records that the button was used. It does not record the link. An adjustment records that a control changed. It does not record the new value.
- Comparisons remain in `notaquote.comparisons.v1` on this browser. That store is separate from the count tally.
