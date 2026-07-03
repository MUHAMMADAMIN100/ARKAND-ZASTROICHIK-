from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.enums import (
    ApprovalStatus,
    FulfillmentType,
    InvoiceStatus,
    InvoiceType,
    LocationType,
    MovementReason,
    PaymentMethod,
    RequestStatus,
    TxnCategory,
    TxnType,
)
from app.models import (
    DebtRecord,
    FinanceTransaction,
    Invoice,
    InvoiceItem,
    MaterialRequest,
    Supplier,
    User,
)
from app.schemas import InvoiceCreate, InvoiceOut, InvoiceReceiveIn
from app.serializers import load_refs, ser_invoice
from app.services import (
    apply_movement,
    assert_material_not_locked,
    get_business_limits,
    money,
    next_number,
    qty,
    stock_qty,
)

router = APIRouter(tags=["invoices"], prefix="/invoices")


async def _get_full(db: AsyncSession, invoice_id: int) -> Invoice:
    inv = await db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.items).selectinload(InvoiceItem.material))
    )
    if inv is None:
        raise HTTPException(404, "Накладная не найдена")
    return inv


@router.get("", response_model=list[InvoiceOut])
async def list_invoices(
    type: str | None = Query(None),
    status: str | None = Query(None),
    object_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Invoice).options(selectinload(Invoice.items)).order_by(desc(Invoice.id))
    if type:
        q = q.where(Invoice.type == type)
    if status:
        q = q.where(Invoice.status == status)
    if object_id:
        q = q.where(
            Invoice.dest_type == LocationType.OBJECT.value, Invoice.dest_id == object_id
        )
    invs = (await db.scalars(q)).all()
    refs = await load_refs(db)
    return [ser_invoice(inv, refs) for inv in invs]


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    inv = await _get_full(db, invoice_id)
    refs = await load_refs(db)
    return ser_invoice(inv, refs)


@router.post("", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not data.items:
        raise HTTPException(422, "Добавьте позиции в накладную")

    source_type = data.source_type.value if data.source_type else None
    if data.type == InvoiceType.ISSUE:
        # выдача всегда со склада
        source_type = LocationType.WAREHOUSE.value
        source_id = 0
    else:
        source_id = data.source_id

    inv = Invoice(
        number=await next_number(db, "invoice", Invoice),
        type=data.type.value,
        status=InvoiceStatus.SHIPPED.value,
        request_id=data.request_id,
        source_type=source_type,
        source_id=source_id,
        dest_type=data.dest_type.value,
        dest_id=data.dest_id,
        supplier_id=data.supplier_id,
        is_internal_barter=data.is_internal_barter,
        note=data.note.strip(),
        created_by=user.id,
    )
    for it in data.items:
        inv.items.append(
            InvoiceItem(
                material_id=it.material_id,
                qty_planned=qty(it.qty_planned),
                unit_price=money(it.unit_price),
            )
        )
    db.add(inv)
    await db.commit()
    inv = await _get_full(db, inv.id)
    refs = await load_refs(db)
    return ser_invoice(inv, refs)


@router.post("/from-request/{request_id}", response_model=InvoiceOut, status_code=201)
async def create_from_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Формирует накладную из подтверждённой заявки согласно развилке (ЗАС-12, ЗАС-13)."""
    req = await db.scalar(
        select(MaterialRequest)
        .where(MaterialRequest.id == request_id)
        .options(selectinload(MaterialRequest.items))
    )
    if req is None:
        raise HTTPException(404, "Заявка не найдена")
    if req.status != RequestStatus.CONFIRMED.value:
        raise HTTPException(409, "Заявка должна быть подтверждена снабжением")

    is_purchase = req.fulfillment_type == FulfillmentType.PURCHASE.value
    inv = Invoice(
        number=await next_number(db, "invoice", Invoice),
        type=InvoiceType.INBOUND.value if is_purchase else InvoiceType.ISSUE.value,
        status=InvoiceStatus.SHIPPED.value,
        request_id=req.id,
        source_type=None if is_purchase else LocationType.WAREHOUSE.value,
        source_id=None if is_purchase else 0,
        # закупка приходуется на склад, выдача — на объект
        dest_type=LocationType.WAREHOUSE.value if is_purchase else LocationType.OBJECT.value,
        dest_id=0 if is_purchase else req.object_id,
        note=f"По заявке {req.number}",
        created_by=user.id,
    )
    for it in req.items:
        inv.items.append(
            InvoiceItem(
                material_id=it.material_id,
                qty_planned=qty(it.quantity),
                unit_price=0.0,
            )
        )
    db.add(inv)
    await db.commit()
    inv = await _get_full(db, inv.id)
    refs = await load_refs(db)
    return ser_invoice(inv, refs)


@router.post("/{invoice_id}/receive", response_model=InvoiceOut)
async def receive_invoice(
    invoice_id: int,
    data: InvoiceReceiveIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Приёмка со сверкой факта и накладной (ЗАС-21, ЗАС-22, ЗАС-24)."""
    inv = await _get_full(db, invoice_id)
    if inv.status == InvoiceStatus.RECEIVED.value:
        raise HTTPException(409, "Накладная уже принята")
    if inv.status == InvoiceStatus.CANCELLED.value:
        raise HTTPException(409, "Накладная отменена")

    # блокировка движений при активной инвентаризации (ЗАС-51)
    for item in inv.items:
        await assert_material_not_locked(db, item.material_id)

    fact_map = {d.item_id: d.qty_fact for d in data.items}
    price_map = {d.item_id: d.unit_price for d in data.items if d.unit_price is not None}
    lands_on_object = inv.dest_type == LocationType.OBJECT.value
    landed_value = 0.0
    barter_value = 0.0

    for item in inv.items:
        raw = fact_map.get(item.id, item.qty_planned)  # по умолчанию — план
        f = qty(max(0.0, raw))
        item.qty_fact = f
        if f <= 0:
            continue

        if inv.type == InvoiceType.INBOUND.value:
            # цена прихода: введённая при приёмке → цена накладной → цена материала по умолчанию
            price = price_map.get(item.id)
            if price is None:
                price = item.unit_price
            if not price and item.material:
                price = item.material.default_price
            item.unit_price = money(price)

        if inv.type == InvoiceType.ISSUE.value:
            avail = await stock_qty(db, item.material_id, LocationType.WAREHOUSE.value, 0)
            if f > avail + 1e-9:
                raise HTTPException(
                    422,
                    f"Недостаточно на складе: «{item.material.name}» доступно {avail}",
                )
            mv = await apply_movement(
                db,
                material_id=item.material_id,
                quantity=f,
                from_type=LocationType.WAREHOUSE.value,
                from_id=0,
                to_type=LocationType.OBJECT.value,
                to_id=inv.dest_id,
                reason=MovementReason.ISSUE.value,
                ref_type="invoice",
                ref_id=inv.id,
                created_by=user.id,
            )
            # себестоимость выдачи = средняя стоимость склада (для суммы накладной)
            item.unit_price = money(mv.unit_price)
        else:  # INBOUND — приход/поставка
            mv = await apply_movement(
                db,
                material_id=item.material_id,
                quantity=f,
                unit_price=item.unit_price,
                from_type=inv.source_type,
                from_id=inv.source_id,
                to_type=inv.dest_type,
                to_id=inv.dest_id,
                reason=MovementReason.RECEIPT.value,
                ref_type="invoice",
                ref_id=inv.id,
                created_by=user.id,
            )
            barter_value += f * mv.unit_price

        if lands_on_object:
            landed_value += f * mv.unit_price

    inv.status = InvoiceStatus.RECEIVED.value
    inv.received_by = user.id
    inv.received_at = datetime.now(timezone.utc)

    # заявка обеспечена
    if inv.request_id:
        req = await db.get(MaterialRequest, inv.request_id)
        if req:
            req.status = RequestStatus.FULFILLED.value

    # расход по объекту: стоимость материала, попавшего на объект (ЗАС-40, ЗАС-42)
    if lands_on_object and landed_value > 0:
        _limit, threshold = await get_business_limits(db)
        approval = (
            ApprovalStatus.PENDING.value
            if threshold and money(landed_value) >= threshold
            else ApprovalStatus.NOT_REQUIRED.value
        )
        db.add(
            FinanceTransaction(
                object_id=inv.dest_id,
                type=TxnType.EXPENSE.value,
                category=TxnCategory.MATERIAL.value,
                amount=money(landed_value),
                payment_method=PaymentMethod.TRANSFER.value,
                op_date=date.today(),
                description=f"Материалы по накладной {inv.number}",
                ref_type="invoice",
                ref_id=inv.id,
                approval_status=approval,
                created_by=user.id,
            )
        )

    # долг между бизнесами при внутреннем бартере (ХОЛ-30)
    if inv.is_internal_barter and inv.type == InvoiceType.INBOUND.value and barter_value > 0:
        supplier_name = "Свой завод холдинга"
        if inv.supplier_id:
            sup = await db.get(Supplier, inv.supplier_id)
            if sup:
                supplier_name = sup.name
        db.add(
            DebtRecord(
                from_business=supplier_name,
                to_business="Застройщик",
                amount=money(barter_value),
                ref_type="invoice",
                ref_id=inv.id,
                note=f"Бартер по накладной {inv.number}",
            )
        )

    await db.commit()
    inv = await _get_full(db, invoice_id)
    refs = await load_refs(db)
    return ser_invoice(inv, refs)


@router.post("/{invoice_id}/cancel", response_model=InvoiceOut)
async def cancel_invoice(
    invoice_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    inv = await _get_full(db, invoice_id)
    if inv.status == InvoiceStatus.RECEIVED.value:
        raise HTTPException(409, "Нельзя отменить принятую накладную")
    inv.status = InvoiceStatus.CANCELLED.value
    await db.commit()
    inv = await _get_full(db, invoice_id)
    refs = await load_refs(db)
    return ser_invoice(inv, refs)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    inv = await _get_full(db, invoice_id)
    if inv.status == InvoiceStatus.RECEIVED.value:
        raise HTTPException(409, "Нельзя удалить принятую накладную")
    await db.delete(inv)
    await db.commit()
