import { Kyc, KycDocument } from "@/types/kyc";

export function normalizeDocArray(value: unknown): KycDocument[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as KycDocument[];
  return [value as KycDocument];
}

function normalizeContactList(
  listValue: unknown,
  primaryValue: unknown
): string[] {
  if (Array.isArray(listValue)) {
    return (listValue as unknown[])
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  const primary = String(primaryValue ?? "").trim();
  return primary ? [primary] : [];
}

export function normalizeKyc(raw: Record<string, unknown> & { id?: string }): Kyc {
  const branchAddresses = Array.isArray(raw.branchAddresses)
    ? (raw.branchAddresses as string[])
    : raw.deliveryAddress
      ? [String(raw.deliveryAddress)]
      : [];

  const emails = normalizeContactList(raw.emails, raw.email);
  const phones = normalizeContactList(raw.phones, raw.phone);

  return {
    id: raw.id,
    fileNo: (raw.fileNo as string) ?? "",
    gstin: (raw.gstin as string) ?? "",
    gstStatus: (raw.gstStatus as string) ?? undefined,
    gstinDocument: raw.gstinDocument as KycDocument | undefined,
    companyName: (raw.companyName as string) ?? "",
    billingAddress: (raw.billingAddress as string) ?? "",
    branchAddresses,
    pan: (raw.pan as string) ?? "",
    panDocument: raw.panDocument as KycDocument | undefined,
    iec: (raw.iec as string) ?? "",
    iecDocument: raw.iecDocument as KycDocument | undefined,
    adCode: (raw.adCode as string) ?? "",
    adCodeDocument: raw.adCodeDocument as KycDocument | undefined,
    loiNo: (raw.loiNo as string) ?? "",
    loiDate: (raw.loiDate as string) ?? "",
    loiDocument:
      (raw.loiDocument as KycDocument | undefined) ??
      (raw.loi as KycDocument | undefined),
    emails,
    phones,
    email: emails[0] ?? "",
    phone: phones[0] ?? "",
    directorAadhar: normalizeDocArray(raw.directorAadhar),
    directorPan: normalizeDocArray(raw.directorPan),
    supportingDocuments: normalizeDocArray(raw.supportingDocuments),
    deliveryAddress: raw.deliveryAddress as string | undefined,
    createdAt: raw.createdAt,
  };
}
