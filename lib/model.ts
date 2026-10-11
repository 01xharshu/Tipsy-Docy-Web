export type Placement = {
  id: string;
  sourceId: string;
  page: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  dx: number;
  dy: number;
  selected: boolean;
};
export type Source = {
  id: string;
  name: string;
  bytes: Uint8Array;
  count: number;
};
export type Layout = {
  size: string;
  width: number;
  height: number;
  landscape: boolean;
  rows: number;
  cols: number;
  margin: number;
  gapX: number;
  gapY: number;
  order: "horizontal" | "vertical";
  fit: "fit" | "fill";
  align: "center" | "start" | "end";
  background: string;
  borders: boolean;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
};
export const SIZES: Record<string, [number, number]> = {
  A4: [595.276, 841.89],
  A3: [841.89, 1190.55],
  A5: [419.528, 595.276],
  Letter: [612, 792],
  Legal: [612, 1008],
};
export const DEFAULT_LAYOUT: Layout = {
  size: "A4",
  width: 595.276,
  height: 841.89,
  landscape: false,
  rows: 2,
  cols: 2,
  margin: 28.346,
  gapX: 14.173,
  gapY: 14.173,
  order: "horizontal",
  fit: "fit",
  align: "center",
  background: "#ffffff",
  borders: false,
  borderColor: "#53634a",
  borderWidth: 1,
  borderStyle: "solid",
};
export type DocumentSettings = {
  size: string;
  width: number;
  height: number;
  landscape: boolean;
  margin: number;
  background: string;
  header: string;
  footer: string;
  numbers: boolean;
};
export const DEFAULT_DOCUMENT: DocumentSettings = {
  size: "A4",
  width: 595.276,
  height: 841.89,
  landscape: false,
  margin: 56.693,
  background: "#ffffff",
  header: "",
  footer: "",
  numbers: true,
};
export type Project = {
  id: string;
  title: string;
  kind: "pdf" | "document";
  updated: number;
  sources: Source[];
  pages: Placement[];
  layout: Layout;
  html: string;
  doc: DocumentSettings;
};
export function newProject(kind: Project["kind"]): Project {
  return {
    id: crypto.randomUUID(),
    title: kind === "pdf" ? "Untitled layout" : "Untitled document",
    kind,
    updated: Date.now(),
    sources: [],
    pages: [],
    layout: { ...DEFAULT_LAYOUT },
    html: "<p></p>",
    doc: { ...DEFAULT_DOCUMENT },
  };
}
export function dimensions(s: {
  width: number;
  height: number;
  landscape: boolean;
}): [number, number] {
  return s.landscape
    ? [Math.max(s.width, s.height), Math.min(s.width, s.height)]
    : [Math.min(s.width, s.height), Math.max(s.width, s.height)];
}
export function parseRange(text: string, total: number): number[] {
  if (!text.trim()) return Array.from({ length: total }, (_, i) => i);
  const result = new Set<number>();
  for (const part of text.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error("Use page ranges such as 1-3, 5.");
    const a = Number(m[1]),
      b = Number(m[2] || m[1]);
    if (a < 1 || b < a || b > total)
      throw new Error(`Page range must be between 1 and ${total}.`);
    for (let n = a; n <= b; n++) result.add(n - 1);
  }
  return [...result];
}
