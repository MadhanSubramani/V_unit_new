import {
  deleteDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { invalidateKycCache } from "@/lib/kyc/getKyc";

export async function deleteKyc(
  id: string
) {
  try {
    await deleteDoc(
      doc(db, "kyc", id)
    );
    invalidateKycCache();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Delete KYC Error:", error);

    return {
      success: false,
      error,
    };
  }
}