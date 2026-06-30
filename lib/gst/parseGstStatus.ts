export function parseGstActiveStatus(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;

  const raw =
    data.sts ??
    data.status ??
    data.gstinStatus ??
    data.actvTy ??
    data.active;

  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  const lower = value.toLowerCase();
  if (lower.includes("active") || lower === "a") return "Active";
  if (
    lower.includes("cancel") ||
    lower.includes("inactive") ||
    lower.includes("suspend") ||
    lower === "i"
  ) {
    return "Inactive";
  }

  return value;
}

export function isGstActive(status: string | null | undefined): boolean | null {
  if (!status) return null;
  const lower = status.toLowerCase();
  if (lower.includes("active")) return true;
  if (lower.includes("inactive") || lower.includes("cancel") || lower.includes("suspend")) {
    return false;
  }
  return null;
}
