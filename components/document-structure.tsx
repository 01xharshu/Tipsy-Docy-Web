"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import type { CitationStyle } from "@/lib/citations";
export default function StructureControls({ editor }: { editor: Editor }) {
  const [note, setNote] = useState("");
  const [footnote, setFootnote] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [page, setPage] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [columnCount, setColumnCount] = useState(2);
  const [columnGap, setColumnGap] = useState(24);
  const [equation, setEquation] = useState("\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
  function addNote() {
    const value = note.trim();
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
  }
  function addFootnote() {
    const value = footnote.trim();
    if (!value) return;
    let number = 1;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "footnote")
        number = Math.max(number, Number(node.attrs.number) + 1);
    });
    editor
      .chain()
      .focus()
      .insertContent({
        type: "footnote",
        attrs: { id: `footnote-${crypto.randomUUID()}`, number, note: value },
      })
      .run();
    setFootnote("");
  }
  function insertCitation() {
    const cleanAuthor = author.trim();
    const cleanTitle = title.trim();
    if (!cleanAuthor || !cleanTitle) return;
    const id = crypto.randomUUID();
    let number = 1;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "citation") number = Math.max(number, Number(node.attrs.number) + 1);
    });
    editor.chain().focus().insertContent({
      type: "citation",
      attrs: {
        id,
        author: cleanAuthor,
        year: year.trim(),
        title: cleanTitle,
        url: url.trim(),
        page: page.trim(),
        style: citationStyle,
        number,
      },
    }).run();
    setAuthor("");
    setYear("");
    setTitle("");
    setUrl("");
    setPage("");
  }
  function insertBibliography() {
    let exists = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "bibliography") exists = true;
    });
    if (!exists)
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.doc.content.size, {
          type: "bibliography",
          attrs: { id: `bibliography-${crypto.randomUUID()}`, style: citationStyle },
          content: [{ type: "paragraph" }],
        })
        .run();
  }
  function applyCitationStyle(style: CitationStyle) {
    setCitationStyle(style);
    const tr = editor.state.tr;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "citation")
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
    });
    if (tr.docChanged) editor.view.dispatch(tr);
  }
  function applyColumns() {
    if (editor.isActive("columnSection")) {
      editor.commands.updateAttributes("columnSection", {
        count: columnCount,
        gap: columnGap,
      });
      return;
    }
    editor
      .chain()
      .focus()
      .wrapIn("columnSection", { count: columnCount, gap: columnGap })
      .run();
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
        Contents follow headings. Endnotes and the source list update with your citations.
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
        Page footnote
        <textarea
          aria-label="Page footnote text"
          value={footnote}
          onChange={(event) => setFootnote(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        disabled={!footnote.trim()}
        onClick={addFootnote}
      >
        Insert page footnote
      </button>
      <label>
        Citation style
        <select aria-label="Citation style" value={citationStyle} onChange={(event) => applyCitationStyle(event.target.value as CitationStyle)}>
          <option value="apa">APA (author-date)</option>
          <option value="mla">MLA</option>
          <option value="chicago-author-date">Chicago (author-date)</option>
          <option value="ieee">IEEE</option>
        </select>
      </label>
      <label>Author<input aria-label="Citation author" value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
      <label>Year<input aria-label="Citation year" value={year} onChange={(event) => setYear(event.target.value)} /></label>
      <label>Title<input aria-label="Citation title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>URL (optional)<input aria-label="Citation URL" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      {citationStyle === "mla" && <label>Page (optional)<input aria-label="Citation page" value={page} onChange={(event) => setPage(event.target.value)} /></label>}
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        disabled={!author.trim() || !title.trim()}
        onClick={insertCitation}
      >
        Insert source citation
      </button>
      <button className="text-button tiny" onMouseDown={(event) => event.preventDefault()} onClick={insertBibliography}>Insert or update bibliography</button>
      <hr />
      <label>
        Columns
        <select aria-label="Text columns" value={columnCount} onChange={(event) => setColumnCount(Number(event.target.value))}>
          <option value={2}>2 columns</option>
          <option value={3}>3 columns</option>
        </select>
      </label>
      <label>
        Column gap (px)
        <input aria-label="Column gap" type="number" min={0} max={96} value={columnGap} onChange={(event) => setColumnGap(Math.max(0, Math.min(96, Number(event.target.value) || 0)))} />
      </label>
      <button className="button small full" onMouseDown={(event) => event.preventDefault()} onClick={applyColumns}>
        {editor.isActive("columnSection") ? "Update selected columns" : "Format selection in columns"}
      </button>
      <p className="tiny muted">Select paragraphs first, or place the cursor in a paragraph to format that paragraph as a column section.</p>
      <label>
        Equation (LaTeX)
        <textarea
          aria-label="New equation LaTeX source"
          value={equation}
          maxLength={4000}
          onChange={(event) => setEquation(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (equation.trim())
            editor
              .chain()
              .focus()
              .insertContent({
                type: "equation",
                attrs: { formula: equation.trim() },
              })
              .run();
        }}
      >
        Insert equation
      </button>
    </fieldset>
  );
}
