const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** Денежная сумма без знака: "284 500" или "1 234,50". */
export function fmtMoney(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return nf.format(n);
}

/** Сумма с валютой: "284 500 сом." */
export function fmtMoneyCur(value: number | null | undefined): string {
  return `${fmtMoney(value)} сом.`;
}

/** Сумма со знаком для доходов/расходов: "+284 500" / "−96 200". */
export function fmtSigned(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${nf.format(Math.abs(n))}`;
}

/** Количество: "150" или "12,5". */
export function fmtQty(value: number | null | undefined): string {
  return nf.format(Number(value ?? 0));
}

export function fmtQtyUnit(value: number | null | undefined, unit?: string | null): string {
  return unit ? `${fmtQty(value)} ${unit}` : fmtQty(value);
}

export function fmtInt(value: number | null | undefined): string {
  return nf0.format(Number(value ?? 0));
}

/** Процент: "13,5%". */
export function fmtPercent(value: number | null | undefined): string {
  return `${nf.format(Number(value ?? 0))}%`;
}

/** ISO / date → "03.07.2026". */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Сегодняшняя дата в формате input[type=date] (YYYY-MM-DD). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
