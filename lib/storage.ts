import { z } from "zod";
import { openDB, type DBSchema } from "idb";
import type { Project, DocumentSettings } from "./model";
interface TipsyDatabase extends DBSchema {
  projects: { key: string; value: Project };
  presets: { key: string; value: { name: string; settings: DocumentSettings } };
}
let database: ReturnType<typeof openDB<TipsyDatabase>> | undefined;
const db = () =>
  (database ??= openDB<TipsyDatabase>("tipsy-docy", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("presets"))
        db.createObjectStore("presets", { keyPath: "name" });
    },
    blocking() {
      database?.then((d) => d.close());
      database = undefined;
    },
  }));
export async function saveDocumentPreset(
  name: string,
  settings: DocumentSettings,
) {
  await (await db()).put("presets", { name, settings });
}
export async function listDocumentPresets() {
  return (await db()).getAll("presets");
}
export async function deleteDocumentPreset(name: string) {
  await (await db()).delete("presets", name);
}
export async function saveProject(project: Project) {
  await (await db()).put("projects", { ...project, updated: Date.now() });
}
export async function listProjects(): Promise<Project[]> {
  return (await (await db()).getAll("projects")).sort(
    (a: Project, b: Project) => b.updated - a.updated,
  );
}
export async function deleteProject(id: string) {
  await (await db()).delete("projects", id);
}
export function serializeProject(p: Project) {
  return JSON.stringify({
    ...p,
    format: "tipsy-docy",
    version: 1,
    sources: p.sources.map((s) => ({ ...s, bytes: Array.from(s.bytes) })),
  });
}
const finite = z.number().finite();
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const dimensionsSchema = {
  size: z.string().max(30),
  width: finite.min(72).max(14400),
  height: finite.min(72).max(14400),
  landscape: z.boolean(),
};
const backupSchema = z.object({
  format: z.literal("tipsy-docy"),
  version: z.literal(1),
  title: z.string().max(500),
  kind: z.enum(["pdf", "document"]),
  html: z.string().max(20000000),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(500),
      count: z.number().int().positive(),
      bytes: z.array(z.number().int().min(0).max(255)),
    }),
  ),
  pages: z.array(
    z.object({
      id: z.string(),
      sourceId: z.string(),
      page: z.number().int().nonnegative(),
      width: finite.positive(),
      height: finite.positive(),
      rotation: z
        .number()
        .int()
        .refine((n) => n % 90 === 0),
      scale: finite.min(0.01).max(100),
      dx: finite,
      dy: finite,
      selected: z.boolean(),
    }),
  ),
  layout: z.object({
    ...dimensionsSchema,
    rows: z.number().int().min(1).max(16),
    cols: z.number().int().min(1).max(16),
    margin: finite.nonnegative(),
    gapX: finite.nonnegative(),
    gapY: finite.nonnegative(),
    order: z.enum(["horizontal", "vertical"]),
    fit: z.enum(["fit", "fill"]),
    align: z.enum(["center", "start", "end"]),
    background: color,
    borders: z.boolean(),
  }),
  doc: z.object({
    ...dimensionsSchema,
    margin: finite.nonnegative(),
    background: color,
    header: z.string().max(2000),
    footer: z.string().max(2000),
    numbers: z.boolean(),
  }),
});
export function deserializeProject(text: string): Project {
  const result = backupSchema.safeParse(JSON.parse(text));
  if (!result.success)
    throw new Error(
      "Invalid Tipsy Docy project backup. Check the file format and settings.",
    );
  const p = result.data;
  if (
    new Set(p.sources.map((s) => s.id)).size !== p.sources.length ||
    new Set(p.pages.map((s) => s.id)).size !== p.pages.length
  )
    throw new Error("Backup contains duplicate identifiers.");
  for (const page of p.pages) {
    const src = p.sources.find((s) => s.id === page.sourceId);
    if (!src || page.page >= src.count)
      throw new Error("A backup page refers to a missing source.");
  }
  return {
    ...p,
    id: crypto.randomUUID(),
    updated: Date.now(),
    sources: p.sources.map((s) => ({ ...s, bytes: new Uint8Array(s.bytes) })),
  };
}
