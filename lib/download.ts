export function download(
  data: Uint8Array | string,
  name: string,
  type: string,
) {
  const blob = new Blob(
    [typeof data === "string" ? data : Uint8Array.from(data)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
