import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import type { Tone } from "@/shared/config/labels";

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot, children, className }: BadgeProps) {
  return (
    <span className={cx("badge", `badge--${tone}`, className)}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
