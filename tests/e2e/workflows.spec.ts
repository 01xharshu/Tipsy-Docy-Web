import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Document, Packer, Paragraph, TextRun } from "docx";
async function fixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 5; i++) {
    const p = pdf.addPage([300, 400]);
    p.drawText(`Source page ${i}`, { x: 20, y: 350, size: 24, font });
    p.drawRectangle({ x: 20, y: 20, width: 30, height: 50 });
  }
  return Buffer.from(await pdf.save());
}
async function upload(page: import("@playwright/test").Page) {
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "five-pages.pdf",
      mimeType: "application/pdf",
      buffer: await fixture(),
    });
  await expect(page.getByTestId("output-sheet")).toHaveCount(2);
}
async function exportPdf(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const d = await promise;
  const path = await d.path();
  return { bytes: new Uint8Array(await fs.readFile(path!)), path: path! };
}
test("PDF: real thumbnails, incomplete grid, drag/nudge, undo, vector export and reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio?mode=pdf");
  await upload(page);
  const canvases = page.locator(".source-preview canvas");
  await expect(canvases).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await canvases.nth(i).scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        canvases.nth(i).evaluate((c) => (c as HTMLCanvasElement).width),
      )
      .toBeGreaterThan(0);
  }
  await page.getByLabel("Outer margin", { exact: true }).fill("12");
  await page.getByLabel("Horizontal gap", { exact: true }).fill("4");
  await page.getByLabel("Vertical gap", { exact: true }).fill("6");
  const placed = page.getByRole("button", { name: "Move page 1", exact: true });
  await placed.scrollIntoViewIfNeeded();
  await placed.click();
  await page.getByLabel("Horizontal offset", { exact: true }).fill("5");
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).toHaveValue("5");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).toHaveValue("5");
  await placed.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).not.toHaveValue("5");
  const before = await placed.boundingBox();
  await placed.hover();
  await page.mouse.down();
  await page.mouse.move(
    before!.x + before!.width / 2 + 12,
    before!.y + before!.height / 2 + 8,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).not.toHaveValue("0");
  const result = await exportPdf(page);
  const reopened = await PDFDocument.load(result.bytes);
  expect(reopened.getPageCount()).toBe(2);
  expect(reopened.getPage(0).getWidth()).toBeCloseTo(595.276, 2);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "export.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(result.bytes),
    });
  await expect(page.locator(".source-file")).toHaveCount(2);
  expect(errors).toEqual([]);
});
test("Document: format, table, settings, live preview, persistence, searchable export and arrange", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio?mode=document");
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.waitFor();
  await editor.fill("The local-first handbook");
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByLabel("Paragraph style", { exact: true }).selectOption("h1");
  await editor.focus();
  await editor.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  });
  await page.keyboard.press("Enter");
  await page.getByLabel("Paragraph style", { exact: true }).selectOption("p");
  await editor.focus();
  await page.keyboard.type("A private workspace for thoughtful documents.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Every page stays on your device.");
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByLabel("Font size", { exact: true }).selectOption("14");
  await editor.focus();
  await editor.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  });
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.focus();
  await page.keyboard.type("A useful list item");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await expect(editor.locator("table")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Document settings", exact: true })
    .click();
  await page.getByLabel("Document margins", { exact: true }).fill("18");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Document margins")).toHaveValue("20");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Document margins")).toHaveValue("18");
  await expect(editor).toContainText("A private workspace");
  await expect(page.getByTestId("document-preview-page")).toHaveCount(1);
  await expect(page.locator(".doc-preview-page")).toContainText(
    "The local-first handbook",
  );
  await page.getByLabel("Project title").fill("Local handbook");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: /Local handbook/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Document editor" }),
  ).toContainText("A private workspace");
  const result = await exportPdf(page);
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  const extracted = await getDocument({
    data: Uint8Array.from(result.bytes),
    useSystemFonts: true,
  }).promise;
  const text = await (await extracted.getPage(1)).getTextContent();
  expect(
    text.items
      .filter((i) => "str" in i)
      .map((i) => ("str" in i ? i.str : ""))
      .join(" "),
  ).toContain("The local-first handbook");
  const heading = text.items.find(
    (i) => "str" in i && i.str.includes("The local-first handbook"),
  );
  const preview = await page
    .locator(".document-page-graphics text")
    .evaluateAll((nodes) => {
      const node = nodes.find((n) =>
        n.textContent?.includes("The local-first handbook"),
      );
      return {
        x: Number(node?.getAttribute("x")),
        y: Number(node?.getAttribute("y")),
      };
    });
  if (!heading || !("transform" in heading))
    throw new Error("Missing exported heading");
  expect(heading.transform[4]).toBeCloseTo(preview.x, 2);
  expect(pdf.getPage(0).getHeight() - heading.transform[5]).toBeCloseTo(
    preview.y,
    2,
  );
  await extracted.destroy();
  await page
    .getByRole("button", { name: "Arrange pages", exact: true })
    .click();
  await expect(page.getByTestId("output-sheet")).toHaveCount(1);
  await page.getByRole("button", { name: "3 × 3", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Rows", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Rows", { exact: true })).toHaveValue("3");
  const arranged = await exportPdf(page);
  expect((await PDFDocument.load(arranged.bytes)).getPageCount()).toBe(1);
  await page
    .getByRole("button", { name: "Document Studio", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document editor" }),
  ).toContainText("A private workspace");
  expect(errors).toEqual([]);
});
test("Malformed PDF, HTML sanitization, quick tools, responsive navigation", async ({
  page,
}) => {
  await page.goto("/studio?mode=pdf");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bad.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("invalid"),
    });
  await expect(page.getByRole("status")).toContainText(/PDF|parse|header/i);
  await page
    .getByRole("button", { name: "Document Studio", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "test.html",
      mimeType: "text/html",
      buffer: Buffer.from(
        '<h2>Safe imported text</h2><img src="https://example.com/track"><script>alert(1)</script><p onclick="alert(1)">Hello</p>',
      ),
    });
  await expect(
    page.getByRole("textbox", { name: "Document editor" }),
  ).toContainText("Safe imported text");
  expect(await page.locator(".tiptap img").count()).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Quick Tools", exact: true }).click();
  await expect(page.getByRole("button", { name: /Merge PDFs/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("heading", { name: /Your documents/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("Refresh recovery, DOCX import/export, editable backup, empty document, and page breaks", async ({
  page,
}) => {
  await page.goto("/studio?mode=document");
  await expect(
    page.getByRole("textbox", { name: "Document editor" }),
  ).toBeVisible();
  const empty = await exportPdf(page);
  expect((await PDFDocument.load(empty.bytes)).getPageCount()).toBe(1);
  const docx = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Imported DOCX heading", bold: true }),
            ],
          }),
          new Paragraph("This text came from a real DOCX file."),
        ],
      },
    ],
  });
  const data = await Packer.toBuffer(docx);
  await page.locator("input[type=file]").first().setInputFiles({
    name: "Imported.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: data,
  });
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await expect(editor).toContainText("real DOCX file");
  await expect(editor.locator("strong")).toContainText("Imported DOCX heading");
  await page.getByLabel("Project title").fill("Recovery proof");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Project title")).toHaveValue("Recovery proof");
  await expect(editor).toContainText("real DOCX file");
  await page
    .getByRole("button", { name: "Document settings", exact: true })
    .click();
  await editor.focus();
  await editor.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  });
  await page
    .getByRole("button", { name: "Insert page break", exact: true })
    .click();
  await page.keyboard.type("Second sheet content");
  await expect(editor).toContainText("Second sheet content");
  await expect(editor.locator('[data-type="pageBreak"]')).toHaveCount(1);
  await expect(page.getByTestId("document-preview-page")).toHaveCount(2);
  const two = await exportPdf(page);
  expect((await PDFDocument.load(two.bytes)).getPageCount()).toBe(2);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  let pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "DOCX", exact: true }).click();
  const exportedDoc = await pending;
  expect((await fs.stat((await exportedDoc.path())!)).size).toBeGreaterThan(
    1000,
  );
  await page.getByRole("button", { name: "Export", exact: true }).click();
  pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export editable project backup",
      exact: true,
    })
    .click();
  const backup = await pending;
  const backupPath = (await backup.path())!;
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "proof.tipsy.json",
    mimeType: "application/json",
    buffer: await fs.readFile(backupPath),
  });
  await expect(page.getByRole("link", { name: /Recovery proof/ })).toHaveCount(
    2,
  );
});
test("Real file drop, selection ranges, duplicate/remove/rotate and project management", async ({
  page,
}) => {
  await page.goto("/studio?mode=pdf");
  const buffer = await fixture();
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "dropped.pdf", {
        type: "application/pdf",
      }),
    );
    return dt;
  }, Array.from(buffer));
  await page
    .locator(".pdf-workspace")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByTestId("output-sheet")).toHaveCount(2);
  await page.getByPlaceholder("1-3, 5").fill("1-2,5");
  await page.getByRole("button", { name: "Apply page selection" }).click();
  await expect(page.getByTestId("output-sheet")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Duplicate page 1", exact: true })
    .click();
  await expect(page.locator(".source-page")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Rotate page 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete page 2", exact: true })
    .click();
  await expect(page.locator(".source-page")).toHaveCount(5);
  await page.getByLabel("Project title").fill("Managed layout");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  page.once("dialog", (d) => d.accept("Renamed layout"));
  await page.getByRole("button", { name: "Rename Managed layout" }).click();
  await expect(
    page.getByRole("link", { name: /Renamed layout/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate Renamed layout", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Renamed layout copy/ }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete Renamed layout copy", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Renamed layout copy/ }),
  ).toHaveCount(0);
});

test("Long document pagination, images, custom presets, keyboard export, and browser print", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const remote: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://example.com")) remote.push(r.url());
  });
  await page.goto("/studio?mode=document");
  const pixel = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c4d0b1";
    context.fillRect(0, 0, 200, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const html =
    '<h1>A longer local document</h1><img width="100" src="data:image/png;base64,' +
    pixel +
    '"><p style="background-image:image-set(\'https://example.com/track.png\')">Safe styling</p>' +
    Array.from(
      { length: 75 },
      (_, i) =>
        `<p>Paragraph ${i + 1}. This is a local paragraph that should paginate naturally and remain selectable after PDF export.</p>`,
    ).join("");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "long.html",
      mimeType: "text/html",
      buffer: Buffer.from(html),
    });
  await expect(page.getByTestId("document-preview-page")).not.toHaveCount(1);
  const count = await page.getByTestId("document-preview-page").count();
  expect(count).toBeGreaterThan(2);
  const result = await exportPdf(page);
  expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(count);
  expect(remote).toEqual([]);
  await page
    .getByRole("button", { name: "Document settings", exact: true })
    .click();
  await page.getByLabel("Document margins").fill("20");
  page.once("dialog", (d) => d.accept("My report"));
  await page
    .getByRole("button", { name: "Save page preset", exact: true })
    .click();
  await expect(page.getByLabel("Custom document presets")).toContainText(
    "My report",
  );
  await page.getByLabel("Document margins").fill("15");
  await page.getByLabel("Custom document presets").selectOption("My report");
  await expect(page.getByLabel("Document margins")).toHaveValue("20");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = "true";
    };
  });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Browser print / Save as PDF…", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.printCalled))
    .toBe("true");
  const printed = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const printPdf = await PDFDocument.load(printed);
  expect(printPdf.getPageCount()).toBe(
    await page.getByTestId("document-preview-page").count(),
  );
  expect(printPdf.getPage(0).getWidth()).toBeCloseTo(595.276, 0);
  expect(errors).toEqual([]);
});
test("Storage failure remains visible and exports remain functional", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Storage denied", "SecurityError");
    };
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage denied", "SecurityError");
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/studio?mode=document");
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("Keep this document despite a storage failure.");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByText(/Save failed — export a project backup/),
  ).toBeVisible();
  const result = await exportPdf(page);
  expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
});

test("Workspace accessibility and smaller-screen editing", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator(".dark-button")).toHaveCSS(
    "background-color",
    "rgb(237, 241, 233)",
  );
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.goto("/studio?mode=pdf");
  await expect(page.getByRole("main", { name: "PDF Studio" })).toBeVisible();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Document Studio", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Document editor" })
    .fill("A document on a smaller screen.");
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".doc-preview-page")
    .analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeVisible();
  const exportBounds = await page
    .getByRole("button", { name: "Export", exact: true })
    .boundingBox();
  expect(exportBounds!.x + exportBounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Document settings", exact: true })
    .click();
  await page.getByLabel("Document margins").fill("16");
  await expect(page.getByTestId("document-preview-page")).toHaveCount(1);
});

test("Consecutive page breaks preserve intentionally blank output pages", async ({
  page,
}) => {
  await page.goto("/studio?mode=document");
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("First page.");
  await editor.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  });
  await page
    .getByRole("button", { name: "Document settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Insert page break", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Insert page break", exact: true })
    .click();
  await expect(editor.locator('[data-type="pageBreak"]')).toHaveCount(2);
  await expect(page.getByTestId("document-preview-page")).toHaveCount(3);
  const out = await exportPdf(page);
  expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(3);
});
