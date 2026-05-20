# GitHub + Mermaid wardley-beta support — Design

**Date:** 2026-05-20
**Target codebase:** `ai-rebrand` — `frontend/` (Next.js 16, TypeScript)
**Target Mermaid version:** 11.15.0

## Overview

Let a user open a Wardley map that is stored as a **Mermaid `wardley-beta`** code
fence inside a file in a GitHub repository, edit it in OnlineWardleyMaps (OWM),
and commit the changes back to the same file.

Mermaid's `wardley-beta` diagram type (shipped in Mermaid 11.14.0, refined in
11.15.0) deliberately adopted OWM's `[visibility, evolution]` coordinate format
and keyword names. GitHub renders `wardley-beta` fences natively. This makes a
GitHub repo a viable, human-readable, version-controlled store for Wardley maps —
the map is both editable in OWM and visible in the repo.

The feature is two independent pieces:

1. A **bidirectional Mermaid converter** (OWM DSL ↔ Mermaid `wardley-beta`).
2. A **GitHub persistence strategy** that plugs into the existing
   `LoadMap` / `SaveMap` strategy dispatchers in `frontend/src/repository/`.

## Goals

- Open a map from a GitHub file URL pasted by the user.
- Edit it as a normal OWM map.
- Commit the edited map back to the same file on the same branch.
- Preserve any prose surrounding the fence in a Markdown file.
- Lose no map data on a GitHub round-trip, even for OWM features Mermaid
  cannot render.

## Non-goals (YAGNI — explicitly out of scope)

- OAuth sign-in, GitHub App installation.
- A repo file browser / tree navigator.
- Pull-request or branch-creation flows.
- Hash deep-linking (`#github:...`). Noted as a future enhancement. Consequence:
  **reloading the browser loses the in-memory GitHub binding** and the user must
  re-paste the URL to save again.
- More than one `wardley-beta` fence per file (only the first is used).

## Decisions captured during brainstorming

| Topic | Decision |
|---|---|
| Core capability | GitHub repo integration (load + commit-back). |
| Repo storage format | Mermaid `wardley-beta` is the canonical stored format. |
| Auth | Fine-grained Personal Access Token (PAT) pasted by the user. No backend OAuth. |
| Open flow | Paste a `github.com/.../blob/...` URL. |
| Save flow | Regenerate the fence, commit directly to the same file/branch, prompting for a commit message. |
| Unsupported OWM keywords on export | Kept as `%%` Mermaid comments (lossless round-trip). |
| Converter origin | Port the validated `tools/convert.mjs` from `tractorjuice/wardley-maps-mermaid` to TypeScript, modified to emit comments instead of dropping. |

## Architecture

### Component 1 — Mermaid converter (`frontend/src/conversion/mermaid/`)

Because Mermaid `wardley-beta` reuses OWM's coordinate format and keyword names,
the converter body is largely a pass-through.

#### `MermaidExporter.ts` — OWM `mapText` → Mermaid `wardley-beta`

Ported to TypeScript from `owmToMermaid()` in
[`tractorjuice/wardley-maps-mermaid` `tools/convert.mjs`](https://github.com/tractorjuice/wardley-maps-mermaid/blob/main/tools/convert.mjs).
That converter is validated: 147/147 maps parse and render with the real Mermaid
11.15.0 parser, and `test-fidelity.mjs` reports 100% component/anchor/link
retention with `|Δε| = 0` across 4,905 matched element pairs.

Behaviour carried over from the original:

- Emit `wardley-beta` as the first line, followed by `title` and an
  auto-injected `size [1100, 800]`.
- Pass through keywords shared with OWM: `title`, `size`, `component`, `anchor`,
  `evolve`, `pipeline`, `evolution`, `note`, `annotation` / `annotations`,
  links / flow, inertia, sourcing decorators (`(build)`, `(buy)`, `(outsource)`).
- Conservative name quoting (the `convert.mjs` quoting rules): names that match
  the safe regex are left unquoted; all others are double-quoted with internal
  quotes escaped.
- Pipeline child detection (explicit `{}` blocks open a Mermaid pipeline scope;
  implicit proximity-detected children are auto-injected).
- `evolve` number-safety reformatting (position is a number followed by
  whitespace/EOL, so names like `Lamp / .Net` do not misparse).
- Strip `//` line comments and `/* */` blocks; collapse consecutive blank lines.

**The one behavioural change from the original:** OWM keywords with no
`wardley-beta` equivalent — `market`, `ecosystem`, `submap`, `url`,
`pioneers` / `settlers` / `townplanners`, `accelerator`, `style`,
`x-axis` / `y-axis` — are **emitted as `%% <original line>` Mermaid comments**
rather than silently dropped. This makes the export lossless on a round-trip.

Signature:

```ts
function exportToMermaid(
  mapText: string,
  titleFallback?: string,
): { mermaid: string; keptAsComments: string[] };
```

`keptAsComments` lists the original lines preserved as comments, so the UI can
warn the user which parts of the map GitHub will not render.

#### `MermaidImporter.ts` — Mermaid `wardley-beta` → OWM `mapText`

New, thin:

1. Strip the `wardley-beta` header line.
2. Un-comment `%%` lines whose body begins with a known OWM keyword (restoring
   what `MermaidExporter` preserved). `%%` comments that are not restorable OWM
   keywords are discarded.
3. Hand the resulting body to the existing `Converter` unchanged — the body is
   already valid OWM DSL.

Signature:

```ts
function importFromMermaid(mermaidText: string): string; // returns OWM mapText
```

Both functions are pure and re-exported via `frontend/wmlandscape/src/index.js`
so the VSCode and Obsidian extensions can use them.

### Component 2 — GitHub access (`frontend/src/repository/github/`)

#### `GitHubUrl.ts`

Pure parser. `github.com/{owner}/{repo}/blob/{branch}/{path}` →
`{ owner, repo, branch, path }`. Returns a typed error for unrecognised URLs.

#### `GitHubClient.ts`

Thin wrapper over the GitHub REST API using browser `fetch` (the GitHub API is
CORS-enabled). Carries the PAT in the `Authorization` header.

- Read: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — returns the
  file content (base64) and its blob `sha`.
- Commit: `PUT /repos/{owner}/{repo}/contents/{path}` with the new content,
  commit message, `branch`, and the existing `sha`.

#### `MermaidFence.ts`

- `extractFence(fileContent)` — locate the first ` ```mermaid ` fence whose body
  starts with `wardley-beta`; return the fence body plus enough position
  information to put it back.
- `replaceFence(fileContent, newBody)` — substitute the fence body, leaving all
  surrounding Markdown prose intact.
- A file with no fence (e.g. a bare `.wm`) is treated as the whole map body.

#### PAT storage

The token is stored in `localStorage` under `owm.githubPat` and is sent only to
`api.github.com`. A small settings dialog lets the user enter or clear it, links
to GitHub's fine-grained PAT creation page, and states the required scope:
**Contents — Read and write** on the target repository.

### Component 3 — Persistence wiring & UI

- Add `MapPersistenceStrategy.GitHub = 'GitHub'` to
  `frontend/src/constants/defaults.ts`.
- `GitHubLoadStrategy implements LoadStrategy` — given an id of
  `owner/repo/branch/path`: read the file, `extractFence`, `importFromMermaid`,
  run `followOnActions` to load the map.
- `GitHubSaveStrategy implements SaveStrategy` — `exportToMermaid`,
  `replaceFence` into the original file content, `PUT` commit with the stored
  `sha`. Prompts for a commit message (default e.g.
  `Update Wardley map: <title>`).
- Register both in the `LoadMap` and `SaveMap` dispatchers.
- "Open from GitHub" menu item opens a dialog with a URL field and, if no PAT is
  stored, a PAT field. The GitHub source (`owner/repo/branch/path` plus the file
  `sha`) is held in the in-memory persistence state for the session.

## Data flow

**Open:** paste URL → `GitHubUrl.parse` → `GitHubClient.read` → `extractFence`
→ `importFromMermaid` → `Converter` → map renders. Persistence strategy set to
`GitHub`; source + `sha` retained in memory.

**Save:** user edits → `exportToMermaid(mapText)` → `replaceFence` into the
original file content → `GitHubClient.commit` with the stored `sha` → on success
the returned new `sha` replaces the stored one (so consecutive saves work).

## Error handling

| Condition | Behaviour |
|---|---|
| Unrecognised GitHub URL | Inline error in the open dialog. |
| `401` / `403` | "Token missing or lacks Contents write permission." |
| `404` | "File or branch not found." |
| No `wardley-beta` fence in a Markdown file | Prompt: treat the whole file as the map, or cancel. |
| Save `409` / stale `sha` | "The file changed on GitHub since you opened it — reload before saving." |
| Mermaid import parse failure | Surfaced through the existing `ParseError` UI. |
| `keptAsComments` non-empty after export | Non-blocking warning listing lines GitHub will not render. |

## Testing

- **Unit — `MermaidExporter`**: port the fidelity expectations from
  `convert.mjs`; assert unsupported keywords become `%%` comments and are
  reported in `keptAsComments`.
- **Unit — `MermaidImporter`**: header stripping; `%%` un-commenting of OWM
  keywords; discard of non-restorable comments.
- **Round-trip suite**: OWM → Mermaid → OWM equals the original, including the
  comment round-trip of unsupported keywords. Use real example maps.
- **Unit — `GitHubUrl`**: valid/invalid URL parsing.
- **Unit — `MermaidFence`**: extract/replace with surrounding prose preserved;
  no-fence fallback.
- **`GitHubClient`, `GitHubLoadStrategy`, `GitHubSaveStrategy`**: tested against
  a mocked `fetch` / client (success, `401`, `404`, `409`).

## Open risks

- **`convert.mjs` is export-only.** No reference importer exists; `MermaidImporter`
  is written fresh. Mitigated by the round-trip test suite.
- **Pipeline visibility drift.** The source converter notes a grammar-level mean
  `|Δν| = 0.008` because `wardley-beta` pipeline children inherit parent
  visibility. This is inherent to the format and accepted.
- **PAT in `localStorage`** is readable by any script on the OWM origin. Accepted
  for a fine-grained, repo-scoped token; documented in the settings dialog.

## References

- Mermaid Wardley syntax: <https://mermaid.js.org/syntax/wardley.html>
- Existing converter: <https://github.com/tractorjuice/wardley-maps-mermaid/tree/main/tools>
