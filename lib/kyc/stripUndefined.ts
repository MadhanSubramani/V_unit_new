/** Firestore rejects `undefined` field values — omit them before writes. */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item
      );
      continue;
    }

    if (value !== null && typeof value === "object") {
      result[key] = stripUndefined(value as Record<string, unknown>);
      continue;
    }

    result[key] = value;
  }

  return result;
}
