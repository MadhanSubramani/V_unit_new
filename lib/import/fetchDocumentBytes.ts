"use client";

import { getBytes, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { FreightForwardDocument } from "@/types/freightForward";

function getStoragePathFromDownloadUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("firebasestorage.googleapis.com")) {
      return null;
    }
    const match = parsed.pathname.match(/\/o\/(.+)$/);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function fetchViaFirebaseSdk(url: string) {
  const path = getStoragePathFromDownloadUrl(url);
  if (!path) {
    throw new Error("Not a Firebase Storage URL");
  }
  return new Uint8Array(await getBytes(ref(storage, path)));
}

async function fetchViaHttp(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) {
    throw new Error("Empty file");
  }

  if (bytes[0] === 0x3c) {
    throw new Error("Storage returned HTML instead of a file (link may have expired)");
  }

  return bytes;
}

/** Read Storage files in the browser — required for static Firebase Hosting deploys. */
export async function fetchDocumentBytes(doc: FreightForwardDocument) {
  const label = doc.name?.trim() || "document";
  const url = doc.url.trim();
  const errors: string[] = [];

  try {
    return await fetchViaFirebaseSdk(url);
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Firebase Storage read failed"
    );
  }

  try {
    return await fetchViaHttp(url);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "HTTP fetch failed");
  }

  const combined = errors.join("; ");
  if (/cors|network|failed to fetch/i.test(combined)) {
    throw new Error(
      `${label}: blocked by Firebase Storage CORS. Run "gsutil cors set scripts/storage-cors.json gs://YOUR_BUCKET" once, then retry.`
    );
  }

  throw new Error(`${label}: ${combined}`);
}
