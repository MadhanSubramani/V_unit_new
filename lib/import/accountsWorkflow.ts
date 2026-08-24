import {
  FreightForward,
  ImportAccountsBillingStatus,
  ImportAccountsPaymentStatus,
} from "@/types/freightForward";
import { isImportTransportCompleted } from "@/lib/import/transportWorkflow";

export type ImportAccountsCard =
  | "inProcess"
  | "billingPending"
  | "paymentPending"
  | "completed";

export function getImportAccountsBillingStatus(
  item: FreightForward
): ImportAccountsBillingStatus {
  return item.importAccountsBillingStatus === "completed"
    ? "completed"
    : "pending";
}

export function getImportAccountsPaymentStatus(
  item: FreightForward
): ImportAccountsPaymentStatus {
  return item.importAccountsPaymentStatus === "received"
    ? "received"
    : "pending";
}

export function isImportAccountsCompleted(item: FreightForward) {
  return item.importAccountsCompleted === true;
}

export function matchesImportAccountsCard(
  item: FreightForward,
  card: ImportAccountsCard
) {
  const completed = isImportAccountsCompleted(item);
  const billingDone = getImportAccountsBillingStatus(item) === "completed";
  const paymentReceived =
    getImportAccountsPaymentStatus(item) === "received";

  switch (card) {
    case "inProcess":
      return !completed;
    case "billingPending":
      return !completed && !billingDone;
    case "paymentPending":
      return !completed && billingDone && !paymentReceived;
    case "completed":
      return completed;
  }
}

export function computeImportAccountsCounts(records: FreightForward[]) {
  const completed = records.filter(isImportAccountsCompleted).length;
  return {
    inProcess: records.length - completed,
    billingPending: records.filter((item) =>
      matchesImportAccountsCard(item, "billingPending")
    ).length,
    paymentPending: records.filter((item) =>
      matchesImportAccountsCard(item, "paymentPending")
    ).length,
    completed,
  };
}

export function getImportAccountsRecords(records: FreightForward[]) {
  return records.filter(isImportTransportCompleted);
}
