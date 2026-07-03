import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/shared/lib/cx";

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, error, className, children }: FieldProps) {
  return (
    <label className={cx("field", className)}>
      {label && (
        <span className="field__label">
          {label}
          {required && <span className="req">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  suffix?: string;
}
export function Input({ invalid, suffix, className, ...rest }: InputProps) {
  const el = (
    <input className={cx("input", invalid && "input--invalid", className)} {...rest} />
  );
  if (suffix) {
    return (
      <span className="input-affix">
        {el}
        <span className="input-affix__suffix">{suffix}</span>
      </span>
    );
  }
  return el;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("textarea", className)} {...rest} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}
export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select className={cx("select", invalid && "select--invalid", className)} {...rest}>
      {children}
    </select>
  );
}
