from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.enums import LocationType
from app.models import City, Material, Stock, Supplier, User
from app.schemas import (
    CityCreate,
    CityOut,
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
    SupplierCreate,
    SupplierOut,
)
from app.serializers import ser_material
from app.services import qty

router = APIRouter(tags=["catalog"])


# ─────────────────────────── Города ────────────────────────────────
@router.get("/cities", response_model=list[CityOut])
async def list_cities(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return (await db.scalars(select(City).order_by(City.name))).all()


@router.post("/cities", response_model=CityOut, status_code=201)
async def create_city(
    data: CityCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    name = data.name.strip()
    exists = await db.scalar(select(City).where(func.lower(City.name) == name.lower()))
    if exists:
        return exists
    city = City(name=name)
    db.add(city)
    await db.commit()
    await db.refresh(city)
    return city


# ─────────────────────────── Материалы ─────────────────────────────
async def _stock_maps(db: AsyncSession) -> tuple[dict[int, float], dict[int, float]]:
    """warehouse_qty и total_qty по каждому материалу."""
    wh_rows = await db.execute(
        select(Stock.material_id, func.sum(Stock.quantity))
        .where(Stock.location_type == LocationType.WAREHOUSE.value)
        .group_by(Stock.material_id)
    )
    total_rows = await db.execute(
        select(Stock.material_id, func.sum(Stock.quantity)).group_by(Stock.material_id)
    )
    wh = {mid: qty(t) for mid, t in wh_rows.all()}
    total = {mid: qty(t) for mid, t in total_rows.all()}
    return wh, total


@router.get("/materials", response_model=list[MaterialOut])
async def list_materials(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    materials = (await db.scalars(select(Material).order_by(Material.name))).all()
    wh, total = await _stock_maps(db)
    return [ser_material(m, wh.get(m.id, 0.0), total.get(m.id, 0.0)) for m in materials]


@router.post("/materials", response_model=MaterialOut, status_code=201)
async def create_material(
    data: MaterialCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    m = Material(
        name=data.name.strip(),
        unit=data.unit.strip() or "шт",
        category=data.category.strip() or "Прочее",
        sku=data.sku.strip(),
        min_stock=data.min_stock,
        default_price=data.default_price,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return ser_material(m)


@router.patch("/materials/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: int,
    data: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = await db.get(Material, material_id)
    if m is None:
        raise HTTPException(404, "Материал не найден")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    await db.commit()
    await db.refresh(m)
    wh, total = await _stock_maps(db)
    return ser_material(m, wh.get(m.id, 0.0), total.get(m.id, 0.0))


# ─────────────────────────── Поставщики ────────────────────────────
@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    return (await db.scalars(select(Supplier).order_by(Supplier.name))).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(
    data: SupplierCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    s = Supplier(
        name=data.name.strip(),
        phone=data.phone.strip(),
        note=data.note.strip(),
        is_internal=data.is_internal,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s
