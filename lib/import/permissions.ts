import type {
  AppModuleKey,
  ImportModuleKey,
  ImportSessionUser,
} from "@/types/importRoles";

export type { AppModuleKey, ImportModuleKey, ImportSessionUser } from "@/types/importRoles";
export { APP_MODULE_OPTIONS, IMPORT_MODULE_OPTIONS } from "@/types/importRoles";

export function parseImportSessionUser(): ImportSessionUser | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ImportSessionUser;
  } catch {
    return null;
  }
}

export function isImportAdmin(user: ImportSessionUser | null) {
  return user?.role === "admin";
}

/** User can open the Import group and see every Import page. */
export function canViewImportSection(user: ImportSessionUser | null) {
  if (!user) return false;
  if (isImportAdmin(user)) return true;
  const importRoles = user.importRoles ?? [];
  const appModules = user.appModules ?? [];
  if (importRoles.length) return true;
  if (!appModules.length) return true;
  return false;
}

/** Empty importRoles = legacy full import action access. */
export function hasImportModuleAccess(
  user: ImportSessionUser | null,
  module: ImportModuleKey
) {
  if (!user) return false;
  if (isImportAdmin(user)) return true;
  const roles = user.importRoles;
  if (!roles?.length) return canViewImportSection(user);
  return roles.includes(module);
}

export function hasAppModuleAccess(
  user: ImportSessionUser | null,
  module: AppModuleKey
) {
  if (!user) return false;
  if (isImportAdmin(user)) return true;
  const modules = user.appModules ?? [];
  const importRoles = user.importRoles ?? [];
  if (!modules.length && !importRoles.length) return true;
  return modules.includes(module);
}

export function canExpandImportRow(
  user: ImportSessionUser | null,
  _module: ImportModuleKey
) {
  return canViewImportSection(user);
}

export function canActOnImportModule(
  user: ImportSessionUser | null,
  module: ImportModuleKey
) {
  return hasImportModuleAccess(user, module);
}

export function canManageImportSupportingDocs(
  user: ImportSessionUser | null,
  module?: ImportModuleKey
) {
  if (!user) return false;
  if (isImportAdmin(user)) return true;
  if (module) return canActOnImportModule(user, module);
  return (
    canActOnImportModule(user, "worklist") ||
    canActOnImportModule(user, "liner") ||
    canActOnImportModule(user, "ztype") ||
    canActOnImportModule(user, "transport") ||
    canActOnImportModule(user, "ttype") ||
    canActOnImportModule(user, "accounts")
  );
}

function normalizeNames(names?: string[]) {
  return (names ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

export function canActOnImportLocation(
  user: ImportSessionUser | null,
  item: { cfs?: string; sez?: string; locationType?: string }
) {
  if (!user || isImportAdmin(user)) return true;
  const cfsNames = normalizeNames(user.importCfsNames);
  const sezNames = normalizeNames(user.importSezNames);
  if (!cfsNames.length && !sezNames.length) return true;

  const isSez = item.locationType === "sez";
  if (isSez) {
    if (!sezNames.length) return false;
    return sezNames.includes((item.sez ?? "").trim().toLowerCase());
  }
  if (!cfsNames.length) return false;
  return cfsNames.includes((item.cfs ?? "").trim().toLowerCase());
}

export function filterImportRecordsByUserCfs<
  T extends { cfs?: string; sez?: string; locationType?: string },
>(records: T[], user: ImportSessionUser | null) {
  return filterImportRecordsByUserZones(records, user);
}

export function filterImportRecordsByUserZones<
  T extends { cfs?: string; sez?: string; locationType?: string },
>(records: T[], user: ImportSessionUser | null) {
  if (!user || isImportAdmin(user)) return records;
  const cfsNames = normalizeNames(user.importCfsNames);
  const sezNames = normalizeNames(user.importSezNames);
  if (!cfsNames.length && !sezNames.length) return records;
  return records.filter((item) => canActOnImportLocation(user, item));
}
