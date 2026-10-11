import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
export const Contents = Node.create({
  name: "contents",
  group: "block",
  content: "paragraph+",
  isolating: true,
  parseHTML: () => [{ tag: 'section[data-type="contents"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, {
      "data-type": "contents",
      class: "document-contents",
    }),
    0,
  ],
});
export const Endnotes = Node.create({
  name: "endnotes",
  group: "block",
  content: "paragraph+",
  isolating: true,
  parseHTML: () => [{ tag: 'section[data-type="endnotes"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, {
      "data-type": "endnotes",
      class: "document-endnotes",
    }),
    0,
  ],
});
export const DocumentStructure = Extension.create({
  name: "documentStructure",
  addGlobalAttributes: () => [
    {
      types: ["heading", "paragraph"],
      attributes: {
        id: {
          default: null,
          parseHTML: (element: HTMLElement) => element.id || null,
          renderHTML: (attrs: Record<string, string>) =>
            attrs.id ? { id: attrs.id } : {},
        },
      },
    },
  ],
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((transaction) => transaction.docChanged))
            return null;
          const tr = state.tr;
          const headings: { id: string; text: string; level: number }[] = [];
          const positions: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "heading") {
              const id = node.attrs.id || `heading-${crypto.randomUUID()}`;
              if (!node.attrs.id)
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
              headings.push({
                id,
                text: node.textContent,
                level: Number(node.attrs.level),
              });
            }
            if (node.type.name === "contents") {
              positions.push(pos);
              return false;
            }
          });
          const paragraphs = [
            state.schema.nodes.paragraph.create(
              null,
              state.schema.text("Contents", [state.schema.marks.bold.create()]),
            ),
          ];
          for (const heading of headings) {
            if (!heading.text) continue;
            paragraphs.push(
              state.schema.nodes.paragraph.create(
                { indent: (heading.level - 1) * 12 },
                state.schema.text(heading.text, [
                  state.schema.marks.link.create({ href: `#${heading.id}` }),
                ]),
              ),
            );
          }
          for (const pos of positions.slice().reverse()) {
            const current = state.doc.nodeAt(pos)!;
            const next = state.schema.nodes.contents.create(
              current.attrs,
              paragraphs,
            );
            if (!current.eq(next))
              tr.replaceWith(pos, pos + current.nodeSize, next);
          }
          return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
        },
      }),
    ];
  },
});
