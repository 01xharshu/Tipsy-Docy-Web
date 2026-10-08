import { copyFileSync, mkdirSync, cpSync } from "node:fs";
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(
  new URL(
    "../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ),
  new URL("../public/pdf.worker.min.mjs", import.meta.url),
);

for (const directory of ["standard_fonts", "cmaps"])
  cpSync(
    new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url),
    new URL(`../public/${directory}/`, import.meta.url),
    { recursive: true },
  );
