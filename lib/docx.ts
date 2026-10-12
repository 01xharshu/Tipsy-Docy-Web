import { sanitize } from "./documents";
import { dimensions, type DocumentSettings } from "./model";

// Word has paragraph spacing/indents, rather than HTML block padding. Map grouped
// block spacing into its contained paragraphs and preserve the editable HTML backup.
export async function exportDocx(html: string, settings: DocumentSettings) {
  const d = await import("docx");
  const root = document.createElement("div");
  root.innerHTML = sanitize(html);
  type RunStyle = {
    bold?: boolean;
    italics?: boolean;
    strike?: boolean;
    underline?: Record<string, never>;
    font?: string;
    size?: number;
    color?: string;
    superScript?: boolean;
    subScript?: boolean;
  };
  const inline = (
    node: globalThis.Node,
    style: RunStyle = {},
  ): (
    InstanceType<typeof d.TextRun> | InstanceType<typeof d.ExternalHyperlink>
  )[] => {
    if (node.nodeType === 3)
      return [new d.TextRun({ ...style, text: node.textContent || "" })];
    if (!(node instanceof HTMLElement)) return [];
    if (node.dataset.type === "footnote")
      return [
        new d.TextRun({
          ...style,
          text: `${node.dataset.number || "1"} (Footnote: ${node.dataset.note || ""})`,
        }),
      ];
    if (node.tagName === "BR") return [new d.TextRun({ break: 1 })];
    const next: RunStyle = {
      ...style,
      bold: style.bold || ["B", "STRONG"].includes(node.tagName),
      italics: style.italics || ["EM", "I"].includes(node.tagName),
      strike: style.strike || ["S", "DEL"].includes(node.tagName),
      underline: style.underline || (node.tagName === "U" ? {} : undefined),
      superScript: style.superScript || node.tagName === "SUP",
      subScript: style.subScript || node.tagName === "SUB",
      font: node.style.fontFamily || style.font,
      size: node.style.fontSize
        ? Math.round(parseFloat(node.style.fontSize) * 2)
        : style.size,
      color: node.style.color ? rgb(node.style.color) : style.color,
    };
    const children = Array.from(node.childNodes).flatMap((n) =>
      inline(n, next),
    );
    if (
      node.tagName === "A" &&
      /^(https?:\/\/|mailto:)/i.test(node.getAttribute("href") || "")
    )
      return [
        new d.ExternalHyperlink({ link: node.getAttribute("href")!, children }),
      ];
    return children;
  };
  const points = (value: string) => parseFloat(value) || 0;
  const twips = (value: number) => Math.round(value * 20);
  type Insets = { left: number; right: number; before: number; after: number };
  const empty: Insets = { left: 0, right: 0, before: 0, after: 0 };
  const blocks = async (
    elements: Element[],
    inherited: Insets = empty,
    list?: { ordered: boolean; level: number },
  ): Promise<
    (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[]
  > => {
    const out: (
      InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>
    )[] = [];
    for (let index = 0; index < elements.length; index++) {
      const n = elements[index] as HTMLElement;
      const css = n.style;
      const spacing = {
        left: inherited.left + points(css.marginLeft) + points(css.paddingLeft),
        right:
          inherited.right + points(css.marginRight) + points(css.paddingRight),
        before:
          (index === 0 ? inherited.before : 0) +
          points(css.marginTop) +
          points(css.paddingTop),
        after:
          (index === elements.length - 1 ? inherited.after : 0) +
          points(css.marginBottom) +
          points(css.paddingBottom),
      };
      if (n.dataset.type === "blockGroup") {
        out.push(...(await blocks(Array.from(n.children), spacing, list)));
      } else if (["UL", "OL"].includes(n.tagName)) {
        out.push(
          ...(await blocks(Array.from(n.children), spacing, {
            ordered: n.tagName === "OL",
            level: Math.min(8, list ? list.level + 1 : 0),
          })),
        );
      } else if (n.tagName === "TABLE") {
        const rows = [];
        for (const row of Array.from(
          n.querySelectorAll(
            ":scope > tbody > tr, :scope > tr, :scope > thead > tr",
          ),
        )) {
          const cells = [];
          for (const cell of Array.from(row.children)) {
            const content = await blocks(Array.from(cell.children));
            cells.push(
              new d.TableCell({
                children: content.length
                  ? content
                  : [new d.Paragraph({ children: inline(cell) })],
                columnSpan: Number(cell.getAttribute("colspan")) || 1,
                verticalAlign:
                  cell.getAttribute("data-cell-valign") === "middle"
                    ? d.VerticalAlign.CENTER
                    : cell.getAttribute("data-cell-valign") === "bottom"
                      ? d.VerticalAlign.BOTTOM
                      : d.VerticalAlign.TOP,
                ...(cell.getAttribute("data-cell-fill")
                  ? {
                      shading: {
                        fill: cell
                          .getAttribute("data-cell-fill")!
                          .replace(/^#/, "")
                          .toUpperCase(),
                      },
                    }
                  : {}),
                ...(cell.getAttribute("data-cell-border-color")
                  ? {
                      borders: Object.fromEntries(
                        ["top", "bottom", "left", "right"].map((edge) => [
                          edge,
                          {
                            style: d.BorderStyle.SINGLE,
                            size: Math.round(
                              Math.min(
                                12,
                                Math.max(
                                  0.25,
                                  Number(
                                    cell.getAttribute("data-cell-border-width"),
                                  ) || 1,
                                ),
                              ) * 6,
                            ),
                            color: cell
                              .getAttribute("data-cell-border-color")!
                              .replace(/^#/, "")
                              .toUpperCase(),
                          },
                        ]),
                      ),
                    }
                  : {}),
              }),
            );
          }
          rows.push(new d.TableRow({ children: cells }));
        }
        out.push(
          new d.Table({
            rows,
            width: { size: 100, type: d.WidthType.PERCENTAGE },
          }),
        );
      } else if (
        n.tagName === "IMG" &&
        n.getAttribute("src")?.startsWith("data:image/")
      ) {
        const img = n as HTMLImageElement;
        const bitmap = new Image();
        bitmap.src = img.src;
        await bitmap.decode();
        const width = Math.min(
          Number(img.getAttribute("width")) || 240,
          dimensions(settings)[0] - settings.margin * 2,
        );
        const height = (width * bitmap.naturalHeight) / bitmap.naturalWidth;
        const data = Uint8Array.from(atob(img.src.split(",")[1]), (c) =>
          c.charCodeAt(0),
        );
        out.push(
          new d.Paragraph({
            children: [
              new d.ImageRun({
                data,
                type: img.src.includes("jpeg") ? "jpg" : "png",
                transformation: { width, height },
              }),
            ],
          }),
        );
      } else if (n.dataset.type === "pageBreak") {
        out.push(new d.Paragraph({ pageBreakBefore: true }));
      } else {
        const nested =
          n.tagName === "LI"
            ? Array.from(n.children).filter((c) =>
                ["UL", "OL"].includes(c.tagName),
              )
            : [];
        const textNode = n.cloneNode(true) as HTMLElement;
        if (nested.length)
          Array.from(textNode.children)
            .filter((c) => ["UL", "OL"].includes(c.tagName))
            .forEach((c) => c.remove());
        const align = css.textAlign;
        out.push(
          new d.Paragraph({
            children: inline(textNode),
            heading: /^H[1-6]$/.test(n.tagName)
              ? d.HeadingLevel[
                  `HEADING_${n.tagName[1]}` as keyof typeof d.HeadingLevel
                ]
              : undefined,
            alignment: ["left", "right", "center", "justify"].includes(align)
              ? align === "justify"
                ? d.AlignmentType.JUSTIFIED
                : (align as "left" | "right" | "center")
              : undefined,
            indent: {
              left: twips(spacing.left),
              right: twips(spacing.right),
              ...(points(css.textIndent) >= 0
                ? { firstLine: twips(points(css.textIndent)) }
                : { hanging: twips(-points(css.textIndent)) }),
            },
            spacing: {
              before: twips(spacing.before),
              after: twips(spacing.after),
              ...(css.lineHeight
                ? { line: Math.round(Number(css.lineHeight) * 240) }
                : {}),
            },
            bullet: list && !list.ordered ? { level: list.level } : undefined,
            numbering: list?.ordered
              ? { reference: "list", level: list.level }
              : undefined,
          }),
        );
        if (nested.length) out.push(...(await blocks(nested, spacing, list)));
      }
    }
    return out;
  };
  const [width, height] = dimensions(settings);
  return d.Packer.toBlob(
    new d.Document({
      numbering: {
        config: [
          {
            reference: "list",
            levels: Array.from({ length: 9 }, (_, level) => ({
              level,
              format: d.LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: d.AlignmentType.START,
            })),
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: twips(Math.min(width, height)),
                height: twips(Math.max(width, height)),
                orientation: settings.landscape
                  ? d.PageOrientation.LANDSCAPE
                  : d.PageOrientation.PORTRAIT,
              },
              margin: {
                top: twips(settings.margin),
                bottom: twips(settings.margin),
                left: twips(settings.margin),
                right: twips(settings.margin),
              },
            },
          },
          headers: settings.header
            ? {
                default: new d.Header({
                  children: [new d.Paragraph(settings.header)],
                }),
              }
            : undefined,
          footers:
            settings.footer || settings.numbers
              ? {
                  default: new d.Footer({
                    children: [
                      new d.Paragraph({
                        children: [
                          new d.TextRun(settings.footer),
                          ...(settings.numbers
                            ? [
                                new d.TextRun({
                                  children: [" ", d.PageNumber.CURRENT],
                                }),
                              ]
                            : []),
                        ],
                      }),
                    ],
                  }),
                }
              : undefined,
          children: await blocks(Array.from(root.children)),
        },
      ],
    }),
  );
}
function rgb(value: string) {
  if (value.startsWith("#")) return value.slice(1);
  const channels = value.match(/\d+/g);
  return (
    channels
      ?.slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("") || "000000"
  );
}
