export interface KycDocument {
  name: string;
  url: string;
}

export interface Kyc {
  id?: string;
  fileNo?: string;

  gstin: string;
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

  directorAadhar?: KycDocument[];
  directorPan?: KycDocument[];
  supportingDocuments?: KycDocument[];

  /** @deprecated use branchAddresses */
  deliveryAddress?: string;

  createdAt?: unknown;
}
