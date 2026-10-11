import type { jsPDF } from "jspdf";

const fontStyles = ["normal", "bold", "italic", "bolditalic"] as const;
const files = ["Regular", "Bold", "Italic", "BoldItalic"] as const;
const cache = new Map<string, Promise<string>>();

function fontData(file: string): Promise<string> {
  let pending = cache.get(file);
  if (!pending) {
    pending = fetch(`/standard_fonts/LiberationSans-${file}.ttf`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Local PDF font could not be loaded. Please reload and retry.",
          );
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192),
          );
        return btoa(binary);
      })
      .catch((error: unknown) => {
        cache.delete(file);
        throw error;
      });
    cache.set(file, pending);
  }
  return pending;
}

/** Standard PDF fonts cannot encode Greek/Cyrillic. Load bundled fonts only when needed. */
export async function prepareUnicodeFonts(
  pdf: jsPDF,
  texts: string[],
): Promise<boolean> {
  const text = texts.join("");
  if (!/[^\u0000-\u00ff]/u.test(text)) return false;
  // This is an explicit supported range, not a claim of universal Unicode shaping.
  if (
    /[^\u0000-\u024f\u0300-\u052f\u1e00-\u1fff\u2000-\u206f\u20ac]/u.test(text)
  )
    throw new Error(
      "Direct PDF currently supports Latin, Greek and Cyrillic text. For this document's other scripts or symbols, use Print / Save as PDF to preserve browser typography. Arrange Pages needs a supported direct PDF export.",
    );
  const data = await Promise.all(files.map(fontData));
  data.forEach((value, i) => {
    const name = `LiberationSans-${files[i]}.ttf`;
    pdf.addFileToVFS(name, value);
    pdf.addFont(name, "LocalUnicode", fontStyles[i]);
  });
  return true;
}
