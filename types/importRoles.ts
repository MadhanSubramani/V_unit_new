export type ImportModuleKey =
  | "worklist"
  | "liner"
  | "ztype"
  | "transport"
  | "ttype"
  | "accounts"
  | "eta";

export const IMPORT_MODULE_OPTIONS: {
  value: ImportModuleKey;
  label: string;
}[] = [
  { value: "worklist", label: "Job List" },
  { value: "liner", label: "Liner" },
  { value: "ztype", label: "Z type BE" },
  { value: "transport", label: "Transport" },
  { value: "ttype", label: "T type BE" },
  { value: "accounts", label: "Accounts" },
  { value: "eta", label: "ETA Updater" },
];

export interface ImportSessionUser {
  username?: string;
  role?: string;
  importRoles?: ImportModuleKey[];
}
