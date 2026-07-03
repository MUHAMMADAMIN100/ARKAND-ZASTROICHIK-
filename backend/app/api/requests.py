from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.enums import LocationType, RequestStatus
from app.models import MaterialRequest, MaterialRequestItem, Stock, User
from app.schemas import RequestConfirmIn, RequestCreate, RequestOut
from app.serializers import load_refs, ser_request
from app.services import next_number, qty

router = APIRouter(tags=["requests"], prefix="/requests")


async def _get_full(db: AsyncSession, request_id: int) -> MaterialRequest:
    req = await db.scalar(
        select(MaterialRequest)
        .where(MaterialRequest.id == request_id)
        .options(selectinload(MaterialRequest.items))
    )
    if req is None:
        raise HTTPException(404, "Заявка не найдена")
    return req


async def _warehouse_qty(db: AsyncSession, material_ids: list[int]) -> dict[int, float]:
    if not material_ids:
        return {}
    rows = await db.execute(
        select(Stock.material_id, func.sum(Stock.quantity))
        .where(
            Stock.location_type == LocationType.WAREHOUSE.value,
            Stock.material_id.in_(material_ids),
        )
        .group_by(Stock.material_id)
    )
    return {mid: qty(t) for mid, t in rows.all()}


async def _serialize(db: AsyncSession, req: MaterialRequest, refs=None) -> dict:
    refs = refs or await load_refs(db)
    wh = await _warehouse_qty(db, [it.material_id for it in req.items])
    return ser_request(req, refs, wh)


@router.get("", response_model=list[RequestOut])
async def list_requests(
    status: str | None = Query(None),
    object_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        select(MaterialRequest)
        .options(selectinload(MaterialRequest.items))
        .order_by(desc(MaterialRequest.id))
    )
    if status:
        q = q.where(MaterialRequest.status == status)
    if object_id:
        q = q.where(MaterialRequest.object_id == object_id)
    reqs = (await db.scalars(q)).all()
    refs = await load_refs(db)
    all_mids = [it.material_id for r in reqs for it in r.items]
    wh = await _warehouse_qty(db, list(set(all_mids)))
    return [ser_request(r, refs, wh) for r in reqs]


@router.get("/{request_id}", response_model=RequestOut)
async def get_request(
    request_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    req = await _get_full(db, request_id)
    return await _serialize(db, req)


@router.post("", response_model=RequestOut, status_code=201)
async def create_request(
    data: RequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not data.items:
        raise HTTPException(422, "Добавьте хотя бы одну позицию")
    number = await next_number(db, "request", MaterialRequest)
    req = MaterialRequest(
        number=number,
        object_id=data.object_id,
        created_by=user.id,
        status=RequestStatus.SUBMITTED.value,
        needed_date=data.needed_date,
        note=data.note.strip(),
    )
    for it in data.items:
        req.items.append(
            MaterialRequestItem(
                material_id=it.material_id, quantity=qty(it.quantity), note=it.note.strip()
            )
        )
    db.add(req)
    await db.commit()
    req = await _get_full(db, req.id)
    return await _serialize(db, req)


@router.post("/{request_id}/confirm", response_model=RequestOut)
async def confirm_request(
    request_id: int,
    data: RequestConfirmIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Подтверждение заявки снабжением (роль-заглушка, ЗАС-11) + развилка (ЗАС-12)."""
    req = await _get_full(db, request_id)
    if req.status not in (RequestStatus.SUBMITTED.value, RequestStatus.REJECTED.value):
        raise HTTPException(409, "Заявку уже обработали")
    req.status = RequestStatus.CONFIRMED.value
    req.fulfillment_type = data.fulfillment_type.value
    req.confirmed_by = user.id
    req.confirmed_at = datetime.now(timezone.utc)
    await db.commit()
    req = await _get_full(db, request_id)
    return await _serialize(db, req)


@router.post("/{request_id}/reject", response_model=RequestOut)
async def reject_request(
    request_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    req = await _get_full(db, request_id)
    if req.status == RequestStatus.FULFILLED.value:
        raise HTTPException(409, "Заявка уже обеспечена")
    req.status = RequestStatus.REJECTED.value
    await db.commit()
    req = await _get_full(db, request_id)
    return await _serialize(db, req)


@router.delete("/{request_id}", status_code=204)
async def delete_request(
    request_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    req = await db.get(MaterialRequest, request_id)
    if req is None:
        raise HTTPException(404, "Заявка не найдена")
    if req.status == RequestStatus.FULFILLED.value:
        raise HTTPException(409, "Нельзя удалить обеспеченную заявку")
    await db.delete(req)
    await db.commit()
