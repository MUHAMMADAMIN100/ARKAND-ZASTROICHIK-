import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import { initials } from "@/shared/lib/format";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head__titles">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader-center">
      <div className="stack" style={{ alignItems: "center", gap: 12 }}>
        <Spinner size={28} />
        {label && <span className="muted">{label}</span>}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Пусто",
  hint,
  icon,
  action,
}: {
  title?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">{icon ?? <Inbox size={40} strokeWidth={1.5} />}</span>
      <div className="empty__title">{title}</div>
      {hint && <div className="muted" style={{ maxWidth: 340 }}>{hint}</div>}
      {action}
    </div>
  );
}

export function Progress({
  value,
  tone,
}: {
  value: number;
  tone?: "success" | "warning" | "error";
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress">
      <div
        className={cx("progress__bar", tone && `progress__bar--${tone}`)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface TabItem {
  key: string;
  label: ReactNode;
}
export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button
          key={t.key}
          className={cx("tab", active === t.key && "tab--active")}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {items.map((it) => (
        <button
          key={it.value}
          className={cx("segmented__item", value === it.value && "segmented__item--active")}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar">{initials(name)}</span>;
}

export function ConfirmDialog({
  open,
  title = "Подтвердите действие",
  message,
  confirmText = "Подтвердить",
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="soft">{message}</div>
    </Modal>
  );
}
