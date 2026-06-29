import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const JOB_NUMBER_PREFIX = "FF0";

export async function generateJobNumber(): Promise<string> {
  const snapshot = await getDocs(collection(db, "freightForward"));
  let maxSeq = 0;

  for (const doc of snapshot.docs) {
    const jobNumber = doc.data().jobNumber as string | undefined;
    if (jobNumber?.startsWith(JOB_NUMBER_PREFIX)) {
      const seq = parseInt(jobNumber.slice(JOB_NUMBER_PREFIX.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return `${JOB_NUMBER_PREFIX}${maxSeq + 1}`;
}
