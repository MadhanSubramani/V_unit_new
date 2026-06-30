import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/kyc/stripUndefined";

export async function addKyc(data: Record<string, unknown>) {
  const cleaned = stripUndefined(data);
  return addDoc(collection(db, "kyc"), {
    ...cleaned,
    createdAt: serverTimestamp(),
  });
}
