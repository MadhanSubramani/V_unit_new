import { Timestamp } from "firebase/firestore";
import {
  FreightForward,
  FreightForwardStatus,
  StatusTimeline,
} from "@/types/freightForward";

const WORKFLOW: {
  key: FreightForwardStatus;
  label: string;
  role: "operations" | "accountant";
}[] = [
    { key: "in_process", label: "In Process", role: "operations" },
    { key: "momentum", label: "Momentum", role: "operations" },
    { key: "split_manifest", label: "Split Manifest", role: "operations" },
    { key: "billing", label: "Billing", role: "accountant" },
    { key: "receivable", label: "Receivable", role: "accountant" },
    { key: "payable", label: "Payable", role: "accountant" },
    { key: "completed", label: "Completed", role: "accountant" },
  ];

type TimelineItem = StatusTimeline;

type Props = {
  selected: FreightForward;
  currentUserRole: string;
  onComplete: (nextStatus: FreightForwardStatus) => Promise<void>;
};

export default function WorkflowTimeline({
  selected,
  currentUserRole,
  onComplete,
}: Props) {
  const currentIndex = WORKFLOW.findIndex(
    (x) => x.key === selected.status
  );

  return (
    <div className="rounded-xl border bg-white p-5 mb-6">

      <h3 className="font-semibold text-base mb-5">
        Workflow Timeline
      </h3>

      {WORKFLOW.map((step, index) => {

        const history =
          selected.statusTimeline?.find(
            (x: TimelineItem) => x.status === step.key
          );

        const completed = index < currentIndex;
        const current = index === currentIndex;
        const next = index === currentIndex + 1;
        const canUpdate =
          next &&
          (
            (step.role === "operations" && ((currentUserRole === "operations" || currentUserRole === "admin") || (currentUserRole === "operations" || currentUserRole === "user"))) ||
            (step.role === "accountant" && currentUserRole === "accountant")
          );

        return (

          <div
            key={step.key}
            className="flex gap-4"
          >

            <div className="flex flex-col items-center">

              <div
                className={`
                  h-5
                  w-5
                  rounded-full
                  ${completed
                    ? "bg-green-500"
                    : current
                      ? "bg-blue-500"
                      : "bg-zinc-300"
                  }
                `}
              />

              {index !== WORKFLOW.length - 1 && (
                <div className="w-px h-12 bg-zinc-300" />
              )}

            </div>

            <div className="pb-8 flex-1">

              <h4 className="font-medium">
                {step.label}
              </h4>

              {history && (
                <>
                  <p className="text-xs text-zinc-500">
                    Updated By : {history.updatedBy}
                  </p>

                  <p className="text-xs text-zinc-500">
                    {history.updatedAt
                      ?.toDate()
                      .toLocaleString()}
                  </p>
                </>
              )}

              {current && (
                <span className="text-blue-600 text-xs">
                  Current Stage
                </span>
              )}

              {next && canUpdate && (
                <button
                  onClick={() => onComplete(step.key)}
                  className="mt-2 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  Complete
                </button>
              )}

              {next && !canUpdate && (
                <p className="text-xs text-red-500 mt-2">
                  Only {step.role} can complete this stage.
                </p>
              )}

              {!completed &&
                !current &&
                !next && (
                  <span className="text-xs text-zinc-400">
                    Waiting...
                  </span>
                )}

            </div>

          </div>

        );
      })}

    </div>
  );
}