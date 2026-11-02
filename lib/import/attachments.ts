import { FreightForwardDocument } from "@/types/freightForward";

export type ImportAttachmentValue =
  | FreightForwardDocument
  | FreightForwardDocument[]
  | null
  | undefined;

export function normalizeAttachments(
  value: ImportAttachmentValue
): FreightForwardDocument[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((doc): doc is FreightForwardDocument => Boolean(doc?.url));
  }
  return value.url ? [value] : [];
}

export function hasNamedAttachment(value: ImportAttachmentValue) {
  return normalizeAttachments(value).length > 0;
}

export function primaryAttachment(value: ImportAttachmentValue) {
  return normalizeAttachments(value)[0];
}

export function attachmentLabel(value: ImportAttachmentValue, empty = "Not uploaded") {
  const docs = normalizeAttachments(value);
  if (!docs.length) return empty;
  if (docs.length === 1) return docs[0].name?.trim() || "Uploaded";
  return `${docs.length} files`;
}

export function uniqueAttachmentName(
  name: string | undefined,
  used: Set<string>,
  fallback: string
) {
  const base = (name?.trim() || fallback).replace(/[\\/:*?"<>|]+/g, "_");
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  let candidate = `${stem}-${index}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${stem}-${index}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
