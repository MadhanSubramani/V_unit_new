import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ConfigCategory, ConfigItem } from "@/types/configuration";

export async function getConfigByCategory(category: ConfigCategory): Promise<ConfigItem[]> {
  const q = query(collection(db, "configurations"), where("category", "==", category));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ConfigItem, "id">),
  }));
}

export async function getAllConfigs(): Promise<ConfigItem[]> {
  const snapshot = await getDocs(collection(db, "configurations"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ConfigItem, "id">),
  }));
}

export async function createConfig(data: Omit<ConfigItem, "id">) {
  return addDoc(collection(db, "configurations"), {
    ...data,
    createdAt: new Date(),
  });
}

export async function updateConfig(id: string, value: string) {
  await updateDoc(doc(db, "configurations", id), { value });
}

export async function deleteConfig(id: string) {
  await deleteDoc(doc(db, "configurations", id));
}
