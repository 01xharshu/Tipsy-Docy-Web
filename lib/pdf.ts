import {
  PDFDocument,
  type PDFPage,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from "pdf-lib";
import { calculateLayout } from "./layout";
import type { Layout, Placement, Source } from "./model";
function cropBounds(page: PDFPage) {
  const media = page.getMediaBox(),
    crop = page.getCropBox();
  const left = Math.max(media.x, crop.x),
    bottom = Math.max(media.y, crop.y),
    right = Math.min(media.x + media.width, crop.x + crop.width),
    top = Math.min(media.y + media.height, crop.y + crop.height);
  return right > left && top > bottom
    ? { left, bottom, right, top }
    : {
        left: media.x,
        bottom: media.y,
        right: media.x + media.width,
        top: media.y + media.height,
      };
}
export async function readPdf(
  file: File,
): Promise<{ source: Source; pages: Placement[] }> {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Choose a PDF file.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  if (pdf.getPageCount() === 0) throw new Error("PDF contains no pages.");
  const id = crypto.randomUUID();
  return {
    source: { id, name: file.name, bytes, count: pdf.getPageCount() },
    pages: pdf.getPages().map((p, i) => ({
      id: crypto.randomUUID(),
      sourceId: id,
      page: i,
      width: cropBounds(p).right - cropBounds(p).left,
      height: cropBounds(p).top - cropBounds(p).bottom,
      rotation: p.getRotation().angle,
      scale: 1,
      dx: 0,
      dy: 0,
      selected: true,
    })),
  };
}
function color(hex: string) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}
export async function exportLayout(
  sources: Source[],
  pages: Placement[],
  layout: Layout,
  onProgress?: (value: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const model = calculateLayout(pages, layout);
  if (!model.sheets.length)
    throw new Error("Select at least one page to export.");
  const out = await PDFDocument.create();
  const docs = new Map<string, PDFDocument>();
  for (const s of sources) docs.set(s.id, await PDFDocument.load(s.bytes));
  let done = 0;
  const total = pages.filter((p) => p.selected).length;
  for (const sheet of model.sheets) {
    signal?.throwIfAborted();
    const target = out.addPage([model.width, model.height]);
    target.drawRectangle({
      x: 0,
      y: 0,
      width: model.width,
      height: model.height,
      color: color(layout.background),
    });
    for (const b of sheet) {
      signal?.throwIfAborted();
      if (done % 8 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const src = docs.get(b.page.sourceId);
      if (!src) throw new Error("Missing source PDF.");
      const original = src.getPage(b.page.page);
      if (!original.node.Contents())
        original.drawRectangle({ x: 0, y: 0, width: 0, height: 0, opacity: 0 });
      const embedded = await out.embedPage(original, cropBounds(original));
      const rot = ((b.page.rotation % 360) + 360) % 360;
      const quarter = rot === 90 || rot === 270;
      const w = quarter ? b.height : b.width,
        h = quarter ? b.width : b.height;
      let x = b.x,
        y = model.height - b.y - b.height;
      if (rot === 90) y += b.height;
      if (rot === 180) {
        x += b.width;
        y += b.height;
      }
      if (rot === 270) x += b.width;
      target.pushOperators(
        pushGraphicsState(),
        rectangle(
          b.cellX,
          model.height - b.cellY - b.cellHeight,
          b.cellWidth,
          b.cellHeight,
        ),
        clip(),
        endPath(),
      );
      target.drawPage(embedded, {
        x,
        y,
        width: w,
        height: h,
        rotate: degrees(-rot),
      });
      target.pushOperators(popGraphicsState());
      if (layout.borders)
        target.drawRectangle({
          x: b.cellX,
          y: model.height - b.cellY - b.cellHeight,
          width: b.cellWidth,
          height: b.cellHeight,
          borderWidth: 0.5,
          borderColor: rgb(0.55, 0.55, 0.55),
        });
      onProgress?.(++done / total);
    }
  }
  return out.save();
}
export async function splitPdf(source: Source): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(source.bytes);
  const outputs: Uint8Array[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const out = await PDFDocument.create();
    out.addPage((await out.copyPages(src, [i]))[0]);
    outputs.push(await out.save());
  }
  return outputs;
}
export { download } from "./download";
