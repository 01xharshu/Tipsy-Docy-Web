import { inflateRawSync } from "node:zlib";
// Inspect the real downloaded OOXML archive without adding an application ZIP dependency.
export function zipText(bytes: Buffer, filename: string): string {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) !== 0x06054b50) continue;
    let entry = bytes.readUInt32LE(i + 16);
    const count = bytes.readUInt16LE(i + 10);
    for (let n = 0; n < count; n++) {
      if (bytes.readUInt32LE(entry) !== 0x02014b50)
        throw new Error("Invalid ZIP entry");
      const method = bytes.readUInt16LE(entry + 10),
        size = bytes.readUInt32LE(entry + 20);
      const nameLength = bytes.readUInt16LE(entry + 28),
        extraLength = bytes.readUInt16LE(entry + 30),
        commentLength = bytes.readUInt16LE(entry + 32);
      const name = bytes
        .subarray(entry + 46, entry + 46 + nameLength)
        .toString();
      if (name === filename) {
        const local = bytes.readUInt32LE(entry + 42);
        const start =
          local +
          30 +
          bytes.readUInt16LE(local + 26) +
          bytes.readUInt16LE(local + 28);
        const compressed = bytes.subarray(start, start + size);
        return (
          method === 8 ? inflateRawSync(compressed) : compressed
        ).toString();
      }
      entry += 46 + nameLength + extraLength + commentLength;
    }
    break;
  }
  throw new Error(`Missing ZIP file ${filename}`);
}
