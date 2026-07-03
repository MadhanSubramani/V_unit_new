import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Notepad, NotepadFormData } from "@/types/notepad";
import { stripUndefined } from "@/lib/kyc/stripUndefined";

const REF = () => collection(db, "notepad");

export async function getNotepads(): Promise<Notepad[]> {
  const snap = await getDocs(query(REF(), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Notepad, "id">),
  }));
}

export async function createNotepad(data: NotepadFormData, createdBy: string) {
  return addDoc(
    REF(),
    stripUndefined({
      header: data.header,
      content: data.content,
      createdBy,
      updatedBy: createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
}

export async function updateNotepad(
  id: string,
  data: Partial<NotepadFormData>,
  updatedBy: string
) {
  await updateDoc(
    doc(db, "notepad", id),
    stripUndefined({
      ...data,
      updatedBy,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deleteNotepad(id: string) {
  await deleteDoc(doc(db, "notepad", id));
}
