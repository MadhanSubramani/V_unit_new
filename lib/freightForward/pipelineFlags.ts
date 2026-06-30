import { StatusTimeline } from "@/types/freightForward";

export type PipelineFlags = {
  pendingMomentum: boolean;
  pendingSplitManifest: boolean;
  pendingBilling: boolean;
  pendingReceivable: boolean;
  pendingPayable: boolean;
  workflowCompleted: boolean;
};

export function computePipelineFlags(timeline?: StatusTimeline[]): PipelineFlags {
  const visited = new Set((timeline ?? []).map((entry) => entry.status));

  return {
    pendingMomentum: !visited.has("momentum"),
    pendingSplitManifest: !visited.has("split_manifest"),
    pendingBilling: !visited.has("billing"),
    pendingReceivable: !visited.has("receivable"),
    pendingPayable: !visited.has("payable"),
    workflowCompleted: visited.has("completed"),
  };
}
