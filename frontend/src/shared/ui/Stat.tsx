import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

type IconTone = "brand" | "info" | "success" | "warning";

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  iconTone?: IconTone;
  wide?: boolean;
  onClick?: () => void;
}

export function Stat({ label, value, sub, icon, iconTone = "brand", wide, onClick }: StatProps) {
  return (
    <div
      className={cx("stat", wide && "stat--wide")}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {icon && <span className={cx("stat__icon", `stat__icon--${iconTone}`)}>{icon}</span>}
      </div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}
