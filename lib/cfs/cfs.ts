import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { Cfs } from "@/types/cfs";

export async function getCfsList(): Promise<Cfs[]> {
  const snapshot = await getDocs(collection(db, "cfs"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Cfs, "id">),
  }));
}

export async function createCfs(data: Omit<Cfs, "id">) {
  return addDoc(collection(db, "cfs"), {
    ...data,
    createdAt: new Date(),
  });
}

export async function updateCfs(id: string, data: Partial<Cfs>) {
  await updateDoc(doc(db, "cfs", id), data);
}

export async function deleteCfs(id: string) {
  await deleteDoc(doc(db, "cfs", id));
}
