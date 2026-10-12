"use client";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useMemo, useState } from "react";

function EquationView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const formula = String(node.attrs.formula || "x = y");
  const [draft, setDraft] = useState(formula);
  const markup = useMemo(
    () =>
      katex.renderToString(formula, {
        displayMode: true,
        throwOnError: false,
        trust: false,
        strict: "warn",
        output: "htmlAndMathml",
        maxExpand: 500,
        maxSize: 30,
      }),
    [formula],
  );
  return (
    <NodeViewWrapper className="equation-block" data-equation-block="true">
      <div className="equation-tools">
        <span className="tiny muted">Equation · LaTeX</span>
        <button
          type="button"
          className="button small"
          aria-label={editing ? "Preview equation" : "Edit equation"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setDraft(formula);
            if (editing && draft.trim())
              updateAttributes({ formula: draft.trim() });
            setEditing((value) => !value);
          }}
        >
          {editing ? "Preview" : "Edit source"}
        </button>
      </div>
      {editing && (
        <textarea
          className="equation-source"
          aria-label="Equation LaTeX source"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
          onBlur={() => {
            if (draft.trim()) updateAttributes({ formula: draft.trim() });
          }}
        />
      )}
      <div
        className="equation-render"
        aria-label={`Equation: ${formula}`}
        role="img"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <span className="sr-only">LaTeX source: {formula}</span>
    </NodeViewWrapper>
  );
}

export const Equation = Node.create({
  name: "equation",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      formula: {
        default: "x = y",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-formula") || element.textContent || "x = y",
        renderHTML: (attributes: { formula: string }) => ({
          "data-formula": attributes.formula,
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="equation"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const formula = String(node.attrs.formula || "x = y");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "equation",
        "data-formula": formula,
        class: "equation-block",
        role: "math",
        "aria-label": `Equation: ${formula}`,
      }),
      formula,
    ];
  },
  renderText({ node }) {
    return String(node.attrs.formula || "");
  },
  addNodeView() {
    return ReactNodeViewRenderer(EquationView, { as: "div" });
  },
});
