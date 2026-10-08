import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs/promises";
const src = await PDFDocument.create(),
  font = await src.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 128; i++)
  src
    .addPage([300, 400])
    .drawText(`Synthetic source page ${i}`, { x: 24, y: 350, font, size: 16 });
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage();
  await page.goto(
    process.env.EVIDENCE_URL || "http://127.0.0.1:4174/studio/?mode=pdf",
  );
  await page.locator("input[type=file]").first().waitFor({ state: "attached" });
  const start = Date.now();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "128-simple-pages.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await src.save()),
    });
  await page.getByRole("button", { name: "8 × 8", exact: true }).click();
  await page.getByTestId("output-sheet").first().waitFor();
  const sheets = await page.getByTestId("output-sheet").count();
  if (sheets !== 2) throw new Error("Expected two output sheets");
  const layoutMs = Date.now() - start;
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  const exportStart = Date.now();
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const d = await pending;
  const path = await d.path();
  if (!path) throw new Error("Missing download");
  const bytes = new Uint8Array(await fs.readFile(path));
  const out = await PDFDocument.load(bytes);
  if (out.getPageCount() !== 2) throw new Error("Bad output count");
  const result = {
    timestamp: new Date().toISOString(),
    fixture:
      "128 simple vector text pages, 300 x 400 pt; synthetic smoke test, not a general performance benchmark",
    grid: "8 x 8",
    sheets,
    layoutReadyMs: layoutMs,
    exportAndReopenMs: Date.now() - exportStart,
    exportBytes: bytes.length,
  };
  await fs.writeFile(
    "evidence/large-pdf-smoke.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
