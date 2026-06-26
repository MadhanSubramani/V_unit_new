import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { Sez } from "@/types/sez";

export async function getSezList(): Promise<Sez[]> {
  const snapshot = await getDocs(collection(db, "sez"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Sez, "id">),
  }));
}

export async function createSez(data: Omit<Sez, "id">) {
  return addDoc(collection(db, "sez"), {
    ...data,
    createdAt: new Date(),
  });
}

export async function updateSez(id: string, data: Partial<Sez>) {
  await updateDoc(doc(db, "sez", id), data);
}

export async function deleteSez(id: string) {
  await deleteDoc(doc(db, "sez", id));
}
