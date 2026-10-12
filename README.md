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
- **Canvas:** all output sheets, lazy-rendered PDF.js previews, zoom and fit, pan mode, visual guides, pointer dragging, keyboard nudging (arrows = 1 pt, Shift + arrows = 10 pt), reset, undo/redo. The source list supports drag-to-reorder and accessible Up/Down controls. At most 40 source cards mount at once; previous/next and jump-to-page controls keep long PDFs navigable.
- **Document Studio:** Tiptap/ProseMirror paragraphs and H1–H6, inline formatting, font family/size/color/highlight, lists/checklists, alignment/indent/line/paragraph spacing, links, blockquotes, dividers, tables, local PNG/JPEG images, superscript/subscript, page breaks, editable LaTeX equation blocks rendered locally with KaTeX, and text undo/redo. The typing surface has a page ruler with draggable/keyboard left, right, and first-line indent handles, editor zoom, and text-boundary guides. N-up page-border settings live in Document settings and carry into Arrange Pages: toggle page outlines and customize color, width, and solid, dashed, or dotted strokes; the shared layout renderer previews and exports the same placed-page edges. Additional paragraph, table, image, page, header/footer, numbering, and saved custom page presets are under Document settings. Paragraphs support space before/after, left/right margins, first-line/hanging indent, and four-sided padding. Selected paragraphs can be grouped into blocks with their own four-sided margins and padding. Clear formatting and local find/replace (Ctrl/Cmd+F or H) are available.
- **Import:** DOCX via Mammoth, TXT, sanitized HTML, and formatted clipboard paste. Paste Google Docs content or import a DOCX exported from Google Docs. No direct authenticated Google Docs import and no lossless-compatibility claim.
- **Preview/export:** adjustable split view, collapsible panels, measured multi-page preview, margins and paper setup. Direct local searchable-text PDF, DOCX (common formatting), HTML, TXT, and explicitly labeled browser print / Save as PDF.
- **Arrange Pages:** generates a PDF in memory from the document's current preview model and opens it in PDF Studio. Choose an N-up layout and export. Document Studio retains the editable text. Running Arrange Pages again regenerates the layout source from the latest document.
- **Quick Tools:** routes into the shared engines for merge, split, extract, delete, rotate, reorder, conversion, and N-up layouts.
- **Projects:** debounced IndexedDB saves, refresh recovery via project ID in the URL, recent projects, rename/duplicate/delete, editable JSON backups and validated imports. New version-two JSON backups encode source files as base64 instead of decimal arrays, reducing their size; version-one backups remain importable. Theme is the only localStorage preference. Ctrl/Cmd + S saves; PDF undo uses Ctrl/Cmd + Z / Shift + Z.

## Architecture

- `app/`: static landing, studio, privacy, and layout.
- `components/`: workspace, PDF canvas/properties, document editor/preview, recent projects, theme, and PDF rendering.
- `lib/model.ts`: typed project, page, paper, and document data.
- `lib/layout.ts`: the single point-based N-up geometry engine. Preview and vector export both consume its boxes. Cell clipping is identical in preview and export.
- `lib/pdf.ts`: local parsing, embedding, clockwise rotation, clipping, split, and download lifecycle.
- `lib/documents.ts`: sanitization, DOM text/image/table measurement, pagination, and searchable PDF generation. `lib/page-flow.ts` maps the shared pagination targets to editor-only decorations; `lib/editor-layout.ts` supplies block/paragraph attributes and keyboard editing; `lib/docx.ts` exports editable Word documents. Preview and PDF both consume the same measured `DocModel`; no screenshot-based primary export.
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

See [the original verification report](evidence/VERIFICATION.md) and [the latest continuation report](evidence/CONTINUATION_VERIFICATION.md) for the executed results and artifacts, and `CODEX_HANDOFF.md` for task continuity. Passing these checks does not establish universal compatibility or large-file benchmarks.

## Privacy and security

No document data is sent to a server. Imported/pasted HTML is sanitized with DOMPurify; scripts, forms, embedded content, remote images, and URL-bearing styles are removed. Only local PNG/JPEG data images are retained. Ordinary links remain editable; following one leaves the app. PDF scripting is not enabled. Never trust browser storage as permanent backup: profiles can be cleared, storage evicted, and private sessions discarded. Save failures are visible; editable backup exports remain available.

The final executed dependency audit reports **0 vulnerabilities**. TypeScript/React Hooks ESLint rules are installed directly, avoiding a vulnerable unused development glob chain. Mammoth's CLI-only `argparse` dependency is overridden to 2.0.1 to eliminate its vulnerable `sprintf-js` chain. The browser converter does not import the CLI; real DOCX import/export is covered by browser tests. The upstream Mammoth command-line tool is not a supported feature of this application. Re-run `npm audit` before deployment; an audit is not a security certification.

## Google Docs-style editing scope

The application implements local rich-text typing, cursor-aware common formatting, tables, images, paragraph/block spacing, ruler indentation, find/replace, keyboard shortcuts, history, and export. It is not a feature-identical Google Docs implementation. The editable typing surface now has automatically separated sheets, including long-paragraph flow and explicit page breaks. Editor page spacers are transient ProseMirror decorations derived from the same measured model as preview/export; they do not alter saved text or insert artificial page-break nodes. Ordinary paragraphs and tables that fit a sheet move together across boundaries. Complex tables that are taller than a sheet remain subject to the pagination limitations below. Local anchored comments and accept/reject replacement suggestions are available in Document settings and persist in project content. The automatic contents list follows headings. Endnotes remain available, and inline page footnotes flow to the measured page containing their marker with searchable PDF text and the same position in live preview. DOCX currently keeps footnote content as an inline readable fallback. Structured author/date/title/URL citations generate a live bibliography in APA, MLA, Chicago author-date, or IEEE styles; changing the style updates existing in-text citations and the bibliography. These locally generated styles are useful formatting choices, not a certification of exact compliance with every edition or discipline-specific rule. Selected paragraphs can be formatted as two- or three-column sections with adjustable gaps; the browser preview and PDF export use the measured column positions. DOCX export currently linearizes these sections. Equation numbering/alignment and advanced equation editing remain unimplemented. Basic LaTeX equation blocks render locally in the editor; their formula remains searchable in PDF export, while DOCX export retains the source text rather than the typeset equation. Cloud collaboration/account integrations are outside the browser-only architecture. Full feature parity remains an open request, and is not inferred from passing the implemented workflow tests.

## Known limitations

- Direct document PDF uses standard PDF fonts for ordinary Latin documents. Documents containing extended Latin, Greek or Cyrillic embed bundled Liberation Sans. Hindi and Arabic use local Noto fonts through PDFKit/fontkit shaping. These non-ASCII documents use a sans-serif export fallback, so exact selected-font appearance is not guaranteed. CJK, emoji, mixed-script runs, and other advanced shaping cases still need further work. Text remains selectable/searchable where the generated PDF encoding supports it; PDF text extraction for complex scripts varies by reader. The clearly labeled browser print option retains browser-native multilingual typography, and opens a dialogue in which the user chooses Save as PDF. Arrange Pages uses that same locally generated document PDF representation and font support.
- Common text, headings, inline styles, images, lists, and tables are supported. Complex Word layouts, equations, tracked changes, floating shapes, nested/merged tables crossing page boundaries, custom embedded fonts, and exact DOCX round-trips are not guaranteed. DOCX export preserves common text/headings/inline emphasis/font/color/superscript/subscript/links/lists/tables/local images/page breaks, paragraph spacing/indents, headers/footer/page numbers, and landscape page setup. Grouped block spacing is mapped to Word paragraph spacing/indents; Word does not retain the HTML grouping object. Advanced page decorations and exact application-to-application round trips are not guaranteed.
- Pagination uses measured lines and basic table outlines. Footnotes reserve a bounded page area and follow their inline markers, but very dense notes, footnote-specific typography/numbering rules, complex row fragmentation, widow/orphan constraints, and repeating table headers are not a full professional publishing engine.
- PDF Studio preserves vector content, not interactive form fields, original annotations, document outlines, signatures, accessibility structure, or source metadata. Encrypted/password-protected or malformed PDFs are rejected with an error.
- PDF.js rendering is lazy, but all page metadata and source bytes live in memory. Very large files or hundreds of complex pages can exceed device memory. The source list is paginated into batches of 40 mounted cards. Synthetic 128-page vector and 48-page image-heavy smoke results are in evidence; these are not universal performance benchmarks.
- Project backups encode source bytes as base64, adding approximately 33% to raw source byte size plus editable-model JSON. Legacy decimal-array backups are still supported. Local projects are not encrypted. Browser storage is neither a cloud sync service nor a guaranteed permanent backup.
- No OCR, PDF-to-Word conversion, redaction security certification, direct Google Docs API integration, collaboration, or backend conversion is claimed.
