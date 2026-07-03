from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models import ConstructionObject, ObjectStage, User
from app.schemas import ObjectCreate, ObjectOut, ObjectUpdate, StageIn, StageOut
from app.serializers import load_refs, ser_object

router = APIRouter(tags=["objects"], prefix="/objects")


async def _get_full(db: AsyncSession, object_id: int) -> ConstructionObject:
    obj = await db.scalar(
        select(ConstructionObject)
        .where(ConstructionObject.id == object_id)
        .options(selectinload(ConstructionObject.stages))
    )
    if obj is None:
        raise HTTPException(404, "Объект не найден")
    return obj


@router.get("", response_model=list[ObjectOut])
async def list_objects(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    objs = (
        await db.scalars(
            select(ConstructionObject)
            .options(selectinload(ConstructionObject.stages))
            .order_by(ConstructionObject.id.desc())
        )
    ).all()
    refs = await load_refs(db)
    return [ser_object(o, refs) for o in objs]


@router.get("/{object_id}", response_model=ObjectOut)
async def get_object(
    object_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    obj = await _get_full(db, object_id)
    refs = await load_refs(db)
    return ser_object(obj, refs)


@router.post("", response_model=ObjectOut, status_code=201)
async def create_object(
    data: ObjectCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    obj = ConstructionObject(
        name=data.name.strip(),
        address=data.address.strip(),
        city_id=data.city_id,
        responsible_id=data.responsible_id,
        status=data.status.value,
        start_date=data.start_date,
        deadline=data.deadline,
        description=data.description.strip(),
    )
    for s in data.stages:
        obj.stages.append(
            ObjectStage(
                name=s.name.strip(),
                planned_start=s.planned_start,
                planned_end=s.planned_end,
                status=s.status.value,
            )
        )
    db.add(obj)
    await db.commit()
    obj = await _get_full(db, obj.id)
    refs = await load_refs(db)
    return ser_object(obj, refs)


@router.patch("/{object_id}", response_model=ObjectOut)
async def update_object(
    object_id: int,
    data: ObjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = await _get_full(db, object_id)
    payload = data.model_dump(exclude_unset=True)
    if "status" in payload and payload["status"] is not None:
        payload["status"] = payload["status"].value if hasattr(payload["status"], "value") else payload["status"]
    for field, value in payload.items():
        setattr(obj, field, value)
    await db.commit()
    obj = await _get_full(db, object_id)
    refs = await load_refs(db)
    return ser_object(obj, refs)


@router.delete("/{object_id}", status_code=204)
async def delete_object(
    object_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    obj = await db.get(ConstructionObject, object_id)
    if obj is None:
        raise HTTPException(404, "Объект не найден")
    await db.delete(obj)
    await db.commit()


# ─────────────────────────── Этапы ─────────────────────────────────
@router.post("/{object_id}/stages", response_model=StageOut, status_code=201)
async def add_stage(
    object_id: int,
    data: StageIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = await db.get(ConstructionObject, object_id)
    if obj is None:
        raise HTTPException(404, "Объект не найден")
    stage = ObjectStage(
        object_id=object_id,
        name=data.name.strip(),
        planned_start=data.planned_start,
        planned_end=data.planned_end,
        status=data.status.value,
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.patch("/stages/{stage_id}", response_model=StageOut)
async def update_stage(
    stage_id: int,
    data: StageIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stage = await db.get(ObjectStage, stage_id)
    if stage is None:
        raise HTTPException(404, "Этап не найден")
    stage.name = data.name.strip()
    stage.planned_start = data.planned_start
    stage.planned_end = data.planned_end
    stage.status = data.status.value
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/stages/{stage_id}", status_code=204)
async def delete_stage(
    stage_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    stage = await db.get(ObjectStage, stage_id)
    if stage is None:
        raise HTTPException(404, "Этап не найден")
    await db.delete(stage)
    await db.commit()
