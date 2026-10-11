import { afterEach, expect, test, vi } from "vitest";
import type { jsPDF } from "jspdf";
import { prepareUnicodeFonts } from "../lib/pdf-fonts";
afterEach(() => vi.unstubAllGlobals());
test("ASCII export requires no font requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(await prepareUnicodeFonts({} as jsPDF, ["Hello"])).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
test("unsupported shaping fails before fetching or producing corrupt PDF text", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(prepareUnicodeFonts({} as jsPDF, ["नमस्ते"])).rejects.toThrow(
    "Print / Save as PDF",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
