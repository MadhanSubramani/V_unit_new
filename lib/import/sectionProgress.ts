import { FreightForward, ImportAuditStamp, ImportWorkflowSection } from "@/types/freightForward";
import { formatImportAuditDate } from "@/lib/import/auditDisplay";
import {
  getImportDoStatus,
  getImportIgmStatus,
  getImportMovementStatus,
  getImportMovementStatusLabel,
  isImportLinerCompleted,
} from "@/lib/import/linerWorkflow";
import {
  BOE_CHECKLIST_ITEMS,
  getBoeFilingStatus,
  isBoeChecklistComplete,
  isImportBoeInCompleted,
} from "@/lib/import/boeInWorkflow";
import {
  getImportBoeOutDutyStatus,
  getImportBoeOutInwardOccStatus,
  getImportTTypeEntries,
  isImportBoeOutDispatched,
  isTTypeEntryCompleted,
} from "@/lib/import/boeOutWorkflow";
import {
  getImportTruckDetails,
  isImportTransportCompleted,
} from "@/lib/import/transportWorkflow";
import {
  getImportAccountsBillingStatus,
  getImportAccountsPaymentStatus,
  isImportAccountsCompleted,
} from "@/lib/import/accountsWorkflow";

export type ImportProgressDetail = {
  label: string;
  value: string;
  updatedBy?: string;
  updatedAtLabel?: string;
};

export type ImportProgressStep = {
  key: string;
  label: string;
  complete: boolean;
  updatedBy?: string;
  updatedAtLabel: string;
  details: ImportProgressDetail[];
};

function pretty(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  return trimmed.replace(/_/g, " ");
}

function fromAudit(audit?: Partial<ImportAuditStamp> | null): Pick<
  ImportProgressDetail,
  "updatedBy" | "updatedAtLabel"
> {
  if (!audit) return {};
  return {
    updatedBy: audit.updatedBy || undefined,
    updatedAtLabel: audit.updatedAt ? formatImportAuditDate(audit.updatedAt) : undefined,
  };
}

function detail(
  label: string,
  value: string,
  audit?: Partial<ImportAuditStamp> | null
): ImportProgressDetail {
  return { label, value, ...fromAudit(audit) };
}

function linerSectionAudit(
  item: FreightForward,
  section: ImportWorkflowSection
): ImportAuditStamp | undefined {
  const row = [...(item.importWorkflowTimeline ?? [])]
    .reverse()
    .find((entry) => entry.section === section);
  if (row) return { updatedBy: row.updatedBy, updatedAt: row.updatedAt };
  if (section === "movement") return item.importMovementRemarkAudit;
  if (section === "igm") return item.importIgmRemarkAudit;
  return item.importDoRemarks?.at(-1);
}

function latestLinerAudit(item: FreightForward): ImportAuditStamp | undefined {
  return (
    linerSectionAudit(item, "do") ??
    linerSectionAudit(item, "igm") ??
    linerSectionAudit(item, "movement")
  );
}

function linerDetails(item: FreightForward): ImportProgressDetail[] {
  const rows: ImportProgressDetail[] = [
    detail(
      "Movement",
      getImportMovementStatusLabel(getImportMovementStatus(item)),
      linerSectionAudit(item, "movement")
    ),
  ];

  (item.importWorkflowTimeline ?? [])
    .filter((entry) => entry.section === "movement")
    .forEach((entry) => {
      rows.push(
        detail(
          `Movement · ${getImportMovementStatusLabel(entry.status)}`,
          getImportMovementStatusLabel(entry.status),
          {
            updatedBy: entry.updatedBy,
            updatedAt: entry.updatedAt,
          }
        )
      );
    });
  if (item.importMovementRemark?.trim()) {
    rows.push(
      detail("Movement remark", item.importMovementRemark.trim(), item.importMovementRemarkAudit)
    );
  }
  (item.importMovementRemarks ?? []).forEach((remark) => {
    rows.push(detail("Movement remark", remark.text, remark));
  });

  rows.push(
    detail(
      "IGM",
      pretty(getImportIgmStatus(item)),
      linerSectionAudit(item, "igm")
    )
  );
  (item.importWorkflowTimeline ?? [])
    .filter((entry) => entry.section === "igm")
    .forEach((entry) => {
      rows.push(
        detail(`IGM · ${pretty(entry.status)}`, pretty(entry.status), {
          updatedBy: entry.updatedBy,
          updatedAt: entry.updatedAt,
        })
      );
    });
  rows.push(
    detail("IGM attachment", item.importIgmAttachment?.name?.trim() || (item.importIgmAttachment?.url ? "Uploaded" : "Not uploaded"))
  );
  if (item.importIgmRemark?.trim()) {
    rows.push(detail("IGM remark", item.importIgmRemark.trim(), item.importIgmRemarkAudit));
  }
  (item.importIgmRemarks ?? []).forEach((remark) => {
    rows.push(detail("IGM remark", remark.text, remark));
  });

  rows.push(
    detail(
      "DO status",
      pretty(getImportDoStatus(item)),
      linerSectionAudit(item, "do")
    )
  );
  (item.importWorkflowTimeline ?? [])
    .filter((entry) => entry.section === "do")
    .forEach((entry) => {
      rows.push(
        detail(`DO · ${pretty(entry.status)}`, pretty(entry.status), {
          updatedBy: entry.updatedBy,
          updatedAt: entry.updatedAt,
        })
      );
    });
  rows.push(
    detail("Place of delivery", item.importDoPlaceOfDelivery?.trim() || "—"),
    detail("Port validity", item.importDoPostValidity?.trim() || "—"),
    detail("Empty validity", item.importDoEmptyValidity?.trim() || "—"),
    detail(
      "Port attachment",
      item.importDoPortAttachment?.name?.trim() ||
        (item.importDoPortAttachment?.url ? "Uploaded" : "Not uploaded")
    ),
    detail(
      "Empty attachment",
      item.importDoEmptyAttachment?.name?.trim() ||
        (item.importDoEmptyAttachment?.url ? "Uploaded" : "Not uploaded")
    )
  );
  if (item.importDoRemark?.trim()) {
    rows.push(detail("DO remark", item.importDoRemark.trim()));
  }
  (item.importDoRemarks ?? []).forEach((remark) => {
    rows.push(
      detail(remark.label || pretty(remark.category), remark.label || pretty(remark.category), remark)
    );
  });

  return rows;
}

function ztypeDetails(item: FreightForward): ImportProgressDetail[] {
  const rows: ImportProgressDetail[] = [
    detail(
      "Checklist",
      isBoeChecklistComplete(item) ? "Complete" : "Pending",
      item.importBoeChecklistAudit
    ),
  ];
  BOE_CHECKLIST_ITEMS.forEach((entry) => {
    const checked = item.importBoeChecklist?.[entry.key] === true;
    const stamp = item.importBoeChecklistCheckedAt?.[entry.key];
    rows.push(
      detail(entry.label, checked ? "Yes" : "No", stamp ? { updatedAt: stamp } : undefined)
    );
  });
  rows.push(
    detail("Filing", pretty(getBoeFilingStatus(item)), item.importBoeFilingAudit),
    detail("Z type BE No", item.inwardBoeNo?.trim() || "—", item.importBoeInInwardSaveAudit),
    detail("Z type BE Date", item.inwardBoeDate?.trim() || "—", item.importBoeInInwardSaveAudit),
    detail("Clearance", pretty(item.importBoeClearanceStatus)),
    detail(
      "OOC",
      item.importBoeInOocCompleted ? "Completed" : "Pending",
      item.importBoeInOocCompleteAudit
    ),
    detail(
      "Z type complete",
      isImportBoeInCompleted(item) ? "Completed" : "Pending",
      item.importBoeInCompleteAudit
    )
  );
  return rows;
}

function transportDetails(item: FreightForward): ImportProgressDetail[] {
  const rows: ImportProgressDetail[] = [];
  getImportTruckDetails(item).forEach((truck, index) => {
    const label = truck.containerNumber
      ? `Truck ${index + 1} (${truck.containerNumber})`
      : `Truck ${index + 1}`;
    const parts = [
      truck.importTransporter?.trim(),
      truck.importVehicleNo?.trim(),
      truck.importDriverName?.trim(),
    ].filter(Boolean);
    rows.push(
      detail(
        label,
        parts.length ? parts.join(" · ") : "Not entered",
        item.importTransportCompleteAudit
      )
    );
    if (truck.importScanningEnabled) {
      rows.push(
        detail(`${label} scanning`, pretty(truck.importScanningResult) || "Yes")
      );
    }
  });
  rows.push(
    detail(
      "Port direction",
      pretty(item.importPortDirection),
      item.importPortDirectionAudit
    ),
    detail(
      "CFS / FTWZ",
      pretty(item.importCfsReached),
      item.importCfsReachedAudit
    ),
    detail(
      "Transport",
      isImportTransportCompleted(item) ? "Completed" : "Pending",
      item.importTransportCompleteAudit
    )
  );
  return rows;
}

function ttypeDetails(item: FreightForward): ImportProgressDetail[] {
  const rows: ImportProgressDetail[] = [
    detail(
      "Inward OOC",
      getImportBoeOutInwardOccStatus(item) === "occ" ? "OOC" : "Pending",
      item.importBoeOutInwardOccAudit
    ),
  ];
  const entries = getImportTTypeEntries(item);
  if (!entries.length) {
    rows.push(detail("T type BE", "Not saved"));
  }
  entries.forEach((entry, index) => {
    const last = entry.statuses?.at(-1);
    rows.push(
      detail(
        `T type ${index + 1}`,
        [
          entry.boeNo || "—",
          entry.boeDate || "—",
          last ? pretty(last.status) : "No status",
          isTTypeEntryCompleted(entry) ? "Completed" : "Open",
        ].join(" · "),
        last
          ? { updatedBy: last.updatedBy, updatedAt: last.updatedAt }
          : item.importTTypeBoeSaveAudit
      )
    );
    (entry.statuses ?? []).forEach((status) => {
      rows.push(
        detail(
          `T type ${index + 1} status`,
          `${pretty(status.status)} · ${status.date || "—"}`,
          { updatedBy: status.updatedBy, updatedAt: status.updatedAt }
        )
      );
    });
  });
  const duty = getImportBoeOutDutyStatus(item);
  rows.push(
    detail("Duty", pretty(duty), item.importBoeOutDutyAudit)
  );
  if (duty === "paid" || duty === "final") {
    rows.push(
      detail("Acc value", item.importBoeOutDutyAccValue?.trim() || "—"),
      detail("Duty amt", item.importBoeOutDutyAmt?.trim() || "—")
    );
  }
  rows.push(
    detail("E waybill", pretty(item.importEwayBill), item.importEwayBillAudit),
    detail(
      "Vehicle change",
      item.importBoeOutVehicleChanged ? "Yes" : "No",
      item.importBoeOutVehicleChangeAudit
    ),
    detail(
      "Dispatch",
      isImportBoeOutDispatched(item) ? "Dispatched" : "Pending",
      item.importBoeOutDispatchAudit
    )
  );
  return rows;
}

function accountsDetails(item: FreightForward): ImportProgressDetail[] {
  return [
    detail(
      "Billing",
      pretty(getImportAccountsBillingStatus(item)),
      item.importAccountsBillingAudit
    ),
    detail("Billing remark", item.importAccountsBillingRemark?.trim() || "—"),
    detail(
      "Payment",
      pretty(getImportAccountsPaymentStatus(item)),
      item.importAccountsPaymentAudit
    ),
    detail("Payment remark", item.importAccountsPaymentRemark?.trim() || "—"),
    detail(
      "Accounts",
      isImportAccountsCompleted(item) ? "Completed" : "Pending",
      item.importAccountsCompleteAudit
    ),
  ];
}

function toStep(
  key: string,
  label: string,
  complete: boolean,
  audit: ImportAuditStamp | undefined,
  details: ImportProgressDetail[]
): ImportProgressStep {
  return {
    key,
    label,
    complete,
    updatedBy: audit?.updatedBy,
    updatedAtLabel: audit?.updatedAt ? formatImportAuditDate(audit.updatedAt) : "—",
    details,
  };
}

export function getImportModuleProgressSteps(
  item: FreightForward
): ImportProgressStep[] {
  return [
    toStep(
      "liner",
      "Liner",
      isImportLinerCompleted(item),
      latestLinerAudit(item),
      linerDetails(item)
    ),
    toStep(
      "ztype",
      "Z type BE",
      isImportBoeInCompleted(item),
      item.importBoeInCompleteAudit ??
        item.importBoeInOocCompleteAudit ??
        item.importBoeInInwardSaveAudit ??
        item.importBoeChecklistAudit,
      ztypeDetails(item)
    ),
    toStep(
      "transport",
      "Transport",
      isImportTransportCompleted(item),
      item.importTransportCompleteAudit ??
        item.importCfsReachedAudit ??
        item.importPortDirectionAudit,
      transportDetails(item)
    ),
    toStep(
      "ttype",
      "T type BE",
      isImportBoeOutDispatched(item),
      item.importBoeOutDispatchAudit ??
        item.importTTypeOocCompleteAudit ??
        item.importTTypeBoeSaveAudit ??
        item.importBoeOutDutyAudit ??
        item.importEwayBillAudit,
      ttypeDetails(item)
    ),
    toStep(
      "accounts",
      "Accounts",
      isImportAccountsCompleted(item),
      item.importAccountsCompleteAudit ??
        item.importAccountsPaymentAudit ??
        item.importAccountsBillingAudit,
      accountsDetails(item)
    ),
  ];
}
