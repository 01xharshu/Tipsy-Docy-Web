import { prepareUnicodeFonts } from "./pdf-fonts";
import DOMPurify from "dompurify";
import { dimensions, type DocumentSettings } from "./model";
if (typeof window !== "undefined")
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (
      data.attrName === "src" &&
      !/^data:image\/(png|jpeg);base64,/i.test(data.attrValue)
    )
      data.keepAttr = false;
    if (data.attrName === "style") {
      const allowed = new Set([
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "text-decoration",
        "text-decoration-line",
        "color",
        "background-color",
        "line-height",
        "text-align",
        "text-indent",
        "margin",
        "margin-left",
        "margin-right",
        "margin-top",
        "margin-bottom",
        "padding",
        "padding-left",
        "padding-right",
        "padding-top",
        "padding-bottom",
        "width",
        "height",
        "border",
        "border-color",
        "border-width",
        "border-style",
        "column-count",
        "column-gap",
      ]);
      data.attrValue = data.attrValue
        .split(";")
        .filter((rule) => {
          const [rawName, ...rest] = rule.split(":");
          const name = rawName.trim().toLowerCase();
          const value = rest.join(":").trim().toLowerCase();
          if (name === "column-count") return ["2", "3"].includes(value);
          if (name === "column-gap") {
            const gap = value.match(/^(\d{1,2})px$/);
            return Boolean(gap && Number(gap[1]) <= 96);
          }
          return (
            allowed.has(name) &&
            !/url|expression|image-set|https?:|\\|@/i.test(rest.join(":"))
          );
        })
        .join(";");
    }
  });
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "video",
      "audio",
      "style",
      "svg",
      "math",
    ],
    FORBID_ATTR: ["srcset"],
  });
}

export type TextRun = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  color: string;
  underline: boolean;
  strike: boolean;
  highlight: string;
};
export type DrawImage = {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type DrawBox = {
  fill?: string;
  lineWidth?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};
export type DrawFootnote = { number: number; lines: string[]; y: number };
export type DocPage = {
  text: TextRun[];
  images: DrawImage[];
  boxes: DrawBox[];
  footnotes: DrawFootnote[];
};
export type DocModel = {
  width: number;
  height: number;
  margin: number;
  pages: DocPage[];
  background: string;
  header: string;
  footer: string;
  numbers: boolean;
  flowGaps: {
    offset: number;
    height: number;
    targetTop?: number;
    tag?: string;
  }[];
};
export const EDITOR_PAGE_GAP = 24;
// Measure in CSS points (1 CSS px becomes 1 PDF point). Both preview and PDF consume this model.
export function paginate(
  root: HTMLElement,
  settings: DocumentSettings,
): DocModel {
  const [width, height] = dimensions(settings),
    margin = settings.margin,
    markerNodes = [
      ...root.querySelectorAll<HTMLElement>('sup[data-type="footnote"]'),
    ],
    estimatedFootnoteLines = markerNodes.reduce(
      (sum, marker) =>
        sum + Math.max(1, Math.ceil((marker.dataset.note || "").length / 92)),
      0,
    ),
    footnoteReserve = markerNodes.length
      ? Math.max(
          0,
          Math.min(height - 2 * margin - 80, 28 + estimatedFootnoteLines * 10),
        )
      : 0,
    usable = height - 2 * margin - footnoteReserve;
  if (usable < 80 || width - 2 * margin < 80)
    throw new Error("Reduce margins to leave room for document content.");
  const model: DocModel = {
    width,
    height,
    margin,
    pages: [{ text: [], images: [], boxes: [], footnotes: [] }],
    background: settings.background,
    header: settings.header,
    footer: settings.footer,
    numbers: settings.numbers,
    flowGaps: [],
  };
  const base = root.getBoundingClientRect();
  const page = (i: number) => {
    while (model.pages.length <= i)
      model.pages.push({ text: [], images: [], boxes: [], footnotes: [] });
    return model.pages[i];
  };

  let extra = 0,
    tokenOffset = 0,
    inserted = 0;
  const flow = (
    offset: number,
    index: number,
    targetTop?: number,
    tag?: string,
  ) => {
    const total = extra + index * (2 * margin + EDITOR_PAGE_GAP);
    if (total > inserted + 0.1) {
      model.flowGaps.push({ offset, height: total - inserted, targetTop, tag });
      inserted = total;
    }
  };
  const semantic = new Set([
    "P",
    "SECTION",
    "PRE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "TABLE",
    "TR",
    "TD",
    "TH",
    "IMG",
    "HR",
    "BR",
  ]);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node instanceof HTMLElement) {
      if (node.dataset.type === "footnote") {
        const rect = node.getBoundingClientRect(),
          position = rect.top - base.top + extra,
          index = Math.max(0, Math.floor(position / usable)),
          note = (node.dataset.note || "").trim(),
          words = note.split(/\s+/),
          lines: string[] = [];
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (candidate.length > 92 && line) {
            lines.push(line);
            line = word;
          } else line = candidate;
        }
        if (line) lines.push(line);
        const target = page(index),
          previousLines = target.footnotes.reduce(
            (sum, item) => sum + item.lines.length,
            0,
          ),
          number = Number(node.dataset.number) || 1;
        target.footnotes.push({
          number,
          lines: lines.map((text, lineIndex) =>
            lineIndex === 0 ? `${number}. ${text}` : text,
          ),
          y: height - margin - footnoteReserve + 10 + previousLines * 10,
        });
        tokenOffset++;
        continue;
      }
      const isBreak = node.dataset.type === "pageBreak";
      const isBlock =
        semantic.has(node.tagName) ||
        node.dataset.type === "blockGroup" ||
        isBreak;
      const currentOffset = tokenOffset;
      if (isBlock) tokenOffset++;
      if (
        !isBreak &&
        ["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TABLE"].includes(
          node.tagName,
        )
      ) {
        const r = node.getBoundingClientRect(),
          pos = r.top - base.top + extra;
        if (r.height <= usable && (pos % usable) + r.height > usable)
          extra += usable - (pos % usable);
        const idx = Math.floor((r.top - base.top + extra) / usable);
        page(idx);
        flow(
          currentOffset,
          idx,
          r.top - base.top + extra + idx * (2 * margin + EDITOR_PAGE_GAP),
          node.tagName,
        );
      }
      if (node.tagName === "LI") {
        const r = node.getBoundingClientRect(),
          st = getComputedStyle(node);
        let pos = r.top - base.top + extra;
        const size = parseFloat(st.fontSize);
        if ((pos % usable) + size * 1.2 > usable) {
          extra += usable - (pos % usable);
          pos = r.top - base.top + extra;
        }
        const parent = node.parentElement;
        const siblings = parent
          ? Array.from(parent.children).filter((e) => e.tagName === "LI")
          : [];
        const marker =
          parent?.getAttribute("data-type") === "taskList"
            ? node.getAttribute("data-checked") === "true"
              ? "[x]"
              : "[ ]"
            : parent?.tagName === "OL"
              ? `${siblings.indexOf(node) + (Number(parent.getAttribute("start")) || 1)}.`
              : "•";
        page(Math.floor(pos / usable)).text.push({
          text: marker,
          x: r.left - base.left + margin - 18,
          y: (pos % usable) + margin,
          width: 16,
          height: size * 1.2,
          size,
          font: st.fontFamily,
          bold: false,
          italic: false,
          color: st.color,
          underline: false,
          strike: false,
          highlight: "transparent",
        });
      }
      if (node.tagName === "HR") {
        const r = node.getBoundingClientRect(),
          pos = r.top - base.top + extra;
        flow(currentOffset, Math.floor(pos / usable));
        page(Math.floor(pos / usable)).boxes.push({
          x: r.left - base.left + margin,
          y: (pos % usable) + margin,
          width: r.width,
          height: 0.5,
          color: "#cbd5e1",
        });
      }

      if (node.dataset.type === "pageBreak") {
        const pos = node.getBoundingClientRect().top - base.top + extra;
        extra += usable - (pos % usable);
        const idx = Math.floor((pos + usable - (pos % usable)) / usable);
        page(idx);
        flow(tokenOffset, idx);
        continue;
      }
      if (
        node instanceof HTMLImageElement &&
        node.src.startsWith("data:image/")
      ) {
        const r = node.getBoundingClientRect(),
          pos = r.top - base.top + extra;
        let idx = Math.floor(pos / usable),
          y = pos % usable;
        if (y + r.height > usable && r.height <= usable) {
          extra += usable - y;
          idx++;
          y = 0;
        }
        flow(currentOffset, idx);
        page(idx).images.push({
          src: node.src,
          x: r.left - base.left + margin,
          y: y + margin,
          width: r.width,
          height: Math.min(r.height, usable),
        });
      }
      if (node.tagName === "TD" || node.tagName === "TH") {
        const r = node.getBoundingClientRect(),
          pos = r.top - base.top + extra;
        const idx = Math.floor(pos / usable);
        page(idx).boxes.push({
          x: r.left - base.left + margin,
          y: (pos % usable) + margin,
          width: r.width,
          height: Math.min(r.height, usable - (pos % usable)),
          color: getComputedStyle(node).borderTopColor,
          fill: getComputedStyle(node).backgroundColor,
          lineWidth:
            (parseFloat(getComputedStyle(node).borderTopWidth) || 0.5) * 0.75,
        });
      }
      continue;
    }
    if (!node.textContent) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-type="pageBreak"]')) continue;
    if (!node.textContent.trim() && !parent.closest("p,pre,h1,h2,h3,h4,h5,h6"))
      continue;
    const style = getComputedStyle(parent);
    const range = document.createRange();
    let run: TextRun | null = null;
    let lastTop = -1;
    for (let i = 0; i < node.textContent.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      let pos = rect.top - base.top + extra;
      let idx = Math.floor(pos / usable),
        y = pos % usable;
      if (y + rect.height > usable) {
        extra += usable - y;
        pos += usable - y;
        idx++;
        y = 0;
      }
      flow(
        tokenOffset + i,
        idx,
        rect.top - base.top + extra + idx * (2 * margin + EDITOR_PAGE_GAP),
      );
      if (!run || Math.abs(rect.top - lastTop) > 2) {
        run = {
          text: node.textContent[i],
          x: rect.left - base.left + margin,
          y: y + margin,
          width: rect.width,
          height: rect.height,
          size: parseFloat(style.fontSize),
          font: style.fontFamily,
          bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
          italic: style.fontStyle === "italic",
          color: style.color,
          underline: style.textDecorationLine.includes("underline"),
          strike: style.textDecorationLine.includes("line-through"),
          highlight: style.backgroundColor,
        };
        page(idx).text.push(run);
        lastTop = rect.top;
      } else {
        run.text += node.textContent[i];
        const right = Math.max(
          run.x + run.width,
          rect.right - base.left + margin,
        );
        run.x = Math.min(run.x, rect.left - base.left + margin);
        run.width = right - run.x;
      }
    }
    tokenOffset += node.textContent.length;
    range.detach();
  }
  return model;
}
export async function documentPdf(
  model: DocModel,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const texts = [
    model.header,
    model.footer,
    ...model.pages.flatMap((page) => page.text.map((run) => run.text)),
    ...model.pages.flatMap((page) =>
      page.footnotes.flatMap((footnote) => footnote.lines),
    ),
  ];
  if (
    texts.some((text) =>
      /[\u0600-\u08ff\u0900-\u097f\ufb50-\ufeff]/u.test(text),
    )
  ) {
    const { shapedPdf } = await import("./shaped-pdf");
    return shapedPdf(model, signal);
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    unit: "pt",
    format: [model.width, model.height],
    orientation: model.width > model.height ? "landscape" : "portrait",
  });
  const unicode = await prepareUnicodeFonts(pdf, [
    model.header,
    model.footer,
    ...model.pages.flatMap((page) => page.text.map((run) => run.text)),
    ...model.pages.flatMap((page) =>
      page.footnotes.flatMap((footnote) => footnote.lines),
    ),
  ]);
  for (let i = 0; i < model.pages.length; i++) {
    signal?.throwIfAborted();
    if (i % 4 === 0)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (i)
      pdf.addPage(
        [model.width, model.height],
        model.width > model.height ? "landscape" : "portrait",
      );
    pdf.setFillColor(model.background);
    pdf.rect(0, 0, model.width, model.height, "F");
    const p = model.pages[i];
    for (const b of p.boxes) {
      pdf.setDrawColor(b.color);
      pdf.setLineWidth(b.lineWidth ?? 0.5);
      if (b.fill && b.fill !== "rgba(0, 0, 0, 0)" && b.fill !== "transparent") {
        pdf.setFillColor(b.fill);
        pdf.rect(b.x, b.y, b.width, b.height, "FD");
      } else pdf.rect(b.x, b.y, b.width, b.height);
    }
    for (const t of p.text) {
      const family = /mono/i.test(t.font)
        ? "courier"
        : /georgia|times|serif/i.test(t.font) && !/sans/i.test(t.font)
          ? "times"
          : "helvetica";
      pdf.setFont(
        unicode ? "LocalUnicode" : family,
        t.bold
          ? t.italic
            ? "bolditalic"
            : "bold"
          : t.italic
            ? "italic"
            : "normal",
      );
      pdf.setFontSize(t.size);
      const c = t.color.match(/\d+/g);
      pdf.setTextColor(
        Number(c?.[0] ?? 0),
        Number(c?.[1] ?? 0),
        Number(c?.[2] ?? 0),
      );
      if (t.highlight !== "rgba(0, 0, 0, 0)" && t.highlight !== "transparent") {
        const h = t.highlight.match(/\d+/g);
        if (h) {
          pdf.setFillColor(Number(h[0]), Number(h[1]), Number(h[2]));
          pdf.rect(t.x, t.y, t.width, t.height, "F");
        }
      }
      pdf.text(t.text, t.x, t.y + t.size * 0.83);
      if (t.underline || t.strike) {
        pdf.setDrawColor(
          Number(c?.[0] ?? 0),
          Number(c?.[1] ?? 0),
          Number(c?.[2] ?? 0),
        );
        pdf.line(
          t.x,
          t.y + t.size * (t.strike ? 0.45 : 1),
          t.x + t.width,
          t.y + t.size * (t.strike ? 0.45 : 1),
        );
      }
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    for (const footnote of p.footnotes)
      footnote.lines.forEach((line, lineIndex) =>
        pdf.text(line, model.margin, footnote.y + lineIndex * 10),
      );
    for (const img of p.images) {
      try {
        pdf.addImage(img.src, img.x, img.y, img.width, img.height);
      } catch {
        try {
          const bitmap = new Image();
          bitmap.src = img.src;
          await bitmap.decode();
          signal?.throwIfAborted();
          const canvas = document.createElement("canvas"),
            ratio = Math.min(
              1,
              4096 / bitmap.naturalWidth,
              4096 / bitmap.naturalHeight,
            );
          canvas.width = Math.max(1, Math.round(bitmap.naturalWidth * ratio));
          canvas.height = Math.max(1, Math.round(bitmap.naturalHeight * ratio));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Image canvas unavailable");
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          pdf.addImage(
            canvas.toDataURL("image/png"),
            img.x,
            img.y,
            img.width,
            img.height,
          );
          canvas.width = 0;
          canvas.height = 0;
        } catch {
          throw new Error(
            "An image could not be decoded for export. Replace it with a valid PNG or JPEG.",
          );
        }
      }
    }
    if (p.footnotes.length) {
      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.6);
      pdf.line(
        model.margin,
        p.footnotes[0].y - 7,
        model.margin + Math.min(180, model.width * 0.32),
        p.footnotes[0].y - 7,
      );
    }
    pdf.setFont(unicode ? "LocalUnicode" : "helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor("#64748b");
    pdf.text(model.header, model.margin, Math.max(14, model.margin / 2));
    pdf.text(
      model.footer,
      model.margin,
      model.height - Math.max(14, model.margin / 2),
    );
    if (model.numbers)
      pdf.text(
        String(i + 1),
        model.width - model.margin,
        model.height - Math.max(14, model.margin / 2),
        { align: "right" },
      );
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
export async function importDocument(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    return {
      html: sanitize(result.value),
      warnings: result.messages.map((m) => m.message),
    };
  }
  if (ext === "txt") {
    const text = await file.text();
    return {
      html: text
        .split(/\n/)
        .map(
          (l) =>
            `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`,
        )
        .join(""),
      warnings: [],
    };
  }
  if (ext === "html" || ext === "htm")
    return { html: sanitize(await file.text()), warnings: [] };
  throw new Error("Import DOCX, TXT, or HTML files.");
}
