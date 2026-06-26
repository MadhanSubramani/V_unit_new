export type ConfigCategory =
  | "container_type"
  | "container_size"
  | "payment_type";

export interface ConfigItem {
  id?: string;
  category: ConfigCategory;
  value: string;
  createdAt?: Date;
}

export const CONFIG_CATEGORIES: {
  key: ConfigCategory;
  label: string;
}[] = [
  { key: "container_type", label: "Container Type" },
  { key: "container_size", label: "Container Size" },
  { key: "payment_type", label: "Payment Type" },
];
