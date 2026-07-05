import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/kyc/stripUndefined";
import { invalidateKycCache } from "@/lib/kyc/getKyc";

export async function addKyc(data: Record<string, unknown>) {
  const cleaned = stripUndefined(data);
  const result = await addDoc(collection(db, "kyc"), {
    ...cleaned,
    createdAt: serverTimestamp(),
  });
  invalidateKycCache();
  return result;
}
