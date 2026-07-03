import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

export function Card({
  children,
  pad,
  className,
}: {
  children: ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return <div className={cx("card", pad && "card--pad", className)}>{children}</div>;
}

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyPad?: boolean;
  className?: string;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  bodyPad = true,
  className,
}: PanelProps) {
  return (
    <div className={cx("card", className)}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="panel-title">
            {title && <h3>{title}</h3>}
            {subtitle && <small>{subtitle}</small>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {bodyPad ? <div className="panel-body">{children}</div> : children}
    </div>
  );
}
