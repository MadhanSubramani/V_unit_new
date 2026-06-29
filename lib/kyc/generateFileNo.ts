import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function generateFileNo(): Promise<string> {
  const snapshot = await getDocs(collection(db, "kyc"));
  const next = snapshot.size + 1;
  return `KYC-${String(next).padStart(5, "0")}`;
}
