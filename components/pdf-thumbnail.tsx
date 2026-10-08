"use client";
import { useEffect, useRef, useState } from "react";
import type { Source } from "@/lib/model";
import type { PDFDocumentProxy } from "pdfjs-dist";
const thumbnails = new Map<string, string>();
const cache = new Map<string, Promise<PDFDocumentProxy>>();
export function releasePdfs(ids?: string[]) {
  for (const key of thumbnails.keys())
    if (!ids || ids.some((id) => key.startsWith(id + ":")))
      thumbnails.delete(key);
  for (const [id, p] of cache) {
    if (!ids || ids.includes(id)) {
      void p.then((d) => d.destroy()).catch(() => {});
      cache.delete(id);
    }
  }
}
async function load(source: Source) {
  if (!cache.has(source.id)) {
    cache.set(
      source.id,
      import("pdfjs-dist").then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        return pdfjs.getDocument({
          data: Uint8Array.from(source.bytes),
          isEvalSupported: false,
          useSystemFonts: true,
          standardFontDataUrl: "/standard_fonts/",
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        }).promise;
      }),
    );
  }
  return cache.get(source.id)!;
}
export default function PdfThumbnail({
  source,
  page,
  rotation = 0,
  className = "",
}: {
  source: Source;
  page: number;
  rotation?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let task: { cancel: () => void } | undefined;
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void (async () => {
          try {
            const key = `${source.id}:${page}:${rotation}`,
              cached = thumbnails.get(key);
            if (cached) {
              const bitmap = new Image();
              bitmap.src = cached;
              await bitmap.decode();
              if (disposed) return;
              canvas.width = bitmap.naturalWidth;
              canvas.height = bitmap.naturalHeight;
              canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
              return;
            }
            const doc = await load(source);
            if (disposed) return;
            const p = await doc.getPage(page + 1);
            if (disposed) return;
            const viewport = p.getViewport({ scale: 1, rotation });
            const scale = Math.min(
              1.5,
              600 / viewport.width,
              900 / viewport.height,
            );
            const v = p.getViewport({ scale, rotation });
            canvas.width = v.width;
            canvas.height = v.height;
            const context = canvas.getContext("2d");
            if (!context) return;
            const render = p.render({
              canvasContext: context,
              viewport: v,
              background: "rgba(0,0,0,0)",
            });
            task = render;
            await render.promise;
            if (!disposed) {
              if (thumbnails.size >= 128)
                thumbnails.delete(thumbnails.keys().next().value!);
              thumbnails.set(key, canvas.toDataURL("image/png"));
            }
          } catch (e) {
            if (!disposed)
              setError(e instanceof Error ? e.message : "Preview unavailable");
          }
        })();
      },
      { rootMargin: "200px" },
    );
    observer.observe(canvas);
    return () => {
      disposed = true;
      observer.disconnect();
      task?.cancel();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [source, page, rotation]);
  return error ? (
    <span className="error">Preview unavailable</span>
  ) : (
    <canvas
      aria-label={`${source.name}, page ${page + 1}`}
      className={className}
      ref={ref}
    />
  );
}
