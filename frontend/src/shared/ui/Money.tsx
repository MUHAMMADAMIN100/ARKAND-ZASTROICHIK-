import { cx } from "@/shared/lib/cx";
import { fmtMoney, fmtSigned } from "@/shared/lib/format";

type Kind = "income" | "expense" | "balance" | "auto" | "plain";

interface MoneyProps {
  value: number | null | undefined;
  kind?: Kind;
  signed?: boolean;
  currency?: boolean;
  className?: string;
}

/**
 * Денежное значение. Цвет отделён от бренда:
 * доход — зелёный, расход/минус — сигнальный красный, баланс — чернила.
 */
export function Money({
  value,
  kind = "plain",
  signed,
  currency,
  className,
}: MoneyProps) {
  const n = Number(value ?? 0);
  let toneClass = "";
  if (kind === "income") toneClass = "money--income";
  else if (kind === "expense") toneClass = "money--expense";
  else if (kind === "balance") toneClass = n < 0 ? "money--neg" : "money--balance";
  else if (kind === "auto") toneClass = n < 0 ? "money--expense" : "money--income";

  const text = signed ? fmtSigned(n) : fmtMoney(n);
  return (
    <span className={cx("money", toneClass, className)}>
      {text}
      {currency ? " сом." : ""}
    </span>
  );
}
