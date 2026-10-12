"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  reviewEntries,
  resolveReview,
  reviewableTextRange,
} from "@/lib/review";

export default function DocumentReview({ editor }: { editor: Editor }) {
  const [note, setNote] = useState("");
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState("");
  const lastSelection = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => {
    const remember = () => {
      const selection = editor.state.selection;
      if (!selection.empty)
        lastSelection.current = reviewableTextRange(
          editor.state.doc,
          selection.from,
          selection.to,
        );
    };
    remember();
    editor.on("selectionUpdate", remember);
    editor.on("transaction", remember);
    return () => {
      editor.off("selectionUpdate", remember);
      editor.off("transaction", remember);
    };
  }, [editor]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      entries: reviewEntries(editor),
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }),
  });
  function add(kind: "comment" | "suggestion") {
    const current = editor.state.selection;
    const remembered = lastSelection.current;
    const selected = !current.empty
      ? reviewableTextRange(editor.state.doc, current.from, current.to)
      : null;
    const range = !current.empty
      ? selected
      : remembered && remembered.to <= editor.state.doc.content.size
        ? remembered
        : null;
    if (!range) {
      setError("Select the text to comment on or replace first.");
      return;
    }
    const { from, to } = range;
    if (editor.state.doc.rangeHasMark(from, to, editor.schema.marks.review)) {
      setError("Resolve the existing review on this text first.");
      return;
    }
    if (kind === "comment" && !note.trim()) {
      setError("Write a comment first.");
      return;
    }
    if (kind === "suggestion" && !replacement.trim()) {
      setError("Enter replacement text first.");
      return;
    }
    const original = editor.state.doc.textBetween(from, to, "\n");
    const attrs = {
      id: crypto.randomUUID(),
      kind,
      note: note.trim(),
      original,
    };
    const tr = editor.state.tr;
    if (kind === "suggestion")
      tr.replaceWith(
        from,
        to,
        editor.schema.text(replacement, [
          editor.schema.marks.review.create(attrs),
        ]),
      );
    else tr.addMark(from, to, editor.schema.marks.review.create(attrs));
    editor.view.dispatch(tr);
    if (kind === "suggestion") lastSelection.current = null;
    setError("");
    setNote("");
    setReplacement("");
  }
  return (
    <fieldset className="review-panel">
      <legend>Comments & suggestions</legend>
      <p className="tiny muted">
        Select document text. Reviews are saved on this device and in project
        backups.
      </p>
      <label>
        Comment
        <textarea
          aria-label="Review comment"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => add("comment")}
      >
        Add comment
      </button>
      <label>
        Suggested replacement
        <input
          aria-label="Suggested replacement"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
      </label>
      <button
        className="button small full"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => add("suggestion")}
      >
        Suggest replacement
      </button>
      {error && (
        <p role="alert" className="tiny">
          {error}
        </p>
      )}
      {state.entries.length === 0 && (
        <p className="tiny muted">No open reviews.</p>
      )}
      {state.entries.map((entry) => (
        <article className="review-card" key={entry.id}>
          <button
            className="button small full"
            onClick={() =>
              editor
                .chain()
                .focus()
                .setTextSelection({ from: entry.from, to: entry.to })
                .scrollIntoView()
                .run()
            }
          >
            {entry.kind === "comment" ? "Comment" : "Suggestion"}:{" "}
            {entry.text.slice(0, 80)}
          </button>
          {entry.note && <p>{entry.note}</p>}
          {entry.kind === "suggestion" && (
            <p className="tiny">Original: {entry.original}</p>
          )}
          <div className="row">
            <button
              className="button small"
              onClick={() => resolveReview(editor, entry)}
            >
              {entry.kind === "comment" ? "Resolve" : "Accept"}
            </button>
            {entry.kind === "suggestion" && (
              <button
                className="button small"
                onClick={() => resolveReview(editor, entry, true)}
              >
                Reject
              </button>
            )}
          </div>
        </article>
      ))}
    </fieldset>
  );
}
