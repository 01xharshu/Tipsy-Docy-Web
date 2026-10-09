import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://127.0.0.1:4174/studio/?mode=document");
const html =
  '<h1>A thoughtful document.</h1><div data-type="blockGroup" style="margin-left:18px;padding:16px"><h2>Room to write</h2><p style="padding-left:8px;margin-top:10px">Paragraphs and blocks have their own margins and padding. The live preview uses those same positions when exporting a searchable PDF.</p><p>Write with bold ideas, clear spacing, and room for the details.</p></div><p>Everything stays on this device.</p>';
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({
    name: "Blocks.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });
await page
  .getByRole("textbox", { name: "Document editor" })
  .locator('[data-type="blockGroup"] p')
  .first()
  .click();
await page.getByLabel("Editor zoom").selectOption("0.75");
await page.getByText("Saved on this device", { exact: true }).waitFor();
await page
  .locator(".document-page-graphics text")
  .getByText("A thoughtful document.", { exact: true })
  .waitFor();
await page.screenshot({ path: "evidence/document-blocks-desktop.png" });
await page
  .getByRole("button", { name: "Document settings", exact: true })
  .click();
await page
  .getByText("Document blocks", { exact: true })
  .scrollIntoViewIfNeeded();
await page.screenshot({ path: "evidence/document-block-controls.png" });
await page
  .getByRole("button", { name: "Document settings", exact: true })
  .click();
await page.getByRole("button", { name: "Export", exact: true }).click();
const pdf = page.waitForEvent("download");
await page.getByRole("button", { name: "Download PDF", exact: true }).click();
await (await pdf).saveAs("evidence/document-blocks-export.pdf");
await page.getByRole("button", { name: "Export", exact: true }).click();
const docx = page.waitForEvent("download");
await page.getByRole("button", { name: "DOCX", exact: true }).click();
await (await docx).saveAs("evidence/document-blocks-export.docx");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByLabel("Editor zoom").selectOption("0.5");
await page.screenshot({ path: "evidence/document-blocks-mobile.png" });
await fs.writeFile(
  "evidence/block-capture.json",
  JSON.stringify(
    {
      producer: "scripts/capture-block-evidence.mjs",
      origin: "http://127.0.0.1:4174",
      capturedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
await browser.close();
