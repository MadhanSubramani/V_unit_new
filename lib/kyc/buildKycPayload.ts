import { KycDocument } from "@/types/kyc";
import { stripUndefined } from "@/lib/kyc/stripUndefined";

export type KycSavePayload = {
  fileNo: string;
  gstin: string;
  gstStatus?: string | null;
  gstinDocument?: KycDocument;
  companyName: string;
  billingAddress: string;
  branchAddresses: string[];
  pan: string;
  panDocument?: KycDocument;
  iec: string;
  iecDocument?: KycDocument;
  adCode: string;
  adCodeDocument?: KycDocument;
  loiNo: string;
  loiDate: string;
  loiDocument?: KycDocument;
  email: string;
  phone: string;
  directorAadhar: KycDocument[];
  directorPan: KycDocument[];
  supportingDocuments: KycDocument[];
};

/** Build a Firestore-safe KYC document — never includes `undefined` optional fields. */
export function buildKycFirestoreData(input: KycSavePayload): Record<string, unknown> {
  return stripUndefined({
    fileNo: input.fileNo,
    gstin: input.gstin,
    companyName: input.companyName,
    billingAddress: input.billingAddress,
    branchAddresses: input.branchAddresses,
    pan: input.pan,
    iec: input.iec,
    adCode: input.adCode,
    loiNo: input.loiNo,
    loiDate: input.loiDate,
    email: input.email,
    phone: input.phone,
    directorAadhar: input.directorAadhar,
    directorPan: input.directorPan,
    supportingDocuments: input.supportingDocuments,
    ...(input.gstStatus ? { gstStatus: input.gstStatus } : {}),
    ...(input.gstinDocument ? { gstinDocument: input.gstinDocument } : {}),
    ...(input.panDocument ? { panDocument: input.panDocument } : {}),
    ...(input.iecDocument ? { iecDocument: input.iecDocument } : {}),
    ...(input.adCodeDocument ? { adCodeDocument: input.adCodeDocument } : {}),
    ...(input.loiDocument ? { loiDocument: input.loiDocument } : {}),
  });
}
