import { FreightContainer, FreightForward, CONTAINER_NUMBER_FORMAT_MESSAGE, CONTAINER_NUMBER_REGEX } from "@/types/freightForward";

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export function emptyContainer(): FreightContainer {
  return {
    containerNumber: "",
    containerSize: "",
    containerType: "",
  };
}

/** Prefer `containers` array; fall back to legacy flat fields. */
export function getContainersFromRecord(
  item: Pick<
    FreightForward,
    "containers" | "containerNumber" | "containerSize" | "containerType"
  >
): FreightContainer[] {
  if (item.containers?.length) {
    return item.containers;
  }
  if (item.containerNumber?.trim()) {
    return [
      {
        containerNumber: item.containerNumber,
        containerSize: item.containerSize,
        containerType: item.containerType,
      },
    ];
  }
  return [];
}

export function getContainerCount(
  item: Pick<FreightForward, "containers" | "containerNumber">
): number {
  const containers = getContainersFromRecord(item);
  return Math.max(1, containers.length);
}

export function formatContainersDisplay(
  item: Pick<FreightForward, "containers" | "containerNumber">
): string {
  const containers = getContainersFromRecord(item);
  if (!containers.length) return "—";
  const first = containers[0].containerNumber;
  if (containers.length === 1) return first;
  return `${first} +${containers.length - 1}`;
}

export function normalizeContainerNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function containerNumberError(value: unknown): string | undefined {
  const number = normalizeContainerNumber(value);
  if (!number) return "Container Number is required.";
  if (!CONTAINER_NUMBER_REGEX.test(number)) {
    return CONTAINER_NUMBER_FORMAT_MESSAGE;
  }
  return undefined;
}

/** Same rules as Freight Forward add/edit. */
export function validateFreightContainers(
  containers: FreightContainer[]
): Record<string, string> {
  const next: Record<string, string> = {};
  const items = containers.length ? containers : [emptyContainer()];
  let hasValidContainer = false;
  const seen = new Set<string>();

  items.forEach((item, index) => {
    const number = normalizeContainerNumber(item.containerNumber);
    if (!number) {
      if (items.length === 1 || index === 0) {
        next[`containers.${index}.containerNumber`] =
          "Container Number is required.";
      }
      return;
    }
    const formatError = containerNumberError(number);
    if (formatError) {
      next[`containers.${index}.containerNumber`] = formatError;
      return;
    }
    if (seen.has(number)) {
      next[`containers.${index}.containerNumber`] =
        "Duplicate container number.";
      return;
    }
    seen.add(number);
    hasValidContainer = true;
  });

  if (!hasValidContainer && !next["containers.0.containerNumber"]) {
    next["containers.0.containerNumber"] = "At least one container is required.";
  }

  return next;
}

export function getOceanFreightPerContainer(
  item: Pick<FreightForward, "oceanFreightPerContainer" | "oceanFreight" | "containers" | "containerNumber">
): number | undefined {
  const perContainer = toNumber(item.oceanFreightPerContainer);
  if (perContainer !== undefined) return perContainer;

  const total = toNumber(item.oceanFreight);
  if (total === undefined) return undefined;

  const count = getContainerCount(item);
  return count > 0 ? total / count : total;
}

export function getTotalOceanFreight(
  item: Pick<FreightForward, "oceanFreightPerContainer" | "oceanFreight" | "containers" | "containerNumber">
): number {
  const perContainer = getOceanFreightPerContainer(item);
  if (perContainer === undefined) return toNumber(item.oceanFreight) ?? 0;
  return perContainer * getContainerCount(item);
}
