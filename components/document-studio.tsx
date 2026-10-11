"use client";
/* Local data-URL images must stay browser-local. */
import { useEditor, EditorContent } from "@tiptap/react";
import StructureControls from "./document-structure";
import {
  Contents,
  Endnotes,
  DocumentStructure,
} from "@/lib/document-structure";
import DocumentReview from "./document-review";
import { ReviewMark } from "@/lib/review";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Node, Mark, mergeAttributes } from "@tiptap/core";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ImagePlus,
  Link as LinkIcon,
  Table2,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Upload,
  PanelLeftClose,
  PanelRightClose,
  Settings2,
} from "lucide-react";
import type { Project, DocumentSettings } from "@/lib/model";
import { dimensions, SIZES } from "@/lib/model";
import {
  paginate,
  importDocument,
  sanitize,
  type DocModel,
  EDITOR_PAGE_GAP,
} from "@/lib/documents";
import {
  saveDocumentPreset,
  listDocumentPresets,
  deleteDocumentPreset,
} from "@/lib/storage";
import type { Editor } from "@tiptap/react";
import { ParagraphLayout, BlockGroup } from "@/lib/editor-layout";
import { closeHistory } from "@tiptap/pm/history";
import { PageFlow, updatePageFlow } from "@/lib/page-flow";
const Superscript = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML() {
    return [{ tag: "sup" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", HTMLAttributes, 0];
  },
});
const Subscript = Mark.create({
  name: "subscript",
  excludes: "superscript",
  parseHTML() {
    return [{ tag: "sub" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sub", HTMLAttributes, 0];
  },
});
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-type="pageBreak"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "pageBreak",
        class: "document-page-break",
      }),
      "Page break",
    ];
  },
});
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 240,
        parseHTML: (e) => Number(e.getAttribute("width")) || 240,
        renderHTML: (a) => ({ width: a.width }),
      },
      alignment: {
        default: "left",
        renderHTML: (a) => ({
          style: `display:block;margin-left:${a.alignment === "left" ? "0" : "auto"};margin-right:${a.alignment === "right" ? "0" : "auto"}`,
        }),
      },
    };
  },
});
export type DocumentApi = {
  model: () => DocModel | null;
  editor: () => Editor | null;
  print: () => void;
};
export default function DocumentStudio({
  project: p,
  change,
  report,
  apiRef,
}: {
  project: Project;
  change: (p: Project) => void;
  report: (s: string) => void;
  apiRef: React.MutableRefObject<DocumentApi | null>;
}) {
  useEffect(() => {
    if (window.innerWidth < 600) setZoom(0.5);
  }, []);
  const [customPresets, setCustomPresets] = useState<
    { name: string; settings: DocumentSettings }[]
  >([]);
  useEffect(() => {
    void listDocumentPresets()
      .then(setCustomPresets)
      .catch(() => {});
  }, []);
  const [model, setModel] = useState<DocModel | null>(null),
    [zoom, setZoom] = useState(0.65),
    [showEditor, setShowEditor] = useState(true),
    [showPreview, setShowPreview] = useState(true),
    [showSettings, setShowSettings] = useState(false),
    [split, setSplit] = useState(50),
    [editZoom, setEditZoom] = useState(1),
    [showBoundaries, setShowBoundaries] = useState(false),
    [showFind, setShowFind] = useState(false),
    [findText, setFindText] = useState(""),
    [replaceText, setReplaceText] = useState("");
  const measure = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    image = useRef<HTMLInputElement>(null),
    modelRef = useRef<DocModel | null>(null),
    pRef = useRef(p);
  pRef.current = p;
  const changeRef = useRef(change);
  changeRef.current = change;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["https", "http", "mailto"] },
      }),
      Contents,
      Endnotes,
      DocumentStructure,
      ReviewMark,
      Superscript,
      Subscript,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      PageFlow,
      BlockGroup,
      ParagraphLayout,
      PageBreak,
    ],
    content: sanitize(p.html),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          ["f", "h"].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          setShowFind(true);
          return true;
        }
        return false;
      },
      attributes: {
        class: "document-content",
        spellcheck: "true",
        "aria-label": "Document editor",
      },
      transformPastedHTML: sanitize,
    },
    onUpdate: ({ editor }) => {
      changeRef.current({ ...pRef.current, html: editor.getHTML() });
    },
  });
  // ProseMirror owns active editing state. External undo/redo is applied explicitly
  // by the workspace; echoing every React snapshot back into the editor races typing.
  const recompute = useCallback(() => {
    if (!measure.current || window.matchMedia("print").matches) return;
    try {
      const next = paginate(measure.current, pRef.current.doc);
      modelRef.current = next;
      setModel(next);
      if (editor && !editor.isDestroyed) updatePageFlow(editor, next);
    } catch (e) {
      report(String(e));
    }
  }, [report, editor]);
  useEffect(() => {
    const timer = setTimeout(recompute, 250);
    void document.fonts.ready.then(recompute);
    return () => clearTimeout(timer);
  }, [p.html, p.doc, recompute, showEditor]);
  useEffect(() => {
    const observer = new ResizeObserver(recompute);
    if (measure.current) observer.observe(measure.current);
    return () => observer.disconnect();
  }, [recompute]);
  function print() {
    const m = paginate(measure.current!, pRef.current.doc);
    modelRef.current = m;
    setModel(m);
    document.documentElement.style.setProperty("--print-width", `${m.width}pt`);
    document.documentElement.style.setProperty(
      "--print-height",
      `${m.height}pt`,
    );
    let style = document.getElementById("print-page-size");
    if (!style) {
      style = document.createElement("style");
      style.id = "print-page-size";
      document.head.appendChild(style);
    }
    style.textContent = `@page {size:${m.width}pt ${m.height}pt;margin:0;}`;
    setShowPreview(true);
    setTimeout(() => window.print(), 150);
  }
  useImperativeHandle(apiRef, () => ({
    model: () => {
      if (measure.current) {
        const m = paginate(measure.current, pRef.current.doc);
        modelRef.current = m;
        return m;
      }
      return modelRef.current;
    },
    editor: () => editor,
    print,
  }));
  const doc = (patch: Partial<DocumentSettings>) =>
    change({ ...p, doc: { ...p.doc, ...patch } });
  const [width, height] = dimensions(p.doc);
  const contentWidth = width - 2 * p.doc.margin;
  const paragraphType = editor?.isActive("heading") ? "heading" : "paragraph";
  const paragraphAttrs = editor?.getAttributes(paragraphType) || {};
  const blockAttrs = editor?.getAttributes("blockGroup") || {};
  function spacingControl(
    label: string,
    attribute: string,
    group = false,
    fallback = 0,
  ) {
    const type = group ? "blockGroup" : paragraphType;
    const attrs = group ? blockAttrs : paragraphAttrs;
    return (
      <label className="field" key={label}>
        {label} (pt)
        <input
          aria-label={label}
          type="number"
          min={attribute === "firstLine" ? -120 : 0}
          max={240}
          value={
            attrs[attribute] == null
              ? fallback
              : parseFloat(attrs[attribute]) || 0
          }
          disabled={group && !editor?.isActive("blockGroup")}
          onChange={(e) => {
            editor
              ?.chain()
              .updateAttributes(type, { [attribute]: Number(e.target.value) })
              .run();
          }}
        />
      </label>
    );
  }
  function rulerHandle(
    attribute: "indent" | "rightIndent" | "firstLine",
    label: string,
  ) {
    const value = Number(paragraphAttrs[attribute]) || 0;
    const max = Math.min(240, contentWidth - 60);
    const min = attribute === "firstLine" ? -120 : 0;
    const position =
      attribute === "rightIndent"
        ? contentWidth - value
        : value +
          (attribute === "firstLine" ? Number(paragraphAttrs.indent) || 0 : 0);
    const set = (n: number) =>
      editor?.commands.updateAttributes(paragraphType, {
        [attribute]: Math.max(min, Math.min(max, Math.round(n))),
      });
    return (
      <button
        key={attribute}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-orientation="horizontal"
        title={`${label}: ${value} pt. Drag or use arrow keys.`}
        className={`ruler-handle ${attribute}`}
        style={{ left: p.doc.margin + position }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            set(
              value + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1),
            );
          }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (editor) editor.view.dispatch(closeHistory(editor.state.tr));
          e.currentTarget.setPointerCapture(e.pointerId);
          const target = e.currentTarget,
            start = e.clientX;
          const ratio =
            target.parentElement!.getBoundingClientRect().width / width;
          const move = (event: PointerEvent) =>
            set(
              value +
                ((event.clientX - start) / ratio) *
                  (attribute === "rightIndent" ? -1 : 1),
            );
          const end = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", end);
            target.removeEventListener("pointercancel", end);
            if (editor) editor.view.dispatch(closeHistory(editor.state.tr));
            editor?.view.focus();
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", end);
          target.addEventListener("pointercancel", end);
        }}
      />
    );
  }
  function matches() {
    const found: { from: number; to: number }[] = [];
    if (!editor || !findText) return found;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const text = node.textBetween(0, node.content.size, "", "\ufffc");
      let offset = 0;
      while ((offset = text.indexOf(findText, offset)) !== -1) {
        found.push({
          from: pos + 1 + offset,
          to: pos + 1 + offset + findText.length,
        });
        offset += findText.length;
      }
      return false;
    });
    return found;
  }
  const found = matches();
  function findNext() {
    const next =
      found.find((m) => m.from >= (editor?.state.selection.to || 0)) ||
      found[0];
    if (next) {
      editor?.chain().setTextSelection(next).scrollIntoView().run();
      editor?.view.focus();
    }
  }
  function replace(all: boolean) {
    if (!editor || !found.length) return;
    const selection = editor.state.selection;
    const current =
      found.find((m) => m.from === selection.from && m.to === selection.to) ||
      found[0];
    const tr = closeHistory(editor.state.tr);
    for (const m of (all ? found : [current]).slice().reverse()) {
      if (replaceText)
        tr.replaceWith(
          m.from,
          m.to,
          editor.schema.text(
            replaceText,
            editor.state.doc.resolve(m.from).marks(),
          ),
        );
      else tr.delete(m.from, m.to);
    }
    editor.view.dispatch(tr);
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.view.focus();
  }
  const action = (
    name: string,
    icon: React.ReactNode,
    fn: () => void,
    active = false,
  ) => (
    <button
      key={name}
      className={`icon-button ${active ? "active" : ""}`}
      title={name}
      aria-label={name}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        fn();
        editor?.view.focus();
      }}
    >
      {icon}
    </button>
  );
  async function load(f: File) {
    try {
      report(`Importing ${f.name}…`);
      const result = await importDocument(f);
      if (editor) {
        editor.view.dispatch(closeHistory(editor.state.tr));
        editor.commands.setContent(result.html);
        editor.view.dispatch(closeHistory(editor.state.tr));
      }
      change({
        ...p,
        title: f.name.replace(/\.[^.]+$/, ""),
        html: result.html,
      });
      report(
        result.warnings.length
          ? `Imported with ${result.warnings.length} formatting notice(s): ${result.warnings.slice(0, 2).join(" ")}`
          : "Document imported. Review formatting before export.",
      );
    } catch (e) {
      report(e instanceof Error ? e.message : "Import failed.");
    }
  }
  return (
    <div
      className="document-workspace"
      role="main"
      id="main-content"
      aria-label="Document Studio"
    >
      <h1 className="sr-only">Document Studio</h1>
      <div className="document-toolbar">
        <div className="row toolbar-group">
          <button
            className="button small"
            onClick={() => file.current?.click()}
          >
            <Upload size={14} /> Import
          </button>
          <input
            ref={file}
            hidden
            type="file"
            accept=".docx,.txt,.html,.htm"
            onChange={(e) => {
              if (e.target.files?.[0]) void load(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <select
            aria-label="Paragraph style"
            value={
              editor?.isActive("heading")
                ? `h${editor.getAttributes("heading").level}`
                : "p"
            }
            onChange={(e) => {
              if (e.target.value === "p")
                editor?.chain().focus().setParagraph().run();
              else
                editor
                  ?.chain()
                  .focus()
                  .setHeading({
                    level: Number(e.target.value.slice(1)) as
                      1 | 2 | 3 | 4 | 5 | 6,
                  })
                  .run();
            }}
          >
            <option value="p">Normal text</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={`h${n}`}>
                Heading {n}
              </option>
            ))}
          </select>
          <select
            aria-label="Font family"
            onChange={(e) =>
              editor?.chain().focus().setFontFamily(e.target.value).run()
            }
            value={editor?.getAttributes("textStyle").fontFamily || "Arial"}
          >
            <option>Arial</option>
            <option value="Docy Devanagari">Noto Devanagari</option>
            <option value="Docy Arabic">Noto Arabic</option>
            <option>Georgia</option>
            <option>Times New Roman</option>
            <option>Courier New</option>
            <option>Verdana</option>
          </select>
          <select
            aria-label="Font size"
            onChange={(e) =>
              editor?.chain().focus().setFontSize(`${e.target.value}px`).run()
            }
            value={parseFloat(
              editor?.getAttributes("textStyle").fontSize || "12",
            )}
          >
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="row toolbar-group">
          {action(
            "Bold",
            <Bold size={16} />,
            () => {
              editor?.chain().focus().toggleBold().run();
            },
            editor?.isActive("bold"),
          )}
          {action(
            "Italic",
            <Italic size={16} />,
            () => {
              editor?.chain().focus().toggleItalic().run();
            },
            editor?.isActive("italic"),
          )}
          {action(
            "Underline",
            <Underline size={16} />,
            () => {
              editor?.chain().focus().toggleUnderline().run();
            },
            editor?.isActive("underline"),
          )}
          {action(
            "Strikethrough",
            <Strikethrough size={16} />,
            () => {
              editor?.chain().focus().toggleStrike().run();
            },
            editor?.isActive("strike"),
          )}
          {action(
            "Superscript",
            <span>x²</span>,
            () => {
              editor?.chain().focus().toggleMark("superscript").run();
            },
            editor?.isActive("superscript"),
          )}
          {action(
            "Subscript",
            <span>x₂</span>,
            () => {
              editor?.chain().focus().toggleMark("subscript").run();
            },
            editor?.isActive("subscript"),
          )}
          <label className="toolbar-color" title="Text color">
            A
            <input
              aria-label="Text color"
              type="color"
              defaultValue="#20251f"
              onChange={(e) =>
                editor?.chain().focus().setColor(e.target.value).run()
              }
            />
          </label>
          <label className="toolbar-color highlight" title="Highlight color">
            H
            <input
              aria-label="Highlight color"
              type="color"
              defaultValue="#fef08a"
              onChange={(e) =>
                editor
                  ?.chain()
                  .focus()
                  .setHighlight({ color: e.target.value })
                  .run()
              }
            />
          </label>
        </div>
        <div className="row toolbar-group">
          {(["left", "center", "right", "justify"] as const).map((a, i) =>
            action(
              `Align ${a}`,
              [
                <AlignLeft key={a} size={16} />,
                <AlignCenter key={a} size={16} />,
                <AlignRight key={a} size={16} />,
                <AlignJustify key={a} size={16} />,
              ][i],
              () => {
                editor?.chain().focus().setTextAlign(a).run();
              },
              editor?.isActive({ textAlign: a }),
            ),
          )}
          {action("Bullet list", <List size={16} />, () => {
            editor?.chain().focus().toggleBulletList().run();
          })}
          {action("Numbered list", <ListOrdered size={16} />, () => {
            editor?.chain().focus().toggleOrderedList().run();
          })}
          {action("Checklist", <ListChecks size={16} />, () => {
            editor?.chain().focus().toggleTaskList().run();
          })}
        </div>
        <div className="row toolbar-group">
          {action("Insert table", <Table2 size={16} />, () => {
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run();
          })}
          {action("Insert image", <ImagePlus size={16} />, () =>
            image.current?.click(),
          )}
          {action("Insert link", <LinkIcon size={16} />, () => {
            const href = prompt("Link URL (https://, http://, or mailto:)");
            if (href === null) return;
            if (!href) {
              editor?.chain().focus().unsetLink().run();
              return;
            }
            if (!/^(https?:\/\/|mailto:)/i.test(href)) {
              report("Use an https://, http://, or mailto: link.");
              return;
            }
            editor?.chain().focus().setLink({ href }).run();
          })}
          {action("Blockquote", <Quote size={16} />, () => {
            editor?.chain().focus().toggleBlockquote().run();
          })}
          {action("Divider", <Minus size={16} />, () => {
            editor?.chain().focus().setHorizontalRule().run();
          })}
          {action("Undo text", <Undo2 size={16} />, () => {
            editor?.chain().focus().undo().run();
          })}
          {action("Redo text", <Redo2 size={16} />, () => {
            editor?.chain().focus().redo().run();
          })}
          <button
            className="icon-button"
            aria-label="Document settings"
            title="Document settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 size={17} />
          </button>
        </div>
        <input
          ref={image}
          hidden
          type="file"
          accept="image/png,image/jpeg"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!["image/png", "image/jpeg"].includes(f.type)) {
              report("Use a PNG or JPEG image.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () =>
              editor
                ?.chain()
                .focus()
                .setImage({ src: String(reader.result), alt: f.name })
                .run();
            reader.readAsDataURL(f);
            e.target.value = "";
          }}
        />
      </div>
      {showFind && (
        <div
          className="document-find"
          role="search"
          aria-label="Find and replace"
        >
          <label>
            Find{" "}
            <input
              autoFocus
              aria-label="Find text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") findNext();
                if (e.key === "Escape") setShowFind(false);
              }}
            />
          </label>
          <label>
            Replace{" "}
            <input
              aria-label="Replacement text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
          </label>
          <span className="tiny" role="status">
            {found.length} matches
          </span>
          <button
            className="button small"
            disabled={!found.length}
            onClick={findNext}
          >
            Find next
          </button>
          <button
            className="button small"
            disabled={!found.length}
            onClick={() => replace(false)}
          >
            Replace
          </button>
          <button
            className="button small"
            disabled={!found.length}
            onClick={() => replace(true)}
          >
            Replace all
          </button>
          <button
            className="text-button tiny"
            onClick={() => setShowFind(false)}
          >
            Close find
          </button>
        </div>
      )}
      <div className="document-subbar">
        <button
          className="text-button tiny"
          onClick={() => setShowFind(!showFind)}
        >
          Find & replace
        </button>
        <div className="row">
          <button
            className="text-button tiny"
            onClick={() => {
              if (showEditor && !showPreview) setShowPreview(true);
              setShowEditor(!showEditor);
            }}
          >
            <PanelLeftClose size={14} /> {showEditor ? "Hide" : "Show"} editor
          </button>
          <button
            className="text-button tiny"
            onClick={() => {
              if (showPreview && !showEditor) setShowEditor(true);
              setShowPreview(!showPreview);
            }}
          >
            <PanelRightClose size={14} /> {showPreview ? "Hide" : "Show"}{" "}
            preview
          </button>
        </div>
      </div>
      <div className="document-body">
        {showEditor && (
          <section
            className="editor-panel"
            style={{ flexBasis: showPreview ? `${split}%` : "100%" }}
          >
            <div className="panel-heading">
              <h2>Your document</h2>
              <label className="row tiny">
                Editor zoom
                <select
                  aria-label="Editor zoom"
                  value={editZoom}
                  onChange={(e) => setEditZoom(Number(e.target.value))}
                >
                  {[0.5, 0.65, 0.75, 1, 1.25, 1.5].map((z) => (
                    <option key={z} value={z}>
                      {Math.round(z * 100)}%
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="editor-scroll">
              <div className="editor-sheet" style={{ width, zoom: editZoom }}>
                <div
                  className="document-ruler"
                  aria-label="Document ruler in points"
                  style={{ width }}
                >
                  <div
                    className="ruler-margin"
                    style={{ width: p.doc.margin }}
                  />
                  <div
                    className="ruler-ticks"
                    style={{ left: p.doc.margin, right: p.doc.margin }}
                  >
                    {Array.from(
                      { length: Math.floor(contentWidth / 36) + 1 },
                      (_, i) => (
                        <span key={i} style={{ left: i * 36 }}>
                          {i * 36}
                        </span>
                      ),
                    )}
                  </div>
                  <div
                    className="ruler-margin"
                    style={{ right: 0, width: p.doc.margin }}
                  />
                  {rulerHandle("indent", "Ruler left indent")}
                  {rulerHandle("firstLine", "Ruler first line indent")}
                  {rulerHandle("rightIndent", "Ruler right indent")}
                </div>
                <div
                  className="editor-paper"
                  style={{
                    width: width,
                    minHeight:
                      (model?.pages.length || 1) * height +
                      ((model?.pages.length || 1) - 1) * EDITOR_PAGE_GAP,
                    position: "relative",
                    padding: p.doc.margin,
                    background: p.doc.background,
                  }}
                >
                  <div
                    className={`editor-text-area${showBoundaries ? " editor-text-boundaries" : ""}`}
                    style={{ minHeight: height - 2 * p.doc.margin }}
                  >
                    <EditorContent editor={editor} />
                  </div>
                  {Array.from(
                    { length: Math.max(0, (model?.pages.length || 1) - 1) },
                    (_, i) => (
                      <div
                        className="editor-page-cut"
                        aria-hidden="true"
                        key={i}
                        style={{
                          top: (i + 1) * height + i * EDITOR_PAGE_GAP,
                          height: EDITOR_PAGE_GAP,
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
        {showEditor && showPreview && (
          <div
            className="split-handle"
            role="separator"
            aria-label="Resize editor and preview"
            aria-valuenow={split}
            aria-valuemin={25}
            aria-valuemax={75}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setSplit(Math.max(25, split - 5));
              if (e.key === "ArrowRight") setSplit(Math.min(75, split + 5));
            }}
            onPointerDown={(e) => {
              const parent = e.currentTarget.parentElement!,
                rect = parent.getBoundingClientRect();
              e.currentTarget.setPointerCapture(e.pointerId);
              const move = (event: PointerEvent) =>
                setSplit(
                  Math.min(
                    75,
                    Math.max(
                      25,
                      ((event.clientX - rect.left) / rect.width) * 100,
                    ),
                  ),
                );
              const target = e.currentTarget;
              const up = () => {
                target.removeEventListener("pointermove", move);
              };
              target.addEventListener("pointermove", move);
              target.addEventListener("pointerup", up, { once: true });
            }}
          />
        )}
        {showPreview && (
          <section className="document-preview">
            <div className="panel-heading">
              <h2>Live page preview</h2>
              <div className="row">
                <button
                  className="icon-button"
                  aria-label="Zoom document out"
                  onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}
                >
                  −
                </button>
                <span className="tiny">{Math.round(zoom * 100)}%</span>
                <button
                  className="icon-button"
                  aria-label="Zoom document in"
                  onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                >
                  +
                </button>
              </div>
            </div>
            <div
              className="document-preview-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable document page preview"
            >
              {model?.pages.map((pg, i) => (
                <div
                  className="doc-preview-wrap"
                  key={i}
                  style={{
                    width: model.width * zoom,
                    height: model.height * zoom,
                  }}
                >
                  <div
                    className="doc-preview-page"
                    data-testid="document-preview-page"
                    style={{
                      width: model.width,
                      height: model.height,
                      transform: `scale(${zoom})`,
                      background: model.background,
                    }}
                  >
                    <svg
                      width={model.width}
                      height={model.height}
                      className="document-page-graphics"
                      style={{
                        position: "absolute",
                        inset: 0,
                        overflow: "visible",
                      }}
                    >
                      <text
                        x={model.margin}
                        y={Math.max(14, model.margin / 2)}
                        fontSize={9}
                        fontFamily="Arial"
                        fill="#64748b"
                      >
                        {model.header}
                      </text>
                      {pg.boxes.map((b, j) => (
                        <rect
                          key={`b${j}`}
                          x={b.x}
                          y={b.y}
                          width={b.width}
                          height={b.height}
                          fill={b.fill || "none"}
                          stroke={b.color}
                          strokeWidth={0.5}
                        />
                      ))}
                      {pg.text.map((t, j) => (
                        <g key={j}>
                          {t.highlight !== "transparent" &&
                            t.highlight !== "rgba(0, 0, 0, 0)" && (
                              <rect
                                x={t.x}
                                y={t.y}
                                width={t.width}
                                height={t.height}
                                fill={t.highlight}
                              />
                            )}
                          <text
                            x={t.x}
                            y={t.y + t.size * 0.83}
                            fontSize={t.size}
                            fontFamily={t.font}
                            fontWeight={t.bold ? 700 : 400}
                            fontStyle={t.italic ? "italic" : "normal"}
                            fill={t.color}
                            style={{ whiteSpace: "pre" }}
                          >
                            {t.text}
                          </text>
                          {(t.underline || t.strike) && (
                            <line
                              x1={t.x}
                              x2={t.x + t.width}
                              y1={t.y + t.size * (t.strike ? 0.45 : 1)}
                              y2={t.y + t.size * (t.strike ? 0.45 : 1)}
                              stroke={t.color}
                              strokeWidth={0.5}
                            />
                          )}
                        </g>
                      ))}
                      <text
                        x={model.margin}
                        y={model.height - Math.max(14, model.margin / 2)}
                        fontSize={9}
                        fontFamily="Arial"
                        fill="#64748b"
                      >
                        {model.footer}
                      </text>
                      {model.numbers && (
                        <text
                          x={model.width - model.margin}
                          y={model.height - Math.max(14, model.margin / 2)}
                          textAnchor="end"
                          fontSize={9}
                          fontFamily="Arial"
                          fill="#64748b"
                        >
                          {i + 1}
                        </text>
                      )}
                    </svg>
                    {pg.images.map((img, j) => (
                      <img
                        key={j}
                        src={img.src}
                        alt="Document illustration"
                        style={{
                          position: "absolute",
                          left: img.x,
                          top: img.y,
                          width: img.width,
                          height: img.height,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {showSettings && (
          <aside className="properties document-properties">
            <h2>Document settings</h2>
            {editor && <DocumentReview editor={editor} />}
            {editor && <StructureControls editor={editor} />}
            <fieldset>
              <legend>Page setup</legend>
              {customPresets.length > 0 && (
                <label className="field">
                  Your presets
                  <select
                    aria-label="Custom document presets"
                    defaultValue=""
                    onChange={(e) => {
                      const preset = customPresets.find(
                        (v) => v.name === e.target.value,
                      );
                      if (preset) doc(preset.settings);
                    }}
                  >
                    <option value="" disabled>
                      Choose saved preset
                    </option>
                    {customPresets.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="button small full"
                onClick={async () => {
                  const name = prompt("Save current page setup as a preset");
                  if (!name?.trim()) return;
                  try {
                    await saveDocumentPreset(name.trim(), p.doc);
                    setCustomPresets(await listDocumentPresets());
                    report("Page preset saved on this device.");
                  } catch {
                    report(
                      "Could not save preset. Local storage may be unavailable.",
                    );
                  }
                }}
              >
                Save page preset
              </button>
              {customPresets.length > 0 && (
                <button
                  className="text-button tiny"
                  onClick={async () => {
                    const name = prompt("Preset name to delete");
                    if (!name) return;
                    try {
                      await deleteDocumentPreset(name);
                      setCustomPresets(await listDocumentPresets());
                    } catch {
                      report("Could not delete preset.");
                    }
                  }}
                >
                  Delete saved preset
                </button>
              )}

              <label className="field">
                Preset
                <select
                  aria-label="Document preset"
                  onChange={(e) => {
                    if (e.target.value === "report")
                      doc({
                        size: "A4",
                        width: SIZES.A4[0],
                        height: SIZES.A4[1],
                        margin: 56.693,
                        header: p.title,
                        numbers: true,
                      });
                    else if (e.target.value === "letter")
                      doc({
                        size: "Letter",
                        width: 612,
                        height: 792,
                        margin: 54,
                        header: "",
                        numbers: false,
                      });
                    else
                      doc({
                        size: "A5",
                        width: SIZES.A5[0],
                        height: SIZES.A5[1],
                        margin: 36,
                        header: "",
                        numbers: true,
                      });
                  }}
                  defaultValue="report"
                >
                  <option value="report">Report</option>
                  <option value="letter">Letter</option>
                  <option value="booklet">Booklet</option>
                </select>
              </label>
              <label className="field">
                Paper size
                <select
                  value={p.doc.size}
                  onChange={(e) => {
                    const s = SIZES[e.target.value];
                    doc({
                      size: e.target.value,
                      ...(s ? { width: s[0], height: s[1] } : {}),
                    });
                  }}
                >
                  {Object.keys(SIZES).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                  <option>Custom</option>
                </select>
              </label>
              {p.doc.size === "Custom" && (
                <div className="two-fields">
                  {(["width", "height"] as const).map((k) => (
                    <label className="field" key={k}>
                      {k} (pt)
                      <input
                        type="number"
                        min={144}
                        value={p.doc[k]}
                        onChange={(e) =>
                          doc({ [k]: Math.max(144, +e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <label className="field">
                Orientation
                <select
                  value={String(p.doc.landscape)}
                  onChange={(e) =>
                    doc({ landscape: e.target.value === "true" })
                  }
                >
                  <option value="false">Portrait</option>
                  <option value="true">Landscape</option>
                </select>
              </label>
              <label className="field">
                Margins (mm)
                <input
                  aria-label="Document margins"
                  type="number"
                  min={5}
                  max={70}
                  value={Math.round((p.doc.margin / 72) * 25.4 * 10) / 10}
                  onChange={(e) =>
                    doc({
                      margin:
                        (Math.max(5, Math.min(70, +e.target.value)) * 72) /
                        25.4,
                    })
                  }
                />
              </label>
              <label className="field color-field">
                Page color
                <input
                  type="color"
                  value={p.doc.background}
                  onChange={(e) => doc({ background: e.target.value })}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Headers & footers</legend>
              <label className="field">
                Header
                <input
                  value={p.doc.header}
                  onChange={(e) => doc({ header: e.target.value })}
                />
              </label>
              <label className="field">
                Footer
                <input
                  value={p.doc.footer}
                  onChange={(e) => doc({ footer: e.target.value })}
                />
              </label>
              <label className="row tiny">
                <input
                  type="checkbox"
                  checked={p.doc.numbers}
                  onChange={(e) => doc({ numbers: e.target.checked })}
                />{" "}
                Page numbers
              </label>
            </fieldset>
            <fieldset>
              <legend>Paragraph formatting</legend>
              <label className="field">
                Line height
                <select
                  aria-label="Line height"
                  onChange={(e) => {
                    const type = editor?.isActive("heading")
                      ? "heading"
                      : "paragraph";
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes(type, { lineHeight: e.target.value })
                      .run();
                  }}
                  value={paragraphAttrs.lineHeight || "1.6"}
                >
                  {[1, 1.15, 1.3, 1.5, 1.6, 1.8, 2].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {spacingControl("Space before", "spaceBefore")}
              {spacingControl("Space after", "spaceAfter", false, 8)}
              {spacingControl("Left margin", "indent")}
              {spacingControl("Right margin", "rightIndent")}
              {spacingControl("First line indent", "firstLine")}
              <div className="two-fields">
                {spacingControl("Paragraph padding top", "paddingTop")}
                {spacingControl("Paragraph padding bottom", "paddingBottom")}
                {spacingControl("Paragraph padding left", "paddingLeft")}
                {spacingControl("Paragraph padding right", "paddingRight")}
              </div>
              <fieldset className="nup-border-settings">
                <legend>N-up page borders</legend>
                <p className="tiny muted">
                  Outline each placed document page after Arrange Pages. These
                  settings carry into PDF Studio and PDF export.
                </p>
                <label className="row tiny">
                  <input
                    aria-label="N-up page borders"
                    type="checkbox"
                    checked={p.layout.borders}
                    onChange={(event) =>
                      change({
                        ...p,
                        layout: { ...p.layout, borders: event.target.checked },
                      })
                    }
                  />{" "}
                  Show a border around each page
                </label>
                {p.layout.borders && (
                  <div className="two-fields">
                    <label className="field">
                      Border color
                      <input
                        aria-label="N-up border color"
                        type="color"
                        value={p.layout.borderColor}
                        onChange={(event) =>
                          change({
                            ...p,
                            layout: {
                              ...p.layout,
                              borderColor: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Border width (pt)
                      <input
                        aria-label="N-up border width"
                        type="number"
                        min="0.25"
                        max="12"
                        step="0.25"
                        value={p.layout.borderWidth}
                        onChange={(event) =>
                          change({
                            ...p,
                            layout: {
                              ...p.layout,
                              borderWidth: Math.max(
                                0.25,
                                Math.min(
                                  12,
                                  Number(event.target.value) || 0.25,
                                ),
                              ),
                            },
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Border style
                      <select
                        aria-label="N-up border style"
                        value={p.layout.borderStyle}
                        onChange={(event) =>
                          change({
                            ...p,
                            layout: {
                              ...p.layout,
                              borderStyle: event.target
                                .value as typeof p.layout.borderStyle,
                            },
                          })
                        }
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </label>
                  </div>
                )}
              </fieldset>
              <label className="row tiny">
                <input
                  type="checkbox"
                  checked={showBoundaries}
                  onChange={(e) => setShowBoundaries(e.target.checked)}
                />{" "}
                Show text boundaries
              </label>
              <button
                className="button small full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor
                    ?.chain()
                    .focus()
                    .unsetAllMarks()
                    .resetAttributes(paragraphType, [
                      "lineHeight",
                      "spaceBefore",
                      "spaceAfter",
                      "indent",
                      "rightIndent",
                      "firstLine",
                      "paddingTop",
                      "paddingRight",
                      "paddingBottom",
                      "paddingLeft",
                      "textAlign",
                    ])
                    .run();
                  editor?.view.focus();
                }}
              >
                Clear formatting
              </button>
              <div className="row">
                <button
                  className="button small"
                  onClick={() => {
                    const t = editor?.isActive("heading")
                      ? "heading"
                      : "paragraph";
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes(t, {
                        indent: Math.max(
                          0,
                          (Number(editor.getAttributes(t).indent) || 0) - 18,
                        ),
                      })
                      .run();
                  }}
                >
                  Outdent
                </button>
                <button
                  className="button small"
                  onClick={() => {
                    const t = editor?.isActive("heading")
                      ? "heading"
                      : "paragraph";
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes(t, {
                        indent:
                          (Number(editor.getAttributes(t).indent) || 0) + 18,
                      })
                      .run();
                  }}
                >
                  Indent
                </button>
              </div>
              <button
                className="button full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor
                    ?.chain()
                    .focus()
                    .insertContent([
                      { type: "pageBreak" },
                      { type: "paragraph" },
                    ])
                    .run();
                  editor?.view.focus();
                }}
              >
                Insert page break
              </button>
            </fieldset>
            <fieldset>
              <legend>Document blocks</legend>
              <p className="tiny muted">
                Group selected paragraphs into a block. Block margins sit
                outside its content; padding adds space inside.
              </p>
              <div className="row">
                <button
                  className="button small"
                  disabled={!editor?.can().wrapIn("blockGroup")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor?.chain().focus().wrapIn("blockGroup").run();
                    editor?.view.focus();
                  }}
                >
                  Group into block
                </button>
                <button
                  className="button small"
                  disabled={!editor?.isActive("blockGroup")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor?.chain().focus().lift("blockGroup").run();
                    editor?.view.focus();
                  }}
                >
                  Ungroup block
                </button>
              </div>
              <div className="two-fields">
                {spacingControl("Block margin top", "spaceBefore", true)}
                {spacingControl("Block margin bottom", "spaceAfter", true)}
                {spacingControl("Block margin left", "indent", true)}
                {spacingControl("Block margin right", "rightIndent", true)}
                {spacingControl("Block padding top", "paddingTop", true)}
                {spacingControl("Block padding bottom", "paddingBottom", true)}
                {spacingControl("Block padding left", "paddingLeft", true)}
                {spacingControl("Block padding right", "paddingRight", true)}
              </div>
            </fieldset>
            <fieldset>
              <legend>Table controls</legend>
              <p className="tiny muted">Place your cursor in a table first.</p>
              <div className="table-controls">
                {[
                  [
                    "Add row",
                    () => editor?.chain().focus().addRowAfter().run(),
                  ],
                  [
                    "Add column",
                    () => editor?.chain().focus().addColumnAfter().run(),
                  ],
                  [
                    "Delete row",
                    () => editor?.chain().focus().deleteRow().run(),
                  ],
                  [
                    "Delete column",
                    () => editor?.chain().focus().deleteColumn().run(),
                  ],
                  [
                    "Merge cells",
                    () => editor?.chain().focus().mergeCells().run(),
                  ],
                  [
                    "Split cell",
                    () => editor?.chain().focus().splitCell().run(),
                  ],
                  [
                    "Delete table",
                    () => editor?.chain().focus().deleteTable().run(),
                  ],
                ].map(([text, fn]) => (
                  <button
                    className="button small"
                    key={String(text)}
                    disabled={!editor?.isActive("table")}
                    onClick={fn as () => void}
                  >
                    {String(text)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Image controls</legend>
              <p className="tiny muted">Select an image in the editor first.</p>
              <label className="field">
                Image width (pt)
                <input
                  type="number"
                  min={20}
                  max={contentWidth}
                  defaultValue={240}
                  onChange={(e) =>
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes("image", {
                        width: Math.max(
                          20,
                          Math.min(contentWidth, +e.target.value),
                        ),
                      })
                      .run()
                  }
                />
              </label>
              <label className="field">
                Image alignment
                <select
                  onChange={(e) =>
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes("image", { alignment: e.target.value })
                      .run()
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </fieldset>
          </aside>
        )}
      </div>
      <div className="document-status">
        <span>
          {editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0}{" "}
          words
        </span>
        <span>
          {model?.pages.length ?? 1} pages · {p.doc.size} · Local autosave
        </span>
        <span>⌘ / Ctrl + B, I, U · Undo: ⌘ / Ctrl + Z</span>
      </div>
      <div className="measure-host" aria-hidden="true">
        <div
          ref={measure}
          className="document-content measure-content"
          style={{ width: contentWidth }}
          dangerouslySetInnerHTML={{ __html: sanitize(p.html) }}
          onLoad={recompute}
        />
      </div>
    </div>
  );
}
