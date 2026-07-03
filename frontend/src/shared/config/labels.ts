export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "brand";

// ── Роли ──
export const ROLE_LABELS: Record<string, string> = {
  foreman: "Прораб",
  sales: "Менеджер по продажам",
  storekeeper: "Кладовщик",
  cashier: "Кассир",
  supply: "Снабжение",
  owner: "Владелец",
  admin: "Администратор",
};

// ── Статус объекта ──
export const OBJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Планируется",
  in_progress: "В работе",
  on_hold: "Приостановлен",
  done: "Завершён",
};
export const OBJECT_STATUS_TONE: Record<string, Tone> = {
  planning: "info",
  in_progress: "success",
  on_hold: "warning",
  done: "neutral",
};

// ── Этапы ──
export const STAGE_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  in_progress: "В работе",
  done: "Готово",
};
export const STAGE_STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  in_progress: "info",
  done: "success",
};

// ── Заявки ──
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На подтверждении",
  confirmed: "Подтверждена",
  rejected: "Отклонена",
  fulfilled: "Обеспечена",
};
export const REQUEST_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  submitted: "warning",
  confirmed: "info",
  rejected: "error",
  fulfilled: "success",
};

export const FULFILLMENT_LABELS: Record<string, string> = {
  from_stock: "Со склада",
  purchase: "Закупка",
};

// ── Накладные ──
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  inbound: "Приход",
  issue: "Выдача на объект",
};
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  shipped: "Ожидает приёмки",
  received: "Принята",
  cancelled: "Отменена",
};
export const INVOICE_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  shipped: "warning",
  received: "success",
  cancelled: "error",
};

// ── Движения ──
export const MOVEMENT_REASON_LABELS: Record<string, string> = {
  receipt: "Приход",
  issue: "Выдача",
  inventory_adjust: "Корректировка (инвент.)",
  return: "Возврат",
};

// ── Смета ──
export const ESTIMATE_CATEGORY_LABELS: Record<string, string> = {
  material: "Материалы",
  work: "Работы",
  tech: "Техника",
  money: "Деньги",
  other: "Прочее",
};

// ── Финансы ──
export const TXN_TYPE_LABELS: Record<string, string> = {
  income: "Доход",
  expense: "Расход",
};
export const TXN_CATEGORY_LABELS: Record<string, string> = {
  material: "Материалы",
  work: "Работы",
  tech: "Техника",
  sale_income: "Продажа квартир",
  admin: "Административные",
  salary: "Зарплата",
  other: "Прочее",
};
export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  transfer: "Перевод",
};
export const APPROVAL_LABELS: Record<string, string> = {
  not_required: "Не требует",
  pending: "Ждёт согласования",
  approved: "Согласовано",
  rejected: "Отклонено",
};
export const APPROVAL_TONE: Record<string, Tone> = {
  not_required: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "error",
};

// ── Инвентаризация ──
export const INVENTORY_TYPE_LABELS: Record<string, string> = {
  full: "Полная",
  partial: "Частичная",
};
export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  in_progress: "Идёт пересчёт",
  completed: "Завершена",
  cancelled: "Отменена",
};
export const INVENTORY_STATUS_TONE: Record<string, Tone> = {
  in_progress: "warning",
  completed: "success",
  cancelled: "error",
};

export function label(map: Record<string, string>, key?: string | null): string {
  if (!key) return "—";
  return map[key] ?? key;
}
