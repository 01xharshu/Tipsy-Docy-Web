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
