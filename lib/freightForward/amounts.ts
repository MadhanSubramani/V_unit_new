import { ExpenseItem, FreightForward } from "@/types/freightForward";
import { getTotalOceanFreight } from "@/lib/freightForward/containers";

export function parseAmount(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export function sumExpenseItems(items?: ExpenseItem[]) {
  return (items ?? []).reduce((total, item) => total + (item.amount || 0), 0);
}

export function computeTotalExpenses(
  exWorks?: ExpenseItem[],
  otherExpenses?: ExpenseItem[],
  oceanFreight?: number,
  stored?: number
) {
  const fromItems =
    sumExpenseItems(exWorks) +
    sumExpenseItems(otherExpenses) +
    (parseAmount(oceanFreight) ?? 0);
  if (stored !== undefined && stored !== null) return stored;
  return fromItems;
}

export function computeTotalExpensesForRecord(item: FreightForward) {
  return computeTotalExpenses(
    item.exWorks,
    item.otherExpenses,
    getTotalOceanFreight(item),
    item.totalExpenses
  );
}

export function computeProfitLoss(
  creditNote?: number,
  billedAmount?: number,
  totalExpenses?: number
) {
  const credit = parseAmount(creditNote) ?? 0;
  const billed = parseAmount(billedAmount) ?? 0;
  const expenses = totalExpenses ?? 0;
  return credit + billed - expenses;
}

export function getRecordTotalExpenses(item: FreightForward) {
  return computeTotalExpensesForRecord(item);
}

export function getRecordProfitLoss(item: FreightForward) {
  return computeProfitLoss(
    item.creditNote,
    item.billedAmount ?? item.buildAmount,
    getRecordTotalExpenses(item)
  );
}

export function formatDollar(value?: number | string | null) {
  const num = parseAmount(value);
  if (num === undefined) return "";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatExpenseItems(items?: ExpenseItem[]) {
  if (!items?.length) return "";
  return items.map((i) => `${i.name}: ${formatDollar(i.amount)}`).join("; ");
}
