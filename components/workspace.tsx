"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Undo2,
  Redo2,
  Layers,
  FileText,
  Grid2X2,
  WandSparkles,
  Check,
  Loader2,
  X,
} from "lucide-react";
import type { Project } from "@/lib/model";
import { newProject, DEFAULT_LAYOUT } from "@/lib/model";
import { saveProject, listProjects, serializeProject } from "@/lib/storage";
import { exportLayout, download, readPdf } from "@/lib/pdf";
import { documentPdf, sanitize } from "@/lib/documents";
import dynamic from "next/dynamic";
const PdfStudio = dynamic(() => import("./pdf-studio"), { ssr: false });
import type { DocumentApi } from "./document-studio";
const DocumentStudio = dynamic(() => import("./document-studio"), {
  ssr: false,
  loading: () => <div className="loading">Opening Document Studio…</div>,
});
import Theme from "./theme";
import { releasePdfs } from "./pdf-thumbnail";
const tools = [
  {
    name: "Merge PDFs",
    description: "Combine files in your preferred order.",
    mode: "pdf",
  },
  {
    name: "Split PDFs",
    description: "Save each source page as a separate PDF.",
    mode: "pdf",
  },
  {
    name: "Extract pages",
    description: "Select a range and export only those pages.",
    mode: "pdf",
  },
  {
    name: "Delete pages",
    description: "Remove pages and keep what matters.",
    mode: "pdf",
  },
  {
    name: "Rotate pages",
    description: "Turn any page in 90° steps.",
    mode: "pdf",
  },
  {
    name: "Reorder pages",
    description: "Drag source pages into a new sequence.",
    mode: "pdf",
  },
  {
    name: "Document to PDF",
    description: "Import DOCX, HTML, or text and export locally.",
    mode: "document",
  },
  {
    name: "Pages per sheet",
    description: "Arrange pages into a custom N-up grid.",
    mode: "pdf",
  },
];
export default function Workspace() {
  const [p, setP] = useState<Project | null>(null),
    [view, setView] = useState("pdf"),
    [status, setStatus] = useState("Loading local project…"),
    [notice, setNotice] = useState(""),
    [exportOpen, setExportOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [filename, setFilename] = useState(""),
    [progress, setProgress] = useState(0),
    [history, setHistory] = useState<{ past: Project[]; future: Project[] }>({
      past: [],
      future: [],
    });
  const historyRef = useRef(history);
  historyRef.current = history;
  const api = useRef<DocumentApi | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const current = useRef<Project | null>(null);
  current.current = p;
  const mounted = useRef(false);
  const report = useCallback((s: string) => setNotice(s), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const query = new URLSearchParams(location.search),
        mode = query.get("mode") || "pdf",
        id = query.get("project");
      let project: Project | undefined;
      try {
        if (id) project = (await listProjects()).find((p) => p.id === id);
      } catch {
        setStatus("Local storage unavailable");
      }
      if (cancelled) return;
      if (id && !project)
        setNotice(
          "Project not found on this browser. A new project has been opened.",
        );
      const next =
        project || newProject(mode === "document" ? "document" : "pdf");
      setP(next);
      setView(id ? query.get("mode") || next.kind : mode);
      setFilename(next.title);
      mounted.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!p || !mounted.current) return;
    setStatus("Saving…");
    const timer = setTimeout(() => {
      void saveProject(p)
        .then(() => setStatus("Saved on this device"))
        .catch(() =>
          setStatus(
            "Save failed — export a project backup (storage full or unavailable)",
          ),
        );
    }, 650);
    return () => clearTimeout(timer);
  }, [p]);
  useEffect(() => {
    const save = () => {
      if (current.current) void saveProject(current.current).catch(() => {});
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (p)
      window.history.replaceState(
        null,
        "",
        `/studio/?project=${encodeURIComponent(p.id)}&mode=${view}`,
      );
  }, [p, view]);
  useEffect(() => () => releasePdfs(), []);
  const change = useCallback((next: Project) => {
    const old = current.current;
    const h = {
      past: old
        ? [...historyRef.current.past.slice(-39), old]
        : historyRef.current.past,
      future: [],
    };
    historyRef.current = h;
    current.current = next;
    setHistory(h);
    setP(next);
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current,
      old = current.current;
    if (!h.past.length || !old) return;
    const prev = h.past[h.past.length - 1],
      next = { past: h.past.slice(0, -1), future: [old, ...h.future] };
    historyRef.current = next;
    current.current = prev;
    setHistory(next);
    setP(prev);
    api.current
      ?.editor()
      ?.commands.setContent(sanitize(prev.html), { emitUpdate: false });
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current,
      old = current.current;
    if (!h.future.length || !old) return;
    const project = h.future[0],
      next = { past: [...h.past, old], future: h.future.slice(1) };
    historyRef.current = next;
    current.current = project;
    setHistory(next);
    setP(project);
    api.current
      ?.editor()
      ?.commands.setContent(sanitize(project.html), { emitUpdate: false });
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        if (current.current)
          void saveProject(current.current)
            .then(() => setStatus("Saved on this device"))
            .catch(() => setStatus("Save failed — export a backup"));
      }
      if (view === "pdf" && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [view, undo, redo]);
  async function arrange() {
    if (!p) return;
    setBusy(true);
    try {
      const model = api.current?.model();
      if (!model) throw new Error("Document preview is still loading.");
      const bytes = await documentPdf(model);
      const result = await readPdf(
        new File([Uint8Array.from(bytes)], `${p.title}.pdf`, {
          type: "application/pdf",
        }),
      );
      change({
        ...p,
        sources: [result.source],
        pages: result.pages,
        kind: "document",
        layout: { ...DEFAULT_LAYOUT },
      });
      setView("pdf");
      report(
        "Document pages are ready to arrange. Return to Document to keep editing.",
      );
    } catch (e) {
      report(e instanceof Error ? e.message : "Could not arrange document.");
    } finally {
      setBusy(false);
    }
  }
  async function output(format: string) {
    if (!p) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    try {
      const name = (filename.trim() || p.title).replace(
        /\.(pdf|docx|html|txt)$/i,
        "",
      );
      if (format === "backup") {
        download(serializeProject(p), name + ".tipsy.json", "application/json");
      } else if (format === "pdf") {
        let bytes: Uint8Array;
        if (view === "pdf")
          bytes = await exportLayout(
            p.sources,
            p.pages,
            p.layout,
            setProgress,
            controller.signal,
          );
        else {
          const model = api.current?.model();
          if (!model) throw new Error("Preview is still loading.");
          bytes = await documentPdf(model, controller.signal);
        }
        controller.signal.throwIfAborted();
        download(bytes, name + ".pdf", "application/pdf");
      } else if (format === "html") {
        download(
          `<!doctype html><html><head><meta charset="utf-8"><title>${p.title.replace(/</g, "&lt;")}</title></head><body>${sanitize(p.html)}</body></html>`,
          name + ".html",
          "text/html",
        );
      } else if (format === "txt") {
        download(
          api.current?.editor()?.getText() || "",
          name + ".txt",
          "text/plain",
        );
      } else if (format === "docx") {
        const {
          Document,
          Packer,
          Paragraph,
          TextRun,
          HeadingLevel,
          Table,
          TableRow,
          TableCell,
          ImageRun,
        } = await import("docx");
        const el = document.createElement("div");
        el.innerHTML = sanitize(p.html);
        const inline = (
          node: globalThis.Node,
          style: {
            bold?: boolean;
            italics?: boolean;
            underline?: Record<string, never>;
          } = {},
        ): InstanceType<typeof TextRun>[] => {
          if (node.nodeType === 3)
            return [new TextRun({ ...style, text: node.textContent || "" })];
          if (!(node instanceof HTMLElement)) return [];
          const next = {
            ...style,
            bold: style.bold || ["STRONG", "B"].includes(node.tagName),
            italics: style.italics || ["EM", "I"].includes(node.tagName),
            underline:
              style.underline ||
              (["U"].includes(node.tagName) ? {} : undefined),
          };
          return Array.from(node.childNodes).flatMap((n) => inline(n, next));
        };
        const blocks: (
          InstanceType<typeof Paragraph> | InstanceType<typeof Table>
        )[] = [];
        for (const n of Array.from(el.children)) {
          if (n.tagName === "TABLE") {
            blocks.push(
              new Table({
                rows: Array.from(n.querySelectorAll("tr")).map(
                  (row) =>
                    new TableRow({
                      children: Array.from(row.children).map(
                        (cell) =>
                          new TableCell({
                            children: [
                              new Paragraph({ children: inline(cell) }),
                            ],
                          }),
                      ),
                    }),
                ),
              }),
            );
          } else if (
            n.tagName === "IMG" &&
            n.getAttribute("src")?.startsWith("data:image/")
          ) {
            const img = n as HTMLImageElement;
            const data = Uint8Array.from(atob(img.src.split(",")[1]), (c) =>
              c.charCodeAt(0),
            );
            blocks.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data,
                    type: img.src.includes("jpeg") ? "jpg" : "png",
                    transformation: {
                      width: img.width || 240,
                      height: img.height || 180,
                    },
                  }),
                ],
              }),
            );
          } else if (n.tagName === "UL" || n.tagName === "OL") {
            for (const li of Array.from(n.children))
              blocks.push(
                new Paragraph({
                  children: inline(li),
                  bullet: n.tagName === "UL" ? { level: 0 } : undefined,
                  numbering:
                    n.tagName === "OL"
                      ? { reference: "list", level: 0 }
                      : undefined,
                }),
              );
          } else if (n.getAttribute("data-type") === "pageBreak") {
            blocks.push(new Paragraph({ pageBreakBefore: true }));
          } else
            blocks.push(
              new Paragraph({
                children: inline(n),
                heading: /^H[1-6]$/.test(n.tagName)
                  ? HeadingLevel[
                      `HEADING_${n.tagName[1]}` as keyof typeof HeadingLevel
                    ]
                  : undefined,
              }),
            );
        }
        const doc = new Document({
          numbering: {
            config: [
              {
                reference: "list",
                levels: [
                  {
                    level: 0,
                    format: "decimal",
                    text: "%1.",
                    alignment: "start",
                  },
                ],
              },
            ],
          },
          sections: [
            {
              properties: {
                page: {
                  size: {
                    width: p.doc.width * 20,
                    height: p.doc.height * 20,
                    orientation: p.doc.landscape ? "landscape" : "portrait",
                  },
                  margin: {
                    top: p.doc.margin * 20,
                    bottom: p.doc.margin * 20,
                    left: p.doc.margin * 20,
                    right: p.doc.margin * 20,
                  },
                },
              },
              children: blocks,
            },
          ],
        });
        const blob = await Packer.toBlob(doc);
        download(
          new Uint8Array(await blob.arrayBuffer()),
          name + ".docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        report(
          "DOCX exported. Common text, headings, lists, and tables are supported; review advanced formatting in your word processor.",
        );
      }
      setExportOpen(false);
      if (format !== "docx")
        report("Export created locally. Check your browser downloads.");
    } catch (e) {
      report(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!p)
    return (
      <div className="loading">
        <Loader2 className="spin" /> Opening your local studio…
      </div>
    );
  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div className="row">
          <Link className="icon-button" href="/" aria-label="Back to home">
            <ArrowLeft size={19} />
          </Link>
          <Link className="brand workspace-brand" href="/">
            <span className="brand-symbol">
              <Layers size={21} />
            </span>
            tipsy docy
          </Link>
          <span className="header-divider" />
          <input
            className="project-title"
            aria-label="Project title"
            value={p.title}
            onChange={(e) => change({ ...p, title: e.target.value })}
          />
        </div>
        <div className="row">
          <span className="save-status">
            <Check size={13} />
            {status}
          </span>
          <button
            className="icon-button"
            aria-label="Undo"
            disabled={!history.past.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            disabled={!history.future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <Theme />
          {view === "document" && (
            <button
              className="button small"
              disabled={busy}
              onClick={() => void arrange()}
            >
              Arrange pages <ArrowRight size={15} />
            </button>
          )}
          <button
            className="button primary small"
            disabled={busy || view === "tools"}
            onClick={() => {
              setFilename(p.title);
              setExportOpen(true);
            }}
          >
            <Download size={15} /> Export
          </button>
        </div>
      </header>
      <div
        className="workspace-tabs"
        role="navigation"
        aria-label="Studio navigation"
      >
        <button
          className={view === "pdf" ? "active" : ""}
          onClick={() => setView("pdf")}
        >
          <Grid2X2 size={16} /> PDF Studio
        </button>
        <button
          className={view === "document" ? "active" : ""}
          onClick={() => setView("document")}
        >
          <FileText size={16} /> Document Studio
        </button>
        <button
          className={view === "tools" ? "active" : ""}
          onClick={() => setView("tools")}
        >
          <WandSparkles size={16} /> Quick Tools
        </button>
        <span>
          <span className="status-dot" /> 100% local. Always yours.
        </span>
      </div>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {view === "pdf" ? (
        <PdfStudio project={p} change={change} report={report} />
      ) : view === "document" ? (
        <DocumentStudio
          project={p}
          change={change}
          report={report}
          apiRef={api}
        />
      ) : (
        <main className="quick-tools" id="main-content">
          <div className="eyebrow">THE EVERYDAY, MADE EASIER</div>
          <h1>Small tasks. Sorted.</h1>
          <p>
            Pick a tool. Bring your files. We’ll keep everything on your device.
          </p>
          <div className="quick-grid">
            {tools.map((t, i) => (
              <button
                className="studio-card"
                key={t.name}
                onClick={() => {
                  setView(t.mode);
                  if (t.mode === "pdf" && i !== 7)
                    change({
                      ...p,
                      layout: {
                        ...p.layout,
                        rows: 1,
                        cols: 1,
                        margin: 0,
                        gapX: 0,
                        gapY: 0,
                      },
                    });
                  report(
                    t.name === "Split PDFs"
                      ? "Add PDFs, then choose Split under each source file."
                      : t.name === "Extract pages"
                        ? "Add a PDF, enter a page range, and export the selected pages."
                        : t.name === "Merge PDFs"
                          ? "Add multiple PDFs. Reorder files or pages, then export."
                          : `${t.name}: use the studio controls, then export.`,
                  );
                }}
              >
                <span className="card-icon green">
                  <WandSparkles />
                </span>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <span className="card-link">
                  Open tool <ArrowRight size={15} />
                </span>
              </button>
            ))}
          </div>
        </main>
      )}
      {exportOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setExportOpen(false)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setExportOpen(false);
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input,select,a[href]",
                );
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="row between">
              <h2 id="export-title">Make it official.</h2>
              <button
                disabled={busy}
                className="icon-button"
                aria-label="Close export"
                onClick={() => setExportOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p>Your export is created right here on your device.</p>
            <label className="field">
              Filename
              <input
                autoFocus
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() => void output("pdf")}
            >
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <Download size={17} />
              )}{" "}
              Download PDF{" "}
              {busy && progress > 0 ? `${Math.round(progress * 100)}%` : ""}
            </button>
            {busy && (
              <button
                className="button full"
                onClick={() => {
                  abortRef.current?.abort(new Error("Export cancelled."));
                }}
              >
                Cancel export
              </button>
            )}
            {view === "document" && (
              <>
                <div className="export-options">
                  {["docx", "html", "txt"].map((f) => (
                    <button
                      className="button"
                      disabled={busy}
                      key={f}
                      onClick={() => void output(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  disabled={busy}
                  className="button full"
                  onClick={() => {
                    setExportOpen(false);
                    api.current?.print();
                  }}
                >
                  Browser print / Save as PDF…
                </button>
                <p className="tiny muted">
                  Direct PDF uses searchable standard-font text. Browser print
                  opens your system dialogue and supports native multilingual
                  typography. DOCX export preserves common formatting.
                </p>
              </>
            )}
            <button
              disabled={busy}
              className="text-button full"
              onClick={() => void output("backup")}
            >
              Export editable project backup
            </button>
            <p className="tiny muted">
              Local storage is not a permanent backup. Keep an editable copy
              somewhere you control.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
