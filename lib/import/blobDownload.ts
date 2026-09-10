"use client";

export function bytesToBlob(bytes: Uint8Array, mimeType: string) {
  return new Blob([bytes.slice()], { type: mimeType });
}

export function looksLikePdf(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export function sanitizeDownloadFileName(name: string, fallback = "document.pdf") {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

const blobUrls = new Set<string>();

function scheduleBlobUrlRevoke(url: string) {
  blobUrls.add(url);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    blobUrls.delete(url);
  }, 300_000);
}

async function saveWithFilePicker(blob: Blob, fileName: string) {
  const pickerWindow = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{ createWritable: () => Promise<WritableStreamDefaultWriter> }>;
  };

  if (!pickerWindow.showSaveFilePicker) {
    return false;
  }

  try {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}

export async function triggerBrowserDownload(blob: Blob, fileName: string) {
  const safeName = sanitizeDownloadFileName(fileName);

  if (blob.size < 100) {
    throw new Error("Downloaded file is empty or too small to open.");
  }

  if (await saveWithFilePicker(blob, safeName)) {
    return;
  }

  const navigatorWithMs = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean;
  };

  if (navigatorWithMs.msSaveOrOpenBlob?.(blob, safeName)) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  scheduleBlobUrlRevoke(url);
}

export async function savePdfBytes(bytes: Uint8Array, fileName: string) {
  const copy = bytes.slice();
  if (!looksLikePdf(copy)) {
    const preview = new TextDecoder().decode(copy.slice(0, 120)).trimStart();
    if (preview.startsWith("<!") || preview.startsWith("<html")) {
      throw new Error(
        "Download failed: received a web page instead of a PDF. The deployed site cannot use server APIs — rebuild and redeploy after this fix."
      );
    }
    throw new Error("Downloaded file is not a valid PDF.");
  }
  await triggerBrowserDownload(bytesToBlob(copy, "application/pdf"), fileName);
}
