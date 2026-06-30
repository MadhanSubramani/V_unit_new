import { Kyc, KycDocument } from "@/types/kyc";

export function normalizeDocArray(value: unknown): KycDocument[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as KycDocument[];
  return [value as KycDocument];
}

export function normalizeKyc(raw: Record<string, unknown> & { id?: string }): Kyc {
  const branchAddresses = Array.isArray(raw.branchAddresses)
    ? (raw.branchAddresses as string[])
    : raw.deliveryAddress
      ? [String(raw.deliveryAddress)]
      : [];

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
    email: (raw.email as string) ?? "",
    phone: (raw.phone as string) ?? "",
    directorAadhar: normalizeDocArray(raw.directorAadhar),
    directorPan: normalizeDocArray(raw.directorPan),
    supportingDocuments: normalizeDocArray(raw.supportingDocuments),
    deliveryAddress: raw.deliveryAddress as string | undefined,
    createdAt: raw.createdAt,
  };
}
