"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Upload,
  RotateCw,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Maximize,
  Move,
  CheckSquare,
} from "lucide-react";
import type { Project, Layout, Placement } from "@/lib/model";
import { SIZES, parseRange } from "@/lib/model";
import { calculateLayout } from "@/lib/layout";
import { readPdf, splitPdf, download } from "@/lib/pdf";
import PdfThumbnail, { releasePdfs } from "./pdf-thumbnail";
type Props = {
  project: Project;
  change: (p: Project) => void;
  report: (s: string) => void;
};
export default function PdfStudio({ project: p, change, report }: Props) {
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(0.7),
    [guides, setGuides] = useState(true),
    [unit, setUnit] = useState("mm"),
    [range, setRange] = useState(""),
    [busy, setBusy] = useState(false),
    [pan, setPan] = useState(false);
  const [sourceWindow, setSourceWindow] = useState(0);
  const sourceWindowSize = 40;
  const windowCount = Math.max(1, Math.ceil(p.pages.length / sourceWindowSize));
  const currentWindow = Math.min(sourceWindow, windowCount - 1);
  const input = useRef<HTMLInputElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [moving, setMoving] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);
  const previousSources = useRef<string[]>([]);
  useEffect(() => {
    const ids = p.sources.map((s) => s.id);
    releasePdfs(previousSources.current.filter((id) => !ids.includes(id)));
    previousSources.current = ids;
  }, [p.sources]);
  const factor = unit === "mm" ? 72 / 25.4 : unit === "in" ? 72 : 1;
  const num = (n: number) => Math.round((n / factor) * 100) / 100;
  const layout = (patch: Partial<Layout>) =>
    change({ ...p, layout: { ...p.layout, ...patch } });
  const pages = (a: Placement[]) => change({ ...p, pages: a });
  const update = (id: string, patch: Partial<Placement>) =>
    pages(p.pages.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const model = useMemo(() => {
    try {
      return { data: calculateLayout(p.pages, p.layout), error: "" };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e.message : "Invalid layout",
      };
    }
  }, [p.pages, p.layout]);
  async function upload(files: FileList | File[]) {
    setBusy(true);
    try {
      const nextSources = [...p.sources],
        nextPages = [...p.pages];
      for (const f of Array.from(files)) {
        report(`Opening ${f.name}…`);
        const result = await readPdf(f);
        nextSources.push(result.source);
        nextPages.push(...result.pages);
      }
      change({ ...p, sources: nextSources, pages: nextPages });
      report("PDF files added.");
    } catch (e) {
      report(e instanceof Error ? e.message : "Could not open PDF.");
    } finally {
      setBusy(false);
    }
  }
  function reorder(id: string, delta: number) {
    const a = [...p.pages],
      i = a.findIndex((v) => v.id === id),
      j = i + delta;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    pages(a);
  }
  const active = p.pages.find((a) => a.id === selected);
  return (
    <div
      className="pdf-workspace"
      role="main"
      id="main-content"
      aria-label="PDF Studio"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }
      }}
    >
      <h1 className="sr-only">PDF Studio</h1>
      <aside className="source-sidebar">
        <div className="panel-heading">
          <h2>Source pages</h2>
          <span className="badge">{p.pages.length}</span>
        </div>
        <button
          disabled={busy}
          className="button primary full"
          onClick={() => input.current?.click()}
        >
          <Plus size={16} /> Add PDFs
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="muted tiny">Drop PDFs anywhere in this workspace.</p>
        {p.sources.map((s, i) => (
          <div className="source-file" key={s.id}>
            <strong title={s.name}>{s.name}</strong>
            <span>{s.count} pages</span>
            <div className="row">
              <button
                className="icon-button"
                aria-label={`Move file ${s.name} up`}
                disabled={!i}
                onClick={() => {
                  const a = [...p.sources];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  change({
                    ...p,
                    sources: a,
                    pages: a.flatMap((src) =>
                      p.pages.filter((pg) => pg.sourceId === src.id),
                    ),
                  });
                }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-button"
                aria-label={`Remove file ${s.name}`}
                onClick={() =>
                  change({
                    ...p,
                    sources: p.sources.filter((src) => src.id !== s.id),
                    pages: p.pages.filter((pg) => pg.sourceId !== s.id),
                  })
                }
              >
                <Trash2 size={13} />
              </button>
              <button
                className="text-button tiny"
                onClick={async () => {
                  try {
                    const outputs = await splitPdf(s);
                    for (let n = 0; n < outputs.length; n++)
                      download(
                        outputs[n],
                        `${s.name.replace(/\.pdf$/i, "")}-${n + 1}.pdf`,
                        "application/pdf",
                      );
                    report(
                      `${outputs.length} individual PDFs created. Your browser may ask to allow multiple downloads.`,
                    );
                  } catch (e) {
                    report(String(e));
                  }
                }}
              >
                Split
              </button>
            </div>
          </div>
        ))}
        {p.pages.length > 0 && (
          <>
            <label className="field">
              Select page ranges
              <div className="row">
                <input
                  value={range}
                  placeholder="1-3, 5"
                  onChange={(e) => setRange(e.target.value)}
                />
                <button
                  className="icon-button"
                  aria-label="Apply page selection"
                  onClick={() => {
                    try {
                      const indexes = parseRange(range, p.pages.length);
                      pages(
                        p.pages.map((pg, i) => ({
                          ...pg,
                          selected: indexes.includes(i),
                        })),
                      );
                    } catch (e) {
                      report(String(e));
                    }
                  }}
                >
                  <CheckSquare size={17} />
                </button>
              </div>
            </label>
            <div className="row">
              <button
                className="text-button tiny"
                onClick={() =>
                  pages(p.pages.map((pg) => ({ ...pg, selected: true })))
                }
              >
                Select all
              </button>
              <button
                className="text-button tiny"
                onClick={() => pages(p.pages.filter((pg) => pg.selected))}
              >
                Delete unselected
              </button>
            </div>
          </>
        )}
        {windowCount > 1 && (
          <nav
            aria-label="Source page navigation"
            className="source-navigation"
          >
            <div className="row between">
              <button
                className="text-button tiny"
                disabled={currentWindow === 0}
                onClick={() => setSourceWindow(currentWindow - 1)}
              >
                Previous pages
              </button>
              <button
                className="text-button tiny"
                disabled={currentWindow === windowCount - 1}
                onClick={() => setSourceWindow(currentWindow + 1)}
              >
                Next pages
              </button>
            </div>
            <p className="tiny" role="status">
              Showing {currentWindow * sourceWindowSize + 1}–
              {Math.min((currentWindow + 1) * sourceWindowSize, p.pages.length)}{" "}
              of {p.pages.length}
            </p>
            <label className="field">
              Jump to source page
              <input
                type="number"
                min={1}
                max={p.pages.length}
                defaultValue={currentWindow * sourceWindowSize + 1}
                key={currentWindow}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= p.pages.length)
                    setSourceWindow(Math.floor((n - 1) / sourceWindowSize));
                }}
              />
            </label>
          </nav>
        )}
        <div className="source-pages">
          {p.pages
            .slice(
              currentWindow * sourceWindowSize,
              (currentWindow + 1) * sourceWindowSize,
            )
            .map((pg, index) => {
              const i = currentWindow * sourceWindowSize + index;
              const source = p.sources.find((s) => s.id === pg.sourceId);
              return (
                source && (
                  <div
                    key={pg.id}
                    className={`source-page ${selected === pg.id ? "active" : ""}`}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/page-id", pg.id)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData("text/page-id");
                      if (!id) return;
                      e.preventDefault();
                      const a = [...p.pages],
                        from = a.findIndex((v) => v.id === id);
                      if (from < 0 || from === i) return;
                      a.splice(i, 0, a.splice(from, 1)[0]);
                      pages(a);
                    }}
                  >
                    <button
                      className="source-preview"
                      aria-label={`Select page ${i + 1}`}
                      onClick={() => setSelected(pg.id)}
                    >
                      <PdfThumbnail
                        source={source}
                        page={pg.page}
                        rotation={pg.rotation}
                      />
                    </button>
                    <div className="row between">
                      <label className="row">
                        <input
                          type="checkbox"
                          aria-label={`Include page ${i + 1}`}
                          checked={pg.selected}
                          onChange={(e) =>
                            update(pg.id, { selected: e.target.checked })
                          }
                        />
                        <span className="tiny">Page {i + 1}</span>
                      </label>
                      <div className="row compact">
                        <button
                          className="icon-button"
                          aria-label={`Rotate page ${i + 1}`}
                          onClick={() =>
                            update(pg.id, {
                              rotation: (pg.rotation + 90) % 360,
                            })
                          }
                        >
                          <RotateCw size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Duplicate page ${i + 1}`}
                          onClick={() => {
                            const a = [...p.pages];
                            a.splice(i + 1, 0, {
                              ...pg,
                              id: crypto.randomUUID(),
                            });
                            pages(a);
                          }}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete page ${i + 1}`}
                          onClick={() =>
                            pages(p.pages.filter((v) => v.id !== pg.id))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="text-button tiny"
                        disabled={i === 0}
                        onClick={() => reorder(pg.id, -1)}
                      >
                        ↑ Up
                      </button>
                      <button
                        className="text-button tiny"
                        disabled={i === p.pages.length - 1}
                        onClick={() => reorder(pg.id, 1)}
                      >
                        ↓ Down
                      </button>
                    </div>
                  </div>
                )
              );
            })}
        </div>
      </aside>
      <section className="canvas-area">
        <div className="canvas-topbar">
          <span>
            Layout preview{" "}
            <span className="muted">
              / {model.data?.sheets.length ?? 0} sheets
            </span>
          </span>
          <div className="row">
            <label className="row tiny">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />{" "}
              Guides
            </label>
            <button
              className={`icon-button ${pan ? "active" : ""}`}
              aria-label="Pan canvas"
              onClick={() => setPan(!pan)}
            >
              <Move size={17} />
            </button>
          </div>
        </div>
        <div
          className={`canvas-scroll ${pan ? "pan-mode" : ""}`}
          ref={viewport}
          onPointerDown={(e) => {
            if (!pan || !viewport.current) return;
            const el = viewport.current,
              x = e.clientX,
              y = e.clientY,
              left = el.scrollLeft,
              top = el.scrollTop;
            e.currentTarget.setPointerCapture(e.pointerId);
            const move = (ev: PointerEvent) => {
              el.scrollLeft = left - (ev.clientX - x);
              el.scrollTop = top - (ev.clientY - y);
            };
            const up = () => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerup", up);
            };
            el.addEventListener("pointermove", move);
            el.addEventListener("pointerup", up);
          }}
        >
          {!p.pages.length ? (
            <div className="canvas-empty">
              <span className="large-icon lavender">
                <Upload size={34} />
              </span>
              <h2>A little order for your pages.</h2>
              <p>
                Drop your PDFs here to start arranging.
                <br />
                Your files never leave this browser.
              </p>
              <button
                className="button primary"
                onClick={() => input.current?.click()}
              >
                Choose PDF files <Plus size={16} />
              </button>
              <span className="tiny muted">
                Multiple files welcome. Possibilities included.
              </span>
            </div>
          ) : model.error ? (
            <p className="error" role="alert">
              {model.error}
            </p>
          ) : (
            model.data?.sheets.map((sheet, i) => (
              <div
                className="sheet-container"
                key={i}
                style={{ width: model.data!.width * zoom }}
              >
                <span className="sheet-label">
                  SHEET {i + 1} <span>{sheet.length} pages</span>
                </span>
                <div
                  className="pdf-sheet"
                  data-testid="output-sheet"
                  style={{
                    width: model.data!.width * zoom,
                    height: model.data!.height * zoom,
                    background: p.layout.background,
                  }}
                >
                  {guides && (
                    <div
                      className="margin-guide"
                      style={{ inset: p.layout.margin * zoom }}
                    />
                  )}
                  {sheet.map((b) => {
                    const source = p.sources.find(
                      (s) => s.id === b.page.sourceId,
                    )!;
                    const offset = moving?.id === b.page.id ? moving : null;
                    return (
                      <div
                        className={`page-cell ${guides ? "guided" : ""}`}
                        key={b.page.id}
                        style={{
                          left: b.cellX * zoom,
                          top: b.cellY * zoom,
                          width: b.cellWidth * zoom,
                          height: b.cellHeight * zoom,
                          border: p.layout.borders
                            ? "1px solid #999"
                            : undefined,
                        }}
                      >
                        <div
                          tabIndex={0}
                          role="button"
                          aria-label={`Move page ${p.pages.findIndex((pg) => pg.id === b.page.id) + 1}`}
                          className={`placed-page ${selected === b.page.id ? "selected" : ""}`}
                          style={{
                            left:
                              (b.x -
                                b.cellX +
                                (offset ? offset.dx - b.page.dx : 0)) *
                              zoom,
                            top:
                              (b.y -
                                b.cellY +
                                (offset ? offset.dy - b.page.dy : 0)) *
                              zoom,
                            width: b.width * zoom,
                            height: b.height * zoom,
                            touchAction: pan ? "auto" : "none",
                          }}
                          onClick={() => setSelected(b.page.id)}
                          onKeyDown={(e) => {
                            const delta = e.shiftKey ? 10 : 1;
                            const d: Record<string, [number, number]> = {
                              ArrowLeft: [-delta, 0],
                              ArrowRight: [delta, 0],
                              ArrowUp: [0, -delta],
                              ArrowDown: [0, delta],
                            };
                            if (d[e.key]) {
                              e.preventDefault();
                              update(b.page.id, {
                                dx: b.page.dx + d[e.key][0],
                                dy: b.page.dy + d[e.key][1],
                              });
                            }
                          }}
                          onPointerDown={(e) => {
                            if (pan) return;
                            e.stopPropagation();
                            setSelected(b.page.id);
                            drag.current = {
                              id: b.page.id,
                              x: e.clientX,
                              y: e.clientY,
                              dx: b.page.dx,
                              dy: b.page.dy,
                            };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            const d = drag.current;
                            if (d?.id === b.page.id)
                              setMoving({
                                id: d.id,
                                dx: d.dx + (e.clientX - d.x) / zoom,
                                dy: d.dy + (e.clientY - d.y) / zoom,
                              });
                          }}
                          onPointerUp={(e) => {
                            const d = drag.current;
                            if (d?.id === b.page.id) {
                              const dx = d.dx + (e.clientX - d.x) / zoom,
                                dy = d.dy + (e.clientY - d.y) / zoom;
                              drag.current = null;
                              setMoving(null);
                              if (
                                Math.abs(dx - d.dx) + Math.abs(dy - d.dy) >
                                0.1
                              )
                                update(d.id, { dx, dy });
                            }
                          }}
                        >
                          <PdfThumbnail
                            source={source}
                            page={b.page.page}
                            rotation={b.page.rotation}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="canvas-bottom">
          <span>
            {p.pages.filter((pg) => pg.selected).length} selected pages · Drag
            to position · Arrow keys to nudge
          </span>
          <div className="row">
            <button
              className="icon-button"
              aria-label="Zoom out"
              onClick={() => setZoom(Math.max(0.15, zoom - 0.1))}
            >
              <Minus size={15} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              aria-label="Zoom in"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            >
              <Plus size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="Fit sheets to viewport"
              onClick={() => {
                if (viewport.current && model.data)
                  setZoom(
                    Math.min(
                      (viewport.current.clientWidth - 64) / model.data.width,
                      (viewport.current.clientHeight - 72) / model.data.height,
                    ),
                  );
              }}
            >
              <Maximize size={15} />
            </button>
          </div>
        </div>
      </section>
      <aside className="properties">
        <div className="panel-heading">
          <h2>Make it fit</h2>
          <span className="tiny muted">LAYOUT</span>
        </div>
        <fieldset>
          <legend>Pages per sheet</legend>
          <div className="preset-grid">
            {[
              [1, 1],
              [1, 2],
              [2, 1],
              [2, 2],
              [3, 3],
              [4, 4],
              [6, 6],
              [8, 8],
            ].map(([rows, cols]) => (
              <button
                key={`${rows}-${cols}`}
                className={
                  p.layout.rows === rows && p.layout.cols === cols
                    ? "active"
                    : ""
                }
                onClick={() => layout({ rows, cols })}
              >
                {rows} × {cols}
              </button>
            ))}
          </div>
          <div className="two-fields">
            <label className="field">
              Rows
              <input
                aria-label="Rows"
                type="number"
                min={1}
                max={16}
                value={p.layout.rows}
                onChange={(e) =>
                  layout({ rows: Math.max(1, Math.min(16, +e.target.value)) })
                }
              />
            </label>
            <label className="field">
              Columns
              <input
                aria-label="Columns"
                type="number"
                min={1}
                max={16}
                value={p.layout.cols}
                onChange={(e) =>
                  layout({ cols: Math.max(1, Math.min(16, +e.target.value)) })
                }
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Output sheet</legend>
          <label className="field">
            Paper size
            <select
              value={p.layout.size}
              onChange={(e) => {
                const s = SIZES[e.target.value];
                layout({
                  size: e.target.value,
                  ...(s ? { width: s[0], height: s[1] } : {}),
                });
              }}
            >
              {Object.keys(SIZES).map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option>Custom</option>
            </select>
          </label>
          <label className="field">
            Orientation
            <select
              value={String(p.layout.landscape)}
              onChange={(e) => layout({ landscape: e.target.value === "true" })}
            >
              <option value="false">Portrait</option>
              <option value="true">Landscape</option>
            </select>
          </label>
          <label className="field">
            Units
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="mm">Millimeters</option>
              <option value="in">Inches</option>
              <option value="pt">Points</option>
            </select>
          </label>
          {p.layout.size === "Custom" && (
            <div className="two-fields">
              {(["width", "height"] as const).map((k) => (
                <label key={k} className="field">
                  {k} ({unit})
                  <input
                    type="number"
                    min={num(72)}
                    value={num(p.layout[k])}
                    onChange={(e) =>
                      layout({ [k]: Math.max(72, +e.target.value * factor) })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {(["margin", "gapX", "gapY"] as const).map((k) => (
            <label className="field" key={k}>
              {k === "margin"
                ? "Outer margin"
                : k === "gapX"
                  ? "Horizontal gap"
                  : "Vertical gap"}{" "}
              ({unit})
              <input
                aria-label={
                  k === "margin"
                    ? "Outer margin"
                    : k === "gapX"
                      ? "Horizontal gap"
                      : "Vertical gap"
                }
                type="number"
                min={0}
                step={0.5}
                value={num(p.layout[k])}
                onChange={(e) =>
                  layout({ [k]: Math.max(0, +e.target.value * factor) })
                }
              />
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Page behavior</legend>
          <label className="field">
            Fill order
            <select
              value={p.layout.order}
              onChange={(e) =>
                layout({ order: e.target.value as Layout["order"] })
              }
            >
              <option value="horizontal">Across, then down</option>
              <option value="vertical">Down, then across</option>
            </select>
          </label>
          <label className="field">
            Content fit
            <select
              value={p.layout.fit}
              onChange={(e) => layout({ fit: e.target.value as Layout["fit"] })}
            >
              <option value="fit">Fit entire page</option>
              <option value="fill">Fill cell (crop overflow)</option>
            </select>
          </label>
          <label className="field">
            Alignment
            <select
              value={p.layout.align}
              onChange={(e) =>
                layout({ align: e.target.value as Layout["align"] })
              }
            >
              <option value="center">Center</option>
              <option value="start">Top left</option>
              <option value="end">Bottom right</option>
            </select>
          </label>
          <label className="field color-field">
            Background
            <input
              type="color"
              value={p.layout.background}
              onChange={(e) => layout({ background: e.target.value })}
            />
          </label>
          <label className="row tiny">
            <input
              type="checkbox"
              checked={p.layout.borders}
              onChange={(e) => layout({ borders: e.target.checked })}
            />{" "}
            Page borders
          </label>
        </fieldset>
        {active && (
          <fieldset>
            <legend>Selected page</legend>
            {(["scale", "dx", "dy"] as const).map((k) => (
              <label className="field" key={k}>
                {k === "scale"
                  ? "Scale (%)"
                  : k === "dx"
                    ? `Horizontal offset (${unit})`
                    : `Vertical offset (${unit})`}
                <input
                  aria-label={
                    k === "scale"
                      ? "Page scale"
                      : k === "dx"
                        ? "Horizontal offset"
                        : "Vertical offset"
                  }
                  type="number"
                  step={k === "scale" ? 5 : 0.5}
                  min={k === "scale" ? 5 : undefined}
                  value={
                    k === "scale" ? Math.round(active[k] * 100) : num(active[k])
                  }
                  onChange={(e) =>
                    update(active.id, {
                      [k]:
                        k === "scale"
                          ? Math.max(0.05, +e.target.value / 100)
                          : +e.target.value * factor,
                    })
                  }
                />
              </label>
            ))}
            <button
              className="button full"
              onClick={() =>
                update(active.id, { dx: 0, dy: 0, scale: 1, rotation: 0 })
              }
            >
              Reset page position
            </button>
            <div className="row">
              <button
                className="text-button"
                onClick={() => reorder(active.id, -1)}
              >
                <ArrowUp size={14} /> Earlier
              </button>
              <button
                className="text-button"
                onClick={() => reorder(active.id, 1)}
              >
                <ArrowDown size={14} /> Later
              </button>
            </div>
          </fieldset>
        )}
      </aside>
    </div>
  );
}
