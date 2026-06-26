import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function addKyc(data: any) {
  return addDoc(
    collection(db, "kyc"),
    {
      ...data,
      createdAt: serverTimestamp(),
    }
  );
}