export interface KycDocument {
  name: string;
  url: string;
}

export interface Kyc {
  id?: string;

  gstin: string;
  companyName: string;

  billingAddress: string;
  deliveryAddress: string;

  pan: string;
  iec: string;
  adCode: string;

  email: string;
  phone: string;

  directorAadhar?: KycDocument;
  directorPan?: KycDocument;
  loi?: KycDocument;

  supportingDocuments?: KycDocument[];

  createdAt?: any;
}