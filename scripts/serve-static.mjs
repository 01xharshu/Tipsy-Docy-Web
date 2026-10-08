// Local preview only: serves out/ assets. No uploads, APIs, or document processing.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root = resolve("out"),
  port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};
const server = createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith("/")) {
        res
          .writeHead(301, {
            Location:
              pathname + "/" + new URL(req.url, "http://localhost").search,
          })
          .end();
        return;
      }
      file = resolve(file, "index.html");
      info = await stat(file);
    }
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch {
    res
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Not found");
  }
});
server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;
server.listen(port, "127.0.0.1", () =>
  console.log(`Tipsy Docy static preview: http://127.0.0.1:${port}`),
);
