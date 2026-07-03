from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.enums import InventoryStatus, InventoryType, LocationType
from app.models import Inventory, InventoryItem, Material, Stock, User
from app.schemas import InventoryCountIn, InventoryOut, InventoryStartIn
from app.serializers import load_refs, ser_inventory
from app.services import next_number, qty, set_stock_to_fact

router = APIRouter(tags=["inventory"], prefix="/inventories")


async def _get_full(db: AsyncSession, inv_id: int) -> Inventory:
    inv = await db.scalar(
        select(Inventory).where(Inventory.id == inv_id).options(selectinload(Inventory.items))
    )
    if inv is None:
        raise HTTPException(404, "Инвентаризация не найдена")
    return inv


@router.get("", response_model=list[InventoryOut])
async def list_inventories(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Inventory).options(selectinload(Inventory.items)).order_by(desc(Inventory.id))
    if status:
        q = q.where(Inventory.status == status)
    invs = (await db.scalars(q)).all()
    refs = await load_refs(db)
    return [ser_inventory(inv, refs) for inv in invs]


@router.get("/{inv_id}", response_model=InventoryOut)
async def get_inventory(
    inv_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    inv = await _get_full(db, inv_id)
    refs = await load_refs(db)
    return ser_inventory(inv, refs)


@router.post("/start", response_model=InventoryOut, status_code=201)
async def start_inventory(
    data: InventoryStartIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # проверка пересечений с активными инвентаризациями (ЗАС-51)
    active = (
        await db.scalars(
            select(Inventory).where(Inventory.status == InventoryStatus.IN_PROGRESS.value)
        )
    ).all()
    for a in active:
        if a.type == InventoryType.FULL.value:
            raise HTTPException(409, "Уже идёт полная инвентаризация склада")
        if data.type == InventoryType.FULL:
            raise HTTPException(409, "Есть активная частичная инвентаризация — завершите её")
        if data.type == InventoryType.PARTIAL and a.category_filter == data.category_filter:
            raise HTTPException(409, f"Группа «{data.category_filter}» уже пересчитывается")

    # выборка материалов
    mat_q = select(Material)
    if data.type == InventoryType.PARTIAL:
        if not data.category_filter.strip():
            raise HTTPException(422, "Для частичной инвентаризации укажите группу")
        mat_q = mat_q.where(Material.category == data.category_filter.strip())
    materials = (await db.scalars(mat_q.order_by(Material.name))).all()
    if not materials:
        raise HTTPException(422, "Нет материалов для инвентаризации по этому фильтру")

    # текущие остатки склада
    stock_rows = (
        await db.scalars(
            select(Stock).where(Stock.location_type == LocationType.WAREHOUSE.value)
        )
    ).all()
    stock_map = {s.material_id: s for s in stock_rows}

    inv = Inventory(
        number=await next_number(db, "inventory", Inventory),
        type=data.type.value,
        status=InventoryStatus.IN_PROGRESS.value,
        category_filter=data.category_filter.strip(),
        note=data.note.strip(),
        started_by=user.id,
    )
    for m in materials:
        st = stock_map.get(m.id)
        inv.items.append(
            InventoryItem(
                material_id=m.id,
                qty_system=qty(st.quantity) if st else 0.0,
                qty_fact=None,
                unit_price=(st.avg_cost if st and st.avg_cost else m.default_price),
            )
        )
    db.add(inv)
    await db.commit()
    inv = await _get_full(db, inv.id)
    refs = await load_refs(db)
    return ser_inventory(inv, refs)


@router.post("/{inv_id}/count", response_model=InventoryOut)
async def count_inventory(
    inv_id: int,
    data: InventoryCountIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Ввод факта пересчёта (можно частями, прогресс сохраняется)."""
    inv = await _get_full(db, inv_id)
    if inv.status != InventoryStatus.IN_PROGRESS.value:
        raise HTTPException(409, "Инвентаризация уже завершена")
    fact_map = {d.item_id: d.qty_fact for d in data.items}
    for item in inv.items:
        if item.id in fact_map:
            v = fact_map[item.id]
            item.qty_fact = qty(v) if v is not None else None
    await db.commit()
    inv = await _get_full(db, inv_id)
    refs = await load_refs(db)
    return ser_inventory(inv, refs)


@router.post("/{inv_id}/complete", response_model=InventoryOut)
async def complete_inventory(
    inv_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Завершение: корректировка остатков до факта (ЗАС-52). Непосчитанные — без изменений."""
    inv = await _get_full(db, inv_id)
    if inv.status != InventoryStatus.IN_PROGRESS.value:
        raise HTTPException(409, "Инвентаризация уже завершена")

    for item in inv.items:
        if item.qty_fact is None:
            continue  # не посчитано — остаток не трогаем
        await set_stock_to_fact(
            db,
            material_id=item.material_id,
            location_type=LocationType.WAREHOUSE.value,
            location_id=0,
            fact_qty=item.qty_fact,
            unit_price=item.unit_price,
            ref_type="inventory",
            ref_id=inv.id,
            created_by=user.id,
        )

    inv.status = InventoryStatus.COMPLETED.value
    inv.completed_at = datetime.now(timezone.utc)
    await db.commit()
    inv = await _get_full(db, inv_id)
    refs = await load_refs(db)
    return ser_inventory(inv, refs)


@router.post("/{inv_id}/cancel", response_model=InventoryOut)
async def cancel_inventory(
    inv_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    inv = await _get_full(db, inv_id)
    if inv.status != InventoryStatus.IN_PROGRESS.value:
        raise HTTPException(409, "Инвентаризация уже завершена")
    inv.status = InventoryStatus.CANCELLED.value
    inv.completed_at = datetime.now(timezone.utc)
    await db.commit()
    inv = await _get_full(db, inv_id)
    refs = await load_refs(db)
    return ser_inventory(inv, refs)
