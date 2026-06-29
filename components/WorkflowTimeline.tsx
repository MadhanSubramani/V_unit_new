import { Timestamp } from "firebase/firestore";
import {
  FreightForward,
  FreightForwardStatus,
  StatusTimeline,
} from "@/types/freightForward";
import { Check,Clock3 } from "lucide-react";

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

      {/* {WORKFLOW.map((step, index) => {

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
      })} */}
      {WORKFLOW.map((step, index) => {
  const history = selected.statusTimeline?.find(
    (x: TimelineItem) => x.status === step.key
  );

  const completed = index < currentIndex;
  const current = index === currentIndex;
  const next = index === currentIndex + 1;

  const canUpdate =
    next &&
    (
      (step.role === "operations" &&
        (
          currentUserRole === "operations" ||
          currentUserRole === "admin" ||
          currentUserRole === "user"
        )) ||
      (step.role === "accountant" &&
        currentUserRole === "accountant")
    );

  return (
    <div key={step.key} className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">

        {/* Circle */}
        {/* <div
          className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all
            ${
              completed
                ? "bg-black text-white"
                : current
                ? "bg-black text-white ring-4 ring-zinc-200"
                : "border-2 border-zinc-300 bg-white"
            }`}
        >
          {completed && <Check size={15} strokeWidth={3} />}
        </div> */}
        <div
  className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all
    ${
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

        {/* Line */}
        {index !== WORKFLOW.length - 1 && (
          <div
            className={`mt-1 w-0.5 flex-1 ${
              completed ? "bg-black" : "bg-zinc-300"
            }`}
            style={{ minHeight: 52 }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-zinc-900">
            {step.label}
          </h4>

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
              Updated by <span className="font-medium">{history.updatedBy}</span>
            </p>

            <p className="text-xs text-zinc-400">
              {history.updatedAt?.toDate().toLocaleString()}
            </p>
          </>
        )}

        {next && canUpdate && (
          <button
            onClick={() => onComplete(step.key)}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            Complete Stage
          </button>
        )}

        {next && !canUpdate && (
          <p className="mt-3 text-xs text-red-500">
            Only <span className="font-medium">{step.role}</span> can complete this stage.
          </p>
        )}

        {!completed && !current && !next && (
          <p className="mt-2 text-xs text-zinc-400">
            Waiting for previous stage...
          </p>
        )}
      </div>
    </div>
  );
})}

    </div>
  );
}