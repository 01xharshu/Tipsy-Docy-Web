"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
export default function StructureControls({ editor }: { editor: Editor }) {
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  function addNote(citation = false) {
    const value = (citation ? source : note).trim();
    if (!value) return;
    let count = 0,
      endnotesPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "endnotes") {
        count = node.childCount;
        endnotesPos = pos;
        return false;
      }
    });
    const id = `note-${crypto.randomUUID()}`,
      number = count + 1;
    const tr = editor.state.tr;
    const marker = editor.schema.text(`[${number}]`, [
      editor.schema.marks.link.create({ href: `#${id}` }),
    ]);
    tr.replaceSelectionWith(marker, false);
    const paragraph = editor.schema.nodes.paragraph.create(
      { id },
      editor.schema.text(`${number}. ${value}`),
    );
    if (endnotesPos >= 0) {
      const mapped = tr.mapping.map(endnotesPos),
        node = tr.doc.nodeAt(mapped)!;
      tr.insert(mapped + node.nodeSize - 1, paragraph);
    } else
      tr.insert(
        tr.doc.content.size,
        editor.schema.nodes.endnotes.create(null, paragraph),
      );
    editor.view.dispatch(tr);
    setNote("");
    setSource("");
  }
  return (
    <fieldset>
      <legend>Document structure</legend>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          let exists = false;
          editor.state.doc.forEach((node) => {
            if (node.type.name === "contents") exists = true;
          });
          if (!exists)
            editor
              .chain()
              .focus()
              .insertContent({
                type: "contents",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Contents" }],
                  },
                ],
              })
              .run();
        }}
      >
        Insert automatic contents
      </button>
      <p className="tiny muted">
        Contents update from headings. Notes and citations appear at the end of
        the document.
      </p>
      <label>
        Endnote
        <textarea
          aria-label="Endnote text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => addNote()}
      >
        Insert endnote
      </button>
      <label>
        Citation
        <input
          aria-label="Citation source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => addNote(true)}
      >
        Insert citation
      </button>
    </fieldset>
  );
}
