export interface Notepad {
  id?: string;
  header: string;
  content: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NotepadFormData = Pick<Notepad, "header" | "content">;
