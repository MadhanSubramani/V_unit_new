import { Timestamp } from "firebase/firestore";

export type FreightForwardStatus =
  | "in_process"
  | "momentum"
  | "split_manifest"
  | "billing"
  | "receivable"
  | "payable"
  | "completed";

export const FREIGHT_FORWARD_STATUSES: {
  value: FreightForwardStatus;
  label: string;
  order: number;
}[] = [
  { value: "in_process", label: "IN_PROCESS", order: 1 },
  { value: "momentum", label: "Momentum", order: 2 },
  { value: "split_manifest", label: "Split Manifest", order: 3 },
  { value: "billing", label: "Billing", order: 4 },
  { value: "receivable", label: "Receivable", order: 5 },
  { value: "payable", label: "Payable", order: 6 },
  { value: "completed", label: "Completed", order: 7 },
];

export interface ExpenseItem {
  name: string;
  amount: number;
}

export type ExWorksItem = ExpenseItem;

export interface FreightForwardDocument {
  name: string;
  url: string;
}

export interface FreightForward {
  id?: string;
  jobNumber?: string;
  ezRefNumber?: string;
  consignmentName: string;
  mbl: string;
  hbl: string;
  mblUrl?: FreightForwardDocument;
  hblUrl?: FreightForwardDocument;
  containerNumber: string;
  containerSize?: string;
  containerType?: string;
  etd?: string;
  eta?: string;
  vesselName?: string;
  pol?: string;
  pod?: string;
  locationType?: "cfs" | "sez";
  cfs?: string;
  sez?: string;
  liner?: string;
  agent?: string;
  oceanFreight?: number;
  exWorks?: ExWorksItem[];
  otherExpenses?: ExpenseItem[];
  totalExpenses?: number;
  billedAmount?: number;
  billedAmountUrl?: FreightForwardDocument;
  creditNote?: number;
  creditNoteUrl?: FreightForwardDocument;
  /** @deprecated use billedAmount */
  buildAmount?: number;
  paymentType?: string;
  paymentDate?: string;
  paymentDateUrl?: FreightForwardDocument;
  status: FreightForwardStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  statusTimeline?: StatusTimeline[];
}

export const CONTAINER_NUMBER_REGEX = /^[A-Z]{4}\d{7}$/;

export type FreightForwardFormData = Omit<
  FreightForward,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

export enum FreightForwardStatusObject {
  IN_PROCESS = "in_process",
  MOMENTUM = "momentum",
  SPLIT_MANIFEST = "split_manifest",
  BILLING = "billing",
  RECEIVABLE = "receivable",
  PAYABLE = "payable",
  COMPLETED = "completed",
}

export interface StatusTimeline {
  status: string;
  updatedBy: string;
  updatedAt: Timestamp;
}