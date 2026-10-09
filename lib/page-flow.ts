import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import type { DocModel } from "./documents";
const key = new PluginKey<DecorationSet>("localPageFlow");
export const PageFlow = Extension.create({
  name: "localPageFlow",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const next = tr.getMeta(key) as Decoration[] | undefined;
            return next
              ? DecorationSet.create(tr.doc, next)
              : value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});
export function updatePageFlow(editor: Editor, model: DocModel) {
  const tokens: { offset: number; length: number; pos: number }[] = [];
  let offset = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText) {
      tokens.push({ offset, length: node.text!.length, pos });
      offset += node.text!.length;
    } else if (node.isBlock || node.isLeaf) {
      tokens.push({ offset, length: 1, pos });
      offset++;
    }
  });
  const positions = new Map<
    number,
    { height: number; targetTop?: number; tag?: string }
  >();
  for (const gap of model.flowGaps) {
    const token = tokens.find(
      (t) => gap.offset >= t.offset && gap.offset < t.offset + t.length,
    );
    if (!token) continue;
    const pos = token.pos + gap.offset - token.offset;
    positions.set(pos, {
      height: (positions.get(pos)?.height || 0) + gap.height,
      targetTop: gap.targetTop,
      tag: gap.tag,
    });
  }
  const decorations = [...positions].map(([pos, { height }]) =>
    Decoration.widget(
      pos,
      () => {
        const spacer = document.createElement("span");
        spacer.className = "editor-flow-spacer";
        spacer.setAttribute("aria-hidden", "true");
        spacer.style.height = `${height}px`;
        return spacer;
      },
      { side: -1, ignoreSelection: true, stopEvent: () => true },
    ),
  );
  editor.view.dispatch(
    editor.state.tr.setMeta(key, decorations).setMeta("addToHistory", false),
  );
  // Node-view wrappers (notably tables) can change CSS margin collapsing.
  // Calibrate only editor spacer heights to the shared model's target coordinates.
  const root = editor.view.dom.getBoundingClientRect();
  if (!editor.view.dom.isConnected || !root.width) return;
  const ratio =
    root.width / parseFloat(getComputedStyle(editor.view.dom).width) || 1;
  const widgets = [
    ...editor.view.dom.querySelectorAll<HTMLElement>(".editor-flow-spacer"),
  ];
  for (const [index, [pos, gap]] of [...positions].entries()) {
    if (gap.tag !== "TABLE" || gap.targetTop == null || !widgets[index])
      continue;
    let top: number;
    if (gap.tag) {
      let dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement && dom.tagName !== gap.tag)
        dom = dom.querySelector(gap.tag.toLowerCase());
      if (!(dom instanceof HTMLElement)) continue;
      top = dom.getBoundingClientRect().top;
    } else top = editor.view.coordsAtPos(pos).top;
    const difference = (top - root.top) / ratio - gap.targetTop;
    if (Math.abs(difference) > 0.1)
      widgets[index].style.height = `${Math.max(0, gap.height - difference)}px`;
  }
}
