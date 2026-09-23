It's time for the yearly data refresh. The full recipe, with commands, is in [docs/DATA-REFRESH.md](https://github.com/bolewood/notaquote-fyi/blob/main/docs/DATA-REFRESH.md). Work on a branch named `data-refresh-YEAR` and tick these off as you go.

- [ ] **Start:** `main` is green; open `data` / `factors` / `state-rules` / `vehicles` issues are read and folded in where they have a source
- [ ] **Vehicle catalog:** `npm run catalog:build`, new model years present, `data/catalog/source-diff.md` reviewed
- [ ] **Typical price per state:** checked for a newer NAIC Auto Insurance Database Report (updated if there is one)
- [ ] **Price trend:** latest BLS CUUR0000SETE month pinned, `npm run factors:build`
- [ ] **State rules:** scheduled changes applied; every state re-checked for new laws; `checkedOn` and `version` bumped
- [ ] **Rate surveys:** each survey in `data/factors/sources/sources.json` checked for a new edition; factors rebuilt; big moves explained
- [ ] **HLDI:** permission status checked; newer model years pulled in (or `useHldiModels` switched off)
- [ ] **Everything else:** fleet age, source manifest, `MODEL_VERSION` if the math changed, help-wanted list
- [ ] **Check:** lint, typecheck, test, build, `factors:build` leaves no diff, the site and the API clicked through
- [ ] **Write it down:** `CHANGELOG.md` entry, What's changed page entry, README screenshots if the UI changed
- [ ] **Ship:** PR merged, `data-YYYY.MM` tag pushed, this issue closed

Tip: an AI coding assistant can do most of this. Point it at docs/DATA-REFRESH.md and ask it to stop before any judgment call.
