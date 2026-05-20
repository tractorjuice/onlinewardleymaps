# GitHub + Mermaid wardley-beta Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open a Wardley map stored as a Mermaid `wardley-beta` code fence in a GitHub repo, edit it in OnlineWardleyMaps, and commit it back to the same file.

**Architecture:** A bidirectional OWM↔Mermaid converter (the export side is a TypeScript port of the validated `tractorjuice/wardley-maps-mermaid` `convert.mjs`), plus a PAT-authenticated GitHub `LoadStrategy`/`SaveStrategy` pair that plugs into the existing `LoadMap`/`SaveMap` dispatchers. An "Open from GitHub" dialog drives it.

**Tech Stack:** Next.js 16, React, TypeScript, MUI, Jest (jsdom), GitHub REST API.

**Working directory:** All paths are relative to `/workspaces/onlinewardleymaps-rebrand`. Branch: `feat/github-mermaid-wardley`. Run all commands from `frontend/` unless stated otherwise. Design spec: `docs/superpowers/specs/2026-05-20-github-mermaid-wardley-beta-design.md`.

---

## File Structure

**Created — Mermaid converter (`frontend/src/conversion/mermaid/`):**
- `owmOnlyKeywords.ts` — `isOwmOnlyLine()`: detects OWM keywords Mermaid `wardley-beta` cannot render. Shared by exporter and importer.
- `MermaidExporter.ts` — `exportToMermaid()`: OWM `mapText` → Mermaid string. Ported from `convert.mjs`.
- `MermaidImporter.ts` — `importFromMermaid()`: Mermaid string → OWM `mapText`.

**Created — GitHub access (`frontend/src/repository/github/`):**
- `GitHubUrl.ts` — `parseGitHubUrl()`: GitHub blob URL → `{owner,repo,branch,path}`.
- `MermaidFence.ts` — `extractMermaidFence()` / `replaceMermaidFence()`: read/write the fence inside a Markdown file.
- `GitHubToken.ts` — PAT `localStorage` read/write/clear.
- `GitHubMapSession.ts` — in-memory holder for the open map's source + blob `sha` + raw file content.
- `GitHubClient.ts` — `readFile()` / `commitFile()` over the GitHub REST API.

**Created — persistence strategies (`frontend/src/repository/`):**
- `GitHubLoadStrategy.ts`, `GitHubSaveStrategy.ts`.

**Created — UI (`frontend/src/components/github/`):**
- `OpenFromGitHubDialog.tsx` — the open dialog.

**Modified:**
- `frontend/src/constants/defaults.ts` — add `MapPersistenceStrategy.GitHub`.
- `frontend/src/repository/LoadMap.ts`, `frontend/src/repository/SaveMap.ts` — register strategies.
- `frontend/wmlandscape/src/index.js` — re-export the converter.
- `frontend/src/components/MapEnvironment.tsx`, `frontend/src/components/map/components/MapLayout.tsx`, `frontend/src/components/page/NewHeader.tsx` — wire the dialog.

**Tests:** `frontend/src/__tests__/conversion/mermaid/` and `frontend/src/__tests__/repository/github/`, plus `OpenFromGitHubDialog.test.tsx` alongside the component.

---

## Task 1: `isOwmOnlyLine()` keyword detector

**Files:**
- Create: `frontend/src/conversion/mermaid/owmOnlyKeywords.ts`
- Test: `frontend/src/__tests__/conversion/mermaid/owmOnlyKeywords.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {isOwmOnlyLine} from '../../../conversion/mermaid/owmOnlyKeywords';

describe('isOwmOnlyLine', () => {
	it.each([
		'style wardley',
		'build Foo',
		'x-axis Genesis -> Commodity',
		'y-axis Value -> Invisible',
		'market Customers [0.9, 0.5]',
		'ecosystem Things [0.5, 0.5]',
		'submap Foo [0.5, 0.5]',
		'url foo https://example.com',
		'pioneers [0.1, 0.1, 0.2, 0.2]',
		'accelerator Speed [0.5, 0.5]',
	])('treats "%s" as an OWM-only line', line => {
		expect(isOwmOnlyLine(line)).toBe(true);
	});

	it.each([
		'component Foo [0.5, 0.5]',
		'anchor User [0.9, 0.9]',
		'Market segmentation -> Last Mile',
		'evolve Kettle 0.62',
		'',
	])('treats "%s" as a normal line', line => {
		expect(isOwmOnlyLine(line)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/owmOnlyKeywords.test.ts`
Expected: FAIL — cannot find module `owmOnlyKeywords`.

- [ ] **Step 3: Write the implementation**

```ts
// OWM keywords that have no Mermaid wardley-beta equivalent. Lines matching
// these are preserved as `%%` comments on export and restored on import.
const OWM_ONLY_PATTERNS: RegExp[] = [
	/^style\s+wardley\s*$/i,
	/^(build|buy|outsource)\s+/i,
	/^[xy]-axis\s+/i,
	// `market <name> [vis, evo]` only — must not match links like
	// `Market segmentation -> Last Mile`.
	/^market\s+[^[\]]+\[\s*[\d.]+\s*,/i,
	/^(ecosystem|submap|url)\s+/i,
	/^(pioneers?|settlers?|townplanners?)\b/i,
	/^(accelerator|deaccelerator)\s+/i,
];

export const isOwmOnlyLine = (line: string): boolean => {
	const trimmed = line.trim();
	return OWM_ONLY_PATTERNS.some(re => re.test(trimmed));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/owmOnlyKeywords.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/conversion/mermaid/owmOnlyKeywords.ts frontend/src/__tests__/conversion/mermaid/owmOnlyKeywords.test.ts
git commit -m "feat: add isOwmOnlyLine keyword detector for Mermaid conversion"
```

---

## Task 2: Port `convert.mjs` to `MermaidExporter.ts`

This task vendors the validated converter and makes it compile as TypeScript. Behaviour is unchanged here — the comment-emit modification is Task 3.

**Files:**
- Create: `frontend/src/conversion/mermaid/MermaidExporter.ts`
- Test: `frontend/src/__tests__/conversion/mermaid/MermaidExporter.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import {exportToMermaid} from '../../../conversion/mermaid/MermaidExporter';

describe('exportToMermaid', () => {
	it('emits a wardley-beta header', () => {
		const result = exportToMermaid('title Test\ncomponent Foo [0.5, 0.5]');
		expect(result.mermaid.split('\n')[0]).toBe('wardley-beta');
	});

	it('passes a component through unchanged', () => {
		const result = exportToMermaid('component Foo [0.5, 0.5]');
		expect(result.mermaid).toContain('component Foo [0.5, 0.5]');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidExporter.test.ts`
Expected: FAIL — cannot find module `MermaidExporter`.

- [ ] **Step 3: Download the source converter**

```bash
cd /workspaces/onlinewardleymaps-rebrand
curl -sL https://raw.githubusercontent.com/tractorjuice/wardley-maps-mermaid/main/tools/convert.mjs \
  -o frontend/src/conversion/mermaid/MermaidExporter.ts
```

- [ ] **Step 4: Remove Node-only code**

Edit `frontend/src/conversion/mermaid/MermaidExporter.ts`:

1. Delete the two import lines near the top:
   ```ts
   import { readFileSync, readdirSync } from 'node:fs';
   import { join, basename } from 'node:path';
   ```
2. Delete the entire `export function findMapFiles(dir) { ... }` function (it uses `readdirSync`/`join` and is not needed in the browser).
3. Add this as the new first line of the file:
   ```ts
   /* eslint-disable @typescript-eslint/no-explicit-any */
   ```

- [ ] **Step 5: Add TypeScript annotations**

In the same file, annotate every function parameter (TypeScript strict mode rejects implicit `any`):

- `function normaliseLabel(labelStr)` → `function normaliseLabel(labelStr: string)`
- `function startsWithReserved(name)` → `function startsWithReserved(name: string)`
- `export function quoteName(name)` → `export function quoteName(name: string)`
- `export function owmToMermaid(owmContent, filename)` → `export function exportToMermaid(owmContent: string, titleFallback?: string): {mermaid: string; keptAsComments: string[]}`
  (rename the function and add the return type now; the body still returns a string — fixed in the next step).

Inside `exportToMermaid`, find the three metadata objects and type them as `Record<string, any>`:
```ts
const sourcing: Record<string, any> = {};
const compCoords: Record<string, any> = {};
const pipelineRanges: Record<string, any> = {};
```
(`pipelinesWithExplicitBlock` is a `new Set()` — leave it; add `<string>` if the compiler complains: `new Set<string>()`.)

- [ ] **Step 6: Replace the `basename`-based default title**

Find the block near the end of the function:
```ts
  if (!hasTitleLine) {
    const defaultTitle = basename(filename).replace(/\.\w+$/, '').replace(/[-_]/g, ' ');
    mermaidLines.splice(1, 0, `title ${defaultTitle}`, 'size [1100, 800]');
  }
```
Replace it with:
```ts
  if (!hasTitleLine) {
    const defaultTitle = (titleFallback || 'Wardley Map').replace(/[-_]/g, ' ');
    mermaidLines.splice(1, 0, `title ${defaultTitle}`, 'size [1100, 800]');
  }
```

- [ ] **Step 7: Make the function return a string for now**

The final line of `exportToMermaid` currently is `return cleaned.join('\n');`. Temporarily change it to satisfy the declared return type:
```ts
  return {mermaid: cleaned.join('\n'), keptAsComments: []};
```
Add `const keptAsComments: string[] = [];` immediately after `const mermaidLines = ['wardley-beta'];` near the top of the function (it stays empty until Task 3).

- [ ] **Step 8: Type-check and run the test**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors in `MermaidExporter.ts`. Fix any remaining `implicit any` by adding a type annotation (use `any` if the value is genuinely dynamic).

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidExporter.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/conversion/mermaid/MermaidExporter.ts frontend/src/__tests__/conversion/mermaid/MermaidExporter.test.ts
git commit -m "feat: port OWM-to-Mermaid converter to TypeScript"
```

---

## Task 3: Emit unsupported keywords as comments

Modifies `exportToMermaid` so OWM-only lines become `%%` Mermaid comments instead of being dropped, and are reported in `keptAsComments`.

**Files:**
- Modify: `frontend/src/conversion/mermaid/MermaidExporter.ts`
- Test: `frontend/src/__tests__/conversion/mermaid/MermaidExporter.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `MermaidExporter.test.ts`:

```ts
describe('exportToMermaid — unsupported keywords', () => {
	it('preserves a market line as a %% comment', () => {
		const result = exportToMermaid('component Foo [0.5, 0.5]\nmarket Buyers [0.9, 0.5]');
		expect(result.mermaid).toContain('%% market Buyers [0.9, 0.5]');
		expect(result.keptAsComments).toContain('market Buyers [0.9, 0.5]');
	});

	it('does not list normal lines in keptAsComments', () => {
		const result = exportToMermaid('component Foo [0.5, 0.5]');
		expect(result.keptAsComments).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidExporter.test.ts`
Expected: FAIL — `market` line is dropped, not commented.

- [ ] **Step 3: Apply the modification**

In `MermaidExporter.ts`:

1. Add an import at the top (after the eslint-disable line):
   ```ts
   import {isOwmOnlyLine} from './owmOnlyKeywords';
   ```
2. In `exportToMermaid`, find these five consecutive lines in the main emit loop:
   ```ts
   if (/^style\s+wardley\s*$/i.test(trimmed)) continue;
   if (/^(build|buy|outsource)\s+/i.test(trimmed)) continue;
   if (/^[xy]-axis\s+/i.test(trimmed)) continue;
   if (/^market\s+[^[\]]+\[\s*[\d.]+\s*,/i.test(trimmed)) continue;
   if (/^(ecosystem|submap|url|pioneer|settler|townplanner)\s+/i.test(trimmed)) continue;
   ```
   Replace all five with:
   ```ts
   if (isOwmOnlyLine(trimmed)) {
   	mermaidLines.push(`%% ${trimmed}`);
   	keptAsComments.push(trimmed);
   	continue;
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidExporter.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/conversion/mermaid/MermaidExporter.ts frontend/src/__tests__/conversion/mermaid/MermaidExporter.test.ts
git commit -m "feat: preserve unsupported OWM keywords as Mermaid comments"
```

---

## Task 4: `importFromMermaid()`

**Files:**
- Create: `frontend/src/conversion/mermaid/MermaidImporter.ts`
- Test: `frontend/src/__tests__/conversion/mermaid/MermaidImporter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {importFromMermaid} from '../../../conversion/mermaid/MermaidImporter';

describe('importFromMermaid', () => {
	it('strips the wardley-beta header line', () => {
		const owm = importFromMermaid('wardley-beta\ncomponent Foo [0.5, 0.5]');
		expect(owm).not.toContain('wardley-beta');
		expect(owm).toContain('component Foo [0.5, 0.5]');
	});

	it('strips the auto-injected size line', () => {
		const owm = importFromMermaid('wardley-beta\ntitle T\nsize [1100, 800]\ncomponent Foo [0.5, 0.5]');
		expect(owm).not.toContain('size [1100, 800]');
	});

	it('restores OWM-only keywords from %% comments', () => {
		const owm = importFromMermaid('wardley-beta\n%% market Buyers [0.9, 0.5]\ncomponent Foo [0.5, 0.5]');
		expect(owm).toContain('market Buyers [0.9, 0.5]');
	});

	it('drops %% comments that are not OWM keywords', () => {
		const owm = importFromMermaid('wardley-beta\n%% just a note\ncomponent Foo [0.5, 0.5]');
		expect(owm).not.toContain('just a note');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidImporter.test.ts`
Expected: FAIL — cannot find module `MermaidImporter`.

- [ ] **Step 3: Write the implementation**

```ts
import {isOwmOnlyLine} from './owmOnlyKeywords';

// Converts a Mermaid wardley-beta diagram body into OWM DSL. The body is
// already valid OWM apart from the `wardley-beta` header and the
// auto-injected `size` line; `%%` comments holding OWM-only keywords
// (written by exportToMermaid) are un-commented.
export const importFromMermaid = (mermaidText: string): string => {
	const out: string[] = [];
	for (const line of mermaidText.split('\n')) {
		const trimmed = line.trim();

		if (/^wardley-beta\s*$/i.test(trimmed)) continue;
		if (/^size\s*\[/i.test(trimmed)) continue;

		const commentMatch = trimmed.match(/^%%\s?(.*)$/);
		if (commentMatch) {
			const body = commentMatch[1];
			if (isOwmOnlyLine(body.trim())) out.push(body);
			continue;
		}

		out.push(line);
	}
	return out.join('\n');
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/MermaidImporter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/conversion/mermaid/MermaidImporter.ts frontend/src/__tests__/conversion/mermaid/MermaidImporter.test.ts
git commit -m "feat: add importFromMermaid converter"
```

---

## Task 5: Round-trip test suite

Verifies OWM → Mermaid → OWM preserves the map, including OWM-only keywords. Comparison is normalised because the exporter strips comments, collapses blank lines, and adds a `size` line.

**Files:**
- Test: `frontend/src/__tests__/conversion/mermaid/roundTrip.test.ts`

- [ ] **Step 1: Write the round-trip test**

```ts
import {exportToMermaid} from '../../../conversion/mermaid/MermaidExporter';
import {importFromMermaid} from '../../../conversion/mermaid/MermaidImporter';

// Normalise for comparison: drop blank lines and trim each line. The
// exporter intentionally collapses blanks and strips `//` comments.
const normalise = (text: string): string[] =>
	text
		.split('\n')
		.map(l => l.trim())
		.filter(l => l.length > 0 && !l.startsWith('//'));

const SAMPLE = [
	'title Tea Shop',
	'anchor Business [0.95, 0.63]',
	'component Cup of Tea [0.79, 0.61]',
	'component Kettle [0.43, 0.35]',
	'Business -> Cup of Tea',
	'Cup of Tea -> Kettle',
	'evolve Kettle 0.62',
	'market Buyers [0.9, 0.5]',
].join('\n');

describe('OWM <-> Mermaid round trip', () => {
	it('preserves every meaningful line', () => {
		const mermaid = exportToMermaid(SAMPLE).mermaid;
		const backToOwm = importFromMermaid(mermaid);
		const original = normalise(SAMPLE);
		const result = normalise(backToOwm);
		for (const line of original) {
			expect(result).toContain(line);
		}
	});

	it('round-trips the OWM-only market keyword', () => {
		const mermaid = exportToMermaid(SAMPLE).mermaid;
		expect(mermaid).toContain('%% market Buyers [0.9, 0.5]');
		expect(normalise(importFromMermaid(mermaid))).toContain('market Buyers [0.9, 0.5]');
	});
});
```

- [ ] **Step 2: Run the test**

Run: `cd frontend && yarn test src/__tests__/conversion/mermaid/roundTrip.test.ts`
Expected: PASS. If a line fails to round-trip, inspect the exporter output for that line — the exporter may reformat it (e.g. `evolve` spacing); update the `SAMPLE`/`normalise` expectations only if the reformatting is semantically equivalent, otherwise fix the converter.

- [ ] **Step 3: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/__tests__/conversion/mermaid/roundTrip.test.ts
git commit -m "test: add OWM-Mermaid round-trip suite"
```

---

## Task 6: Re-export the converter from `wmlandscape`

**Files:**
- Modify: `frontend/wmlandscape/src/index.js`

- [ ] **Step 1: Add the imports**

In `frontend/wmlandscape/src/index.js`, alongside the other `../../src/conversion/...` imports (near line 60-82), add:

```js
import {exportToMermaid} from '../../src/conversion/mermaid/MermaidExporter';
import {importFromMermaid} from '../../src/conversion/mermaid/MermaidImporter';
```

- [ ] **Step 2: Add to the export block**

In the `export { ... }` block (near line 97), add `exportToMermaid,` and `importFromMermaid,` as new entries.

- [ ] **Step 3: Verify the package builds**

Run: `cd frontend && yarn package`
Expected: Rollup build succeeds with no errors referencing the new modules.

- [ ] **Step 4: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/wmlandscape/src/index.js
git commit -m "feat: export Mermaid converter from wmlandscape package"
```

---

## Task 7: `parseGitHubUrl()`

**Files:**
- Create: `frontend/src/repository/github/GitHubUrl.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubUrl.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {parseGitHubUrl} from '../../../repository/github/GitHubUrl';

describe('parseGitHubUrl', () => {
	it('parses a blob URL', () => {
		const r = parseGitHubUrl('https://github.com/acme/maps/blob/main/docs/tea.md');
		expect(r).toEqual({owner: 'acme', repo: 'maps', branch: 'main', path: 'docs/tea.md'});
	});

	it('parses a path with nested folders', () => {
		const r = parseGitHubUrl('https://github.com/a/b/blob/dev/x/y/z.md');
		expect(r).toEqual({owner: 'a', repo: 'b', branch: 'dev', path: 'x/y/z.md'});
	});

	it('returns null for a non-blob GitHub URL', () => {
		expect(parseGitHubUrl('https://github.com/acme/maps')).toBeNull();
	});

	it('returns null for a non-GitHub URL', () => {
		expect(parseGitHubUrl('https://example.com/foo')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubUrl.test.ts`
Expected: FAIL — cannot find module `GitHubUrl`.

- [ ] **Step 3: Write the implementation**

```ts
export interface GitHubSource {
	owner: string;
	repo: string;
	branch: string;
	path: string;
}

// Parses https://github.com/{owner}/{repo}/blob/{branch}/{path...}
export const parseGitHubUrl = (url: string): GitHubSource | null => {
	const match = url
		.trim()
		.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
	if (!match) return null;
	const [, owner, repo, branch, path] = match;
	return {owner, repo, branch, path};
};

// id form used by the persistence layer: owner/repo/branch/path...
export const sourceToId = (s: GitHubSource): string =>
	`${s.owner}/${s.repo}/${s.branch}/${s.path}`;

export const idToSource = (id: string): GitHubSource => {
	const [owner, repo, branch, ...rest] = id.split('/');
	return {owner, repo, branch, path: rest.join('/')};
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubUrl.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/github/GitHubUrl.ts frontend/src/__tests__/repository/github/GitHubUrl.test.ts
git commit -m "feat: add GitHub URL parser"
```

---

## Task 8: `MermaidFence` extract/replace

**Files:**
- Create: `frontend/src/repository/github/MermaidFence.ts`
- Test: `frontend/src/__tests__/repository/github/MermaidFence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {extractMermaidFence, replaceMermaidFence} from '../../../repository/github/MermaidFence';

const MD = [
	'# My Map',
	'Some prose.',
	'```mermaid',
	'wardley-beta',
	'component Foo [0.5, 0.5]',
	'```',
	'More prose.',
].join('\n');

describe('extractMermaidFence', () => {
	it('extracts the wardley-beta fence body', () => {
		const r = extractMermaidFence(MD);
		expect(r.hasFence).toBe(true);
		expect(r.body).toBe('wardley-beta\ncomponent Foo [0.5, 0.5]');
	});

	it('treats a file with no fence as the whole body', () => {
		const r = extractMermaidFence('wardley-beta\ncomponent Foo [0.5, 0.5]');
		expect(r.hasFence).toBe(false);
		expect(r.body).toBe('wardley-beta\ncomponent Foo [0.5, 0.5]');
	});
});

describe('replaceMermaidFence', () => {
	it('replaces the fence body and keeps surrounding prose', () => {
		const out = replaceMermaidFence(MD, 'wardley-beta\ncomponent Bar [0.1, 0.2]');
		expect(out).toContain('# My Map');
		expect(out).toContain('More prose.');
		expect(out).toContain('component Bar [0.1, 0.2]');
		expect(out).not.toContain('component Foo');
	});

	it('returns the new body alone when there was no fence', () => {
		const out = replaceMermaidFence('wardley-beta\ncomponent Foo [0.5, 0.5]', 'wardley-beta\nx');
		expect(out).toBe('wardley-beta\nx');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/MermaidFence.test.ts`
Expected: FAIL — cannot find module `MermaidFence`.

- [ ] **Step 3: Write the implementation**

```ts
export interface FenceResult {
	body: string;
	hasFence: boolean;
}

// Matches a ```mermaid ... ``` fenced block. Group 1 = opening fence line
// (with any info string), group 2 = body, group 3 = closing fence.
const FENCE_RE = /(```mermaid[^\n]*\n)([\s\S]*?)(\n```)/g;

const findWardleyFence = (fileContent: string): RegExpExecArray | null => {
	FENCE_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = FENCE_RE.exec(fileContent)) !== null) {
		if (/^\s*wardley-beta\b/.test(match[2])) return match;
	}
	return null;
};

export const extractMermaidFence = (fileContent: string): FenceResult => {
	const match = findWardleyFence(fileContent);
	if (!match) return {body: fileContent, hasFence: false};
	return {body: match[2].trim(), hasFence: true};
};

export const replaceMermaidFence = (fileContent: string, newBody: string): string => {
	const match = findWardleyFence(fileContent);
	if (!match) return newBody;
	const replacement = `${match[1]}${newBody}${match[3]}`;
	return fileContent.slice(0, match.index) + replacement + fileContent.slice(match.index + match[0].length);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/MermaidFence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/github/MermaidFence.ts frontend/src/__tests__/repository/github/MermaidFence.test.ts
git commit -m "feat: add Mermaid fence extract/replace helpers"
```

---

## Task 9: `GitHubToken` PAT storage

**Files:**
- Create: `frontend/src/repository/github/GitHubToken.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubToken.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {getGitHubToken, setGitHubToken, clearGitHubToken} from '../../../repository/github/GitHubToken';

describe('GitHubToken', () => {
	afterEach(() => clearGitHubToken());

	it('returns null when no token is stored', () => {
		expect(getGitHubToken()).toBeNull();
	});

	it('stores and retrieves a token', () => {
		setGitHubToken('ghp_example');
		expect(getGitHubToken()).toBe('ghp_example');
	});

	it('clears a token', () => {
		setGitHubToken('ghp_example');
		clearGitHubToken();
		expect(getGitHubToken()).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubToken.test.ts`
Expected: FAIL — cannot find module `GitHubToken`.

- [ ] **Step 3: Write the implementation**

```ts
const KEY = 'owm.githubPat';

// localStorage is unavailable during SSR; guard every access.
const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

export const getGitHubToken = (): string | null => storage()?.getItem(KEY) ?? null;

export const setGitHubToken = (token: string): void => {
	storage()?.setItem(KEY, token.trim());
};

export const clearGitHubToken = (): void => {
	storage()?.removeItem(KEY);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubToken.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/github/GitHubToken.ts frontend/src/__tests__/repository/github/GitHubToken.test.ts
git commit -m "feat: add GitHub PAT localStorage store"
```

---

## Task 10: `GitHubMapSession` holder

Holds the open map's source, blob `sha`, and raw file content so the save strategy can replace the fence in place and detect stale-`sha` conflicts.

**Files:**
- Create: `frontend/src/repository/github/GitHubMapSession.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubMapSession.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {setSession, getSession, clearSession} from '../../../repository/github/GitHubMapSession';

const SAMPLE = {
	source: {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'},
	sha: 'abc123',
	rawFileContent: '# file',
};

describe('GitHubMapSession', () => {
	afterEach(() => clearSession());

	it('returns null when nothing is set', () => {
		expect(getSession()).toBeNull();
	});

	it('stores and retrieves a session', () => {
		setSession(SAMPLE);
		expect(getSession()).toEqual(SAMPLE);
	});

	it('clears a session', () => {
		setSession(SAMPLE);
		clearSession();
		expect(getSession()).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubMapSession.test.ts`
Expected: FAIL — cannot find module `GitHubMapSession`.

- [ ] **Step 3: Write the implementation**

```ts
import {GitHubSource} from './GitHubUrl';

export interface GitHubMapSession {
	source: GitHubSource;
	sha: string;
	rawFileContent: string;
}

// Module-level singleton: the GitHub map is bound for the browser session
// only. Reloading the page clears it (a known limitation — see the spec).
let current: GitHubMapSession | null = null;

export const setSession = (session: GitHubMapSession): void => {
	current = session;
};

export const getSession = (): GitHubMapSession | null => current;

export const clearSession = (): void => {
	current = null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubMapSession.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/github/GitHubMapSession.ts frontend/src/__tests__/repository/github/GitHubMapSession.test.ts
git commit -m "feat: add in-memory GitHub map session holder"
```

---

## Task 11: `GitHubClient`

**Files:**
- Create: `frontend/src/repository/github/GitHubClient.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubClient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {GitHubClient, GitHubApiError} from '../../../repository/github/GitHubClient';

const SOURCE = {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'};

// base64 of "hello" is "aGVsbG8="
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('GitHubClient', () => {
	afterEach(() => jest.restoreAllMocks());

	it('readFile decodes content and returns the sha', async () => {
		jest.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({content: b64('hello'), encoding: 'base64', sha: 'sha1'}),
		} as Response);

		const client = new GitHubClient('ghp_token');
		const file = await client.readFile(SOURCE);
		expect(file).toEqual({content: 'hello', sha: 'sha1'});
	});

	it('readFile throws GitHubApiError with the status on failure', async () => {
		jest.spyOn(global, 'fetch').mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({message: 'Not Found'}),
		} as Response);

		const client = new GitHubClient('ghp_token');
		await expect(client.readFile(SOURCE)).rejects.toMatchObject({
			name: 'GitHubApiError',
			status: 404,
		});
	});

	it('commitFile sends the sha and returns the new sha', async () => {
		const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({content: {sha: 'sha2'}}),
		} as Response);

		const client = new GitHubClient('ghp_token');
		const result = await client.commitFile(SOURCE, 'new content', 'msg', 'sha1');
		expect(result).toEqual({sha: 'sha2'});

		const [, init] = fetchMock.mock.calls[0];
		const body = JSON.parse((init as RequestInit).body as string);
		expect(body.sha).toBe('sha1');
		expect(body.branch).toBe('main');
		expect(body.message).toBe('msg');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubClient.test.ts`
Expected: FAIL — cannot find module `GitHubClient`.

- [ ] **Step 3: Write the implementation**

```ts
import {GitHubSource} from './GitHubUrl';

export interface GitHubFile {
	content: string;
	sha: string;
}

export class GitHubApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'GitHubApiError';
		this.status = status;
	}
}

const API = 'https://api.github.com';

const decodeBase64 = (b64: string): string => {
	const bytes = Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

const encodeBase64 = (text: string): string => {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	bytes.forEach(b => (binary += String.fromCharCode(b)));
	return btoa(binary);
};

export class GitHubClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		};
	}

	private contentsUrl(s: GitHubSource): string {
		return `${API}/repos/${s.owner}/${s.repo}/contents/${s.path}`;
	}

	async readFile(source: GitHubSource): Promise<GitHubFile> {
		const url = `${this.contentsUrl(source)}?ref=${encodeURIComponent(source.branch)}`;
		const response = await fetch(url, {headers: this.headers()});
		const data = await response.json();
		if (!response.ok) {
			throw new GitHubApiError(response.status, data.message || 'GitHub read failed');
		}
		return {content: decodeBase64(data.content), sha: data.sha};
	}

	async commitFile(
		source: GitHubSource,
		content: string,
		message: string,
		sha: string,
	): Promise<{sha: string}> {
		const response = await fetch(this.contentsUrl(source), {
			method: 'PUT',
			headers: {...this.headers(), 'Content-Type': 'application/json'},
			body: JSON.stringify({
				message,
				content: encodeBase64(content),
				sha,
				branch: source.branch,
			}),
		});
		const data = await response.json();
		if (!response.ok) {
			throw new GitHubApiError(response.status, data.message || 'GitHub commit failed');
		}
		return {sha: data.content.sha};
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/github/GitHubClient.ts frontend/src/__tests__/repository/github/GitHubClient.test.ts
git commit -m "feat: add GitHub REST API client"
```

---

## Task 12: Register the `GitHub` persistence strategy constant

**Files:**
- Modify: `frontend/src/constants/defaults.ts`

- [ ] **Step 1: Add the strategy value**

In `frontend/src/constants/defaults.ts`, change:
```ts
export const MapPersistenceStrategy = {
	Legacy: 'Legacy',
};
```
to:
```ts
export const MapPersistenceStrategy = {
	Legacy: 'Legacy',
	GitHub: 'GitHub',
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/constants/defaults.ts
git commit -m "feat: add GitHub map persistence strategy constant"
```

---

## Task 13: `GitHubLoadStrategy`

**Files:**
- Create: `frontend/src/repository/GitHubLoadStrategy.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubLoadStrategy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {GitHubLoadStrategy} from '../../../repository/GitHubLoadStrategy';
import {GitHubClient} from '../../../repository/github/GitHubClient';
import {setGitHubToken, clearGitHubToken} from '../../../repository/github/GitHubToken';
import {getSession, clearSession} from '../../../repository/github/GitHubMapSession';

const FILE = ['# Map', '```mermaid', 'wardley-beta', 'component Foo [0.5, 0.5]', '```'].join('\n');

describe('GitHubLoadStrategy', () => {
	beforeEach(() => setGitHubToken('ghp_token'));
	afterEach(() => {
		clearGitHubToken();
		clearSession();
		jest.restoreAllMocks();
	});

	it('loads a map, imports it to OWM DSL, and stores the session', async () => {
		jest.spyOn(GitHubClient.prototype, 'readFile').mockResolvedValue({content: FILE, sha: 'sha1'});

		const callback = jest.fn();
		const strategy = new GitHubLoadStrategy(callback);
		await strategy.load('acme/maps/main/docs/tea.md');

		const [strategyName, data] = callback.mock.calls[0];
		expect(strategyName).toBe('GitHub');
		expect(data.mapText).toContain('component Foo [0.5, 0.5]');
		expect(data.mapText).not.toContain('wardley-beta');
		expect(getSession()?.sha).toBe('sha1');
	});

	it('throws when no token is stored', async () => {
		clearGitHubToken();
		const strategy = new GitHubLoadStrategy(jest.fn());
		await expect(strategy.load('acme/maps/main/tea.md')).rejects.toThrow(/token/i);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubLoadStrategy.test.ts`
Expected: FAIL — cannot find module `GitHubLoadStrategy`.

- [ ] **Step 3: Write the implementation**

```ts
import {importFromMermaid} from '../conversion/mermaid/MermaidImporter';
import * as Defaults from '../constants/defaults';
import {GitHubClient} from './github/GitHubClient';
import {extractMermaidFence} from './github/MermaidFence';
import {setSession} from './github/GitHubMapSession';
import {getGitHubToken} from './github/GitHubToken';
import {idToSource} from './github/GitHubUrl';
import {LoadStrategy} from './LoadStrategy';

export class GitHubLoadStrategy extends LoadStrategy {
	async load(id: string): Promise<void> {
		const token = getGitHubToken();
		if (!token) {
			throw new Error('No GitHub token configured. Add a personal access token first.');
		}

		const source = idToSource(id);
		const client = new GitHubClient(token);
		const file = await client.readFile(source);

		const {body} = extractMermaidFence(file.content);
		const mapText = importFromMermaid(body);

		setSession({source, sha: file.sha, rawFileContent: file.content});

		this.callback(Defaults.MapPersistenceStrategy.GitHub, {
			id,
			mapText,
			mapIterations: [],
		});
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubLoadStrategy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/GitHubLoadStrategy.ts frontend/src/__tests__/repository/github/GitHubLoadStrategy.test.ts
git commit -m "feat: add GitHubLoadStrategy"
```

---

## Task 14: `GitHubSaveStrategy`

**Files:**
- Create: `frontend/src/repository/GitHubSaveStrategy.ts`
- Test: `frontend/src/__tests__/repository/github/GitHubSaveStrategy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {GitHubSaveStrategy} from '../../../repository/GitHubSaveStrategy';
import {GitHubClient} from '../../../repository/github/GitHubClient';
import {setSession, getSession, clearSession} from '../../../repository/github/GitHubMapSession';

const FILE = ['# Map', '```mermaid', 'wardley-beta', 'component Foo [0.5, 0.5]', '```'].join('\n');

const map = (mapText: string) => ({readOnly: false, mapText, imageData: '', mapIterations: []});

describe('GitHubSaveStrategy', () => {
	beforeEach(() => {
		setSession({
			source: {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'},
			sha: 'sha1',
			rawFileContent: FILE,
		});
		jest.spyOn(window, 'prompt').mockReturnValue('Update map');
	});
	afterEach(() => {
		clearSession();
		jest.restoreAllMocks();
	});

	it('commits the regenerated fence and updates the session sha', async () => {
		const commit = jest
			.spyOn(GitHubClient.prototype, 'commitFile')
			.mockResolvedValue({sha: 'sha2'});

		const callback = jest.fn();
		await new GitHubSaveStrategy(callback).save(map('component Bar [0.1, 0.2]'), 'a/b/main/m.md');

		const committedContent = commit.mock.calls[0][1];
		expect(committedContent).toContain('component Bar [0.1, 0.2]');
		expect(committedContent).toContain('# Map'); // prose preserved
		expect(commit.mock.calls[0][3]).toBe('sha1'); // sha sent
		expect(getSession()?.sha).toBe('sha2'); // sha updated
		expect(callback).toHaveBeenCalled();
	});

	it('aborts when the user cancels the commit-message prompt', async () => {
		jest.spyOn(window, 'prompt').mockReturnValue(null);
		const commit = jest.spyOn(GitHubClient.prototype, 'commitFile');
		await new GitHubSaveStrategy(jest.fn()).save(map('component Bar [0.1, 0.2]'), 'a/b/main/m.md');
		expect(commit).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubSaveStrategy.test.ts`
Expected: FAIL — cannot find module `GitHubSaveStrategy`.

- [ ] **Step 3: Write the implementation**

```ts
import {exportToMermaid} from '../conversion/mermaid/MermaidExporter';
import {GitHubClient} from './github/GitHubClient';
import {getGitHubToken} from './github/GitHubToken';
import {getSession, setSession} from './github/GitHubMapSession';
import {replaceMermaidFence} from './github/MermaidFence';
import {OwnApiWardleyMap} from './OwnApiWardleyMap';
import {SaveStrategy} from './SaveStrategy';

export class GitHubSaveStrategy implements SaveStrategy {
	callback: (id: string, data: string) => void;

	constructor(callback: (id: string, data: string) => void) {
		this.callback = callback;
	}

	async save(map: OwnApiWardleyMap, hash: string): Promise<void> {
		const token = getGitHubToken();
		const session = getSession();
		if (!token || !session) {
			throw new Error('No GitHub map is open. Open a map from GitHub before saving.');
		}

		const message = window.prompt('Commit message', 'Update Wardley map via OnlineWardleyMaps');
		if (message === null) return; // user cancelled

		const {mermaid} = exportToMermaid(map.mapText);
		const newFileContent = replaceMermaidFence(session.rawFileContent, mermaid);

		const client = new GitHubClient(token);
		const result = await client.commitFile(session.source, newFileContent, message, session.sha);

		setSession({...session, sha: result.sha, rawFileContent: newFileContent});
		this.callback(hash, JSON.stringify({id: hash}));
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/__tests__/repository/github/GitHubSaveStrategy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/GitHubSaveStrategy.ts frontend/src/__tests__/repository/github/GitHubSaveStrategy.test.ts
git commit -m "feat: add GitHubSaveStrategy"
```

---

## Task 15: Register strategies in `LoadMap` and `SaveMap`

**Files:**
- Modify: `frontend/src/repository/LoadMap.ts`
- Modify: `frontend/src/repository/SaveMap.ts`

- [ ] **Step 1: Wire `LoadMap.ts`**

In `frontend/src/repository/LoadMap.ts`, add an import:
```ts
import {GitHubLoadStrategy} from './GitHubLoadStrategy';
```
In the `loadStrategy` record, add a second entry so it reads:
```ts
const loadStrategy: Record<string, () => LoadStrategy> = {
	[Defaults.MapPersistenceStrategy.Legacy]: () => new LegacyLoadStrategy(followOnActions),
	[Defaults.MapPersistenceStrategy.GitHub]: () => new GitHubLoadStrategy(followOnActions),
};
```

- [ ] **Step 2: Wire `SaveMap.ts`**

In `frontend/src/repository/SaveMap.ts`, add an import:
```ts
import {GitHubSaveStrategy} from './GitHubSaveStrategy';
```
In the `switch (mapPersistenceStrategy)` block, add a case after the `Legacy` case:
```ts
		case Defaults.MapPersistenceStrategy.GitHub:
			loadedSaveStrategy = new GitHubSaveStrategy(callback);
			break;
```

- [ ] **Step 3: Type-check and run the repository tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

Run: `cd frontend && yarn test src/__tests__/repository`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/repository/LoadMap.ts frontend/src/repository/SaveMap.ts
git commit -m "feat: register GitHub load/save strategies in dispatchers"
```

---

## Task 16: `OpenFromGitHubDialog` component

A MUI dialog with a GitHub URL field, a PAT field (shown only when no token is stored), and validation.

**Files:**
- Create: `frontend/src/components/github/OpenFromGitHubDialog.tsx`
- Test: `frontend/src/components/github/OpenFromGitHubDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import {fireEvent, render, screen} from '@testing-library/react';
import OpenFromGitHubDialog from './OpenFromGitHubDialog';
import {clearGitHubToken, getGitHubToken, setGitHubToken} from '../../repository/github/GitHubToken';

describe('OpenFromGitHubDialog', () => {
	afterEach(() => clearGitHubToken());

	it('rejects an invalid URL without calling onOpen', () => {
		const onOpen = jest.fn();
		setGitHubToken('ghp_token');
		render(<OpenFromGitHubDialog open onClose={jest.fn()} onOpen={onOpen} />);

		fireEvent.change(screen.getByLabelText(/github file url/i), {target: {value: 'not a url'}});
		fireEvent.click(screen.getByRole('button', {name: /^open$/i}));

		expect(onOpen).not.toHaveBeenCalled();
		expect(screen.getByText(/not a valid github/i)).toBeInTheDocument();
	});

	it('calls onOpen with the id and stores the PAT for a valid URL', () => {
		const onOpen = jest.fn();
		render(<OpenFromGitHubDialog open onClose={jest.fn()} onOpen={onOpen} />);

		fireEvent.change(screen.getByLabelText(/personal access token/i), {
			target: {value: 'ghp_new'},
		});
		fireEvent.change(screen.getByLabelText(/github file url/i), {
			target: {value: 'https://github.com/acme/maps/blob/main/docs/tea.md'},
		});
		fireEvent.click(screen.getByRole('button', {name: /^open$/i}));

		expect(onOpen).toHaveBeenCalledWith('acme/maps/main/docs/tea.md');
		expect(getGitHubToken()).toBe('ghp_new');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && yarn test src/components/github/OpenFromGitHubDialog.test.tsx`
Expected: FAIL — cannot find module `OpenFromGitHubDialog`.

- [ ] **Step 3: Write the implementation**

```tsx
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import React, {FunctionComponent, useState} from 'react';
import {parseGitHubUrl, sourceToId} from '../../repository/github/GitHubUrl';
import {getGitHubToken, setGitHubToken} from '../../repository/github/GitHubToken';

interface OpenFromGitHubDialogProps {
	open: boolean;
	onClose: () => void;
	onOpen: (id: string) => void;
}

const OpenFromGitHubDialog: FunctionComponent<OpenFromGitHubDialogProps> = ({open, onClose, onOpen}) => {
	const hasToken = getGitHubToken() !== null;
	const [url, setUrl] = useState('');
	const [token, setToken] = useState('');
	const [error, setError] = useState('');

	const handleOpen = () => {
		const source = parseGitHubUrl(url);
		if (!source) {
			setError('That is not a valid GitHub file URL (expected .../blob/...).');
			return;
		}
		if (!hasToken && token.trim() === '') {
			setError('A personal access token is required.');
			return;
		}
		if (token.trim() !== '') setGitHubToken(token);
		setError('');
		onOpen(sourceToId(source));
		onClose();
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>Open map from GitHub</DialogTitle>
			<DialogContent>
				<DialogContentText sx={{mb: 2}}>
					Paste a link to a Markdown file containing a Mermaid <code>wardley-beta</code> block.
				</DialogContentText>
				<TextField
					autoFocus
					fullWidth
					margin="dense"
					label="GitHub file URL"
					placeholder="https://github.com/owner/repo/blob/branch/path.md"
					value={url}
					onChange={e => setUrl(e.target.value)}
				/>
				{!hasToken && (
					<TextField
						fullWidth
						margin="dense"
						type="password"
						label="Personal access token"
						helperText={
							<>
								Needs Contents: read &amp; write.{' '}
								<Link
									href="https://github.com/settings/personal-access-tokens"
									target="_blank"
									rel="noreferrer">
									Create one
								</Link>
								.
							</>
						}
						value={token}
						onChange={e => setToken(e.target.value)}
					/>
				)}
				{error !== '' && (
					<DialogContentText color="error" sx={{mt: 1}}>
						{error}
					</DialogContentText>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Cancel</Button>
				<Button onClick={handleOpen} variant="contained">
					Open
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default OpenFromGitHubDialog;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && yarn test src/components/github/OpenFromGitHubDialog.test.tsx`
Expected: PASS. If `getByLabelText` fails to match, confirm the `label` text in the test matches the `TextField` `label` prop.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/components/github/OpenFromGitHubDialog.tsx frontend/src/components/github/OpenFromGitHubDialog.test.tsx
git commit -m "feat: add Open from GitHub dialog"
```

---

## Task 17: Wire the dialog into the header

Threads an `openFromGitHub` callback from `MapEnvironment` (which owns the persistence state) through `MapLayout` to `NewHeader`, and adds an "Open from GitHub…" menu item that shows the dialog.

**Files:**
- Modify: `frontend/src/components/MapEnvironment.tsx`
- Modify: `frontend/src/components/map/components/MapLayout.tsx`
- Modify: `frontend/src/components/page/NewHeader.tsx`

- [ ] **Step 1: Add the `openFromGitHub` callback in `MapEnvironment.tsx`**

In `frontend/src/components/MapEnvironment.tsx`, add a `useCallback` near the other persistence callbacks (it must be after `setMapPersistenceStrategy`, `setCurrentId`, and `setShouldLoad` are in scope — they already are, per the `useMapPersistence` props block around line 308):

```tsx
const openFromGitHub = useCallback(
	(id: string) => {
		setMapPersistenceStrategy(Defaults.MapPersistenceStrategy.GitHub);
		setCurrentId(id);
		setShouldLoad(true);
	},
	[setMapPersistenceStrategy, setCurrentId, setShouldLoad],
);
```

If `Defaults` is not already imported in this file, add `import * as Defaults from '../constants/defaults';` with the other imports. (The existing `useEffect` at line ~392 — `if (shouldLoad) mapPersistence.loadFromRemoteStorage()` — then performs the load.)

Then in the `<MapLayout ... />` element (around line 715), add the prop:
```tsx
openFromGitHub={openFromGitHub}
```

- [ ] **Step 2: Pass the prop through `MapLayout.tsx`**

In `frontend/src/components/map/components/MapLayout.tsx`:

1. In the props interface (the one containing `newMapClick: (strategy: string) => void;` near line 32), add:
   ```tsx
   openFromGitHub: (id: string) => void;
   ```
2. In the destructured props (near line 77, where `newMapClick` is listed), add `openFromGitHub,`.
3. In the `<NewHeader ... />` element (near line 122), add the prop:
   ```tsx
   openFromGitHub={openFromGitHub}
   ```

- [ ] **Step 3: Add the prop and menu item in `NewHeader.tsx`**

In `frontend/src/components/page/NewHeader.tsx`:

1. In `NewHeaderProps`, add:
   ```tsx
   openFromGitHub: (id: string) => void;
   ```
2. In the destructured props of the `NewHeader` component, add `openFromGitHub,`.
3. Add an import at the top:
   ```tsx
   import OpenFromGitHubDialog from '../github/OpenFromGitHubDialog';
   ```
4. Next to the existing `const [modalShow, setModalShow] = useState(false);`, add:
   ```tsx
   const [gitHubDialogShow, setGitHubDialogShow] = useState(false);
   ```
5. Inside the `StyledMenu` (`moreMenu`), add a new menu item as the first child, before the existing first `<MenuItem>`:
   ```tsx
   <MenuItem disableRipple onClick={() => handleMoreClose(() => setGitHubDialogShow(true))}>
   	Open from GitHub…
   </MenuItem>
   ```
6. Render the dialog. Find where `moreMenu` is returned/used in the component's JSX and add the dialog as a sibling element (e.g. immediately after `{moreMenu}` or inside the same fragment):
   ```tsx
   <OpenFromGitHubDialog
   	open={gitHubDialogShow}
   	onClose={() => setGitHubDialogShow(false)}
   	onOpen={openFromGitHub}
   />
   ```

- [ ] **Step 4: Type-check, lint, and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && yarn lint`
Expected: no errors.

Run: `cd frontend && yarn test`
Expected: PASS — all tests, including the new converter, repository, and dialog suites.

- [ ] **Step 5: Manual smoke test**

Run: `cd frontend && yarn dev`
Then in the browser at http://localhost:3000:
1. Open the overflow (⋮) menu → "Open from GitHub…".
2. Paste a URL to a Markdown file with a `wardley-beta` fence and a fine-grained PAT.
3. Confirm the map loads and renders.
4. Edit the map text, click Save, accept the commit-message prompt.
5. Confirm the commit appears on GitHub with the fence updated and surrounding prose intact.

- [ ] **Step 6: Commit**

```bash
cd /workspaces/onlinewardleymaps-rebrand
git add frontend/src/components/MapEnvironment.tsx frontend/src/components/map/components/MapLayout.tsx frontend/src/components/page/NewHeader.tsx
git commit -m "feat: wire Open from GitHub dialog into the header menu"
```

---

## Self-Review Notes

- **Spec coverage:** Component 1 (converter) → Tasks 1-6; Component 2 (GitHub access) → Tasks 7-11; Component 3 (persistence wiring & UI) → Tasks 12-17. Error handling — `GitHubApiError` carries the status (Task 11) for the load/save callers to surface; the dialog shows inline URL/token errors (Task 16); the stale-`sha` `409` surfaces as a `GitHubApiError` from `commitFile`. `keptAsComments` is produced (Task 3) and available to callers for the "won't render on GitHub" warning.
- **Type consistency:** `GitHubSource` (Task 7) is reused by `GitHubMapSession`, `GitHubClient`, and both strategies. `exportToMermaid` returns `{mermaid, keptAsComments}` consistently (Tasks 2/3) and is consumed by `GitHubSaveStrategy` (Task 14). `importFromMermaid` returns a `string` consumed by `GitHubLoadStrategy` (Task 13).
- **Known follow-up (out of scope, per spec):** the `keptAsComments` warning is not yet shown in the UI on save, and there is no hash deep-linking — reloading the page loses the GitHub binding. Both are noted in the design spec as future enhancements.
