import {
  FREIGHT_FORWARD_STATUSES,
  FreightForwardStatus,
  StatusTimeline,
} from "@/types/freightForward";

export const WORKFLOW_STEPS: {
  key: FreightForwardStatus;
  label: string;
}[] = [
  { key: "in_process", label: "In Process" },
  { key: "momentum", label: "Movement" },
  { key: "split_manifest", label: "Split Manifest" },
  { key: "billing", label: "Billing" },
  { key: "receivable", label: "Receivable" },
  { key: "payable", label: "Payable" },
  { key: "completed", label: "Completed" },
];

export function getVisitedStatuses(timeline?: StatusTimeline[]) {
  return new Set(
    (timeline ?? []).map((entry) => entry.status as FreightForwardStatus)
  );
}

export function statusLabel(status: FreightForwardStatus) {
  return (
    WORKFLOW_STEPS.find((step) => step.key === status)?.label ??
    FREIGHT_FORWARD_STATUSES.find((item) => item.value === status)?.label ??
    status
  );
}

export function getMissingPrerequisites(
  target: FreightForwardStatus,
  timeline?: StatusTimeline[]
) {
  const visited = getVisitedStatuses(timeline);
  const targetIndex = WORKFLOW_STEPS.findIndex((step) => step.key === target);
  if (targetIndex <= 0) return [];

  return WORKFLOW_STEPS.slice(0, targetIndex)
    .map((step) => step.key)
    .filter((status) => !visited.has(status));
}

export function canUpdateToStatus(
  target: FreightForwardStatus,
  timeline?: StatusTimeline[]
) {
  if (target !== "completed") return true;
  return getMissingPrerequisites(target, timeline).length === 0;
}

function getRoleCandidates(role: string): FreightForwardStatus[] {
  if (role === "admin") {
    return WORKFLOW_STEPS.map((step) => step.key).filter(
      (status) => status !== "in_process"
    );
  }
  if (role === "user") {
    return ["momentum", "split_manifest", "completed"];
  }
  if (role === "accountant") {
    return ["billing", "receivable", "payable", "completed"];
  }
  return [];
}

export type StatusDropdownOption = {
  value: FreightForwardStatus;
  label: string;
  disabled: boolean;
};

export function getStatusDropdownOptions(
  role: string,
  timeline?: StatusTimeline[]
): StatusDropdownOption[] {
  const visited = getVisitedStatuses(timeline);

  return getRoleCandidates(role).map((status) => ({
    value: status,
    label: statusLabel(status),
    disabled:
      visited.has(status) ||
      !canUpdateToStatus(status, timeline),
  }));
}

/** @deprecated use getStatusDropdownOptions */
export function getJumpOptions(
  role: string,
  timeline?: StatusTimeline[]
): FreightForwardStatus[] {
  return getStatusDropdownOptions(role, timeline)
    .filter((option) => !option.disabled)
    .map((option) => option.value);
}

export function getNextAllowedStatus(
  currentStatus: FreightForwardStatus,
  timeline?: StatusTimeline[]
): FreightForwardStatus | null {
  const visited = getVisitedStatuses(timeline);
  const currentIndex = WORKFLOW_STEPS.findIndex((step) => step.key === currentStatus);
  if (currentIndex < 0) return null;

  for (let index = currentIndex + 1; index < WORKFLOW_STEPS.length; index++) {
    const candidate = WORKFLOW_STEPS[index].key;
    if (!visited.has(candidate) && canUpdateToStatus(candidate, timeline)) {
      return candidate;
    }
  }

  return null;
}
