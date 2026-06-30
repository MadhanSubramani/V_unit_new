import {
  collection,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FreightForward } from "@/types/freightForward";
import { normalizeEtaSort } from "@/lib/freightForward/etaSort";
import { computePipelineFlags } from "@/lib/freightForward/pipelineFlags";

/** One-time helper: set etaSort + pipeline flags on existing freightForward docs. */
export async function backfillFreightForwardIndexFields() {
  const snap = await getDocs(collection(db, "freightForward"));
  let batch = writeBatch(db);
  let ops = 0;
  let updated = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as FreightForward;
    const flags = computePipelineFlags(data.statusTimeline);
    const etaSort = normalizeEtaSort(data.eta);

    const needsUpdate =
      data.etaSort !== etaSort ||
      data.pendingBilling !== flags.pendingBilling ||
      data.pendingReceivable !== flags.pendingReceivable ||
      data.pendingPayable !== flags.pendingPayable ||
      data.pendingMomentum !== flags.pendingMomentum ||
      data.pendingSplitManifest !== flags.pendingSplitManifest ||
      data.workflowCompleted !== flags.workflowCompleted;

    if (!needsUpdate) continue;

    batch.update(doc(db, "freightForward", docSnap.id), {
      etaSort,
      ...flags,
    });
    ops += 1;
    updated += 1;

    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  return updated;
}
