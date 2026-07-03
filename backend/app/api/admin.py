from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.enums import DebtStatus, Role
from app.models import DebtRecord, User
from app.schemas import DebtOut, SettingsOut, SettingsUpdate
from app.services import get_business_limits, set_setting

router = APIRouter(tags=["admin"])


@router.get("/settings", response_model=SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    limit, threshold = await get_business_limits(db)
    return SettingsOut(expense_limit=limit, large_threshold=threshold)


@router.put("/settings", response_model=SettingsOut)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.OWNER, Role.ADMIN)),
):
    if data.expense_limit is not None:
        await set_setting(db, "expense_limit", str(data.expense_limit))
    if data.large_threshold is not None:
        await set_setting(db, "large_threshold", str(data.large_threshold))
    await db.commit()
    limit, threshold = await get_business_limits(db)
    return SettingsOut(expense_limit=limit, large_threshold=threshold)


@router.get("/debts", response_model=list[DebtOut])
async def list_debts(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return (await db.scalars(select(DebtRecord).order_by(desc(DebtRecord.id)))).all()


@router.post("/debts/{debt_id}/settle", response_model=DebtOut)
async def settle_debt(
    debt_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    debt = await db.get(DebtRecord, debt_id)
    if debt is None:
        raise HTTPException(404, "Долг не найден")
    debt.status = DebtStatus.SETTLED.value
    await db.commit()
    await db.refresh(debt)
    return debt


@router.get("/kpi")
async def kpi_placeholder(_: User = Depends(get_current_user)):
    """Место под KPI (ХОЛ-40): структура-заглушка, метрики уточняются на опыте."""
    return {
        "note": "Место под KPI. Метрики уточняются на опыте эксплуатации.",
        "roles": [
            {"role": "foreman", "label": "Прораб", "metrics": []},
            {"role": "storekeeper", "label": "Кладовщик", "metrics": []},
            {"role": "sales", "label": "Менеджер по продажам", "metrics": []},
            {"role": "cashier", "label": "Кассир", "metrics": []},
        ],
    }
