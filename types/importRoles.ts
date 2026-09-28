export type ImportModuleKey =
  | "worklist"
  | "liner"
  | "ztype"
  | "transport"
  | "ttype"
  | "accounts"
  | "eta";

export type AppModuleKey =
  | "kyc"
  | "export"
  | "notepad"
  | "operations_cfs"
  | "operations_sez"
  | "operations_config"
  | "freight_forward"
  | "freight_eta";

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

export const APP_MODULE_OPTIONS: {
  value: AppModuleKey;
  label: string;
  group: string;
}[] = [
  { value: "kyc", label: "KYC", group: "Core" },
  { value: "export", label: "Export", group: "Core" },
  { value: "notepad", label: "Notepad", group: "Core" },
  { value: "operations_cfs", label: "CFS Master", group: "Operations" },
  { value: "operations_sez", label: "SEZ Master", group: "Operations" },
  { value: "operations_config", label: "Configurations", group: "Operations" },
  { value: "freight_forward", label: "Job List", group: "Freight Forward" },
  { value: "freight_eta", label: "ETA Updater", group: "Freight Forward" },
];

export interface ImportSessionUser {
  username?: string;
  role?: string;
  importRoles?: ImportModuleKey[];
  appModules?: AppModuleKey[];
  /** CFS names this user may act on in Import. Empty = all CFS (legacy). */
  importCfsNames?: string[];
  /** SEZ names this user may act on in Import. Empty = all SEZ (legacy). */
  importSezNames?: string[];
}
