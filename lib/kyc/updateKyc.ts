import {
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function updateKyc(
  id: string,
  data: any
) {
  try {
    await updateDoc(
      doc(db, "kyc", id),
      {
        ...data,
      }
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error("Update KYC Error:", error);

    return {
      success: false,
      error,
    };
  }
}