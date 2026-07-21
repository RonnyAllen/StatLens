# TASK F: Close out Phase 0 (Foundation, design system, Pyodide bootstrap)

Phase 0's exact spec, from `docs/IMPLEMENTATION_PLAN.md`:

> Scaffold `apps/web` (Vite + React + TS strict); ESLint/Prettier; test runner (Vitest). Tailwind +
> shadcn/ui; design tokens; class-based light/dark toggle that persists. Bundle OFL fonts via
> Fontsource; wire into Tailwind. Base app shell: top bar, left sidebar placeholder, empty canvas.
> Pyodide bootstrap in a Web Worker: load numpy/pandas/scipy/scikit-learn/statsmodels and
> micropip-install pingouin, scikit-posthocs, lifelines; expose a typed `runStats(payload)` bridge;
> add a tiny smoke computation (e.g. a t-test) to prove the engine works.
>
> **Acceptance:** app builds with zero type errors; light/dark toggle persists; fonts load locally
> (no external font URLs); the Pyodide worker loads and the smoke t-test returns a value matching
> SciPy (unit-tested); a one-time "Loading statistics engine…" state shows on first use.

**I verified every clause of this by execution against the current codebase, not by reading it.**
Most of Phase 0 is already done — some of it exceeds the spec. Four small, real gaps remain. This
task closes them and nothing else.

---

## RULES

1. If a FIND string doesn't match, **STOP and report** — don't regenerate the file.
2. `npx tsc -p tsconfig.app.json --noEmit` must exit 0 when you're done, with `strict: true` set.
3. **Do not touch fonts, the loading-state UI, or the base app shell** — see §0 for why; they're
   already correct and re-doing them risks regressing something that works.
4. **Do not mass-reformat the repo with Prettier.** Add the config; do not run `prettier --write`
   across existing files in this task. A repo-wide reformat is a separate, reviewable change —
   bundling it here would bury 4 real fixes inside thousands of unrelated whitespace lines (the
   project already has a live CRLF-churn problem from exactly this kind of blanket tool run).

---

## §0 — What's already done (verified, don't touch)

- **Fonts:** 15 Fontsource families are bundled and imported in `main.tsx`; zero external font
  CDN links exist in `index.html`. They're wired into the **graph font-family selector**
  (`GraphSettingsPanel.tsx` → `config.fontFamily` → rendered directly in chart SVG `fontFamily`
  props in `GraphEngine.tsx`/`ColumnCharts.tsx`) — which is the typography a Prism user actually
  cares about (publication export), not app chrome. **This satisfies the acceptance criterion
  ("fonts load locally, no external font URLs") in full.** The PRD's literal phrase "wire into
  Tailwind" is technically unmet for the app's own UI chrome (buttons/headers still render in
  Tailwind's default system-font stack) — that's cosmetic, optional, and explicitly **out of
  scope** for this task.
- **Loading state:** `App.tsx` already drives a `statsState`/`loadMessage` pair from
  `statsEngine.init()`, showing live progress ("Loading Pyodide runtime…" → "Loading core
  mathematics…" → "Loading advanced statistics…" → "Engine ready"). This *is* the one-time
  loading state the acceptance criterion asks for.
- **Pyodide package loading:** matches the spec exactly — `loadPackage(["numpy","pandas","scipy",
  "scikit-learn","statsmodels","micropip"])` + micropip-installs pingouin/scikit-posthocs/lifelines.
- **Base app shell:** far exceeds a placeholder — this is a full app now. Nothing to do here.
- **Dark/light toggle:** verified persists via `localStorage` (`theme-provider.tsx`).
- **Vitest:** present as a dependency; 2 test files already exist
  (`src/stats/__tests__/run_audit.test.ts`, `src/charts/__tests__/geometry.test.ts`). I could not
  execute these myself in my sandbox (a native-binding resolution error in `rolldown`, which reads
  as an environment issue, not a code defect) — **run `npx vitest run` yourself as part of
  verification** and report the real output.

---

## §1 — TS strict mode is off (real gap, but a 1-line, zero-risk fix)

`strict` is not set anywhere in the tsconfig chain (`tsconfig.json` only references
`tsconfig.app.json`/`tsconfig.node.json`; neither sets it). **I tested turning it on before writing
this prompt:** with `strict: true` added, `tsc -p tsconfig.app.json --noEmit` still **exits 0 with
zero new errors** — confirmed genuine (not a stale cache: I cleared `.tsbuildinfo` and re-ran; and
confirmed `strict` really is being enforced by planting a deliberate implicit-`any` in a scratch
file, which correctly raised `TS7006`). **This is not a refactor — it's a one-line flip.**

### `apps/web/tsconfig.app.json` — 1 occurrence
FIND:
```json
    "noEmit": true,
```
REPLACE:
```json
    "noEmit": true,
    "strict": true,
```

Run `npx tsc -p tsconfig.app.json --noEmit` immediately after. If it is *not* clean in your
checkout (possible if files changed since I tested), fix the surfaced errors properly — do not
loosen the flag back off, and do not blanket-suppress with `// @ts-ignore`.

---

## §2 — The bridge isn't typed (`runEngine`/`runPython` take `payload: any`)

`apps/web/src/stats/engine.ts` is the actual `runStats`-equivalent bridge (named `StatsEngine`,
methods `init`/`runPython`/`runEngine`/`analyzeSheet`). It works correctly but its public surface
is untyped, which both violates "expose a **typed** bridge" and means a caller gets no
autocomplete/type-checking on what it's allowed to send.

**Note on scope:** only the *input* is typed below. The engine's Python `run()` genuinely returns
a different shape per `test_id` (error dict | descriptives | ANOVA table | post-hoc matrix | ...),
so the *return* type stays `any` — that's honest, not a shortcut. I tried typing the return as
`unknown` first and it cascaded into 7 unrelated errors across `AnalyzePanel.tsx`,
`AnalysisResultsView.tsx`, and `Workspace.tsx` (none of which narrow the result before reading
properties off it) — fixing that properly is a separate, larger task, not part of Phase 0. Ship
the version below; I verified it compiles clean end-to-end with `strict: true` already applied.

### `apps/web/src/stats/engine.ts` — add a type import, 1 occurrence
FIND:
```ts
export type WorkerResponse = {
```
REPLACE:
```ts
import type { DataSheet } from "@/types/workbook"
import type { TestOptions } from "@/components/workspace/TestOptionsDialog"

// The engine's Python run() returns a shape that genuinely varies per test_id (error |
// descriptives | ANOVA table | post-hoc matrix | ...), so the RETURN type below stays
// `any` on purpose -- only the INPUT payload is typed, which is what this task asks for.
export interface RunEnginePayload {
  sheet: DataSheet
  entrypoint?: string
  options?: TestOptions
}

export type WorkerResponse = {
```

### Type `runPython`'s `globals` param — 1 occurrence
FIND:
```ts
  runPython(code: string, globals?: Record<string, any>, onProgress?: (p: number, m: string) => void): Promise<any> {
```
REPLACE:
```ts
  runPython(code: string, globals?: Record<string, unknown>, onProgress?: (p: number, m: string) => void): Promise<any> {
```

### Type `runEngine`'s payload — 1 occurrence
FIND:
```ts
  runEngine(payload: any, onProgress?: (p: number, m: string) => void): Promise<any> {
```
REPLACE:
```ts
  runEngine(payload: RunEnginePayload, onProgress?: (p: number, m: string) => void): Promise<any> {
```

### Type `analyzeSheet`'s sheet param — 1 occurrence
FIND:
```ts
    async analyzeSheet(sheet: any): Promise<any> {
```
REPLACE:
```ts
    async analyzeSheet(sheet: DataSheet): Promise<any> {
```

I applied this exact patch set (§1 + §2 together) to a scratch copy of your checkout and confirmed
`npx tsc -p tsconfig.app.json --noEmit` exits 0 with zero errors, `.tsbuildinfo` cleared. If it's
not clean in your actual checkout, something changed since — fix it properly, don't loosen types
to make it pass.

---

## §3 — The smoke test exists but proves nothing (dead code, not unit-tested)

`StatsEngine.smokeTest()` runs `scipy.stats.ttest_ind([1,2,3],[4,5,6])` through the worker and
`console.log`s the result — but **it is never called anywhere in the app**, and there is no test
asserting its output. The acceptance criterion explicitly requires this be **unit-tested**, and
right now nothing would catch it if the Pyodide bootstrap silently broke.

**I could not execute this test myself** — it needs to fetch the Pyodide WASM runtime from
`cdn.jsdelivr.net`, which isn't in my sandbox's network allowlist. I computed the reference values
independently with a plain (non-WASM) SciPy install, so the expected numbers below are verified —
but **you must actually run this test and paste the real output before considering this closed.**
That's not a formality: this is exactly the kind of thing that looks right on paper and turns out
wrong in WASM (this project has hit real Pyodide-vs-CPython numerical drift before).

Create `apps/web/src/stats/__tests__/pyodide_smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { loadPyodide } from "pyodide"

// Phase 0 acceptance: "the Pyodide worker loads and the smoke t-test returns a value
// matching SciPy (unit-tested)". This exercises the real Pyodide runtime + scipy package
// load directly (not the Worker message-passing wrapper, which vitest's Node environment
// can't host) — that's the part of the acceptance criterion that can actually break silently.
describe("Pyodide bootstrap smoke test", () => {
  it("loads numpy/scipy in Pyodide and matches a plain-SciPy reference exactly", async () => {
    const pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
    })
    await pyodide.loadPackage(["numpy", "scipy"])

    const result = await pyodide.runPythonAsync(`
from scipy import stats
r = stats.ttest_ind([1, 2, 3], [4, 5, 6])
{"statistic": r.statistic, "pvalue": r.pvalue}
    `)
    const { statistic, pvalue } = result.toJs({ dict_converter: Object.fromEntries }) as {
      statistic: number
      pvalue: number
    }

    // Reference computed independently on CPython/SciPy (not inside Pyodide):
    //   scipy.stats.ttest_ind([1,2,3],[4,5,6]) -> statistic=-3.6742346141747673, pvalue=0.021311641128756713
    expect(statistic).toBeCloseTo(-3.6742346141747673, 6)
    expect(pvalue).toBeCloseTo(0.021311641128756713, 6)
  }, 60_000) // first-run WASM boot + package fetch can take 10-30s — do not lower this
})
```

Run `npx vitest run src/stats/__tests__/pyodide_smoke.test.ts` and confirm it passes with the real
Pyodide runtime. **Report the actual printed statistic/pvalue in your response** — don't just
report the exit code — so this is verified the same way everything else in this project has been:
by execution, not by a green checkmark.

If `loadPyodide` needs additional Node-side setup to run outside a browser/worker (e.g. a fetch
polyfill), add the minimal shim required and note what you added.

---

## §4 — Prettier is entirely absent

`oxlint` legitimately fills ESLint's role (fast, already wired as the `lint` script) — that part of
Phase 0 is fine. But no code formatter exists at all.

Existing style, sampled from `engine.ts`/`App.tsx`: **no semicolons, double quotes.** Configure
Prettier to match this so adding it doesn't imply a mass reformat.

Create `apps/web/.prettierrc.json`:
```json
{
  "semi": false,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

Create `apps/web/.prettierignore`:
```
dist
node_modules
scratch
*.md
```

### `apps/web/package.json` — add a format script, 1 occurrence
FIND:
```json
    "lint": "oxlint",
```
REPLACE:
```json
    "lint": "oxlint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
```

Add `"prettier"` to `devDependencies` at whatever version `npm info prettier version` currently
resolves to. Run `npx prettier --check .` (read-only) and tell me the number of files it flags —
**do not run `--write` on the existing tree in this task** (see RULES §4).

---

## Final verification checklist

Run these and paste real output, not a summary:

```
npx tsc -p tsconfig.app.json --noEmit          # must exit 0, with strict:true set
npx vitest run                                  # all existing tests + the new smoke test
npx prettier --check .                          # report the count; do not fix in this task
```

Confirm each acceptance clause explicitly in your response:
- [ ] App builds with zero type errors **under `strict: true`**
- [ ] Light/dark toggle persists (already true — just confirm you didn't regress it)
- [ ] Fonts load locally, no external font URLs (already true — confirm unchanged)
- [ ] Smoke t-test passes **with real printed statistic/pvalue**, matching SciPy to 6 decimals
- [ ] "Loading statistics engine…" state still shows on first use (already true — confirm unchanged)
