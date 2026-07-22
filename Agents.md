# StatLens — Agent Rules

## Mission
Build a free, reliable, beautiful, BROWSER-ONLY web replacement for GraphPad Prism.
Statistical correctness is the top priority; UX polish is second. No backend server and no
database — statistics run in the browser via Pyodide, files live in the user's Google Drive.
When in doubt, prefer correctness and clarity over cleverness, and prefer fewer moving parts.

## Golden rules
1. STATISTICAL CORRECTNESS IS NON-NEGOTIABLE. Every statistic/test has a unit test against
   known reference values (SciPy/statsmodels/pingouin/lifelines docs, R, or published worked
   examples) with sensible tolerance. Never change an algorithm without updating tests + comments.
2. DO NOT INVENT statistical methods. Use numpy/scipy/statsmodels/pingouin/scikit-posthocs/
   lifelines/scikit-learn (in Pyodide). If multiple conventions exist, pick one, cite it in a
   comment, be consistent.
3. NO BACKEND, NO DATABASE. All computation runs in the browser via Pyodide (in a Web Worker so
   the UI never freezes). All persistence is Google Drive. Do NOT add a server, API service, or
   DB. If a specific library truly cannot run in Pyodide, STOP and ask the human before adding any
   server-side component; never silently introduce one.
4. LEAST PRIVILEGE for Google Drive: scope `https://www.googleapis.com/auth/drive.file` only.
   Operate only on files/folders StatLens created. Never log tokens or raw user data.
5. SECRETS: none in the repo. The only user-supplied config is a PUBLIC OAuth client ID (not a
   secret). Provide `.env.example`; add `.env*` to `.gitignore`.
6. TYPE SAFETY: TypeScript strict; no `any` unless documented. Strongly type the JS↔Pyodide
   boundary (validate shapes crossing into/out of Python) and the project file format.
7. CHARTS: render as vector SVG; default background transparent; PNG export preserves transparency
   and matches the on-screen graph exactly.
8. THEMING: global light + dark via design tokens (CSS variables / Tailwind). No hardcoded hex in
   components; theme all UI and chart colors through tokens/palettes.
9. ACCESSIBILITY: semantic HTML, keyboard access, visible focus, ARIA where appropriate, WCAG-AA
   contrast in both themes, colorblind-friendly palettes.
10. PRIVACY: user data goes only to (a) the user's own Google Drive and (b) their own browser's
    computation. No external analytics on data; nothing leaves the browser but Drive API calls.
11. LEGAL DISTINCTNESS: do NOT copy any GraphPad Prism text/tooltips/menu strings/icons/branding
    or its exact UI. All in-app copy (tooltips, table-type descriptions, test explanations,
    figure-legend notes, errors) is original, written from scratch.
12. ENGINEERING CONVENTIONS: single app `apps/web` (Vite + React + TS) with a clear module layout:
    `data/` (workbook model + Drive I/O), `stats/` (Pyodide worker + typed wrappers + tests),
    `charts/` (SVG chart engine + significance layer + PNG export), `ui/` (shell, editor, panels).
    Co-locate tests (`*.test.ts`). Keep the app runnable at the end of every phase.
13. VERIFICATION: a phase is done only when TS type checks pass, all tests pass, and the phase's
    acceptance criteria are demonstrably met with browser screenshots saved as artifacts and a
    note appended to /docs/PROGRESS.md.
## Verification discipline (added Phase 4.5)
- Every statistic/test/effect-size/CI has BOTH a reference-oracle test (vs an independent
  known-correct computation or published constant) AND edge-case tests. No exceptions.
- Treat prior "verified/complete" claims as unverified until re-proven in a test.
- Every bug fix adds a regression test that fails before the fix and passes after. Never fix by
  loosening tolerances or removing assertions.
- Pin library behavior (method/alternative/correction/zero_method/typ/contrasts) explicitly;
  never depend on a library version's default.
- Seed all randomness. Degenerate inputs must error cleanly or compute correctly — never crash,
  emit a silent NaN to the UI, or show a misleading value. Never display p = 0, NaN, or Infinity.
- The oracle path and the production path must be independent (don't validate a function against
  itself). Prefer a second library, a textbook dataset with a published answer, or a hardcoded
  R/Prism-validated value.
## Git Commits
All changes must be made to local files. DO NOT commit or push anything to the git repo until explicitly instructed by the user.
