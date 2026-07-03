from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.enums import ApprovalStatus, PaymentMethod, Role, TxnCategory, TxnType
from app.models import CashRegister, FinanceTransaction, User
from app.schemas import (
    CashCreate,
    CashOut,
    CashUpdate,
    TxnCreate,
    TxnOut,
    TxnUpdate,
)
from app.serializers import load_refs, ser_cash, ser_txn
from app.services import get_business_limits, money

router = APIRouter(tags=["finance"])


# ─────────────────────────── Кассы ─────────────────────────────────
async def _cash_flows(db: AsyncSession) -> dict[int, tuple[float, float]]:
    """cash_id -> (income, expense)."""
    rows = await db.execute(
        select(
            FinanceTransaction.cash_id,
            FinanceTransaction.type,
            func.sum(FinanceTransaction.amount),
        )
        .where(FinanceTransaction.cash_id.isnot(None))
        .group_by(FinanceTransaction.cash_id, FinanceTransaction.type)
    )
    acc: dict[int, list[float]] = {}
    for cash_id, ttype, total in rows.all():
        inc, exp = acc.get(cash_id, [0.0, 0.0])
        if ttype == TxnType.INCOME.value:
            inc += float(total or 0)
        else:
            exp += float(total or 0)
        acc[cash_id] = [inc, exp]
    return {k: (v[0], v[1]) for k, v in acc.items()}


@router.get("/cash", response_model=list[CashOut])
async def list_cash(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    cashes = (await db.scalars(select(CashRegister).order_by(CashRegister.id))).all()
    refs = await load_refs(db)
    flows = await _cash_flows(db)
    out = []
    for c in cashes:
        inc, exp = flows.get(c.id, (0.0, 0.0))
        out.append(ser_cash(c, refs, inc, exp))
    return out


@router.post("/cash", response_model=CashOut, status_code=201)
async def create_cash(
    data: CashCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    c = CashRegister(
        name=data.name.strip(), object_id=data.object_id, limit_amount=data.limit_amount
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    refs = await load_refs(db)
    return ser_cash(c, refs, 0.0, 0.0)


@router.patch("/cash/{cash_id}", response_model=CashOut)
async def update_cash(
    cash_id: int,
    data: CashUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    c = await db.get(CashRegister, cash_id)
    if c is None:
        raise HTTPException(404, "Касса не найдена")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    await db.commit()
    await db.refresh(c)
    refs = await load_refs(db)
    flows = await _cash_flows(db)
    inc, exp = flows.get(c.id, (0.0, 0.0))
    return ser_cash(c, refs, inc, exp)


# ─────────────────────────── Транзакции ────────────────────────────
@router.get("/finance/transactions", response_model=list[TxnOut])
async def list_transactions(
    object_id: int | None = Query(None),
    type: str | None = Query(None),
    category: str | None = Query(None),
    cash_id: int | None = Query(None),
    approval_status: str | None = Query(None),
    limit: int = Query(300, le=2000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(FinanceTransaction).order_by(desc(FinanceTransaction.id)).limit(limit)
    if object_id:
        q = q.where(FinanceTransaction.object_id == object_id)
    if type:
        q = q.where(FinanceTransaction.type == type)
    if category:
        q = q.where(FinanceTransaction.category == category)
    if cash_id:
        q = q.where(FinanceTransaction.cash_id == cash_id)
    if approval_status:
        q = q.where(FinanceTransaction.approval_status == approval_status)
    txns = (await db.scalars(q)).all()
    refs = await load_refs(db)
    return [ser_txn(t, refs) for t in txns]


@router.post("/finance/transactions", response_model=TxnOut, status_code=201)
async def create_transaction(
    data: TxnCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.amount <= 0:
        raise HTTPException(422, "Сумма должна быть больше нуля")

    approval = ApprovalStatus.NOT_REQUIRED.value
    if data.type == TxnType.EXPENSE:
        _limit, threshold = await get_business_limits(db)
        if threshold and money(data.amount) >= threshold:
            approval = ApprovalStatus.PENDING.value  # крупный расход — заглушка согласования

    t = FinanceTransaction(
        object_id=data.object_id,
        cash_id=data.cash_id,
        type=data.type.value,
        category=data.category.value,
        amount=money(data.amount),
        payment_method=data.payment_method.value,
        is_admin=data.is_admin,
        op_date=data.op_date or date.today(),
        description=data.description.strip(),
        approval_status=approval,
        created_by=user.id,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    refs = await load_refs(db)
    return ser_txn(t, refs)


@router.patch("/finance/transactions/{txn_id}", response_model=TxnOut)
async def update_transaction(
    txn_id: int,
    data: TxnUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = await db.get(FinanceTransaction, txn_id)
    if t is None:
        raise HTTPException(404, "Операция не найдена")
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if field in ("category", "payment_method") and value is not None and hasattr(value, "value"):
            value = value.value
        if field == "amount" and value is not None:
            value = money(value)
        setattr(t, field, value)
    await db.commit()
    await db.refresh(t)
    refs = await load_refs(db)
    return ser_txn(t, refs)


@router.post("/finance/transactions/{txn_id}/approve", response_model=TxnOut)
async def approve_transaction(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.OWNER, Role.ADMIN)),
):
    """Согласование крупного расхода (заглушка владельцев, ХОЛ-22..23)."""
    t = await db.get(FinanceTransaction, txn_id)
    if t is None:
        raise HTTPException(404, "Операция не найдена")
    t.approval_status = ApprovalStatus.APPROVED.value
    await db.commit()
    await db.refresh(t)
    refs = await load_refs(db)
    return ser_txn(t, refs)


@router.post("/finance/transactions/{txn_id}/reject", response_model=TxnOut)
async def reject_transaction(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.OWNER, Role.ADMIN)),
):
    t = await db.get(FinanceTransaction, txn_id)
    if t is None:
        raise HTTPException(404, "Операция не найдена")
    t.approval_status = ApprovalStatus.REJECTED.value
    await db.commit()
    await db.refresh(t)
    refs = await load_refs(db)
    return ser_txn(t, refs)


@router.delete("/finance/transactions/{txn_id}", status_code=204)
async def delete_transaction(
    txn_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    t = await db.get(FinanceTransaction, txn_id)
    if t is None:
        raise HTTPException(404, "Операция не найдена")
    await db.delete(t)
    await db.commit()
