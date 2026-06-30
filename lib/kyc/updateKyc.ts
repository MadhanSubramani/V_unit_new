import { doc, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/kyc/stripUndefined";

export async function updateKyc(id: string, data: Record<string, unknown>) {
  const cleaned = stripUndefined(data);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, "kyc", id), cleaned);
}
