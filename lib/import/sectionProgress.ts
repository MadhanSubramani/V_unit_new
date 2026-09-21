import { FreightForward, ImportAuditStamp } from "@/types/freightForward";
import { formatImportAuditDate } from "@/lib/import/auditDisplay";
import { isImportLinerCompleted } from "@/lib/import/linerWorkflow";
import { isImportBoeInCompleted } from "@/lib/import/boeInWorkflow";
import { isImportBoeOutDispatched } from "@/lib/import/boeOutWorkflow";
import { isImportTransportCompleted } from "@/lib/import/transportWorkflow";
import { isImportAccountsCompleted } from "@/lib/import/accountsWorkflow";

export type ImportProgressStep = {
  key: string;
  label: string;
  complete: boolean;
  updatedBy?: string;
  updatedAtLabel: string;
};

function toStep(
  key: string,
  label: string,
  complete: boolean,
  audit?: ImportAuditStamp
): ImportProgressStep {
  return {
    key,
    label,
    complete,
    updatedBy: audit?.updatedBy,
    updatedAtLabel: audit?.updatedAt
      ? formatImportAuditDate(audit.updatedAt)
      : "—",
  };
}

function latestLinerAudit(item: FreightForward): ImportAuditStamp | undefined {
  const timeline = [...(item.importWorkflowTimeline ?? [])].reverse();
  const doDone = timeline.find(
    (row) =>
      row.section === "do" &&
      (row.status === "received" || row.status === "eod")
  );
  const entry = doDone ?? timeline[0];
  if (entry) {
    return { updatedBy: entry.updatedBy, updatedAt: entry.updatedAt };
  }
  return (
    item.importDoRemarks?.at(-1) ??
    item.importIgmRemarkAudit ??
    item.importMovementRemarkAudit
  );
}

export function getImportModuleProgressSteps(
  item: FreightForward
): ImportProgressStep[] {
  return [
    toStep("liner", "Liner", isImportLinerCompleted(item), latestLinerAudit(item)),
    toStep(
      "ztype",
      "Z type BE",
      isImportBoeInCompleted(item),
      item.importBoeInCompleteAudit ??
        item.importBoeInOocCompleteAudit ??
        item.importBoeInInwardSaveAudit ??
        item.importBoeChecklistAudit
    ),
    toStep(
      "transport",
      "Transport",
      isImportTransportCompleted(item),
      item.importTransportCompleteAudit ??
        item.importCfsReachedAudit ??
        item.importPortDirectionAudit
    ),
    toStep(
      "ttype",
      "T type BE",
      isImportBoeOutDispatched(item),
      item.importBoeOutDispatchAudit ??
        item.importTTypeOocCompleteAudit ??
        item.importTTypeBoeSaveAudit ??
        item.importBoeOutDutyAudit ??
        item.importEwayBillAudit
    ),
    toStep(
      "accounts",
      "Accounts",
      isImportAccountsCompleted(item),
      item.importAccountsCompleteAudit ??
        item.importAccountsPaymentAudit ??
        item.importAccountsBillingAudit
    ),
  ];
}
