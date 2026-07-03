from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import (
    InventoryStatus,
    InventoryType,
    LocationType,
    MovementReason,
    TxnCategory,
    TxnType,
)
from app.models import (
    FinanceTransaction,
    Inventory,
    InventoryItem,
    Material,
    Setting,
    Stock,
    StockMovement,
)


def money(x: float | None) -> float:
    return round(float(x or 0.0), 2)


def qty(x: float | None) -> float:
    return round(float(x or 0.0), 3)


# ─────────────────────────── Нумерация документов ──────────────────
_PREFIX = {
    "request": "ЗАЯ",
    "invoice": "НАК",
    "inventory": "ИНВ",
}


async def next_number(db: AsyncSession, kind: str, model) -> str:
    prefix = _PREFIX.get(kind, "DOC")
    # Монотонный номер от max(id): не «съезжает» при удалении документов.
    max_id = await db.scalar(select(func.max(model.id)))
    return f"{prefix}-{(max_id or 0) + 1:04d}"


# ─────────────────────────── Остатки / движения ────────────────────
async def get_or_create_stock(
    db: AsyncSession, material_id: int, location_type: str, location_id: int
) -> Stock:
    row = await db.scalar(
        select(Stock).where(
            Stock.material_id == material_id,
            Stock.location_type == location_type,
            Stock.location_id == location_id,
        )
    )
    if row is None:
        row = Stock(
            material_id=material_id,
            location_type=location_type,
            location_id=location_id,
            quantity=0.0,
            avg_cost=0.0,
        )
        db.add(row)
        await db.flush()
    return row


async def stock_qty(
    db: AsyncSession, material_id: int, location_type: str, location_id: int
) -> float:
    row = await db.scalar(
        select(Stock).where(
            Stock.material_id == material_id,
            Stock.location_type == location_type,
            Stock.location_id == location_id,
        )
    )
    return qty(row.quantity) if row else 0.0


async def apply_movement(
    db: AsyncSession,
    *,
    material_id: int,
    quantity: float,
    unit_price: float = 0.0,
    from_type: str | None = None,
    from_id: int | None = None,
    to_type: str | None = None,
    to_id: int | None = None,
    reason: str = MovementReason.RECEIPT.value,
    ref_type: str | None = None,
    ref_id: int | None = None,
    created_by: int | None = None,
    note: str = "",
) -> StockMovement:
    """Проводит движение материала: списывает из источника, приходует в назначение,
    пересчитывает средневзвешенную стоимость и пишет запись в историю (ЗАС-23)."""
    move_qty = qty(quantity)
    price = money(unit_price)

    # Списание из источника
    if from_type is not None and from_id is not None:
        src = await get_or_create_stock(db, material_id, from_type, from_id)
        if not price:  # стоимость движения = средняя стоимость источника
            price = money(src.avg_cost)
        src.quantity = qty(src.quantity - move_qty)

    # Приход в назначение с пересчётом средней стоимости
    if to_type is not None and to_id is not None:
        dst = await get_or_create_stock(db, material_id, to_type, to_id)
        old_qty = qty(dst.quantity)
        new_qty = qty(old_qty + move_qty)
        if new_qty > 0:
            dst.avg_cost = money((old_qty * dst.avg_cost + move_qty * price) / new_qty)
        dst.quantity = new_qty

    mv = StockMovement(
        material_id=material_id,
        from_type=from_type,
        from_id=from_id,
        to_type=to_type,
        to_id=to_id,
        quantity=move_qty,
        unit_price=price,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
        created_by=created_by,
        note=note,
    )
    db.add(mv)
    await db.flush()
    return mv


async def set_stock_to_fact(
    db: AsyncSession,
    material_id: int,
    location_type: str,
    location_id: int,
    fact_qty: float,
    unit_price: float,
    ref_type: str | None = None,
    ref_id: int | None = None,
    created_by: int | None = None,
) -> None:
    """Корректировка остатка до факта (инвентаризация, ЗАС-52). Пишет движение на разницу."""
    st = await get_or_create_stock(db, material_id, location_type, location_id)
    old = qty(st.quantity)
    old_avg = money(st.avg_cost)
    fact = qty(fact_qty)
    diff = qty(fact - old)
    price = money(unit_price)
    # Излишек приходуется по цене — пересчитываем средневзвешенную стоимость,
    # иначе впервые оприходованный через инвентаризацию материал остался бы с avg_cost=0.
    if diff > 0 and fact > 0:
        st.avg_cost = money((old * old_avg + diff * price) / fact)
    st.quantity = fact
    if diff != 0:
        db.add(
            StockMovement(
                material_id=material_id,
                from_type=None if diff > 0 else location_type,
                from_id=None if diff > 0 else location_id,
                to_type=location_type if diff > 0 else None,
                to_id=location_id if diff > 0 else None,
                quantity=abs(diff),
                unit_price=money(unit_price),
                reason=MovementReason.INVENTORY_ADJUST.value,
                ref_type=ref_type,
                ref_id=ref_id,
                created_by=created_by,
                note="Корректировка по инвентаризации",
            )
        )
    await db.flush()


# ─────────────────────────── Блокировка при инвентаризации ─────────
async def locked_material_ids(db: AsyncSession) -> tuple[bool, set[int], set[str]]:
    """Возвращает (заблокирован_весь_склад, {material_id}, {category}) по активным
    инвентаризациям (ЗАС-51). Полная блокирует весь склад, частичная — свою группу."""
    invs = (
        await db.scalars(
            select(Inventory).where(Inventory.status == InventoryStatus.IN_PROGRESS.value)
        )
    ).all()
    full = False
    cats: set[str] = set()
    for inv in invs:
        if inv.type == InventoryType.FULL.value:
            full = True
        elif inv.category_filter:
            cats.add(inv.category_filter)
    return full, set(), cats


async def assert_material_not_locked(db: AsyncSession, material_id: int) -> None:
    full, _ids, cats = await locked_material_ids(db)
    if full:
        raise PermissionError("Движения заблокированы: идёт полная инвентаризация склада.")
    if cats:
        mat = await db.get(Material, material_id)
        if mat and mat.category in cats:
            raise PermissionError(
                f"Движения по группе «{mat.category}» заблокированы: идёт инвентаризация."
            )


# ─────────────────────────── Смета: факт по категориям ─────────────
_ESTIMATE_TO_TXN = {
    "material": TxnCategory.MATERIAL.value,
    "work": TxnCategory.WORK.value,
    "tech": TxnCategory.TECH.value,
    "money": TxnCategory.OTHER.value,
    "other": TxnCategory.OTHER.value,
}


async def object_expense_by_txn_category(db: AsyncSession, object_id: int) -> dict[str, float]:
    """Суммы фактических расходов по объекту в разрезе категорий транзакций."""
    rows = await db.execute(
        select(FinanceTransaction.category, func.sum(FinanceTransaction.amount))
        .where(
            FinanceTransaction.object_id == object_id,
            FinanceTransaction.type == TxnType.EXPENSE.value,
            FinanceTransaction.is_admin.is_(False),  # административные — отдельно (ЗАС-42)
        )
        .group_by(FinanceTransaction.category)
    )
    return {cat: money(total) for cat, total in rows.all()}


# ─────────────────────────── Настройки бизнеса ─────────────────────
async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    row = await db.scalar(select(Setting).where(Setting.key == key))
    return row.value if row else default


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    row = await db.scalar(select(Setting).where(Setting.key == key))
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    await db.flush()


async def get_business_limits(db: AsyncSession) -> tuple[float, float]:
    limit = float(await get_setting(db, "expense_limit", "0") or 0)
    threshold = float(await get_setting(db, "large_threshold", "0") or 0)
    return money(limit), money(threshold)
