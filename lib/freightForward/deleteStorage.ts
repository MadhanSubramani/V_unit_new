import { deleteObject, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { FreightForward, FreightForwardDocument } from "@/types/freightForward";

export async function deleteStorageFileByUrl(url?: string | null) {
  if (!url?.trim()) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (error) {
    // Missing objects (already removed) should not block permanent delete.
    const code = (error as { code?: string })?.code;
    if (code === "storage/object-not-found") return;
    console.warn("Failed to delete storage file:", url, error);
  }
}

function collectDocumentUrls(docs: Array<FreightForwardDocument | undefined | null>) {
  return docs
    .map((doc) => doc?.url)
    .filter((url): url is string => Boolean(url?.trim()));
}

export function getFreightForwardStorageUrls(item: FreightForward): string[] {
  return collectDocumentUrls([
    item.mblUrl,
    item.hblUrl,
    item.billedAmountUrl,
    item.creditNoteUrl,
    item.paymentDateUrl,
    ...(item.debitDocuments ?? []),
  ]);
}

export async function deleteFreightForwardStorageFiles(item: FreightForward) {
  const urls = getFreightForwardStorageUrls(item);
  await Promise.all(urls.map((url) => deleteStorageFileByUrl(url)));
}
