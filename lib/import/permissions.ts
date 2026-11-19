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
    canActOnImportModule(user, "cmfc") ||
    canActOnImportModule(user, "inout") ||
    canActOnImportModule(user, "accounts")
  );
}

function normalizeNames(names?: string[]) {
  return (names ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

/** CFS/SEZ master row used to match job codes against user-assigned names. */
export type ImportZoneMaster = { code?: string; name?: string };

export type ImportZoneLookup = {
  cfsList?: ImportZoneMaster[];
  sezList?: ImportZoneMaster[];
};

/** Expand assigned names/codes to include both name and code from masters. */
function expandAllowedZoneTokens(
  assigned: string[],
  masters: ImportZoneMaster[] = []
) {
  const allowed = new Set(normalizeNames(assigned));
  for (const master of masters) {
    const name = (master.name ?? "").trim().toLowerCase();
    const code = (master.code ?? "").trim().toLowerCase();
    if (!name && !code) continue;
    if ((name && allowed.has(name)) || (code && allowed.has(code))) {
      if (name) allowed.add(name);
      if (code) allowed.add(code);
    }
  }
  return allowed;
}

function storedLocationMatchesAllowed(
  stored: string | undefined,
  allowed: Set<string>
) {
  const value = (stored ?? "").trim().toLowerCase();
  if (!value || !allowed.size) return false;
  if (allowed.has(value)) return true;
  const codePart = value.split(/\s*[-–|]\s*/)[0]?.trim() ?? value;
  return Boolean(codePart) && allowed.has(codePart);
}

export function canActOnImportLocation(
  user: ImportSessionUser | null,
  item: { cfs?: string; sez?: string; locationType?: string },
  zones?: ImportZoneLookup
) {
  if (!user || isImportAdmin(user)) return true;
  const cfsNames = normalizeNames(user.importCfsNames);
  const sezNames = normalizeNames(user.importSezNames);
  if (!cfsNames.length && !sezNames.length) return true;

  const locationType =
    item.locationType ?? (item.sez && !item.cfs ? "sez" : "cfs");
  const isSez = locationType === "sez";
  if (isSez) {
    if (!sezNames.length) return false;
    return storedLocationMatchesAllowed(
      item.sez,
      expandAllowedZoneTokens(user.importSezNames ?? [], zones?.sezList)
    );
  }
  if (!cfsNames.length) return false;
  return storedLocationMatchesAllowed(
    item.cfs,
    expandAllowedZoneTokens(user.importCfsNames ?? [], zones?.cfsList)
  );
}

export function filterImportRecordsByUserCfs<
  T extends { cfs?: string; sez?: string; locationType?: string },
>(records: T[], user: ImportSessionUser | null, zones?: ImportZoneLookup) {
  return filterImportRecordsByUserZones(records, user, zones);
}

export function filterImportRecordsByUserZones<
  T extends { cfs?: string; sez?: string; locationType?: string },
>(records: T[], user: ImportSessionUser | null, zones?: ImportZoneLookup) {
  if (!user || isImportAdmin(user)) return records;
  const cfsNames = normalizeNames(user.importCfsNames);
  const sezNames = normalizeNames(user.importSezNames);
  if (!cfsNames.length && !sezNames.length) return records;
  return records.filter((item) => canActOnImportLocation(user, item, zones));
}
