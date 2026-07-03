from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.enums import (
    InventoryStatus,
    InvoiceStatus,
    LocationType,
    ObjectStatus,
    RequestStatus,
    TxnCategory,
    TxnType,
)
from app.models import (
    ConstructionObject,
    FinanceTransaction,
    Inventory,
    Invoice,
    MaterialRequest,
    Stock,
    User,
)
from app.schemas import CityAnalyticsRow, DashboardOut, ObjectExpenseRow
from app.serializers import load_refs
from app.services import money

router = APIRouter(tags=["reports"], prefix="/reports")


def _month_bounds() -> tuple[date, date]:
    today = date.today()
    start = today.replace(day=1)
    return start, today


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    objects_total = await db.scalar(select(func.count()).select_from(ConstructionObject)) or 0
    objects_active = (
        await db.scalar(
            select(func.count())
            .select_from(ConstructionObject)
            .where(ConstructionObject.status == ObjectStatus.IN_PROGRESS.value)
        )
        or 0
    )
    requests_open = (
        await db.scalar(
            select(func.count())
            .select_from(MaterialRequest)
            .where(
                MaterialRequest.status.in_(
                    [RequestStatus.SUBMITTED.value, RequestStatus.CONFIRMED.value]
                )
            )
        )
        or 0
    )
    invoices_pending = (
        await db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.status == InvoiceStatus.SHIPPED.value)
        )
        or 0
    )
    inventory_active = (
        await db.scalar(
            select(func.count())
            .select_from(Inventory)
            .where(Inventory.status == InventoryStatus.IN_PROGRESS.value)
        )
        or 0
    )

    # дефицит на складе
    low_rows = await db.execute(
        select(Stock.quantity, Stock.material_id).where(
            Stock.location_type == LocationType.WAREHOUSE.value
        )
    )
    refs = await load_refs(db)
    low_stock_count = 0
    for q_, mid in low_rows.all():
        m = refs.materials.get(mid)
        if m and m.min_stock > 0 and float(q_ or 0) < m.min_stock:
            low_stock_count += 1

    # касса — суммарный баланс
    inc_cash = (
        await db.scalar(
            select(func.sum(FinanceTransaction.amount)).where(
                FinanceTransaction.cash_id.isnot(None),
                FinanceTransaction.type == TxnType.INCOME.value,
            )
        )
        or 0
    )
    exp_cash = (
        await db.scalar(
            select(func.sum(FinanceTransaction.amount)).where(
                FinanceTransaction.cash_id.isnot(None),
                FinanceTransaction.type == TxnType.EXPENSE.value,
            )
        )
        or 0
    )

    # месяц
    start, today = _month_bounds()
    inc_m = (
        await db.scalar(
            select(func.sum(FinanceTransaction.amount)).where(
                FinanceTransaction.type == TxnType.INCOME.value,
                FinanceTransaction.op_date >= start,
                FinanceTransaction.op_date <= today,
            )
        )
        or 0
    )
    exp_m = (
        await db.scalar(
            select(func.sum(FinanceTransaction.amount)).where(
                FinanceTransaction.type == TxnType.EXPENSE.value,
                FinanceTransaction.op_date >= start,
                FinanceTransaction.op_date <= today,
            )
        )
        or 0
    )

    return DashboardOut(
        objects_total=objects_total,
        objects_active=objects_active,
        requests_open=requests_open,
        invoices_pending=invoices_pending,
        low_stock_count=low_stock_count,
        inventory_active=inventory_active,
        cash_balance=money(inc_cash - exp_cash),
        expense_month=money(exp_m),
        income_month=money(inc_m),
        profit_month=money(inc_m - exp_m),
    )


@router.get("/object-expenses", response_model=list[ObjectExpenseRow])
async def object_expenses(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    objects = (await db.scalars(select(ConstructionObject))).all()
    refs = await load_refs(db)

    # агрегаты по объекту и категории
    # Прибыль по объекту считается по ПРЯМЫМ расходам; административные — отдельно (ЗАС-42).
    rows = await db.execute(
        select(
            FinanceTransaction.object_id,
            FinanceTransaction.type,
            FinanceTransaction.category,
            func.sum(FinanceTransaction.amount),
        )
        .where(
            FinanceTransaction.object_id.isnot(None),
            FinanceTransaction.is_admin.is_(False),
        )
        .group_by(
            FinanceTransaction.object_id,
            FinanceTransaction.type,
            FinanceTransaction.category,
        )
    )
    agg: dict[int, dict] = {}
    for oid, ttype, cat, total in rows.all():
        d = agg.setdefault(
            oid,
            {"materials": 0.0, "work": 0.0, "tech": 0.0, "other": 0.0, "income": 0.0},
        )
        val = float(total or 0)
        if ttype == TxnType.INCOME.value:
            d["income"] += val
        else:
            if cat == TxnCategory.MATERIAL.value:
                d["materials"] += val
            elif cat == TxnCategory.WORK.value:
                d["work"] += val
            elif cat == TxnCategory.TECH.value:
                d["tech"] += val
            else:
                d["other"] += val

    out: list[ObjectExpenseRow] = []
    for o in objects:
        d = agg.get(o.id, {"materials": 0.0, "work": 0.0, "tech": 0.0, "other": 0.0, "income": 0.0})
        total_exp = d["materials"] + d["work"] + d["tech"] + d["other"]
        out.append(
            ObjectExpenseRow(
                object_id=o.id,
                object_name=o.name,
                city_name=refs.cities.get(o.city_id) if o.city_id else None,
                materials=money(d["materials"]),
                work=money(d["work"]),
                tech=money(d["tech"]),
                other=money(d["other"]),
                total_expense=money(total_exp),
                income=money(d["income"]),
                profit=money(d["income"] - total_exp),
            )
        )
    out.sort(key=lambda r: r.total_expense, reverse=True)
    return out


@router.get("/city-analytics", response_model=list[CityAnalyticsRow])
async def city_analytics(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    objects = (await db.scalars(select(ConstructionObject))).all()
    refs = await load_refs(db)
    obj_city = {o.id: (refs.cities.get(o.city_id) if o.city_id else "Без города") for o in objects}

    rows = await db.execute(
        select(
            FinanceTransaction.object_id,
            FinanceTransaction.type,
            func.sum(FinanceTransaction.amount),
        )
        .where(
            FinanceTransaction.object_id.isnot(None),
            FinanceTransaction.is_admin.is_(False),
        )
        .group_by(FinanceTransaction.object_id, FinanceTransaction.type)
    )
    city_agg: dict[str, dict] = {}
    for oid, ttype, total in rows.all():
        city = obj_city.get(oid, "Без города")
        d = city_agg.setdefault(city, {"expense": 0.0, "income": 0.0})
        if ttype == TxnType.INCOME.value:
            d["income"] += float(total or 0)
        else:
            d["expense"] += float(total or 0)

    # количество объектов по городам
    city_count: dict[str, int] = {}
    for o in objects:
        city = obj_city.get(o.id, "Без города")
        city_count[city] = city_count.get(city, 0) + 1

    out: list[CityAnalyticsRow] = []
    for city, count in city_count.items():
        d = city_agg.get(city, {"expense": 0.0, "income": 0.0})
        out.append(
            CityAnalyticsRow(
                city_name=city,
                objects_count=count,
                total_expense=money(d["expense"]),
                income=money(d["income"]),
                profit=money(d["income"] - d["expense"]),
            )
        )
    out.sort(key=lambda r: r.profit, reverse=True)
    return out
