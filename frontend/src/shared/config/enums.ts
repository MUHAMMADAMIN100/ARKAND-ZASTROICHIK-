export type Role =
  | "foreman"
  | "sales"
  | "storekeeper"
  | "cashier"
  | "supply"
  | "owner"
  | "admin";

export type ObjectStatus = "planning" | "in_progress" | "on_hold" | "done";
export type StageStatus = "pending" | "in_progress" | "done";
export type LocationType = "WAREHOUSE" | "OBJECT";
export type RequestStatus = "draft" | "submitted" | "confirmed" | "rejected" | "fulfilled";
export type FulfillmentType = "from_stock" | "purchase";
export type InvoiceType = "inbound" | "issue";
export type InvoiceStatus = "draft" | "shipped" | "received" | "cancelled";
export type EstimateCategory = "material" | "work" | "tech" | "money" | "other";
export type TxnType = "income" | "expense";
export type TxnCategory =
  | "material"
  | "work"
  | "tech"
  | "sale_income"
  | "admin"
  | "salary"
  | "other";
export type PaymentMethod = "cash" | "transfer";
export type InventoryType = "full" | "partial";
export type InventoryStatus = "in_progress" | "completed" | "cancelled";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
