# NotAQuote.FYI

Privacy-first personal auto insurance planning calculator. The homepage is the calculator. It opens on a finished sample scenario for one driver and one vehicle.

With no current annual premium entered, the dollars are a labeled sample. The baseline is not cleared. Those figures are not the factor engine. Entering a current annual premium makes that amount the anchor for the open scenario only. The engine then applies versioned factors in the browser. The premium is not sent to a server. A saved comparison can keep it in this browser’s local storage. A share link can include it only as that anchor.

Publisher: Bolewood Group, LLC.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 41731.

Open [http://127.0.0.1:41731](http://127.0.0.1:41731).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm test` — checks the labeled sample, the factor engine, the disclaimer, the catalog, the state-rules table, comparisons, the corrections queue, and count payloads

## Vehicle catalog

The committed snapshot is `public/catalog/vehicle-catalog.json`. It was retrieved on 21 September 2026.

- NHTSA vPIC: https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/
- FuelEconomy.gov file: https://www.fueleconomy.gov/feg/epadata/vehicles.csv
- FuelEconomy.gov description: https://www.fueleconomy.gov/feg/ws/index.shtml

Rebuild it with `npm run catalog:build`. The script writes the snapshot, `src/lib/catalog-meta.ts`, `src/lib/catalog-defaults.ts`, and `data/catalog/source-diff.md`. Raw downloads stay in `.catalog-cache` and are not committed. Assumptions for this join are in `data/catalog/assumptions.md`.

Year, make, model, and trim read that file in the browser. An optional VIN is sent from the browser to NHTSA and then discarded.

## This version

Molly, Jayden, and Ava are one-click presets. Their default vehicles resolve in the catalog snapshot. Coverage packages are assumptions with their limits written on the page. Standard liability stays 100/300/100. Full coverage stays 100/300/100 plus comprehensive and collision. High limits stay 250/500/250 plus comprehensive and collision.

The state-rules table is version `state-rules-2026-09-21` in `src/lib/state-rules.ts`. Six rows cite a statute or insurance-department page opened on 21 September 2026: California, Texas, Florida, New York, Pennsylvania, and Illinois. The other 45 rows have no source URL and no dollar minimum. The State minimum control shows a liability figure only when that row has a source. Credit is unreviewed and the factor is 1.00 on every row. The reviewer field is unsigned. Research notes are in `data/state-rules/assumptions.md`. This is source research, not a legal conclusion.

With no premium entered, displayed dollars remain the labeled sample. Model `0.2.0` and data bundle `factors-2026-09-21` run in the browser when a current annual premium is entered. The source manifest is `manifest-2026-09-21`. NAIC rows for the June 2025 supplement (AUT-PB 2023) and the December 2025 report (AUT-PB 2022-2023) say not cleared and contain no figures. BLS CPI is not applied. There is no account and no document upload.

Saved comparisons stay in this browser. A share link encodes inputs and the model and data-bundle versions, then the page recomputes. Print uses the browser print dialog. Assumptions for that slice are in `data/comparison/assumptions.md`.

The corrections form is at `/corrections`. It asks for a state, a page, a source URL, and one category. It has no name, email, phone, carrier, premium, or note. This environment has no Supabase credentials, so the queue is not live: the form is disabled and does not save a row. Do not invent keys.

Product counts stay in this browser under `notaquote.counts.v1`. A payload is `{ "kind": "calculator_session" }` or one of `persona_click`, `adjustment`, `save`, `share_link_copy`, `worksheet_print`, and `trust_page_view`. It does not include a premium, a VIN, or scenario dollars. Nothing is sent. The Privacy page shows the tally. Assumptions are in `data/corrections/assumptions.md`.

Search engines are asked not to index the site (`noindex, nofollow`).
