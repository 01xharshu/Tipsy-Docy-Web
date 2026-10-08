# Tipsy Docy verification

Verified 2026-10-08, Asia/Kolkata. Runtime: Node.js 24.19.0, Chromium headless via Playwright. The repository initially contained no application files or commits. This implementation processes document contents entirely in the browser and produces a static Next.js export.

## Executed checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run lint` | PASS | `lint.log` |
| `npm test` | 16/16 PASS | `unit-tests.log` |
| `npm run build` | PASS, static routes | `build.log` |
| `E2E_STATIC=1 npm run test:e2e` | 9/9 PASS, 22.7 seconds | `static-e2e.log` |
| `npm audit --json` | 0 vulnerabilities at verification time | `dependency-audit.json` |

The final browser suite ran against the generated `out/` directory served by `scripts/serve-static.mjs`, not a development-only rendering. Earlier failed runs were repaired and are recorded in implementation-history.md; they are not counted as passing verification.

## Real workflow coverage

- Five-page PDF upload and all source thumbnails; 2x2 yields two sheets; margins, spacing, page movement, history, export and reopening. Unit tests compare exported vector text transforms with the centralized preview geometry, including clockwise rotation and CropBox handling.
- Rich document text, headings, bold, lists, table insertion, font/margin changes, live preview, local persistence and refresh recovery. Actual searchable PDF export is reopened and checked against SVG preview baselines.
- Document-to-PDF arrangement in memory, N-up export, valid final file.
- DOCX import/export, sanitized HTML, malformed files, actual drop events, selection, duplicate/delete/rotate, editable backup import/export, project rename/duplicate/delete.
- Long documents, real canvas-generated PNG insertion, custom saved presets, modal keyboard interaction, native browser-print pagination, intentionally blank pages from consecutive page breaks.
- Storage quota failure and denied localStorage remain visible/recoverable without blocking editing/export. Light/dark landing and studio accessibility scans, mobile editor and export-button bounds.

## Visual and export evidence

Desktop: landing-desktop.png, landing-hero.png, document-desktop.png, pdf-desktop.png, combined-desktop.png. Mobile: landing-mobile.png, document-mobile.png, pdf-mobile.png. Screenshots were captured from the final static production output and inspected.

Actual downloads: document-export.pdf and arranged-export.pdf. Independently rendered PDF pages: document-export-render.png and arranged-export-render.png. Reproduce against a running static preview with `node scripts/capture-evidence.mjs` (default origin http://127.0.0.1:4174).

Synthetic smoke: large-pdf-smoke.json records 128 simple vector-text pages arranged 8x8 into two valid sheets: layout ready 143 ms; export/reopen 249 ms; output 79,369 bytes. These timings describe this fixture and machine only. They do not establish performance for large image-heavy PDFs or all devices.

## Scope and practical limits

Direct document PDF exports use standard PDF fonts; advanced shaping and non-Latin text require browser print, which opens a print dialogue. Complex DOCX layouts and advanced publishing pagination are not lossless. Vector page arrangement does not preserve interactive annotations/forms/signatures. Very large/image-heavy workloads have not been benchmarked, and source lists are not fully virtualized. Browser storage can be evicted; export editable backups. README.md documents these boundaries and deployment requirements.

No remote deployment or universal production/security certification is claimed. The supported local workflows passed the checks above. manifest.json identifies source and evidence hashes; it is not a substitute for the actual browser tests and visual inspection.
