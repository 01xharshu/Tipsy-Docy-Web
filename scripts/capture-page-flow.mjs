import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await page.goto("http://127.0.0.1:4174/studio/?mode=document");
  const html = Array.from(
    { length: 70 },
    (_, i) =>
      `<p>Paragraph ${i + 1}. Write naturally across pages. Your margins and formatting stay with the document.</p>`,
  ).join("");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "Editable pages.html",
      mimeType: "text/html",
      buffer: Buffer.from(html),
    });
  await page.waitForFunction(
    () => document.querySelectorAll(".editor-page-cut").length >= 2,
  );
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await page.locator(".editor-scroll").evaluate((el) => (el.scrollTop = 600));
  await page
    .locator(".document-preview-scroll")
    .evaluate((el) => (el.scrollTop = 400));
  await page.screenshot({ path: "evidence/document-editable-pages.png" });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await (await pending).saveAs("evidence/editable-pages-export.pdf");
} finally {
  await browser.close();
}
