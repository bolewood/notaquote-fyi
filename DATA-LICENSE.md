# Data license

The code in this repository is under the MIT license (see [LICENSE](LICENSE)). The data we put together is under a separate license, described here.

## Data we compile: CC BY 4.0

The tables, factors, and notes that NotAQuote.FYI contributors research and assemble are licensed under the [Creative Commons Attribution 4.0 International license (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You can copy, share, and adapt them for any purpose, including commercial use, as long as you give credit.

That covers, for example:

- the factor bundle and source manifest in `src/data/` (excluding the underlying HLDI source tables; see below)
- the state rule values and their sources (the values and citations only, not the code around them)
- the research notes and assumption logs in `data/`
- our selection and arrangement of the vehicle catalog in `public/catalog/`

The HLDI source files in `data/factors/sources/` (`hldi-*.csv` and `hldi-class-subtotals-*.csv`) are **not** covered by this repository's MIT or CC BY 4.0 licenses. They are the Highway Loss Data Institute's data, used with permission, and anyone reusing them needs HLDI's permission.

If you're not sure which license a file falls under, [ask us](https://github.com/bolewood/notaquote-fyi/issues/new?template=5-question.yml).

A credit line like this is plenty:

> Data from NotAQuote.FYI contributors, https://github.com/bolewood/notaquote-fyi, licensed CC BY 4.0.

Copyright (c) 2026 Bolewood Group, LLC and contributors.

## Third-party sources keep their own terms

Much of what we compile points to, or is drawn from, other people's public information: for example NHTSA's vPIC vehicle listings, FuelEconomy.gov's vehicle file, HLDI's insurance loss and claim-frequency tables, state insurance department pages, and state statutes. Our license covers our own work, not theirs. In particular, the HLDI source files in `data/factors/sources/` are HLDI's data, used with permission, and are not covered by the repo's MIT or CC BY 4.0 licenses; anyone reusing them needs HLDI's permission. Each third-party source keeps its own terms, and we list them, with links, on the site's **Data licenses** page (`src/app/data-licenses/page.tsx`) and in `src/data/source-manifest.json`.

If you reuse our data, please check the terms of any third-party source it relies on, too.

## Not a quote, not advice

The data is shared to help people plan. It isn't an insurance quote, and it isn't legal advice. It's provided as-is, without warranty, as described in section 5 of the CC BY 4.0 license.
