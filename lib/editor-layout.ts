import { Extension, Node, mergeAttributes } from "@tiptap/core";
const numeric = (value: unknown) =>
  Math.max(0, Math.min(240, Number(value) || 0));
const spacingAttributes = {
  spaceBefore: "margin-top",
  spaceAfter: "margin-bottom",
  indent: "margin-left",
  rightIndent: "margin-right",
  paddingTop: "padding-top",
  paddingRight: "padding-right",
  paddingBottom: "padding-bottom",
  paddingLeft: "padding-left",
} as const;
export const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockGroup"],
        attributes: {
          ...Object.fromEntries(
            Object.entries(spacingAttributes).map(([attribute, css]) => [
              attribute,
              {
                default: null,
                parseHTML: (e: HTMLElement) =>
                  e.style.getPropertyValue(css)
                    ? numeric(parseFloat(e.style.getPropertyValue(css)))
                    : null,
                renderHTML: (a: Record<string, unknown>) =>
                  a[attribute] === null
                    ? {}
                    : { style: `${css}:${numeric(a[attribute])}px` },
              },
            ]),
          ),
          firstLine: {
            default: null,
            parseHTML: (e: HTMLElement) =>
              parseFloat(e.style.textIndent) || null,
            renderHTML: (a: Record<string, unknown>) =>
              a.firstLine === null
                ? {}
                : {
                    style: `text-indent:${Math.max(-120, Math.min(120, Number(a.firstLine) || 0))}px`,
                  },
          },
          lineHeight: {
            default: null,
            parseHTML: (e: HTMLElement) => e.style.lineHeight || null,
            renderHTML: (a: Record<string, unknown>) =>
              a.lineHeight
                ? {
                    style: `line-height:${Math.max(0.8, Math.min(3, Number(a.lineHeight) || 1.6))}`,
                  }
                : {},
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    const indent = (delta: number) => {
      const type = this.editor.isActive("heading") ? "heading" : "paragraph";
      return this.editor.commands.updateAttributes(type, {
        indent: numeric(Number(this.editor.getAttributes(type).indent) + delta),
      });
    };
    return {
      "Mod-]": () => indent(18),
      "Mod-[": () => indent(-18),
      Tab: () =>
        this.editor.isActive("listItem")
          ? this.editor.commands.sinkListItem("listItem")
          : this.editor.isActive("taskItem")
            ? this.editor.commands.sinkListItem("taskItem")
            : this.editor.commands.insertContent("\t"),
      "Shift-Tab": () =>
        this.editor.isActive("listItem")
          ? this.editor.commands.liftListItem("listItem")
          : this.editor.isActive("taskItem")
            ? this.editor.commands.liftListItem("taskItem")
            : indent(-18),
    };
  },
});
export const BlockGroup = Node.create({
  name: "blockGroup",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="blockGroup"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "blockGroup" }),
      0,
    ];
  },
});
