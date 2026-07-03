from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Роли системы застройщика (+ заглушки снабжения и владельца)."""

    FOREMAN = "foreman"          # Прораб / объект
    SALES = "sales"              # Менеджер по продажам
    STOREKEEPER = "storekeeper"  # Кладовщик
    CASHIER = "cashier"          # Кассир
    SUPPLY = "supply"            # Снабжение (заглушка — подтверждает заявки)
    OWNER = "owner"              # Владелец (Сохиб) — согласования (заглушка)
    ADMIN = "admin"              # Администратор системы


ROLE_LABELS: dict[str, str] = {
    Role.FOREMAN: "Прораб",
    Role.SALES: "Менеджер по продажам",
    Role.STOREKEEPER: "Кладовщик",
    Role.CASHIER: "Кассир",
    Role.SUPPLY: "Снабжение",
    Role.OWNER: "Владелец",
    Role.ADMIN: "Администратор",
}


class ObjectStatus(str, Enum):
    PLANNING = "planning"        # план
    IN_PROGRESS = "in_progress"  # в работе
    ON_HOLD = "on_hold"          # приостановлен
    DONE = "done"                # завершён


class StageStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class LocationType(str, Enum):
    WAREHOUSE = "WAREHOUSE"  # центральный склад (location_id = 0)
    OBJECT = "OBJECT"        # склад объекта (location_id = object_id)


class RequestStatus(str, Enum):
    DRAFT = "draft"            # черновик
    SUBMITTED = "submitted"    # отправлена снабжению
    CONFIRMED = "confirmed"    # подтверждена снабжением
    REJECTED = "rejected"      # отклонена
    FULFILLED = "fulfilled"    # обеспечена (выдана/закуплена)


class FulfillmentType(str, Enum):
    FROM_STOCK = "from_stock"  # выдать со склада
    PURCHASE = "purchase"      # закупить (нет в наличии)


class InvoiceType(str, Enum):
    INBOUND = "inbound"  # приход/поставка (на склад или напрямую на объект)
    ISSUE = "issue"      # выдача со склада на объект


class InvoiceStatus(str, Enum):
    DRAFT = "draft"            # оформляется
    SHIPPED = "shipped"        # отгружена, ждёт приёмки
    RECEIVED = "received"      # принята со сверкой
    CANCELLED = "cancelled"


class MovementReason(str, Enum):
    RECEIPT = "receipt"                  # поставка/приход
    ISSUE = "issue"                      # выдача на объект
    INVENTORY_ADJUST = "inventory_adjust"  # корректировка по инвентаризации
    RETURN = "return"                    # возврат


class EstimateCategory(str, Enum):
    MATERIAL = "material"  # материалы
    WORK = "work"          # работы
    TECH = "tech"          # техника
    MONEY = "money"        # деньги/прочее
    OTHER = "other"


class TxnType(str, Enum):
    INCOME = "income"    # приход/доход
    EXPENSE = "expense"  # расход


class TxnCategory(str, Enum):
    MATERIAL = "material"        # материалы
    WORK = "work"                # работы
    TECH = "tech"                # техника
    SALE_INCOME = "sale_income"  # доход от продажи квартир (внешняя система)
    ADMIN = "admin"              # административные
    SALARY = "salary"            # зарплата
    OTHER = "other"              # прочее


class PaymentMethod(str, Enum):
    CASH = "cash"          # наличные
    TRANSFER = "transfer"  # перевод


class InventoryType(str, Enum):
    FULL = "full"        # полная (весь склад)
    PARTIAL = "partial"  # частичная (группа/позиции)


class InventoryStatus(str, Enum):
    IN_PROGRESS = "in_progress"  # идёт пересчёт (движения заблокированы)
    COMPLETED = "completed"      # завершена
    CANCELLED = "cancelled"


class ApprovalStatus(str, Enum):
    NOT_REQUIRED = "not_required"  # в пределах лимита
    PENDING = "pending"            # ждёт согласования владельцев (заглушка)
    APPROVED = "approved"
    REJECTED = "rejected"


class DebtStatus(str, Enum):
    OPEN = "open"
    SETTLED = "settled"
