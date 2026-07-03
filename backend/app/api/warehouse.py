from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.enums import LocationType
from app.models import Stock, StockMovement, User
from app.schemas import MovementOut, StockOut
from app.serializers import load_refs, location_name, ser_movement
from app.services import qty

router = APIRouter(tags=["warehouse"])


@router.get("/stock", response_model=list[StockOut])
async def list_stock(
    location_type: str | None = Query(None),
    location_id: int | None = Query(None),
    low_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Stock)
    if location_type:
        q = q.where(Stock.location_type == location_type)
    if location_id is not None:
        q = q.where(Stock.location_id == location_id)
    rows = (await db.scalars(q)).all()
    refs = await load_refs(db)

    out: list[dict] = []
    for st in rows:
        m = refs.materials.get(st.material_id)
        if m is None:
            continue
        is_low = (
            st.location_type == LocationType.WAREHOUSE.value
            and m.min_stock > 0
            and qty(st.quantity) < m.min_stock
        )
        if low_only and not is_low:
            continue
        out.append(
            {
                "material_id": st.material_id,
                "material_name": m.name,
                "unit": m.unit,
                "category": m.category,
                "location_type": st.location_type,
                "location_id": st.location_id,
                "location_name": location_name(refs, st.location_type, st.location_id) or "",
                "quantity": qty(st.quantity),
                "avg_cost": st.avg_cost,
                "min_stock": m.min_stock,
                "is_low": is_low,
            }
        )
    # сортировка: сначала дефицит, затем по названию
    out.sort(key=lambda x: (not x["is_low"], x["material_name"].lower()))
    return out


@router.get("/movements", response_model=list[MovementOut])
async def list_movements(
    material_id: int | None = Query(None),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(StockMovement).order_by(desc(StockMovement.id)).limit(limit)
    if material_id:
        q = q.where(StockMovement.material_id == material_id)
    rows = (await db.scalars(q)).all()
    refs = await load_refs(db)
    return [ser_movement(mv, refs) for mv in rows]
