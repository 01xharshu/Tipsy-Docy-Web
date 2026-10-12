import { Mark, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export function reviewableTextRange(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): { from: number; to: number } | null {
  if (from >= to) return null;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if ($from.parent.isTextblock && $from.parent === $to.parent)
    return { from, to };

  const blocks: { start: number; end: number }[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return;
    const start = pos + 1;
    const end = pos + node.nodeSize - 1;
    if (Math.max(from, start) < Math.min(to, end)) blocks.push({ start, end });
    return false;
  });
  if (blocks.length !== 1) return null;
  const block = blocks[0];
  if (from <= block.start - 1 && to >= block.end + 1)
    return { from: block.start, to: block.end };
  return null;
}

export const ReviewMark = Mark.create({
  name: "review",
  inclusive: false,
  addAttributes() {
    return Object.fromEntries(
      ["id", "kind", "note", "original"].map((key) => [
        key,
        {
          default: "",
          parseHTML: (element: HTMLElement) =>
            element.getAttribute(`data-review-${key}`) || "",
          renderHTML: (attributes: Record<string, string>) => ({
            [`data-review-${key}`]: attributes[key],
          }),
        },
      ]),
    );
  },
  parseHTML: () => [{ tag: "span[data-review-id]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, { class: "review-anchor" }),
    0,
  ],
});
export type ReviewEntry = {
  id: string;
  kind: string;
  note: string;
  original: string;
  from: number;
  to: number;
  text: string;
};
export function reviewEntries(editor: Editor): ReviewEntry[] {
  const entries = new Map<string, ReviewEntry>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((mark) => mark.type.name === "review");
    if (!mark) return;
    const id = String(mark.attrs.id);
    const prior = entries.get(id);
    if (prior) {
      prior.to = pos + node.nodeSize;
      prior.text += node.text;
    } else
      entries.set(id, {
        id,
        kind: String(mark.attrs.kind),
        note: String(mark.attrs.note),
        original: String(mark.attrs.original),
        from: pos,
        to: pos + node.nodeSize,
        text: node.text || "",
      });
  });
  return [...entries.values()];
}
export function resolveReview(
  editor: Editor,
  entry: ReviewEntry,
  reject = false,
) {
  const tr = editor.state.tr;
  if (reject && entry.kind === "suggestion") {
    if (entry.original)
      tr.replaceWith(entry.from, entry.to, editor.schema.text(entry.original));
    else tr.delete(entry.from, entry.to);
  } else tr.removeMark(entry.from, entry.to, editor.schema.marks.review);
  editor.view.dispatch(tr);
}
