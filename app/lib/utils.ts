export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Force-download a URL as a file. Falls back to opening in a new tab if fetch fails. */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
  } catch {
    window.open(url, "_blank");
  }
}

/** Build and trigger download of a ZIP containing all provided assets + metadata.json */
export async function downloadZip(
  assets: { url: string; filename: string; meta: Record<string, unknown> }[],
  zipName: string,
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const folder = zip.folder("assets")!;

  const metadata: Record<string, unknown>[] = [];

  await Promise.all(
    assets.map(async ({ url, filename, meta }) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        folder.file(filename, blob);
        metadata.push({ filename, ...meta });
      } catch {
        metadata.push({ filename, error: "fetch failed", ...meta });
      }
    })
  );

  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = zipName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
