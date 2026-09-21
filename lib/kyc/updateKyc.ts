import { doc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/kyc/stripUndefined";
import { invalidateKycCache } from "@/lib/kyc/getKyc";
import { KycRemark } from "@/types/kyc";

export async function updateKyc(id: string, data: Record<string, unknown>) {
  const cleaned = stripUndefined(data);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, "kyc", id), cleaned);
  invalidateKycCache();
}

export async function addKycRemark(
  id: string,
  text: string,
  updatedBy: string
) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Remark is required.");
  const entry: KycRemark = {
    text: trimmed,
    updatedBy,
    updatedAt: Timestamp.now(),
  };
  await updateDoc(doc(db, "kyc", id), {
    remarks: arrayUnion(entry),
  });
  invalidateKycCache();
  return entry;
}
