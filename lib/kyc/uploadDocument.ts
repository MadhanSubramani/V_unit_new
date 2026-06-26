import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { storage } from "@/lib/firebase";

export async function uploadDocument(
  file: File,
  folder: string
) {
  const storageRef = ref(
    storage,
    `${folder}/${Date.now()}-${file.name}`
  );

  await uploadBytes(storageRef, file);

  return {
    name: file.name,
    url: await getDownloadURL(storageRef),
  };
}