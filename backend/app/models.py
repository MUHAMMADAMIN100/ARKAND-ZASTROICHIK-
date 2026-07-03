from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.enums import (
    ApprovalStatus,
    DebtStatus,
    EstimateCategory,
    FulfillmentType,
    InventoryStatus,
    InventoryType,
    InvoiceStatus,
    InvoiceType,
    LocationType,
    MovementReason,
    ObjectStatus,
    PaymentMethod,
    RequestStatus,
    Role,
    StageStatus,
    TxnCategory,
    TxnType,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─────────────────────────── Пользователи ───────────────────────────
class User(TimestampMixin, Base):
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(String(160))
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(30), default=Role.FOREMAN.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ─────────────────────────── Города / объекты ───────────────────────
class City(TimestampMixin, Base):
    __tablename__ = "cities"

    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)

    objects: Mapped[list["ConstructionObject"]] = relationship(back_populates="city")


class ConstructionObject(TimestampMixin, Base):
    __tablename__ = "objects"

    name: Mapped[str] = mapped_column(String(200), index=True)
    address: Mapped[str] = mapped_column(String(300), default="")
    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id"), nullable=True)
    responsible_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=ObjectStatus.PLANNING.value)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")

    city: Mapped["City | None"] = relationship(back_populates="objects")
    responsible: Mapped["User | None"] = relationship()
    stages: Mapped[list["ObjectStage"]] = relationship(
        back_populates="object", cascade="all, delete-orphan"
    )


class ObjectStage(TimestampMixin, Base):
    __tablename__ = "object_stages"

    object_id: Mapped[int] = mapped_column(ForeignKey("objects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    planned_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=StageStatus.PENDING.value)

    object: Mapped["ConstructionObject"] = relationship(back_populates="stages")


# ─────────────────────────── Материалы / склад ──────────────────────
class Material(TimestampMixin, Base):
    __tablename__ = "materials"

    name: Mapped[str] = mapped_column(String(200), index=True)
    unit: Mapped[str] = mapped_column(String(20), default="шт")
    category: Mapped[str] = mapped_column(String(80), default="Прочее")
    sku: Mapped[str] = mapped_column(String(60), default="")
    min_stock: Mapped[float] = mapped_column(Float, default=0.0)
    default_price: Mapped[float] = mapped_column(Float, default=0.0)


class Stock(TimestampMixin, Base):
    """Остаток материала в конкретной локации.

    location_type = WAREHOUSE -> location_id = 0 (единый центральный склад)
    location_type = OBJECT    -> location_id = object_id
    """

    __tablename__ = "stock"
    __table_args__ = (
        UniqueConstraint("material_id", "location_type", "location_id", name="uq_stock_loc"),
    )

    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    location_type: Mapped[str] = mapped_column(String(20), default=LocationType.WAREHOUSE.value)
    location_id: Mapped[int] = mapped_column(Integer, default=0)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    avg_cost: Mapped[float] = mapped_column(Float, default=0.0)

    material: Mapped["Material"] = relationship()


class StockMovement(TimestampMixin, Base):
    """История движений материалов (ЗАС-23)."""

    __tablename__ = "stock_movements"

    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    from_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    from_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    to_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    reason: Mapped[str] = mapped_column(String(30), default=MovementReason.RECEIPT.value)
    ref_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    material: Mapped["Material"] = relationship()


# ─────────────────────────── Заявки на материалы ────────────────────
class MaterialRequest(TimestampMixin, Base):
    __tablename__ = "material_requests"

    number: Mapped[str] = mapped_column(String(40), index=True, default="")
    object_id: Mapped[int] = mapped_column(ForeignKey("objects.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=RequestStatus.SUBMITTED.value)
    needed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    fulfillment_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    object: Mapped["ConstructionObject"] = relationship()
    items: Mapped[list["MaterialRequestItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class MaterialRequestItem(TimestampMixin, Base):
    __tablename__ = "material_request_items"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("material_requests.id", ondelete="CASCADE")
    )
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    note: Mapped[str] = mapped_column(String(300), default="")

    request: Mapped["MaterialRequest"] = relationship(back_populates="items")
    material: Mapped["Material"] = relationship()


# ─────────────────────────── Накладные (движение) ───────────────────
class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"

    number: Mapped[str] = mapped_column(String(40), index=True, default="")
    type: Mapped[str] = mapped_column(String(20), default=InvoiceType.ISSUE.value)
    status: Mapped[str] = mapped_column(String(20), default=InvoiceStatus.DRAFT.value)
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("material_requests.id"), nullable=True
    )
    # источник / назначение
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_type: Mapped[str] = mapped_column(String(20), default=LocationType.OBJECT.value)
    dest_id: Mapped[int] = mapped_column(Integer, default=0)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    is_internal_barter: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    received_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    supplier: Mapped["Supplier | None"] = relationship()


class InvoiceItem(TimestampMixin, Base):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"))
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    qty_planned: Mapped[float] = mapped_column(Float, default=0.0)
    qty_fact: Mapped[float | None] = mapped_column(Float, nullable=True)  # факт при приёмке
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")
    material: Mapped["Material"] = relationship()


# ─────────────────────────── Смета ──────────────────────────────────
class Estimate(TimestampMixin, Base):
    __tablename__ = "estimates"

    object_id: Mapped[int] = mapped_column(ForeignKey("objects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), default="Смета по объекту")
    note: Mapped[str] = mapped_column(Text, default="")

    object: Mapped["ConstructionObject"] = relationship()
    items: Mapped[list["EstimateItem"]] = relationship(
        back_populates="estimate", cascade="all, delete-orphan"
    )


class EstimateItem(TimestampMixin, Base):
    __tablename__ = "estimate_items"

    estimate_id: Mapped[int] = mapped_column(ForeignKey("estimates.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(20), default=EstimateCategory.MATERIAL.value)
    name: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(20), default="")
    qty_plan: Mapped[float] = mapped_column(Float, default=0.0)
    price_plan: Mapped[float] = mapped_column(Float, default=0.0)
    # ручной факт (необязательно; иначе факт считается из финансов/движений по категории)
    amount_fact_manual: Mapped[float | None] = mapped_column(Float, nullable=True)

    estimate: Mapped["Estimate"] = relationship(back_populates="items")


# ─────────────────────────── Финансы / касса ────────────────────────
class CashRegister(TimestampMixin, Base):
    __tablename__ = "cash_registers"

    name: Mapped[str] = mapped_column(String(120))
    object_id: Mapped[int | None] = mapped_column(ForeignKey("objects.id"), nullable=True)
    limit_amount: Mapped[float] = mapped_column(Float, default=0.0)  # лимит оборота (КАС-03)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    object: Mapped["ConstructionObject | None"] = relationship()


class FinanceTransaction(TimestampMixin, Base):
    __tablename__ = "finance_transactions"

    object_id: Mapped[int | None] = mapped_column(ForeignKey("objects.id"), nullable=True)
    cash_id: Mapped[int | None] = mapped_column(ForeignKey("cash_registers.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(20), default=TxnType.EXPENSE.value)
    category: Mapped[str] = mapped_column(String(20), default=TxnCategory.OTHER.value)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    payment_method: Mapped[str] = mapped_column(String(20), default=PaymentMethod.CASH.value)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)  # административные — отдельно
    op_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(String(400), default="")
    ref_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approval_status: Mapped[str] = mapped_column(
        String(20), default=ApprovalStatus.NOT_REQUIRED.value
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    object: Mapped["ConstructionObject | None"] = relationship()
    cash: Mapped["CashRegister | None"] = relationship()


# ─────────────────────────── Инвентаризация ─────────────────────────
class Inventory(TimestampMixin, Base):
    __tablename__ = "inventories"

    number: Mapped[str] = mapped_column(String(40), index=True, default="")
    type: Mapped[str] = mapped_column(String(20), default=InventoryType.FULL.value)
    status: Mapped[str] = mapped_column(String(20), default=InventoryStatus.IN_PROGRESS.value)
    category_filter: Mapped[str] = mapped_column(String(80), default="")  # для частичной
    note: Mapped[str] = mapped_column(Text, default="")
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="inventory", cascade="all, delete-orphan"
    )


class InventoryItem(TimestampMixin, Base):
    __tablename__ = "inventory_items"

    inventory_id: Mapped[int] = mapped_column(ForeignKey("inventories.id", ondelete="CASCADE"))
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    qty_system: Mapped[float] = mapped_column(Float, default=0.0)  # остаток на момент старта
    qty_fact: Mapped[float | None] = mapped_column(Float, nullable=True)  # пересчёт
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    inventory: Mapped["Inventory"] = relationship(back_populates="items")
    material: Mapped["Material"] = relationship()


# ─────────────────────────── Поставщики / долги (лёгкие) ─────────────
class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(60), default="")
    note: Mapped[str] = mapped_column(String(300), default="")
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)  # свой завод холдинга


class DebtRecord(TimestampMixin, Base):
    """Долг между бизнесами (ХОЛ-30) — лёгкий учёт при внутреннем бартере."""

    __tablename__ = "debt_records"

    from_business: Mapped[str] = mapped_column(String(120))  # кто поставил (напр. Бетонный завод)
    to_business: Mapped[str] = mapped_column(String(120), default="Застройщик")
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default=DebtStatus.OPEN.value)
    ref_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(300), default="")


class Setting(TimestampMixin, Base):
    """Настройки бизнеса: лимит расходов, порог «крупно/мелко» (заглушка согласований)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(200), default="")
