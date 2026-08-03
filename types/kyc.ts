export interface KycDocument {
  name: string;
  url: string;
}

export interface Kyc {
  id?: string;
  fileNo?: string;

  gstin: string;
  gstStatus?: string;
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

  /** Primary email (first of emails). Kept for backward compatibility. */
  email: string;
  /** Primary phone (first of phones). Kept for backward compatibility. */
  phone: string;
  /** All emails; when missing, treat [email] as the list. */
  emails?: string[];
  /** All phones; when missing, treat [phone] as the list. */
  phones?: string[];

  directorAadhar?: KycDocument[];
  directorPan?: KycDocument[];
  supportingDocuments?: KycDocument[];

  /** @deprecated use branchAddresses */
  deliveryAddress?: string;

  createdAt?: unknown;
}
