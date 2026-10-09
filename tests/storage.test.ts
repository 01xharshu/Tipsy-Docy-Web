import { it, expect } from "vitest";
import { serializeProject, deserializeProject } from "../lib/storage";
import { newProject } from "../lib/model";
it("round-trips editable backup and source bytes with a fresh project ID", () => {
  const p = newProject("pdf");
  p.sources = [
    {
      id: "source",
      name: "sample.pdf",
      bytes: new Uint8Array([0, 128, 255]),
      count: 1,
    },
  ];
  const restored = deserializeProject(serializeProject(p));
  expect(restored.id).not.toBe(p.id);
  expect(restored.sources[0].bytes).toEqual(p.sources[0].bytes);
  expect(restored.layout).toEqual(p.layout);
});
it("rejects invalid settings and broken page references", () => {
  const p = newProject("pdf");
  const raw = JSON.parse(serializeProject(p));
  raw.layout.rows = 0;
  expect(() => deserializeProject(JSON.stringify(raw))).toThrow("Invalid");
  expect(() => deserializeProject("{}")).toThrow();
  expect(() => deserializeProject("not json")).toThrow();
});

it("uses compact source encoding for large backups and preserves all byte values", () => {
  const p = newProject("pdf");
  const bytes = Uint8Array.from({ length: 1024 * 1024 }, (_, i) => i % 256);
  p.sources = [{ id: "large", name: "large.pdf", bytes, count: 1 }];
  const text = serializeProject(p);
  expect(JSON.parse(text).version).toBe(2);
  expect(text.length).toBeLessThan(bytes.length * 1.35);
  expect(deserializeProject(text).sources[0].bytes).toEqual(bytes);
});
it("imports legacy version-one backups", () => {
  const p = newProject("pdf");
  const raw = JSON.parse(serializeProject(p));
  raw.version = 1;
  raw.sources = [
    { id: "old", name: "legacy.pdf", count: 1, bytes: [0, 128, 255] },
  ];
  expect(deserializeProject(JSON.stringify(raw)).sources[0].bytes).toEqual(
    new Uint8Array([0, 128, 255]),
  );
});
it("rejects corrupt base64 and version/encoding mismatches", () => {
  const raw = JSON.parse(serializeProject(newProject("pdf")));
  raw.sources = [{ id: "bad", name: "bad.pdf", count: 1, bytes: "!!==" }];
  expect(() => deserializeProject(JSON.stringify(raw))).toThrow("encoding");
  raw.sources[0].bytes = [1, 2];
  expect(() => deserializeProject(JSON.stringify(raw))).toThrow("version");
});
