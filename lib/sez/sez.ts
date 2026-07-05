import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { Sez } from "@/types/sez";
import { cacheKeys, lookupCache } from "@/lib/cache/memoryCache";

async function fetchSezFromFirestore(): Promise<Sez[]> {
  const snapshot = await getDocs(collection(db, "sez"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Sez, "id">),
  }));
}

export async function getSezList(): Promise<Sez[]> {
  return lookupCache.get(cacheKeys.sez, fetchSezFromFirestore) as Promise<Sez[]>;
}

export function invalidateSezCache() {
  lookupCache.invalidate(cacheKeys.sez);
}

export async function createSez(data: Omit<Sez, "id">) {
  const result = await addDoc(collection(db, "sez"), {
    ...data,
    createdAt: new Date(),
  });
  invalidateSezCache();
  return result;
}

export async function updateSez(id: string, data: Partial<Sez>) {
  await updateDoc(doc(db, "sez", id), data);
  invalidateSezCache();
}

export async function deleteSez(id: string) {
  await deleteDoc(doc(db, "sez", id));
  invalidateSezCache();
}
