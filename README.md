# NotAQuote.FYI

A free, open-source calculator for planning what car insurance might cost. It's being built to answer questions like *"What happens to my insurance if I buy a Tesla Model Y?"* and *"Show my 15-year-old a table of 15 cars and let them narrow it down."* It gives you a ballpark range, not a quote, shows where its numbers come from, and lets anyone fix a number that's wrong.

> **This is early.** The calculator works, but a lot of its numbers are still being sourced. Where we don't have a public source yet, the site says so and the range gets wider. The [roadmap](docs/ROADMAP.md) lays out what's done and what's next, and it's a good place to find something to help with.

## Why it exists

Car insurance prices depend on a handful of big things: who's driving, where, what car, and how much coverage. A lot of what's publicly known about those things is scattered across state insurance department guides, statutes, and government datasets, often in PDFs that few people ever read. NotAQuote.FYI pulls that public information into one place and turns it into something you can play with: change the car, the driver, or the coverage, and see roughly what moves.

It's in the spirit of [collegedata.fyi](https://collegedata.fyi): public information, made easy to use.

It is not an insurance company, agent, or broker, and it doesn't sell anything or pass your information to anyone. Only an insurer can give you a real price.

## Your privacy

- **No account, and nothing to sign up for.**
- **Your inputs stay in your browser.** The math runs on your device. We don't collect or store your answers.
- **One exception, and only if you use it:** if you type in a VIN, your browser sends it straight to NHTSA's free vehicle decoder to look up the car. We don't keep it.
- **No cookies, ad trackers, or analytics scripts.**
- **Saved comparisons stay on your device.** Share links do include the inputs for that scenario (including your current premium, if you entered one), so share them the way you'd share any personal note.

## Quickstart

You'll need [Node.js](https://nodejs.org/) 20.19 or newer (22+ recommended).

```bash
git clone https://github.com/bolewood/notaquote-fyi.git
cd notaquote-fyi
npm install
npm run dev
```

Open [http://127.0.0.1:41731](http://127.0.0.1:41731). No API keys, environment variables, or database needed.

Other scripts: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. [CONTRIBUTING.md](CONTRIBUTING.md) explains each one.

## How the numbers work

The idea is simple, and the goal is that every piece of it can be checked:

1. **A starting point.** If you tell us what you pay now, we start from your real number. If you don't, we start from a typical premium for your state: roughly what drivers there pay in a year, taken from a public source. (We now have one for every state and DC: NAIC's 2023 average for liability plus collision and comprehensive, listed on the Sources page. The calculator doesn't start from it yet; until it does, the site tells you plainly what it's starting from.)
2. **Factors.** Each thing that changes the price, like the driver's age, the car, the deductible (the part of a claim you pay yourself), or the coverage level, is a multiplier. Each multiplier should cite a public source and the date it was checked.
3. **A range, not a price.** Where we're less sure, the range gets wider. Real quotes can land above or below it.

Every dollar figure should come from one set of math that runs in your browser and has a version number, so you can tell when it changes. We're partway through that switch; the [roadmap](docs/ROADMAP.md) has the details. The site's methodology and sources pages show the factors, where they came from, and which version of the data you're looking at.

## What's where

| Path | What's in it |
| --- | --- |
| `src/app/` | The pages. The calculator is `page.tsx`; the rest are the explainer pages (methodology, sources, privacy, and so on). |
| `src/components/` | The building blocks of the interface. |
| `src/lib/` | The logic: the factor engine (`factor-engine.ts`), state rules (`state-rules.ts`), typical premium by state (`state-baselines.ts`), scenario options (`scenario.ts`), the vehicle catalog, share links, "Suggest a fix" links (`suggest-fix.ts`), and the tests (`*.test.ts`). |
| `src/data/` | The factor bundle and the list of sources, as JSON. |
| `public/catalog/` | The vehicle catalog, built from NHTSA and FuelEconomy.gov data. |
| `scripts/` | The script that rebuilds the vehicle catalog (`npm run catalog:build`). |
| `data/` | Research notes for each kind of data, plus two data files you can edit directly: the state minimums (`data/state-rules/state-rules.json`, 50 states and DC, each with sources and a check date) and the typical premium by state (`data/state-baselines/state-baselines.json`). |
| `docs/` | The [roadmap](docs/ROADMAP.md) and the [voice guide](docs/VOICE.md) for anything a visitor reads. |
| `.github/` | Issue forms, the pull request template, and CI. |

## How to help

You don't need to write code to help.

- **A number looks wrong?** [Tell us](https://github.com/bolewood/notaquote-fyi/issues/new?template=1-number.yml), ideally with a link to a better source.
- **Your state's rules are missing or wrong?** [Report a state rule](https://github.com/bolewood/notaquote-fyi/issues/new?template=2-state-rule.yml). A link to your state insurance department or the statute is perfect.
- **A car is missing or in the wrong group?** [Report a vehicle](https://github.com/bolewood/notaquote-fyi/issues/new?template=3-vehicle.yml).
- **Something's broken?** [Report a bug](https://github.com/bolewood/notaquote-fyi/issues/new?template=4-bug.yml).
- **Just have a question?** [Ask it](https://github.com/bolewood/notaquote-fyi/issues/new?template=5-question.yml).
- **Want to send a fix?** Start with [CONTRIBUTING.md](CONTRIBUTING.md). The one rule to remember: every number needs a public source and the date you checked it.

Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem privately, see [SECURITY.md](SECURITY.md).

## Licenses

- **Code:** [MIT](LICENSE).
- **Data we compile** (factors, state rules, research notes): [CC BY 4.0](DATA-LICENSE.md). Use it for anything; just give credit.
- **Third-party sources** like NHTSA, FuelEconomy.gov, and state insurance departments keep their own terms. They're listed on the site's Data licenses page.

Published by Bolewood Group, LLC, with help from contributors.
