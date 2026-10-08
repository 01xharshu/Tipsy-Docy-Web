import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { calculateLayout } from "../lib/layout";
import { exportLayout } from "../lib/pdf";
import { DEFAULT_LAYOUT, parseRange, type Placement } from "../lib/model";
const pages = (n: number): Placement[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    sourceId: "test",
    page: i,
    width: 300,
    height: 400,
    rotation: 0,
    scale: 1,
    dx: 0,
    dy: 0,
    selected: true,
  }));
describe("shared layout engine", () => {
  it("creates an incomplete second sheet for five pages at 2x2", () => {
    const m = calculateLayout(pages(5), DEFAULT_LAYOUT);
    expect(m.sheets.map((s) => s.length)).toEqual([4, 1]);
  });
  it("uses exact point offsets and keeps scale consistent", () => {
    const p = pages(1);
    const a = calculateLayout(p, DEFAULT_LAYOUT).sheets[0][0];
    p[0].dx = (5 * 72) / 25.4;
    p[0].dy = -8;
    const b = calculateLayout(p, DEFAULT_LAYOUT).sheets[0][0];
    expect(b.x - a.x).toBeCloseTo(14.173228);
    expect(b.y - a.y).toBe(-8);
    expect(b.width).toBe(a.width);
  });
  it("fills vertically and ignores deselected pages", () => {
    const p = pages(5);
    p[0].selected = false;
    const m = calculateLayout(p, { ...DEFAULT_LAYOUT, order: "vertical" });
    expect(m.sheets).toHaveLength(1);
    expect(m.sheets[0][1].cellX).toBe(m.sheets[0][0].cellX);
    expect(m.sheets[0][1].cellY).toBeGreaterThan(m.sheets[0][0].cellY);
  });
  it("rejects impossible spacing and invalid grids", () => {
    expect(() =>
      calculateLayout(pages(1), { ...DEFAULT_LAYOUT, margin: 500 }),
    ).toThrow();
    expect(() =>
      calculateLayout(pages(1), { ...DEFAULT_LAYOUT, rows: 0 }),
    ).toThrow();
  });
  it("supports rotation, fill, custom sheets and alignment", () => {
    const p = pages(1);
    p[0].rotation = 90;
    const fit = calculateLayout(p, {
      ...DEFAULT_LAYOUT,
      size: "Custom",
      width: 600,
      height: 900,
      landscape: true,
      rows: 1,
      cols: 1,
      align: "start",
    });
    expect(fit.width).toBe(900);
    expect(fit.sheets[0][0].x).toBe(DEFAULT_LAYOUT.margin);
    expect(fit.sheets[0][0].width / fit.sheets[0][0].height).toBeCloseTo(
      400 / 300,
    );
    const fill = calculateLayout(p, { ...DEFAULT_LAYOUT, fit: "fill" });
    expect(fill.sheets[0][0].width).toBeGreaterThanOrEqual(
      fill.sheets[0][0].cellWidth,
    );
  });
  it("validates ranges, deduplicates, and accepts blank as all", () => {
    expect(parseRange("1-3, 5, 2", 5)).toEqual([0, 1, 2, 4]);
    expect(parseRange("", 2)).toEqual([0, 1]);
    expect(() => parseRange("0, 9", 5)).toThrow();
    expect(() => parseRange("3-1", 5)).toThrow();
    expect(() => parseRange("a", 5)).toThrow();
  });
  it("exports valid vector PDFs with expected page count/dimensions", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 5; i++) {
      const page = src.addPage([300, 400]);
      page.drawText(`Source page ${i + 1}`, { x: 20, y: 350, font });
    }
    const bytes = await src.save();
    const p = pages(5);
    p[0].dx = 10;
    p[2].rotation = 90;
    const exported = await exportLayout(
      [{ id: "test", name: "test.pdf", bytes, count: 5 }],
      p,
      DEFAULT_LAYOUT,
    );
    const reopened = await PDFDocument.load(exported);
    expect(reopened.getPageCount()).toBe(2);
    expect(reopened.getPage(0).getWidth()).toBeCloseTo(DEFAULT_LAYOUT.width);
    expect(reopened.getPage(0).getHeight()).toBeCloseTo(DEFAULT_LAYOUT.height);
    expect(reopened.getPage(0).node.Resources()?.lookupMaybe).toBeDefined();
  });
  it("rejects empty exports and malformed sources", async () => {
    await expect(exportLayout([], [], DEFAULT_LAYOUT)).rejects.toThrow(
      "Select",
    );
    await expect(
      exportLayout(
        [
          {
            id: "test",
            name: "bad.pdf",
            bytes: new Uint8Array([1, 2]),
            count: 1,
          },
        ],
        pages(1),
        DEFAULT_LAYOUT,
      ),
    ).rejects.toThrow();
  });
});

describe("export geometry", () => {
  it("reopens with PDF.js and confirms moved text coordinates match the shared preview model", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    src
      .addPage([300, 400])
      .drawText("Geometry proof", { x: 20, y: 350, size: 18, font });
    const bytes = await src.save();
    const p = pages(1);
    p[0].dx = (5 * 72) / 25.4;
    p[0].dy = 9;
    const b = calculateLayout(p, DEFAULT_LAYOUT).sheets[0][0];
    const output = await exportLayout(
      [{ id: "test", name: "geometry.pdf", bytes, count: 1 }],
      p,
      DEFAULT_LAYOUT,
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: output,
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;
    const text = await (await doc.getPage(1)).getTextContent();
    const item = text.items.find(
      (i) => "str" in i && i.str === "Geometry proof",
    );
    expect(item && "transform" in item).toBeTruthy();
    if (item && "transform" in item) {
      expect(item.transform[4]).toBeCloseTo(b.x + (20 * b.width) / 300, 3);
      expect(item.transform[5]).toBeCloseTo(
        DEFAULT_LAYOUT.height - b.y - b.height + (350 * b.height) / 400,
        3,
      );
    }
    await doc.destroy();
  });
  it("applies clockwise rotations consistently with PDF.js preview orientation", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    src
      .addPage([300, 400])
      .drawText("Turn me", { x: 20, y: 350, size: 18, font });
    const p = pages(1);
    p[0].rotation = 90;
    const layout = { ...DEFAULT_LAYOUT, rows: 1, cols: 1 };
    const box = calculateLayout(p, layout).sheets[0][0];
    const output = await exportLayout(
      [{ id: "test", name: "rotate.pdf", bytes: await src.save(), count: 1 }],
      p,
      layout,
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: output, useSystemFonts: true })
      .promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const t = content.items.find((i) => "str" in i && i.str === "Turn me");
    if (!t || !("transform" in t)) throw new Error("Missing text");
    const scale = box.width / 400;
    expect(t.transform[4]).toBeCloseTo(box.x + 350 * scale, 3);
    expect(t.transform[5]).toBeCloseTo(
      DEFAULT_LAYOUT.height - box.y - 20 * scale,
      3,
    );
    await doc.destroy();
  });
});

it("uses the visible CropBox for source metadata and exported content", async () => {
  const src = await PDFDocument.create();
  const font = await src.embedFont(StandardFonts.Helvetica);
  const original = src.addPage([600, 800]);
  original.setCropBox(50, 70, 300, 400);
  original.drawText("Cropped page", { x: 70, y: 420, size: 18, font });
  const { readPdf } = await import("../lib/pdf");
  const imported = await readPdf(
    new File([Uint8Array.from(await src.save())], "crop.pdf", {
      type: "application/pdf",
    }),
  );
  expect(imported.pages[0].width).toBe(300);
  expect(imported.pages[0].height).toBe(400);
  const box = calculateLayout(imported.pages, DEFAULT_LAYOUT).sheets[0][0];
  const output = await exportLayout(
    [imported.source],
    imported.pages,
    DEFAULT_LAYOUT,
  );
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: output, useSystemFonts: true })
    .promise;
  const content = await (await pdf.getPage(1)).getTextContent();
  const t = content.items.find((i) => "str" in i && i.str === "Cropped page");
  if (!t || !("transform" in t)) throw new Error("Missing cropped text");
  expect(t.transform[4]).toBeCloseTo(box.x + (20 * box.width) / 300, 3);
  expect(t.transform[5]).toBeCloseTo(
    DEFAULT_LAYOUT.height - box.y - box.height + (350 * box.height) / 400,
    3,
  );
  await pdf.destroy();
});
it("honors export cancellation", async () => {
  const controller = new AbortController();
  controller.abort(new Error("Export cancelled"));
  const src = await PDFDocument.create();
  src.addPage([300, 400]);
  await expect(
    exportLayout(
      [{ id: "test", name: "cancel.pdf", bytes: await src.save(), count: 1 }],
      pages(1),
      DEFAULT_LAYOUT,
      undefined,
      controller.signal,
    ),
  ).rejects.toThrow("Export cancelled");
});
it("splits source pages into independently reopenable PDFs", async () => {
  const src = await PDFDocument.create();
  for (let i = 0; i < 3; i++) src.addPage([300 + i * 10, 400]);
  const { splitPdf } = await import("../lib/pdf");
  const outputs = await splitPdf({
    id: "test",
    name: "split.pdf",
    bytes: await src.save(),
    count: 3,
  });
  expect(outputs).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    const part = await PDFDocument.load(outputs[i]);
    expect(part.getPageCount()).toBe(1);
    expect(part.getPage(0).getWidth()).toBe(300 + i * 10);
  }
});
it("exports a truly blank PDF source without missing-content failures", async () => {
  const src = await PDFDocument.create();
  src.addPage([300, 400]);
  const bytes = await exportLayout(
    [{ id: "test", name: "blank.pdf", bytes: await src.save(), count: 1 }],
    pages(1),
    { ...DEFAULT_LAYOUT, background: "#d9e1cc" },
  );
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});
