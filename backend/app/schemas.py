from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.enums import (
    ApprovalStatus,
    EstimateCategory,
    FulfillmentType,
    InventoryStatus,
    InventoryType,
    InvoiceStatus,
    InvoiceType,
    LocationType,
    ObjectStatus,
    PaymentMethod,
    RequestStatus,
    Role,
    StageStatus,
    TxnCategory,
    TxnType,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Auth / Users ───────────────────────────
class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(ORMModel):
    id: int
    full_name: str
    username: str
    role: Role
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    full_name: str
    username: str
    password: str
    role: Role = Role.FOREMAN


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None
    role: Role | None = None
    is_active: bool | None = None


# ─────────────────────────── Cities ─────────────────────────────────
class CityOut(ORMModel):
    id: int
    name: str


class CityCreate(BaseModel):
    name: str


# ─────────────────────────── Objects ────────────────────────────────
class StageIn(BaseModel):
    name: str
    planned_start: date | None = None
    planned_end: date | None = None
    status: StageStatus = StageStatus.PENDING


class StageOut(ORMModel):
    id: int
    object_id: int
    name: str
    planned_start: date | None
    planned_end: date | None
    status: StageStatus


class ObjectCreate(BaseModel):
    name: str
    address: str = ""
    city_id: int | None = None
    responsible_id: int | None = None
    status: ObjectStatus = ObjectStatus.PLANNING
    start_date: date | None = None
    deadline: date | None = None
    description: str = ""
    stages: list[StageIn] = Field(default_factory=list)


class ObjectUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    city_id: int | None = None
    responsible_id: int | None = None
    status: ObjectStatus | None = None
    start_date: date | None = None
    deadline: date | None = None
    description: str | None = None


class ObjectOut(ORMModel):
    id: int
    name: str
    address: str
    city_id: int | None
    city_name: str | None = None
    responsible_id: int | None
    responsible_name: str | None = None
    status: ObjectStatus
    start_date: date | None
    deadline: date | None
    description: str
    created_at: datetime
    stages: list[StageOut] = Field(default_factory=list)


# ─────────────────────────── Materials ──────────────────────────────
class MaterialCreate(BaseModel):
    name: str
    unit: str = "шт"
    category: str = "Прочее"
    sku: str = ""
    min_stock: float = 0.0
    default_price: float = 0.0


class MaterialUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    category: str | None = None
    sku: str | None = None
    min_stock: float | None = None
    default_price: float | None = None


class MaterialOut(ORMModel):
    id: int
    name: str
    unit: str
    category: str
    sku: str
    min_stock: float
    default_price: float
    # агрегаты (заполняются в списках склада)
    warehouse_qty: float = 0.0
    total_qty: float = 0.0


# ─────────────────────────── Stock / movements ──────────────────────
class StockOut(BaseModel):
    material_id: int
    material_name: str
    unit: str
    category: str
    location_type: LocationType
    location_id: int
    location_name: str
    quantity: float
    avg_cost: float
    min_stock: float
    is_low: bool = False


class MovementOut(ORMModel):
    id: int
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    from_type: str | None
    from_id: int | None
    from_name: str | None = None
    to_type: str | None
    to_id: int | None
    to_name: str | None = None
    quantity: float
    unit_price: float
    reason: str
    ref_type: str | None
    ref_id: int | None
    note: str
    created_at: datetime


# ─────────────────────────── Material requests ──────────────────────
class RequestItemIn(BaseModel):
    material_id: int
    quantity: float
    note: str = ""


class RequestItemOut(ORMModel):
    id: int
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    quantity: float
    note: str
    warehouse_qty: float = 0.0  # сколько есть на складе (для развилки склад/закупка)


class RequestCreate(BaseModel):
    object_id: int
    needed_date: date | None = None
    note: str = ""
    items: list[RequestItemIn] = Field(default_factory=list)


class RequestConfirmIn(BaseModel):
    fulfillment_type: FulfillmentType = FulfillmentType.FROM_STOCK


class RequestOut(ORMModel):
    id: int
    number: str
    object_id: int
    object_name: str | None = None
    created_by: int | None
    created_by_name: str | None = None
    status: RequestStatus
    needed_date: date | None
    note: str
    fulfillment_type: FulfillmentType | None
    confirmed_at: datetime | None
    created_at: datetime
    items: list[RequestItemOut] = Field(default_factory=list)


# ─────────────────────────── Invoices ───────────────────────────────
class InvoiceItemIn(BaseModel):
    material_id: int
    qty_planned: float
    unit_price: float = 0.0


class InvoiceItemReceiveIn(BaseModel):
    item_id: int
    qty_fact: float
    unit_price: float | None = None  # факт. цена при приёмке прихода (INBOUND)


class InvoiceItemOut(ORMModel):
    id: int
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    qty_planned: float
    qty_fact: float | None
    unit_price: float
    line_total: float = 0.0


class InvoiceCreate(BaseModel):
    type: InvoiceType
    request_id: int | None = None
    source_type: LocationType | None = None
    source_id: int | None = None
    dest_type: LocationType = LocationType.OBJECT
    dest_id: int = 0
    supplier_id: int | None = None
    is_internal_barter: bool = False
    note: str = ""
    items: list[InvoiceItemIn] = Field(default_factory=list)


class InvoiceReceiveIn(BaseModel):
    items: list[InvoiceItemReceiveIn] = Field(default_factory=list)


class InvoiceOut(ORMModel):
    id: int
    number: str
    type: InvoiceType
    status: InvoiceStatus
    request_id: int | None
    source_type: LocationType | None
    source_id: int | None
    source_name: str | None = None
    dest_type: LocationType
    dest_id: int
    dest_name: str | None = None
    supplier_id: int | None
    supplier_name: str | None = None
    is_internal_barter: bool
    note: str
    received_at: datetime | None
    created_at: datetime
    total_amount: float = 0.0
    items: list[InvoiceItemOut] = Field(default_factory=list)


# ─────────────────────────── Estimates ──────────────────────────────
class EstimateItemIn(BaseModel):
    category: EstimateCategory = EstimateCategory.MATERIAL
    name: str
    unit: str = ""
    qty_plan: float = 0.0
    price_plan: float = 0.0
    amount_fact_manual: float | None = None


class EstimateItemUpdate(BaseModel):
    category: EstimateCategory | None = None
    name: str | None = None
    unit: str | None = None
    qty_plan: float | None = None
    price_plan: float | None = None
    amount_fact_manual: float | None = None


class EstimateItemOut(ORMModel):
    id: int
    estimate_id: int
    category: EstimateCategory
    name: str
    unit: str
    qty_plan: float
    price_plan: float
    amount_plan: float = 0.0
    amount_fact_manual: float | None


class EstimateCreate(BaseModel):
    object_id: int
    name: str = "Смета по объекту"
    note: str = ""
    items: list[EstimateItemIn] = Field(default_factory=list)


class EstimateOut(ORMModel):
    id: int
    object_id: int
    object_name: str | None = None
    name: str
    note: str
    created_at: datetime
    items: list[EstimateItemOut] = Field(default_factory=list)
    total_plan: float = 0.0
    total_fact: float = 0.0


class EstimateCategoryCompare(BaseModel):
    category: EstimateCategory
    label: str
    plan: float
    fact: float
    diff: float
    percent: float


class EstimateCompareOut(BaseModel):
    estimate_id: int
    object_id: int
    object_name: str | None = None
    total_plan: float
    total_fact: float
    diff: float
    percent: float
    by_category: list[EstimateCategoryCompare] = Field(default_factory=list)


# ─────────────────────────── Cash / finance ─────────────────────────
class CashCreate(BaseModel):
    name: str
    object_id: int | None = None
    limit_amount: float = 0.0


class CashUpdate(BaseModel):
    name: str | None = None
    object_id: int | None = None
    limit_amount: float | None = None
    is_active: bool | None = None


class CashOut(ORMModel):
    id: int
    name: str
    object_id: int | None
    object_name: str | None = None
    limit_amount: float
    is_active: bool
    balance: float = 0.0
    turnover: float = 0.0
    over_limit: bool = False


class TxnCreate(BaseModel):
    object_id: int | None = None
    cash_id: int | None = None
    type: TxnType
    category: TxnCategory = TxnCategory.OTHER
    amount: float
    payment_method: PaymentMethod = PaymentMethod.CASH
    is_admin: bool = False
    op_date: date | None = None
    description: str = ""


class TxnUpdate(BaseModel):
    category: TxnCategory | None = None
    amount: float | None = None
    payment_method: PaymentMethod | None = None
    is_admin: bool | None = None
    op_date: date | None = None
    description: str | None = None


class TxnOut(ORMModel):
    id: int
    object_id: int | None
    object_name: str | None = None
    cash_id: int | None
    cash_name: str | None = None
    type: TxnType
    category: TxnCategory
    amount: float
    payment_method: PaymentMethod
    is_admin: bool
    op_date: date | None
    description: str
    ref_type: str | None
    ref_id: int | None
    approval_status: ApprovalStatus
    created_at: datetime


# ─────────────────────────── Inventory ──────────────────────────────
class InventoryStartIn(BaseModel):
    type: InventoryType = InventoryType.FULL
    category_filter: str = ""
    note: str = ""


class InventoryCountItemIn(BaseModel):
    item_id: int
    qty_fact: float


class InventoryCountIn(BaseModel):
    items: list[InventoryCountItemIn] = Field(default_factory=list)


class InventoryItemOut(ORMModel):
    id: int
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    category: str | None = None
    qty_system: float
    qty_fact: float | None
    unit_price: float
    qty_diff: float = 0.0
    cost_diff: float = 0.0


class InventoryOut(ORMModel):
    id: int
    number: str
    type: InventoryType
    status: InventoryStatus
    category_filter: str
    note: str
    created_at: datetime
    completed_at: datetime | None
    items: list[InventoryItemOut] = Field(default_factory=list)
    total_qty_diff: float = 0.0
    total_cost_diff: float = 0.0


# ─────────────────────────── Suppliers / debts ──────────────────────
class SupplierCreate(BaseModel):
    name: str
    phone: str = ""
    note: str = ""
    is_internal: bool = False


class SupplierOut(ORMModel):
    id: int
    name: str
    phone: str
    note: str
    is_internal: bool


class DebtOut(ORMModel):
    id: int
    from_business: str
    to_business: str
    amount: float
    status: str
    ref_type: str | None
    ref_id: int | None
    note: str
    created_at: datetime


# ─────────────────────────── Settings ───────────────────────────────
class SettingsOut(BaseModel):
    expense_limit: float = 0.0
    large_threshold: float = 0.0


class SettingsUpdate(BaseModel):
    expense_limit: float | None = None
    large_threshold: float | None = None


# ─────────────────────────── Reports / dashboard ────────────────────
class ObjectExpenseRow(BaseModel):
    object_id: int
    object_name: str
    city_name: str | None = None
    materials: float
    work: float
    tech: float
    other: float
    total_expense: float
    income: float
    profit: float


class CityAnalyticsRow(BaseModel):
    city_name: str
    objects_count: int
    total_expense: float
    income: float
    profit: float


class DashboardOut(BaseModel):
    objects_total: int
    objects_active: int
    requests_open: int
    invoices_pending: int
    low_stock_count: int
    inventory_active: int
    cash_balance: float
    expense_month: float
    income_month: float
    profit_month: float


TokenOut.model_rebuild()
