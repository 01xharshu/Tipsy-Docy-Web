import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs/promises";
const url = process.env.EVIDENCE_URL || "http://127.0.0.1:4174";
await fs.mkdir("evidence", { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(url);
await page.screenshot({ path: "evidence/landing-desktop.png", fullPage: true });
await page.screenshot({ path: "evidence/landing-hero.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "evidence/landing-mobile.png", fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(url + "/studio/?mode=document");
await page.getByRole("textbox", { name: "Document editor" }).waitFor();
const html =
  "<h1>A little room for big ideas.</h1><p>Your documents are yours. This is a real, locally editable document with a shared PDF preview.</p><h2>The thoughtful workspace</h2><p>Make every page feel considered. Add structure, explore ideas, and keep the details in place.</p><ul><li><p>Write with clarity</p></li><li><p>Arrange with intention</p></li><li><p>Export with confidence</p></li></ul><table><tr><th><p>Part</p></th><th><p>Purpose</p></th></tr><tr><td><p>Document Studio</p></td><td><p>Create and refine</p></td></tr><tr><td><p>PDF Studio</p></td><td><p>Arrange and export</p></td></tr></table>";
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({
    name: "Ideas.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });
await page
  .locator(".doc-preview-page")
  .getByText("A little room for big ideas.")
  .waitFor();
await page.getByText("Saved on this device", { exact: true }).waitFor();
await page.screenshot({ path: "evidence/document-desktop.png" });
async function savePdf(name) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await (await pending).saveAs("evidence/" + name + ".pdf");
}
await savePdf("document-export");
await page.getByRole("button", { name: "Arrange pages", exact: true }).click();
await page.getByTestId("output-sheet").waitFor();
await page.waitForFunction(() =>
  [...document.querySelectorAll(".placed-page canvas")].every(
    (c) => c.width > 0,
  ),
);
await page.screenshot({ path: "evidence/combined-desktop.png" });
await savePdf("arranged-export");
await page.goto(url + "/studio/?mode=pdf");
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 5; i++) {
  const p = pdf.addPage([300, 400]);
  p.drawText("The everyday, reimagined", { x: 24, y: 360, size: 12, font });
  p.drawText(`0${i + 1}`, { x: 24, y: 280, size: 54, font });
  p.drawRectangle({
    x: 24,
    y: 80,
    width: 252,
    height: 160,
    color: rgb(0.83, 0.87, 0.77),
  });
}
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({
    name: "Five ideas.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
await page.getByTestId("output-sheet").first().waitFor();
await page.waitForFunction(() =>
  [...document.querySelectorAll(".placed-page canvas")]
    .slice(0, 4)
    .every((c) => c.width > 0),
);
await page.screenshot({ path: "evidence/pdf-desktop.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "evidence/pdf-mobile.png" });
await page
  .getByRole("button", { name: "Document Studio", exact: true })
  .click();
await page
  .getByRole("textbox", { name: "Document editor" })
  .fill("A page for your next idea.");
await page.getByTestId("document-preview-page").waitFor();
await page.screenshot({ path: "evidence/document-mobile.png" });
await browser.close();
for (const name of ["document-export", "arranged-export"]) {
  const doc = await getDocument({
    data: new Uint8Array(await fs.readFile(`evidence/${name}.pdf`)),
    useSystemFonts: false,
    standardFontDataUrl:
      process.cwd() + "/node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const p = await doc.getPage(1),
    viewport = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await p.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  await fs.writeFile(
    `evidence/${name}-render.png`,
    canvas.toBuffer("image/png"),
  );
  await doc.destroy();
}
console.log(
  "Captured static production evidence and real PDF exports in evidence/.",
);
