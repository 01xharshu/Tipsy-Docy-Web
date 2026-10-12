import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

/** Inline, self-contained footnote marker; the source text stays in the document model. */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: null },
      number: { default: 1 },
      note: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-type="footnote"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-type": "footnote",
        "data-id": node.attrs.id,
        "data-number": node.attrs.number,
        "data-note": node.attrs.note,
        title: node.attrs.note,
        class: "document-footnote-marker",
      }),
      String(node.attrs.number),
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((transaction) => transaction.docChanged))
            return null;
          const tr = state.tr;
          let number = 0;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "footnote") return;
            number++;
            if (Number(node.attrs.number) !== number)
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, number });
          });
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});
