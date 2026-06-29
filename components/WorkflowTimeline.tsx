import { useEffect, useMemo, useState } from "react";
import {
  FreightForward,
  FreightForwardStatus,
  FREIGHT_FORWARD_STATUSES,
  StatusTimeline,
} from "@/types/freightForward";
import { Check, Clock3 } from "lucide-react";

const WORKFLOW: {
  key: FreightForwardStatus;
  label: string;
  role: "operations" | "accountant";
}[] = [
  { key: "in_process", label: "In Process", role: "operations" },
  { key: "momentum", label: "Movement", role: "operations" },
  { key: "split_manifest", label: "Split Manifest", role: "operations" },
  { key: "billing", label: "Billing", role: "accountant" },
  { key: "receivable", label: "Receivable", role: "accountant" },
  { key: "payable", label: "Payable", role: "accountant" },
  { key: "completed", label: "Completed", role: "accountant" },
];

const ALL_STATUSES = FREIGHT_FORWARD_STATUSES.map((s) => s.value);
const ACCOUNTANT_STATUSES: FreightForwardStatus[] = [
  "billing",
  "receivable",
  "payable",
  "completed",
];


type Props = {
  selected: FreightForward;
  currentUserRole: string;
  onComplete: (nextStatus: FreightForwardStatus) => Promise<void>;
};

function getStepState(
  stepKey: FreightForwardStatus,
  currentStatus: FreightForwardStatus,
  timeline?: StatusTimeline[]
) {
  const visited = new Set(
    (timeline ?? []).map((entry) => entry.status as FreightForwardStatus)
  );

  const current = currentStatus === stepKey;
  const completed = visited.has(stepKey) && !current;

  return { current, completed, history: timeline?.find((x) => x.status === stepKey) };
}

function getVisitedStatuses(timeline?: StatusTimeline[]) {
  return new Set(
    (timeline ?? []).map((entry) => entry.status as FreightForwardStatus)
  );
}

function getJumpOptions(
  role: string,
  timeline?: StatusTimeline[]
): FreightForwardStatus[] {
  const visited = getVisitedStatuses(timeline);
  const baseOptions =
    role === "admin"
      ? ALL_STATUSES
      : role === "accountant"
        ? ACCOUNTANT_STATUSES
        : [];

  return baseOptions.filter((status) => !visited.has(status));
}

function getNextStatus(current: FreightForwardStatus): FreightForwardStatus | null {
  const index = WORKFLOW.findIndex((step) => step.key === current);
  if (index < 0 || index >= WORKFLOW.length - 1) return null;
  return WORKFLOW[index + 1].key;
}

export default function WorkflowTimeline({
  selected,
  currentUserRole,
  onComplete,
}: Props) {
  const [jumpStatus, setJumpStatus] = useState<FreightForwardStatus>(selected.status);
  const [updating, setUpdating] = useState(false);

  const jumpOptions = useMemo(
    () => getJumpOptions(currentUserRole, selected.statusTimeline),
    [currentUserRole, selected.statusTimeline]
  );

  useEffect(() => {
    if (jumpOptions.length === 0) return;
    if (!jumpOptions.includes(jumpStatus)) {
      setJumpStatus(jumpOptions[0]);
    }
  }, [jumpOptions, jumpStatus]);

  const canJumpStatus =
    (currentUserRole === "admin" || currentUserRole === "accountant") &&
    jumpOptions.length > 0;

  const handleJump = async () => {
    if (jumpStatus === selected.status) return;
    setUpdating(true);
    try {
      await onComplete(jumpStatus);
    } finally {
      setUpdating(false);
    }
  };

  const nextStatus = getNextStatus(selected.status);
  const nextStep = nextStatus
    ? WORKFLOW.find((step) => step.key === nextStatus)
    : undefined;

  const canCompleteNext =
    currentUserRole === "user" &&
    nextStep &&
    nextStep.role === "operations" &&
    nextStatus !== null;

  return (
    <div className="mb-6 rounded-xl border bg-white p-5">
      <h3 className="mb-5 text-base font-semibold">Workflow Timeline</h3>

      {canJumpStatus && (
        <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="mb-2 text-xs font-medium text-zinc-600">Update status</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={jumpStatus}
              onChange={(e) => setJumpStatus(e.target.value as FreightForwardStatus)}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              {jumpOptions.map((status) => {
                const label =
                  FREIGHT_FORWARD_STATUSES.find((s) => s.value === status)?.label ??
                  status;
                return (
                  <option key={status} value={status}>
                    {label}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={handleJump}
              disabled={updating || !jumpStatus}
              className="rounded-xl bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
            >
              {updating ? "Updating..." : "Apply Status"}
            </button>
          </div>
          {currentUserRole === "admin" && (
            <p className="mt-2 text-[11px] text-zinc-500">
              Only statuses not yet updated are shown.
            </p>
          )}
          {currentUserRole === "accountant" && (
            <p className="mt-2 text-[11px] text-zinc-500">
              Only billing stages not yet updated are shown.
            </p>
          )}
        </div>
      )}

      {canCompleteNext && nextStatus && (
        <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="mb-2 text-xs text-zinc-600">
            Next stage:{" "}
            <span className="font-medium text-zinc-900">{nextStep?.label}</span>
          </p>
          <button
            type="button"
            onClick={() => onComplete(nextStatus)}
            className="rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            Complete Stage
          </button>
        </div>
      )}

      {WORKFLOW.map((step, index) => {
        const { current, completed, history } = getStepState(
          step.key,
          selected.status,
          selected.statusTimeline
        );

        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                  completed
                    ? "bg-black text-white"
                    : current
                      ? "bg-black text-white ring-4 ring-zinc-200"
                      : "border-2 border-zinc-300 bg-white"
                }`}
              >
                {completed && <Check size={15} strokeWidth={3} />}
                {current && <Clock3 size={14} strokeWidth={2.5} />}
                {!completed && !current && (
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                )}
              </div>

              {index !== WORKFLOW.length - 1 && (
                <div
                  className={`mt-1 w-0.5 flex-1 ${completed ? "bg-black" : "bg-zinc-300"}`}
                  style={{ minHeight: 52 }}
                />
              )}
            </div>

            <div className="flex-1 pb-8">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-zinc-900">{step.label}</h4>

                {completed && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                    Completed
                  </span>
                )}

                {current && (
                  <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
                    Current
                  </span>
                )}
              </div>

              {history && (
                <>
                  <p className="mt-2 text-xs text-zinc-500">
                    Updated by{" "}
                    <span className="font-medium">{history.updatedBy}</span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    {history.updatedAt?.toDate().toLocaleString()}
                  </p>
                </>
              )}

              {!completed && !current && (
                <p className="mt-2 text-xs text-zinc-400">Waiting...</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
