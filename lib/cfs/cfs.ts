import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { Cfs } from "@/types/cfs";
import { cacheKeys, lookupCache } from "@/lib/cache/memoryCache";

async function fetchCfsFromFirestore(): Promise<Cfs[]> {
  const snapshot = await getDocs(collection(db, "cfs"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Cfs, "id">),
  }));
}

export async function getCfsList(): Promise<Cfs[]> {
  return lookupCache.get(cacheKeys.cfs, fetchCfsFromFirestore) as Promise<Cfs[]>;
}

export function invalidateCfsCache() {
  lookupCache.invalidate(cacheKeys.cfs);
}

export async function createCfs(data: Omit<Cfs, "id">) {
  const result = await addDoc(collection(db, "cfs"), {
    ...data,
    createdAt: new Date(),
  });
  invalidateCfsCache();
  return result;
}

export async function updateCfs(id: string, data: Partial<Cfs>) {
  await updateDoc(doc(db, "cfs", id), data);
  invalidateCfsCache();
}

export async function deleteCfs(id: string) {
  await deleteDoc(doc(db, "cfs", id));
  invalidateCfsCache();
}
