from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models import Estimate, EstimateItem, User
from app.schemas import (
    EstimateCompareOut,
    EstimateCreate,
    EstimateItemIn,
    EstimateItemOut,
    EstimateItemUpdate,
    EstimateOut,
)
from app.serializers import estimate_compare, load_refs, ser_estimate
from app.services import object_expense_by_txn_category, qty

router = APIRouter(tags=["estimates"], prefix="/estimates")


async def _get_full(db: AsyncSession, estimate_id: int) -> Estimate:
    est = await db.scalar(
        select(Estimate).where(Estimate.id == estimate_id).options(selectinload(Estimate.items))
    )
    if est is None:
        raise HTTPException(404, "Смета не найдена")
    return est


async def _serialize(db: AsyncSession, est: Estimate, refs=None) -> dict:
    refs = refs or await load_refs(db)
    fact = await object_expense_by_txn_category(db, est.object_id)
    return ser_estimate(est, refs, fact)


@router.get("", response_model=list[EstimateOut])
async def list_estimates(
    object_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Estimate).options(selectinload(Estimate.items)).order_by(desc(Estimate.id))
    if object_id:
        q = q.where(Estimate.object_id == object_id)
    ests = (await db.scalars(q)).all()
    refs = await load_refs(db)
    out = []
    for e in ests:
        fact = await object_expense_by_txn_category(db, e.object_id)
        out.append(ser_estimate(e, refs, fact))
    return out


@router.get("/{estimate_id}", response_model=EstimateOut)
async def get_estimate(
    estimate_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    est = await _get_full(db, estimate_id)
    return await _serialize(db, est)


@router.get("/{estimate_id}/compare", response_model=EstimateCompareOut)
async def compare_estimate(
    estimate_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    est = await _get_full(db, estimate_id)
    refs = await load_refs(db)
    fact = await object_expense_by_txn_category(db, est.object_id)
    return estimate_compare(est, refs, fact)


@router.post("", response_model=EstimateOut, status_code=201)
async def create_estimate(
    data: EstimateCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    est = Estimate(object_id=data.object_id, name=data.name.strip(), note=data.note.strip())
    for it in data.items:
        est.items.append(
            EstimateItem(
                category=it.category.value,
                name=it.name.strip(),
                unit=it.unit.strip(),
                qty_plan=qty(it.qty_plan),
                price_plan=it.price_plan,
                amount_fact_manual=it.amount_fact_manual,
            )
        )
    db.add(est)
    await db.commit()
    est = await _get_full(db, est.id)
    return await _serialize(db, est)


@router.post("/{estimate_id}/items", response_model=EstimateItemOut, status_code=201)
async def add_item(
    estimate_id: int,
    data: EstimateItemIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    est = await db.get(Estimate, estimate_id)
    if est is None:
        raise HTTPException(404, "Смета не найдена")
    item = EstimateItem(
        estimate_id=estimate_id,
        category=data.category.value,
        name=data.name.strip(),
        unit=data.unit.strip(),
        qty_plan=qty(data.qty_plan),
        price_plan=data.price_plan,
        amount_fact_manual=data.amount_fact_manual,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    from app.serializers import _estimate_item

    return _estimate_item(item)


@router.patch("/items/{item_id}", response_model=EstimateItemOut)
async def update_item(
    item_id: int,
    data: EstimateItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = await db.get(EstimateItem, item_id)
    if item is None:
        raise HTTPException(404, "Позиция не найдена")
    payload = data.model_dump(exclude_unset=True)
    if "category" in payload and payload["category"] is not None:
        payload["category"] = (
            payload["category"].value
            if hasattr(payload["category"], "value")
            else payload["category"]
        )
    for field, value in payload.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    from app.serializers import _estimate_item

    return _estimate_item(item)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    item = await db.get(EstimateItem, item_id)
    if item is None:
        raise HTTPException(404, "Позиция не найдена")
    await db.delete(item)
    await db.commit()


@router.delete("/{estimate_id}", status_code=204)
async def delete_estimate(
    estimate_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    est = await db.get(Estimate, estimate_id)
    if est is None:
        raise HTTPException(404, "Смета не найдена")
    await db.delete(est)
    await db.commit()
