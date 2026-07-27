import { Timestamp } from "firebase/firestore";

export interface FreightForwardCounts {
  inProcess: number;
  next7Days: number;
  movement: number;
  splitManifest: number;
  completedCount: number;
  incompleteCount: number;
  pendingBilling: number;
  pendingReceivable: number;
  pendingPayable: number;
  updatedAt?: Timestamp;
}

export type FreightForwardCountsKey = keyof Omit<
  FreightForwardCounts,
  "updatedAt"
>;
