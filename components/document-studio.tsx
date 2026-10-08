"use client";
/* Local data-URL images must stay browser-local. */
import { useEditor, EditorContent } from "@tiptap/react";
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
import { Extension, Node, mergeAttributes } from "@tiptap/core";
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
} from "@/lib/documents";
import {
  saveDocumentPreset,
  listDocumentPresets,
  deleteDocumentPreset,
} from "@/lib/storage";
import type { Editor } from "@tiptap/react";
const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (e) => e.style.lineHeight,
            renderHTML: (a) =>
              a.lineHeight ? { style: `line-height:${a.lineHeight}` } : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (e) => e.style.marginBottom,
            renderHTML: (a) =>
              a.spaceAfter ? { style: `margin-bottom:${a.spaceAfter}` } : {},
          },
          indent: {
            default: 0,
            parseHTML: (e) => parseInt(e.style.marginLeft) || 0,
            renderHTML: (a) =>
              a.indent ? { style: `margin-left:${a.indent}px` } : {},
          },
        },
      },
    ];
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
    [split, setSplit] = useState(50);
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
      ParagraphLayout,
      PageBreak,
    ],
    content: sanitize(p.html),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
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
    if (!measure.current) return;
    try {
      const next = paginate(measure.current, pRef.current.doc);
      modelRef.current = next;
      setModel(next);
    } catch (e) {
      report(String(e));
    }
  }, [report]);
  useEffect(() => {
    const timer = setTimeout(recompute, 250);
    return () => clearTimeout(timer);
  }, [p.html, p.doc, recompute]);
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
  const [width] = dimensions(p.doc);
  const contentWidth = width - 2 * p.doc.margin;
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
      editor?.commands.setContent(result.html);
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
            defaultValue="Arial"
          >
            <option>Arial</option>
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
            defaultValue="12"
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
      <div className="document-subbar">
        <span className="tiny muted">WRITE SOMETHING WORTH A PAGE</span>
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
              <span className="tiny muted">EDITABLE</span>
            </div>
            <div className="editor-scroll">
              <div
                className="editor-paper"
                style={{
                  width: width,
                  padding: p.doc.margin,
                  background: p.doc.background,
                }}
              >
                <EditorContent editor={editor} />
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
                  defaultValue="1.6"
                >
                  {[1, 1.15, 1.3, 1.5, 1.6, 1.8, 2].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Space after (pt)
                <input
                  type="number"
                  min={0}
                  defaultValue={8}
                  onChange={(e) =>
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes(
                        editor.isActive("heading") ? "heading" : "paragraph",
                        { spaceAfter: `${Math.max(0, +e.target.value)}px` },
                      )
                      .run()
                  }
                />
              </label>
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
