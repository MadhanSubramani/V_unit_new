import {
  deleteDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function deleteKyc(
  id: string
) {
  try {
    await deleteDoc(
      doc(db, "kyc", id)
    );

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