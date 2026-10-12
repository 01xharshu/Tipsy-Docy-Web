import { describe, expect, it } from "vitest";
import {
  bibliographyEntry,
  citationLabel,
  type CitationSource,
} from "../lib/citations";
import { Schema } from "@tiptap/pm/model";
import { reviewableTextRange } from "../lib/review";

const source: CitationSource = {
  id: "source-1",
  author: "Ada Lovelace",
  year: "1843",
  title: "Notes on the Analytical Engine",
  url: "https://example.test/notes",
  page: "12",
};

describe("local citation formatting", () => {
  it("formats author-date, MLA page, and IEEE in-text citations", () => {
    expect(citationLabel(source, "apa", 1)).toBe("(Ada Lovelace, 1843)");
    expect(citationLabel(source, "chicago-author-date", 1)).toBe(
      "(Ada Lovelace, 1843)",
    );
    expect(citationLabel(source, "mla", 1)).toBe("(Ada Lovelace 12)");
    expect(citationLabel(source, "ieee", 3)).toBe("[3]");
  });

  it("builds distinct bibliography entries for supported styles", () => {
    expect(bibliographyEntry(source, "apa", 1)).toContain(
      "Ada Lovelace (1843). Notes on the Analytical Engine.",
    );
    expect(bibliographyEntry(source, "mla", 1)).toContain(
      "Ada Lovelace. “Notes on the Analytical Engine.” 1843.",
    );
    expect(bibliographyEntry(source, "chicago-author-date", 1)).toContain(
      "Ada Lovelace. 1843. Notes on the Analytical Engine.",
    );
    expect(bibliographyEntry(source, "ieee", 3)).toContain(
      '[3] Ada Lovelace, “Notes on the Analytical Engine,” 1843.',
    );
  });
});

describe("review selection normalization", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block" },
      text: { group: "inline" },
    },
  });

  it("maps select-all of one paragraph to its editable text positions", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("Review this sentence")),
    ]);
    expect(reviewableTextRange(doc, 0, doc.content.size)).toEqual({
      from: 1,
      to: doc.content.size - 1,
    });
  });

  it("rejects multi-paragraph select-all for inline replacement", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("First paragraph")),
      schema.node("paragraph", null, schema.text("Second paragraph")),
    ]);
    expect(reviewableTextRange(doc, 0, doc.content.size)).toBeNull();
  });
});
