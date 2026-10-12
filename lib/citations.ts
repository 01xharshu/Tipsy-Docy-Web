import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

export type CitationStyle = "apa" | "mla" | "chicago-author-date" | "ieee";
export type CitationSource = {
  id: string;
  author: string;
  year: string;
  title: string;
  url: string;
  page: string;
};

export function citationLabel(
  source: CitationSource,
  style: CitationStyle,
  number: number,
) {
  const author = source.author.trim() || "Unknown author";
  const year = source.year.trim() || "n.d.";
  if (style === "ieee") return `[${number}]`;
  if (style === "mla") return `(${author}${source.page.trim() ? ` ${source.page.trim()}` : ""})`;
  return `(${author}, ${year})`;
}

export function bibliographyEntry(
  source: CitationSource,
  style: CitationStyle,
  number: number,
) {
  const author = source.author.trim() || "Unknown author";
  const year = source.year.trim() || "n.d.";
  const title = source.title.trim() || "Untitled source";
  const url = source.url.trim();
  if (style === "mla")
    return `${author}. “${title}.” ${year}.${url ? ` ${url}` : ""}`;
  if (style === "chicago-author-date")
    return `${author}. ${year}. ${title}.${url ? ` ${url}` : ""}`;
  if (style === "ieee")
    return `[${number}] ${author}, “${title},” ${year}.${url ? ` [Online]. Available: ${url}` : ""}`;
  return `${author} (${year}). ${title}.${url ? ` ${url}` : ""}`;
}

export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: "", parseHTML: (e) => e.getAttribute("data-source-id") || "" },
      author: { default: "", parseHTML: (e) => e.getAttribute("data-author") || "" },
      year: { default: "", parseHTML: (e) => e.getAttribute("data-year") || "" },
      title: { default: "", parseHTML: (e) => e.getAttribute("data-title") || "" },
      url: { default: "", parseHTML: (e) => e.getAttribute("data-url") || "" },
      page: { default: "", parseHTML: (e) => e.getAttribute("data-page") || "" },
      style: { default: "apa", parseHTML: (e) => e.getAttribute("data-style") || "apa" },
      number: { default: 1, parseHTML: (e) => Number(e.getAttribute("data-number")) || 1 },
    };
  },
  parseHTML: () => [{ tag: 'span[data-type="citation"]' }],
  renderHTML({ node, HTMLAttributes }) {
    const source = node.attrs as CitationSource;
    const style = node.attrs.style as CitationStyle;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "citation",
        "data-source-id": source.id,
        "data-author": source.author,
        "data-year": source.year,
        "data-title": source.title,
        "data-url": source.url,
        "data-page": source.page,
        "data-style": style,
        "data-number": node.attrs.number,
        class: "document-citation",
        "aria-label": `Citation: ${source.author}, ${source.year}, ${source.title}`,
      }),
      citationLabel(source, style, Number(node.attrs.number) || 1),
    ];
  },
});

export const Bibliography = Node.create({
  name: "bibliography",
  group: "block",
  content: "(heading|paragraph)+",
  isolating: true,
  addAttributes() {
    return {
      id: { default: "", parseHTML: (e) => e.getAttribute("data-bibliography-id") || "" },
      style: { default: "apa", parseHTML: (e) => e.getAttribute("data-style") || "apa" },
    };
  },
  parseHTML: () => [{ tag: 'section[data-type="bibliography"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, {
      "data-type": "bibliography",
      "data-bibliography-id": HTMLAttributes.id,
      class: "document-bibliography",
    }),
    0,
  ],
});

export const CitationBibliography = Extension.create({
  name: "citationBibliography",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const sources = new Map<string, CitationSource>();
          const styles: CitationStyle[] = [];
          const bibliographyPositions: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "citation") {
              const source = node.attrs as CitationSource;
              if (!sources.has(source.id)) sources.set(source.id, source);
              styles.push(node.attrs.style as CitationStyle);
            } else if (node.type.name === "bibliography")
              bibliographyPositions.push(pos);
          });
          if (!bibliographyPositions.length) return null;
          const style = styles[0] || "apa";
          const sourceList = [...sources.values()];
          const paragraphs = [
            state.schema.nodes.heading.create(
              {
                level: 2,
                id: `${state.doc.nodeAt(bibliographyPositions[0])?.attrs.id || "bibliography"}-references`,
              },
              state.schema.text("References"),
            ),
            ...(sourceList.length
            ? sourceList.map((source, index) =>
                state.schema.nodes.paragraph.create(
                  null,
                  state.schema.text(
                    bibliographyEntry(source, style, index + 1),
                  ),
                ),
              )
            : [state.schema.nodes.paragraph.create()]),
          ];
          const tr = state.tr;
          for (const pos of bibliographyPositions.reverse()) {
            const current = state.doc.nodeAt(pos)!;
            const next = state.schema.nodes.bibliography.create(
              { ...current.attrs, id: current.attrs.id || "bibliography", style },
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
