# Tipsy Docy

**Your documents. Your canvas. Your rules.**

A static Next.js application for local document editing and vector PDF page arrangement. Processing, previews, exports, and editable project storage run in the browser. There is no document backend, authentication, analytics, paid API, or upload service.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`) and npm. No additional runtime is needed for the local static-preview server.

```sh
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. To test the actual static production output:

```sh
npm run build
npm start
```

`npm start` serves `out/` with a local Node static-file server on port 3000. Stop the development server first. There is no Next.js runtime server in production.

## Studios and workflows

- **PDF Studio:** add or drop multiple PDFs, view source thumbnails, select page ranges, reorder files and pages, duplicate/delete/rotate pages, and split source PDFs. Splitting initiates multiple downloads; your browser may ask for permission.
- **Layouts:** 1×1, 1×2, 2×1, 2×2, 3×3, 4×4, 6×6, 8×8, or up to 16 rows/columns. Five selected pages in a 2×2 layout produce two sheets. A4/A3/A5/Letter/Legal/custom paper; orientation; mm/in/pt controls; margins; independent gaps; fit/fill; alignment; reading order; background; borders; individual scale/offsets.
- **Canvas:** all output sheets, lazy-rendered PDF.js previews, zoom and fit, pan mode, visual guides, pointer dragging, keyboard nudging (arrows = 1 pt, Shift + arrows = 10 pt), reset, undo/redo. The source list supports drag-to-reorder and accessible Up/Down controls.
- **Document Studio:** Tiptap/ProseMirror paragraphs and H1–H6, inline formatting, font family/size/color/highlight, lists/checklists, alignment/indent/line/paragraph spacing, links, blockquotes, dividers, tables, local PNG/JPEG images, page breaks, and text undo/redo. Additional paragraph, table, image, page, header/footer, numbering, and saved custom page presets are under Document settings.
- **Import:** DOCX via Mammoth, TXT, sanitized HTML, and formatted clipboard paste. Paste Google Docs content or import a DOCX exported from Google Docs. No direct authenticated Google Docs import and no lossless-compatibility claim.
- **Preview/export:** adjustable split view, collapsible panels, measured multi-page preview, margins and paper setup. Direct local searchable-text PDF, DOCX (common formatting), HTML, TXT, and explicitly labeled browser print / Save as PDF.
- **Arrange Pages:** generates a PDF in memory from the document's current preview model and opens it in PDF Studio. Choose an N-up layout and export. Document Studio retains the editable text. Running Arrange Pages again regenerates the layout source from the latest document.
- **Quick Tools:** routes into the shared engines for merge, split, extract, delete, rotate, reorder, conversion, and N-up layouts.
- **Projects:** debounced IndexedDB saves, refresh recovery via project ID in the URL, recent projects, rename/duplicate/delete, editable JSON backups and validated imports. Theme is the only localStorage preference. Ctrl/Cmd + S saves; PDF undo uses Ctrl/Cmd + Z / Shift + Z.

## Architecture

- `app/`: static landing, studio, privacy, and layout.
- `components/`: workspace, PDF canvas/properties, document editor/preview, recent projects, theme, and PDF rendering.
- `lib/model.ts`: typed project, page, paper, and document data.
- `lib/layout.ts`: the single point-based N-up geometry engine. Preview and vector export both consume its boxes. Cell clipping is identical in preview and export.
- `lib/pdf.ts`: local parsing, embedding, clockwise rotation, clipping, split, and download lifecycle.
- `lib/documents.ts`: sanitization, DOM text/image/table measurement, pagination, and searchable PDF generation. Preview and PDF both consume the same measured `DocModel`; no screenshot-based primary export.
- `lib/storage.ts`: IndexedDB and Zod-validated portable project backups.
- `scripts/copy-worker.mjs`: installs the matching PDF.js worker into `public/`. Runs automatically after npm install/ci. No CDN worker is used.
- `tests/`: layout, real vector export/reopening/geometry, backup validation, and browser workflows.

Browser libraries are loaded from a client-only dynamic workspace. PDF.js parses in its worker; rendering waits for thumbnail visibility and cancels on unmount. Source proxies are shared and destroyed when removed or the workspace closes. Layout drag updates are transient until pointer-up to avoid filling history. History is capped at 40 snapshots. Source byte arrays are shared between snapshots. Autosave waits 650 ms after a change. Exports yield to the event loop and PDF export can be cancelled.

## Deployment

```sh
npm ci
npm run build
```

Publish **only `out/`** to any static host. `trailingSlash: true` emits `studio/index.html` and `privacy/index.html`, so ordinary directory-index hosting supports refreshes. Host at the origin root; subpath hosting needs a matching Next.js `basePath` and worker URL adjustment. Serve `.mjs` as JavaScript. HTTPS or localhost is recommended for secure browser APIs. There are no environment variables or secrets to provision.

The static configuration follows the [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
E2E_STATIC=1 npm run test:e2e
```

Playwright uses Chromium's regular executable in headless mode (`channel: chromium`). Unit tests reopen generated vector PDFs and verify text coordinates against the preview model, including clockwise rotation. Browser tests use actual generated PDF/DOCX fixtures, file pickers/drop events, formatting actions, exported downloads, local recovery, and malformed content.

See [the verification report](evidence/VERIFICATION.md) for the executed results and artifacts, and `CODEX_HANDOFF.md` for task continuity. Passing these checks does not establish universal compatibility or large-file benchmarks.

## Privacy and security

No document data is sent to a server. Imported/pasted HTML is sanitized with DOMPurify; scripts, forms, embedded content, remote images, and URL-bearing styles are removed. Only local PNG/JPEG data images are retained. Ordinary links remain editable; following one leaves the app. PDF scripting is not enabled. Never trust browser storage as permanent backup: profiles can be cleared, storage evicted, and private sessions discarded. Save failures are visible; editable backup exports remain available.

The final executed dependency audit reports **0 vulnerabilities**. TypeScript/React Hooks ESLint rules are installed directly, avoiding a vulnerable unused development glob chain. Mammoth's CLI-only `argparse` dependency is overridden to 2.0.1 to eliminate its vulnerable `sprintf-js` chain. The browser converter does not import the CLI; real DOCX import/export is covered by browser tests. The upstream Mammoth command-line tool is not a supported feature of this application. Re-run `npm audit` before deployment; an audit is not a security certification.

## Known limitations

- Direct document PDF uses standard PDF fonts (Arial/Helvetica, Times, Courier approximations). Non-Latin text and advanced shaping are not supported reliably by that path. The clearly labeled browser print option retains browser-native multilingual typography, and opens a dialogue in which the user chooses Save as PDF. Arrange Pages uses the direct PDF representation and shares its font limitations.
- Common text, headings, inline styles, images, lists, and tables are supported. Complex Word layouts, equations, tracked changes, floating shapes, nested/merged tables crossing page boundaries, custom embedded fonts, and exact DOCX round-trips are not guaranteed. DOCX export currently preserves common text/headings/inline emphasis/lists/tables/local images/page breaks, but does not reproduce all advanced page decoration and paragraph styles.
- Pagination uses measured lines and basic table outlines. It is not a full print publishing engine: complex row fragmentation, widow/orphan constraints, repeating table headers, and professional footnotes are not implemented.
- PDF Studio preserves vector content, not interactive form fields, original annotations, document outlines, signatures, accessibility structure, or source metadata. Encrypted/password-protected or malformed PDFs are rejected with an error.
- PDF.js rendering is lazy, but all page metadata and source bytes live in memory. Very large files or hundreds of complex pages can exceed device memory. Large-document performance has not been benchmarked; the source list is not fully virtualized.
- Project backups currently encode source bytes as JSON arrays, which is portable but larger than the original PDF. Local projects are not encrypted. Browser storage is neither a cloud sync service nor a guaranteed permanent backup.
- No OCR, PDF-to-Word conversion, redaction security certification, direct Google Docs API integration, collaboration, or backend conversion is claimed.
