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

export interface FreightContainer {
  containerNumber: string;
  containerSize?: string;
  containerType?: string;
}

export type ImportMovementStatus = "pending" | "accepted" | "completed";
export type ImportIgmStatus = "pending" | "posted";
export type ImportDoStatus = "pending" | "received" | "eod";
export type ImportWorkflowSection = "movement" | "igm" | "do";

export type ImportWorkflowTimelineEntry =
  | {
      section: "movement";
      status: ImportMovementStatus;
      updatedBy: string;
      updatedAt: Timestamp;
    }
  | {
      section: "igm";
      status: ImportIgmStatus;
      updatedBy: string;
      updatedAt: Timestamp;
    }
  | {
      section: "do";
      status: ImportDoStatus;
      updatedBy: string;
      updatedAt: Timestamp;
    };

export interface FreightForward {
  id?: string;
  jobNumber?: string;
  ezRefNumber?: string;
  consignmentName: string;
  clientName?: string;
  tradeTerms?: string;
  mbl: string;
  hbl: string;
  blType?: string;
  mblUrl?: FreightForwardDocument;
  hblUrl?: FreightForwardDocument;
  containerNumber: string;
  containerSize?: string;
  containerType?: string;
  /** New multi-container storage; legacy flat fields kept for older records. */
  containers?: FreightContainer[];
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
  /** Per-container rate entered in the form. */
  oceanFreightPerContainer?: number;
  /** Total ocean freight (per-container rate × container count). */
  oceanFreight?: number;
  exWorks?: ExWorksItem[];
  otherExpenses?: ExpenseItem[];
  debit?: number;
  debitDocuments?: FreightForwardDocument[];
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
  /** Normalized ETA (YYYY-MM-DD) for server-side sorting */
  etaSort?: string;
  pendingMomentum?: boolean;
  pendingSplitManifest?: boolean;
  pendingBilling?: boolean;
  pendingReceivable?: boolean;
  pendingPayable?: boolean;
  workflowCompleted?: boolean;
  /** When true, the same document is listed in Import > Liner. */
  useForImport?: boolean;
  /** Where the job was originally created. Defaults to freight_forward for older records. */
  createdFrom?: "import" | "freight_forward";
  importMovementStatus?: ImportMovementStatus;
  importIgmStatus?: ImportIgmStatus;
  importDoStatus?: ImportDoStatus;
  /** True only when Movement=Completed, IGM=Posted, and DO=EOD. */
  importCompleted?: boolean;
  importWorkflowTimeline?: ImportWorkflowTimelineEntry[];
  /** Remarks shown when a liner stage is still pending. */
  importMovementRemark?: string;
  importIgmRemark?: string;
  importDoRemark?: string;
  /** Extra named documents captured from Import Add / documents section. */
  otherDocuments?: FreightForwardDocument[];
  /** Lowercase search helpers for scalable filtering/prefix queries. */
  searchText?: string;
  searchJobNumber?: string;
  searchMbl?: string;
  searchHbl?: string;
  searchEzRef?: string;
  searchVessel?: string;
  searchConsignee?: string;
  searchClient?: string;
  searchAgent?: string;
  searchContainer?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  statusTimeline?: StatusTimeline[];
  /** Soft-delete flag; missing/false = active job. */
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: Date | Timestamp | unknown;
}

export const CONTAINER_NUMBER_REGEX = /^[A-Z]{4}\d{7}$/;

export type FreightForwardFormData = Omit<
  FreightForward,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
  | "isDeleted"
  | "deletedBy"
  | "deletedAt"
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