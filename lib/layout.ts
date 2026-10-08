import { dimensions, type Layout, type Placement } from "./model";
export type Box = {
  page: Placement;
  sheet: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cellX: number;
  cellY: number;
  cellWidth: number;
  cellHeight: number;
};
export function calculateLayout(
  pages: Placement[],
  layout: Layout,
): { width: number; height: number; sheets: Box[][] } {
  const [width, height] = dimensions(layout);
  const { rows, cols, margin, gapX, gapY } = layout;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < 1 ||
    cols < 1 ||
    rows > 16 ||
    cols > 16
  )
    throw new Error("Grid must contain 1–16 rows and columns.");
  const cw = (width - 2 * margin - (cols - 1) * gapX) / cols,
    ch = (height - 2 * margin - (rows - 1) * gapY) / rows;
  if (cw <= 0 || ch <= 0)
    throw new Error("Margins and gaps leave no room for pages.");
  const sheets: Box[][] = [];
  pages
    .filter((p) => p.selected)
    .forEach((p, i) => {
      const sheet = Math.floor(i / (rows * cols)),
        slot = i % (rows * cols);
      const col =
          layout.order === "horizontal" ? slot % cols : Math.floor(slot / rows),
        row =
          layout.order === "horizontal" ? Math.floor(slot / cols) : slot % rows;
      const rotated = p.rotation % 180 !== 0;
      const pw = rotated ? p.height : p.width,
        ph = rotated ? p.width : p.height;
      const ratio =
        (layout.fit === "fit"
          ? Math.min(cw / pw, ch / ph)
          : Math.max(cw / pw, ch / ph)) * p.scale;
      const w = pw * ratio,
        h = ph * ratio,
        factor =
          layout.align === "start" ? 0 : layout.align === "end" ? 1 : 0.5;
      const cellX = margin + col * (cw + gapX),
        cellY = margin + row * (ch + gapY);
      (sheets[sheet] ??= []).push({
        page: p,
        sheet,
        x: cellX + (cw - w) * factor + p.dx,
        y: cellY + (ch - h) * factor + p.dy,
        width: w,
        height: h,
        cellX,
        cellY,
        cellWidth: cw,
        cellHeight: ch,
      });
    });
  return { width, height, sheets };
}
