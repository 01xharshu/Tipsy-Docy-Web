import type { DocModel, TextRun } from "./documents";

const assets = new Map<string, Promise<Uint8Array>>();
async function fontBytes(url: string) {
  let promise = assets.get(url);
  if (!promise) {
    promise = fetch(url)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "A local export font is unavailable. Reload and retry.",
          );
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch((error: unknown) => {
        assets.delete(url);
        throw error;
      });
    assets.set(url, promise);
  }
  return promise;
}
const script = (text: string) =>
  /[\u0900-\u097f]/u.test(text)
    ? "devanagari"
    : /[\u0600-\u08ff\ufb50-\ufeff]/u.test(text)
      ? "arabic"
      : "latin";
const color = (value: string) =>
  value.match(/\d+/g)?.slice(0, 3).map(Number) as
    [number, number, number] | undefined;

/** PDFKit's browser build uses fontkit OpenType shaping; all bytes remain local. */
export async function shapedPdf(
  model: DocModel,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const { default: PDFDocument } = await import("pdfkit");
  const pdf = new PDFDocument({
    autoFirstPage: false,
    font: (await fontBytes(
      "/standard_fonts/LiberationSans-Regular.ttf",
    )) as unknown as string,
    compress: true,
  });
  const chunks: Uint8Array[] = [];
  const finished = new Promise<Uint8Array>((resolve) => {
    pdf.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    pdf.on("end", () => {
      const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    });
  });
  const names = new Set<string>();
  const selectFont = async (run: Pick<TextRun, "text" | "bold" | "italic">) => {
    const family = script(run.text);
    const style = run.bold
      ? run.italic
        ? "BoldItalic"
        : "Bold"
      : run.italic
        ? "Italic"
        : "Regular";
    const name = family === "latin" ? `latin-${style}` : family;
    if (!names.has(name)) {
      const url =
        family === "latin"
          ? `/standard_fonts/LiberationSans-${style}.ttf`
          : `/fonts/noto${family === "arabic" ? "naskharabic" : "sansdevanagari"}.ttf`;
      pdf.registerFont(name, await fontBytes(url));
      names.add(name);
    }
    pdf.font(name);
  };
  for (let i = 0; i < model.pages.length; i++) {
    signal?.throwIfAborted();
    pdf.addPage({ size: [model.width, model.height], margin: 0 });
    pdf.rect(0, 0, model.width, model.height).fill(model.background);
    const page = model.pages[i];
    for (const box of page.boxes) {
      pdf.rect(box.x, box.y, box.width, box.height).lineWidth(0.5);
      if (
        box.fill &&
        box.fill !== "transparent" &&
        box.fill !== "rgba(0, 0, 0, 0)"
      )
        pdf.fillAndStroke(box.fill, box.color);
      else pdf.stroke(box.color);
    }
    for (const run of page.text) {
      await selectFont(run);
      signal?.throwIfAborted();
      pdf.fontSize(run.size);
      if (
        run.highlight !== "transparent" &&
        run.highlight !== "rgba(0, 0, 0, 0)"
      ) {
        pdf
          .rect(run.x, run.y, run.width, run.height)
          .fill(color(run.highlight) ?? "#ffffff");
      }
      pdf.fillColor(color(run.color) ?? "#000000");
      // Browser measurement determines placement and width; PDFKit supplies glyph shaping.
      const width = pdf.widthOfString(run.text);
      pdf.save();
      pdf.translate(run.x, 0);
      if (width > 0 && run.width > 0) pdf.scale(run.width / width, 1);
      pdf.text(run.text, 0, run.y + run.size * 0.83, {
        lineBreak: false,
        baseline: "alphabetic",
      });
      pdf.restore();
      if (run.underline || run.strike)
        pdf
          .moveTo(run.x, run.y + run.size * (run.strike ? 0.45 : 1))
          .lineTo(run.x + run.width, run.y + run.size * (run.strike ? 0.45 : 1))
          .lineWidth(0.5)
          .stroke(color(run.color) ?? "#000000");
    }
    for (const image of page.images)
      pdf.image(image.src, image.x, image.y, {
        width: image.width,
        height: image.height,
      });
    for (const footnote of page.footnotes) {
      for (const [lineIndex, line] of footnote.lines.entries()) {
        await selectFont({ text: line, bold: false, italic: false });
        pdf
          .fontSize(8)
          .fillColor("#334155")
          .text(line, model.margin, footnote.y + lineIndex * 10, {
            lineBreak: false,
            baseline: "alphabetic",
          });
      }
    }
    for (const [text, x, y] of [
      [model.header, model.margin, Math.max(14, model.margin / 2)],
      [
        model.footer,
        model.margin,
        model.height - Math.max(14, model.margin / 2),
      ],
    ] as const) {
      await selectFont({ text, bold: false, italic: false });
      pdf
        .fontSize(9)
        .fillColor("#64748b")
        .text(text, x, y, { lineBreak: false, baseline: "alphabetic" });
    }
    if (model.numbers) {
      await selectFont({ text: String(i + 1), bold: false, italic: false });
      pdf
        .fontSize(9)
        .text(
          String(i + 1),
          model.width - model.margin - pdf.widthOfString(String(i + 1)),
          model.height - Math.max(14, model.margin / 2),
          { lineBreak: false, baseline: "alphabetic" },
        );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  pdf.end();
  return finished;
}
