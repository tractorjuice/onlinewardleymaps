# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a fork of `damonsk/onlinewardleymaps`. The active codebase was re-forked from upstream `main` in April 2026 and is a **monorepo**:

- `frontend/` — Next.js 16 app deployed to Vercel (`https://create.wardleymaps.ai`).
- `frontend/wmlandscape/` — npm package (`wmlandscape`) that re-exports parsing/rendering pieces from `frontend/src/` for use by the VSCode and Obsidian extensions. Its `src/index.js` is a flat re-export of the relevant `frontend/src/...` modules.
- Repo root has a near-empty `package.json` (only `husky`); all real work lives under `frontend/`.

**Active branch is `ai-rebrand`.** `master` is the legacy CRA snapshot frozen in 2023 — do not modify. `Development` and `Enhancements` branches contain documentation written against the legacy CRA codebase and are stale; do not merge them. See `enhancements.md` (cherry-picked, with a banner explaining its staleness) for the product roadmap.

## Commands (run from `frontend/`)

Package manager is **yarn**. Node 24 is used in CI and on Vercel.

- `yarn dev` — Next dev server with Turbopack on http://localhost:3000.
- `yarn dev:webpack` — fallback to Webpack if Turbopack misbehaves.
- `yarn build` — production build (Next + Turbopack).
- `yarn start` — serve a built app locally.
- `yarn test` — Jest, jsdom env. Add `--watch` or pass a filter, e.g. `yarn test -- -t "should create links"` or `yarn test src/__tests__/utils/dependencyGraph.test.ts`.
- `yarn lint` — ESLint flat config (`frontend/eslint.config.mjs`) over the whole tree, with `--fix`.
- `yarn format` — Prettier 3.
- `yarn package` — builds the `wmlandscape` npm package via Rollup (`yarn --cwd wmlandscape build`).
- `yarn validate-translations` — runs `check-translation-completeness` + `find-untranslated:strict`. Useful before merging anything that touches `public/locales/**/*.json`.

CI is at `.github/workflows/main.yml` — only builds `wmlandscape`. Vercel handles the frontend deploy on push to the production branch.

## Architecture

### Single page, hash-based routing

The whole app is `frontend/pages/index.tsx`. There are no other routes (no `[id].tsx`). Map identity is in the URL **hash**: `https://create.wardleymaps.ai/#<mapId>` loads a map; `#clone:<mapId>` clones it. The page reads `window.location.hash` on mount **and on every `hashchange` event** (added in this fork — upstream only read it once on mount, which broke in-tab navigation).

i18n: `next-i18next` with locales `en, es, fr, de, it, pt, ja, zh, ko`. `defaultLocale: 'en'` keeps English at `/` (no `/en` prefix), so existing hash bookmarks like `https://create.wardleymaps.ai/#abc123` continue to work. Translation strings live in `frontend/public/locales/<lang>/common.json`. The brand strings (`app.title`, `app.name`, `app.description`, footer credits) have been customised per locale for the AI rebrand.

### State flow

`frontend/src/components/MapEnvironment.tsx` is the shell. Map state is owned by `useUnifiedMapState` (in `frontend/src/hooks/useUnifiedMapState.ts`). It holds:

- `state.mapText` — the canonical source of truth (the editor's text)
- `state.map` — the parsed `UnifiedWardleyMap` derived from `mapText`
- a pile of UI state (highlightedLine, evolution offsets, dimensions, etc.)

`useLegacyMapState` exposes the same data in a backward-compat shape so that components ported from CRA can still read `mapComponents`, `mapAnchors`, `mapLinks`, etc.

There are **two** `mutateMapText` setters in MapEnvironment, and the difference matters:

1. **Enhanced** (`MapEnvironment.tsx` line ~258) — calls `undoRedoContext.recordChange()` + `setMapText` + parse + `setMap` + `setSaveOutstanding(true)`. Used for **user edits** (editor onChange, drag-to-mutate operations).
2. **Simple** (`legacyState.mutateMapText` from `useUnifiedMapState`) — just `setMapText`. Used for **remote map loads** so we don't record a 10KB undo entry per navigation, don't parse 3 times, and don't briefly flag save-outstanding.

The remote-load path is wired through `useMapPersistence` with the simple setter (`MapEnvironment.tsx` line ~323). Don't pass the enhanced one — the cumulative cost across navigations is significant.

### Parsing pipeline (`frontend/src/conversion/`)

`Converter.parse(text)` runs a sequence of `*ExtractionStrategy` instances against the text:

1. `stripComments` removes `//` line comments (except on `url` lines) and `/* ... */` blocks.
2. Strategies in order: `Title`, `XAxisLabels` (evolution stage names), `Presentation`, `Note`, `Annotation`, `Component`, `Pipeline`, `Evolve`, `Anchor`, `Links`, `SubMap`, `Url`, `Attitude`, `Accelerator`. Each scans the whole text for lines starting with its keyword and merges results into the wardley-map object.
3. `LinksExtractionStrategy` runs near the end and processes **every line that doesn't start with a known keyword** (see its `notLinks` blocklist).

**Adding a new top-level keyword:** you MUST add it to `LinksExtractionStrategy.notLinks` or lines with that keyword get misparsed as links and accumulate ParseError noise. Note that upstream's `notLinks` is missing `market`, `ecosystem`, and `y-axis` — those keywords still parse correctly via their own strategies, but they also produce ParseErrors via the link parser. Worth fixing in a follow-up.

`UnifiedConverter` (in the same directory) wraps `Converter` and remaps the legacy result to the new `UnifiedWardleyMap` type used by the modern renderer. **Caveat:** `UnifiedConverter.transformAllComponentTypes` doesn't currently transform `markets` or `ecosystems` from `legacyMap.markets`/`legacyMap.ecosystems` into the unified map. The `createEmptyMap()` initialiser sets them to `[]`, so they're silently dropped during transformation. Maps that use `market` lines will parse the keyword but those entries won't appear in the unified rendering pipeline.

Strategies extend `ExtendableComponentExtractionStrategy` or use `BaseStrategyRunner` (or `PipelineStrategyRunner` for nested pipelines) plus composed decorator functions from `frontend/src/constants/extractionFunctions.ts`. To add a new attribute to existing components, write a new extraction function and insert it into the relevant strategy's decorator list — don't duplicate parsing logic.

### Rendering

`MapEnvironment` composes `MapCanvas` → `MapElements` (the merged draw list) → `LinksBuilder`. The link variants live in `frontend/src/linkStrategies/` (`*LinksStrategy.ts`, ~14 of them — one per link variant: evolving→evolving, evolved→evolved, anchor→component, flow vs. non-flow, future/past arrows, etc.). `LinksBuilder.canSatisfyLink` filters out links whose endpoints aren't present in the relevant element sets.

To change how a specific link variant renders, edit the corresponding strategy — do not special-case inside `ComponentLink`.

### Component-link highlighting

`frontend/src/utils/dependencyGraph.ts` builds a transitive-descendants graph for hover highlighting (hover a component → highlight everything downstream). This file has a **performance gotcha**: the original recursive walk cloned the visited Set on every recursive call (`new Set(visited)`), making it O(N × 2^N) for diamond-pattern DAGs. On a real ~80-component map this caused a 20+ second main-thread block.

The current implementation (committed on this fork in `9f56fa9`) memoises per-component results and snapshots direct descendants before mutating `node.descendants`. Linear time. **Do not "simplify" by removing the snapshot** — `node.descendants` is mutated mid-iteration in the outer loop, so the cache must read pre-mutation values from the snapshot.

This same bug exists in upstream `damonsk/onlinewardleymaps` and should be PR'd back.

### Text mutation on drag (`frontend/src/components/map/positionUpdaters/`)

When a user drags an element, the component invokes a `PositionUpdater` that **rewrites the matching line in `mapText`** rather than mutating any state object. Three updater types exist:

- `DefaultPositionUpdater` — scans every line, runs matcher/action pairs from its `replacers` array.
- `LineNumberPositionUpdater` — updates a specific line number when the same name appears multiple times (e.g. the same component on two anchors).
- `SingletonPositionUpdater` — for keywords that can only appear once (e.g. `annotations` box position).

Matchers (`ExistingCoordsMatcher`, `ExistingSingleCoordMatcher`, `NotDefinedCoordsMatcher`, `ExistingManyCoordsMatcher`, `NotDefinedManyCoordsMatcher`, `ExistingMaturityMatcher`) decide which line applies and how to substitute coords. When adding a new draggable keyword, pick a matcher/action pair per case rather than writing new regex inline.

### Persistence

Map storage is the Cloudflare Worker `maps` (zone `wardleymaps.ai`) backed by R2 via the `MAPS` binding. Endpoints: `POST /v2/maps/save`, `GET /v2/maps/fetch?id=<id>`. The Worker code lives in Cloudflare itself, not in this repo.

Frontend wiring: `frontend/src/constants/defaults.ts` reads `process.env.NEXT_PUBLIC_API_ENDPOINT` (build-time substitution). Vercel project env var is `https://maps.wardleymaps.ai/v2/maps/`. **Changing this value requires a redeploy** because `NEXT_PUBLIC_*` is inlined at build, not runtime.

Worker CORS allows `https://create.wardleymaps.ai` plus the Vercel preview pattern `^https://onlinewardleymaps[-a-z0-9]*-tractorjuices-projects\.vercel\.app$`. If you publish from a new Vercel team, update the Worker regex.

Load flow: `useMapPersistence.loadFromRemoteStorage` → `LegacyApiLoadStrategy` → `fetch ${Defaults.ApiEndpoint}fetch?id=<id>` → simple-setter `mutateMapText`. The single-source-of-truth update propagates through `useMapParsing`'s memo + a `useEffect` in MapEnvironment that calls `mapActions.setMap`.

### Editor

The Ace editor is via `react-ace` (v14), which uses `ace-builds` directly (no `brace`). Custom `owm` mode for syntax highlighting is loaded by react-ace; the autocomplete prefix list is in `frontend/src/constants/editorPrefixes.ts`. New keywords should be added there so they appear in autocomplete.

### Persistence vs save flag

After loading a map, `setSaveOutstanding(false)` is called explicitly because some upstream code paths flag it true. Don't remove that — without it, navigation would briefly show "unsaved" status.

### Feature switches

`frontend/src/constants/featureswitches.ts` exports a static `featureSwitches` object provided via `FeatureSwitchesProvider`. Currently:

- `enableNewPipelines: true` — uses `PipelineStrategyRunner` (supports `pipeline X { ... }` block form). Old single-line form `pipeline X [a, b]` still works.
- `enableLinkContext: true`
- `enableAccelerators: true`
- `enableModernComponents: true` — Phase 4 unified rendering path. If you see weird rendering issues on big maps, try flipping this off as a debug step.
- `enableDoubleClickRename`, `enableNoteInlineEditing`, etc. — UX features.

The provider value is stable (imported from a static module), so consumers can rely on referential equality for memoization.

### Tests

Tests live in `frontend/src/__tests__/` and as colocated `*.test.tsx`. Jest config at `frontend/jest.config.js`, jsdom environment. The `.jest/register-context.js` shim isn't used here (there's no Storyshot equivalent — Storybook was removed during the upstream rewrite).

Translation completeness is checked by scripts in `frontend/scripts/`: `check-translation-completeness.js` and `find-untranslated.js`. These are wired into the precommit hook and are sensitive to missing keys across locale files.

## Conventions

- 4-space indent, single quotes, trailing commas (TypeScript). Prettier 3 + ESLint 9 (flat config) enforce this.
- TypeScript strict; types live in `frontend/src/types/` (`base.ts` for legacy shapes, `unified/` for the modern model).
- All UI text goes through `useI18n().t()` with a fallback string. Never hardcode user-visible English.
- For new components, prefer functional + hooks; the codebase has one remaining class component (`MapView` upstream, may be retained for compatibility).

## Notable fork-specific deltas from upstream

These commits on `ai-rebrand` are unique to this fork:

1. **AI rebrand** — `frontend/public/locales/*/common.json`, `frontend/src/components/page/Footer.tsx`, `frontend/src/components/page/NewHeader.tsx` (Patreon menu item removed). Plus deletion of upstream's self-host infrastructure (`api/`, `Dockerfile`, `docker-compose.yml`, docker workflows) — we deploy via Vercel, not Docker.
2. **Hashchange listener** in `frontend/pages/index.tsx`. Upstream only reads `window.location.hash` once on mount; we add a `hashchange` listener so in-tab navigation works.
3. **Simple setter on remote load** in `frontend/src/components/MapEnvironment.tsx`. Avoids 3x parse + undo bloat per navigation.
4. **`findAllDescendants` memoisation** in `frontend/src/utils/dependencyGraph.ts`. The O(2^N) → O(N+E) fix described above.

(2), (3), and (4) are upstream bugs and worth a PR back to `damonsk/onlinewardleymaps`.

## Common pitfalls

- **Adding a top-level keyword without updating `LinksExtractionStrategy.notLinks`** — silently produces ParseError noise.
- **Editing a `mutateMapText` callsite without thinking about which variant** — enhanced (records undo) vs simple (just setMapText). Wrong choice produces UX bugs that don't show up in unit tests.
- **Removing the `directDescendants` snapshot in `dependencyGraph.ts`** — looks redundant but is load-bearing because the outer loop mutates `node.descendants`.
- **Touching `NEXT_PUBLIC_API_ENDPOINT` and not redeploying** — the value is build-time inlined, not runtime read.
- **Editing one English locale string without the matching change in the other 8 locales** — translation completeness check will fail in CI.
- **Modifying `master`** — that branch is the frozen 2023-era CRA fork, archived for emergency rollback only. All work goes on `ai-rebrand` (or whatever supersedes it).

## Infrastructure quick-reference

| What | Where | How to change |
|---|---|---|
| Frontend hosting | Vercel project `onlinewardleymaps` (team `tractorjuices-projects`) | `vercel` dashboard or `vercel` CLI |
| Production domain | `https://create.wardleymaps.ai` | Vercel → Domains |
| Build env var | `NEXT_PUBLIC_API_ENDPOINT` | Vercel → Settings → Environment Variables (then redeploy) |
| Map storage API | Cloudflare Worker `maps`, account `Mark.craddock@borovets.eu's Account` | Edit via `wrangler` (no current source repo — code lives in Cloudflare). To recover the Worker code: `cloudflare-api` MCP `GET /accounts/<id>/workers/services/maps/environments/production/content`. |
| Map data | R2 bucket bound to the Worker as `MAPS` | Worker code uses `MAPS.put`/`MAPS.get` |
| Production branch on Vercel | `ai-rebrand` (after this session's promotion) | Vercel → Settings → Git → Production Branch |
