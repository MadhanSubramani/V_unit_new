import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ConfigCategory, ConfigItem } from "@/types/configuration";
import { cacheKeys, lookupCache } from "@/lib/cache/memoryCache";

async function fetchConfigByCategory(category: ConfigCategory): Promise<ConfigItem[]> {
  const q = query(collection(db, "configurations"), where("category", "==", category));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ConfigItem, "id">),
  }));
}

export async function getConfigByCategory(category: ConfigCategory): Promise<ConfigItem[]> {
  return lookupCache.get(cacheKeys.config(category), () =>
    fetchConfigByCategory(category)
  ) as Promise<ConfigItem[]>;
}

const ALL_CONFIG_CATEGORIES: ConfigCategory[] = [
  "container_type",
  "container_size",
  "payment_type",
  "bl_type",
];

export function invalidateConfigCache(category?: ConfigCategory) {
  if (category) {
    lookupCache.invalidate(cacheKeys.config(category));
    return;
  }
  for (const cat of ALL_CONFIG_CATEGORIES) {
    lookupCache.invalidate(cacheKeys.config(cat));
  }
}

export async function getAllConfigs(): Promise<ConfigItem[]> {
  const snapshot = await getDocs(collection(db, "configurations"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ConfigItem, "id">),
  }));
}

export async function createConfig(data: Omit<ConfigItem, "id">) {
  const result = await addDoc(collection(db, "configurations"), {
    ...data,
    createdAt: new Date(),
  });
  invalidateConfigCache(data.category);
  return result;
}

export async function updateConfig(id: string, value: string) {
  await updateDoc(doc(db, "configurations", id), { value });
  invalidateConfigCache();
}

export async function deleteConfig(id: string) {
  await deleteDoc(doc(db, "configurations", id));
  invalidateConfigCache();
}
