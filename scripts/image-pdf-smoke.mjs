import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs/promises";
const source = await PDFDocument.create();
const canvas = createCanvas(960, 1280),
  ctx = canvas.getContext("2d");
const pixels = ctx.createImageData(960, 1280);
let seed = 711;
for (let page = 0; page < 48; page++) {
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = seed & 255;
    pixels.data[i + 1] = (seed >>> 8) & 255;
    pixels.data[i + 2] = (seed >>> 16) & 255;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 960, 100);
  ctx.fillStyle = "#222222";
  ctx.font = "48px sans-serif";
  ctx.fillText(`Image page ${page + 1}`, 35, 65);
  const image = await source.embedJpg(canvas.toBuffer("image/jpeg", 72));
  source
    .addPage([300, 400])
    .drawImage(image, { x: 0, y: 0, width: 300, height: 400 });
}
const input = Buffer.from(await source.save());
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/studio/?mode=pdf");
  await page.locator("input[type=file]").first().waitFor({ state: "attached" });
  const start = Date.now();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "48-image-pages.pdf",
      mimeType: "application/pdf",
      buffer: input,
    });
  await page.getByRole("button", { name: "8 × 8", exact: true }).click();
  await page.getByTestId("output-sheet").first().waitFor();
  const layoutMs = Date.now() - start;
  const mounted = await page.locator(".source-page").count();
  if (mounted !== 40) throw new Error(`Unexpected card count ${mounted}`);
  await page.getByLabel("Jump to source page").fill("48");
  await page
    .getByRole("button", { name: "Select page 48", exact: true })
    .click();
  const thumb = page
    .getByRole("button", { name: "Select page 48", exact: true })
    .locator("canvas");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".source-preview canvas")].some(
      (c) => c.width > 0,
    ),
  );
  if (!(await thumb.evaluate((c) => c.width > 0))) {
    await thumb.waitFor();
    await page.waitForTimeout(500);
  }
  const lastThumbnailRendered = await thumb.evaluate((c) => c.width > 0);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download"),
    exportStart = Date.now();
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await pending;
  const bytes = await fs.readFile(await download.path());
  const output = await PDFDocument.load(bytes);
  if (output.getPageCount() !== 1 || !lastThumbnailRendered || errors.length)
    throw new Error("Image-heavy smoke failed: " + JSON.stringify(errors));
  const result = {
    timestamp: new Date().toISOString(),
    fixture:
      "48 unique 960x1280 JPEG image pages, deterministic synthetic noise; not a general/device benchmark",
    inputBytes: input.length,
    sourcePages: 48,
    grid: "8x8",
    outputSheets: 1,
    mountedSourceCards: mounted,
    lastThumbnailRendered,
    layoutReadyMs: layoutMs,
    exportAndReopenMs: Date.now() - exportStart,
    outputBytes: bytes.length,
    pageErrors: errors,
  };
  await fs.writeFile(
    "evidence/image-pdf-smoke.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
