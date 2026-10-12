import { Node, mergeAttributes } from "@tiptap/core";

export const ColumnSection = Node.create({
  name: "columnSection",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) =>
          Math.max(2, Math.min(3, Number(element.getAttribute("data-columns")) || 2)),
      },
      gap: {
        default: 24,
        parseHTML: (element) => {
          const value = Number(element.getAttribute("data-column-gap"));
          return Number.isFinite(value)
            ? Math.max(0, Math.min(96, value))
            : 24;
        },
      },
    };
  },
  parseHTML: () => [{ tag: 'section[data-type="columns"]' }],
  renderHTML({ node, HTMLAttributes }) {
    const rawCount = Number(node.attrs.count);
    const rawGap = Number(node.attrs.gap);
    const count = Number.isFinite(rawCount) ? Math.max(2, Math.min(3, rawCount)) : 2;
    const gap = Number.isFinite(rawGap) ? Math.max(0, Math.min(96, rawGap)) : 24;
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-type": "columns",
        "data-columns": count,
        "data-column-gap": gap,
        class: "document-columns",
        style: `column-count:${count};column-gap:${gap}px`,
        "aria-label": `${count} column text section`,
      }),
      0,
    ];
  },
});
