import { FreightContainer, FreightForward } from "@/types/freightForward";

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
