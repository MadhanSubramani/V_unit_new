import type {
  ImportModuleKey,
  ImportSessionUser,
} from "@/types/importRoles";

export type { ImportModuleKey, ImportSessionUser } from "@/types/importRoles";
export { IMPORT_MODULE_OPTIONS } from "@/types/importRoles";

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

/** Empty importRoles = legacy full import access. */
export function hasImportModuleAccess(
  user: ImportSessionUser | null,
  module: ImportModuleKey
) {
  if (!user) return false;
  if (isImportAdmin(user)) return true;
  const roles = user.importRoles;
  if (!roles?.length) return true;
  return roles.includes(module);
}

export function canExpandImportRow(
  user: ImportSessionUser | null,
  module: ImportModuleKey
) {
  return hasImportModuleAccess(user, module);
}

export function canActOnImportModule(
  user: ImportSessionUser | null,
  module: ImportModuleKey
) {
  return hasImportModuleAccess(user, module);
}
