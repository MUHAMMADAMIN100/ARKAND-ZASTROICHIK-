from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import (
    EstimateCategory,
    LocationType,
    MovementReason,
    TxnType,
)
from app.models import (
    CashRegister,
    City,
    ConstructionObject,
    Material,
    Supplier,
    User,
)
from app.services import money, qty

WAREHOUSE_NAME = "Центральный склад"

_CATEGORY_LABELS = {
    EstimateCategory.MATERIAL.value: "Материалы",
    EstimateCategory.WORK.value: "Работы",
    EstimateCategory.TECH.value: "Техника",
    EstimateCategory.MONEY.value: "Деньги",
    EstimateCategory.OTHER.value: "Прочее",
}

# соответствие категорий сметы и категорий финансовых транзакций (для факта)
_EST_TO_TXN = {
    "material": "material",
    "work": "work",
    "tech": "tech",
    "money": "other",
    "other": "other",
}


@dataclass
class RefMaps:
    objects: dict[int, ConstructionObject] = field(default_factory=dict)
    materials: dict[int, Material] = field(default_factory=dict)
    users: dict[int, str] = field(default_factory=dict)
    cities: dict[int, str] = field(default_factory=dict)
    cash: dict[int, str] = field(default_factory=dict)
    suppliers: dict[int, str] = field(default_factory=dict)


async def load_refs(db: AsyncSession) -> RefMaps:
    r = RefMaps()
    for o in (await db.scalars(select(ConstructionObject))).all():
        r.objects[o.id] = o
    for m in (await db.scalars(select(Material))).all():
        r.materials[m.id] = m
    for u in (await db.scalars(select(User))).all():
        r.users[u.id] = u.full_name
    for c in (await db.scalars(select(City))).all():
        r.cities[c.id] = c.name
    for c in (await db.scalars(select(CashRegister))).all():
        r.cash[c.id] = c.name
    for s in (await db.scalars(select(Supplier))).all():
        r.suppliers[s.id] = s.name
    return r


def object_name(refs: RefMaps, oid: int | None) -> str | None:
    o = refs.objects.get(oid) if oid else None
    return o.name if o else None


def city_name_of_object(refs: RefMaps, oid: int | None) -> str | None:
    o = refs.objects.get(oid) if oid else None
    if o and o.city_id:
        return refs.cities.get(o.city_id)
    return None


def location_name(refs: RefMaps, ltype: str | None, lid: int | None) -> str | None:
    if ltype is None:
        return None
    if ltype == LocationType.WAREHOUSE.value:
        return WAREHOUSE_NAME
    if ltype == LocationType.OBJECT.value:
        return object_name(refs, lid) or f"Объект #{lid}"
    return None


def material_name(refs: RefMaps, mid: int) -> str | None:
    m = refs.materials.get(mid)
    return m.name if m else None


def material_unit(refs: RefMaps, mid: int) -> str | None:
    m = refs.materials.get(mid)
    return m.unit if m else None


# ─────────────────────────── Объекты ───────────────────────────────
def ser_object(o: ConstructionObject, refs: RefMaps) -> dict:
    return {
        "id": o.id,
        "name": o.name,
        "address": o.address,
        "city_id": o.city_id,
        "city_name": refs.cities.get(o.city_id) if o.city_id else None,
        "responsible_id": o.responsible_id,
        "responsible_name": refs.users.get(o.responsible_id) if o.responsible_id else None,
        "status": o.status,
        "start_date": o.start_date,
        "deadline": o.deadline,
        "description": o.description,
        "created_at": o.created_at,
        "stages": [
            {
                "id": s.id,
                "object_id": s.object_id,
                "name": s.name,
                "planned_start": s.planned_start,
                "planned_end": s.planned_end,
                "status": s.status,
            }
            for s in sorted(o.stages, key=lambda x: x.id)
        ],
    }


def ser_material(m: Material, warehouse_qty: float = 0.0, total_qty: float = 0.0) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "unit": m.unit,
        "category": m.category,
        "sku": m.sku,
        "min_stock": money(m.min_stock),
        "default_price": money(m.default_price),
        "warehouse_qty": qty(warehouse_qty),
        "total_qty": qty(total_qty),
    }


# ─────────────────────────── Заявки ────────────────────────────────
def ser_request(r, refs: RefMaps, wh_qty: dict[int, float] | None = None) -> dict:
    wh_qty = wh_qty or {}
    return {
        "id": r.id,
        "number": r.number,
        "object_id": r.object_id,
        "object_name": object_name(refs, r.object_id),
        "created_by": r.created_by,
        "created_by_name": refs.users.get(r.created_by) if r.created_by else None,
        "status": r.status,
        "needed_date": r.needed_date,
        "note": r.note,
        "fulfillment_type": r.fulfillment_type,
        "confirmed_at": r.confirmed_at,
        "created_at": r.created_at,
        "items": [
            {
                "id": it.id,
                "material_id": it.material_id,
                "material_name": material_name(refs, it.material_id),
                "unit": material_unit(refs, it.material_id),
                "quantity": qty(it.quantity),
                "note": it.note,
                "warehouse_qty": qty(wh_qty.get(it.material_id, 0.0)),
            }
            for it in sorted(r.items, key=lambda x: x.id)
        ],
    }


# ─────────────────────────── Накладные ─────────────────────────────
def _invoice_item(it, refs: RefMaps) -> dict:
    eff_qty = it.qty_fact if it.qty_fact is not None else it.qty_planned
    return {
        "id": it.id,
        "material_id": it.material_id,
        "material_name": material_name(refs, it.material_id),
        "unit": material_unit(refs, it.material_id),
        "qty_planned": qty(it.qty_planned),
        "qty_fact": qty(it.qty_fact) if it.qty_fact is not None else None,
        "unit_price": money(it.unit_price),
        "line_total": money(eff_qty * it.unit_price),
    }


def ser_invoice(inv, refs: RefMaps) -> dict:
    items = [_invoice_item(it, refs) for it in sorted(inv.items, key=lambda x: x.id)]
    total = money(sum(i["line_total"] for i in items))
    return {
        "id": inv.id,
        "number": inv.number,
        "type": inv.type,
        "status": inv.status,
        "request_id": inv.request_id,
        "source_type": inv.source_type,
        "source_id": inv.source_id,
        "source_name": location_name(refs, inv.source_type, inv.source_id),
        "dest_type": inv.dest_type,
        "dest_id": inv.dest_id,
        "dest_name": location_name(refs, inv.dest_type, inv.dest_id),
        "supplier_id": inv.supplier_id,
        "supplier_name": refs.suppliers.get(inv.supplier_id) if inv.supplier_id else None,
        "is_internal_barter": inv.is_internal_barter,
        "note": inv.note,
        "received_at": inv.received_at,
        "created_at": inv.created_at,
        "total_amount": total,
        "items": items,
    }


# ─────────────────────────── Смета ─────────────────────────────────
def _estimate_item(it) -> dict:
    return {
        "id": it.id,
        "estimate_id": it.estimate_id,
        "category": it.category,
        "name": it.name,
        "unit": it.unit,
        "qty_plan": qty(it.qty_plan),
        "price_plan": money(it.price_plan),
        "amount_plan": money(it.qty_plan * it.price_plan),
        "amount_fact_manual": money(it.amount_fact_manual)
        if it.amount_fact_manual is not None
        else None,
    }


# Нормализация категорий сметы → категория факта (txn). «Деньги» и «Прочее»
# сводятся к одной категории факта «other», чтобы факт не считался дважды.
_EST_NORM = {"material": "material", "work": "work", "tech": "tech", "money": "other", "other": "other"}
_NORM_ORDER = ["material", "work", "tech", "other"]
_NORM_LABELS = {"material": "Материалы", "work": "Работы", "tech": "Техника", "other": "Прочее"}


def _estimate_fact_norms(
    items: list[dict], fact_by_txn_cat: dict[str, float]
) -> tuple[dict[str, float], dict[str, float]]:
    """План и факт по нормализованным категориям. Факт = ручной (если задан хотя бы в
    одной строке категории) иначе фактические расходы объекта по этой категории."""
    plan_by_norm: dict[str, float] = {}
    manual_by_norm: dict[str, float] = {}
    has_manual: set[str] = set()
    for it in items:
        norm = _EST_NORM.get(it["category"], "other")
        plan_by_norm[norm] = plan_by_norm.get(norm, 0.0) + it["amount_plan"]
        if it["amount_fact_manual"] is not None:
            manual_by_norm[norm] = manual_by_norm.get(norm, 0.0) + it["amount_fact_manual"]
            has_manual.add(norm)
    fact_by_norm: dict[str, float] = {}
    for norm in _NORM_ORDER:
        fact_by_norm[norm] = (
            manual_by_norm.get(norm, 0.0) if norm in has_manual else fact_by_txn_cat.get(norm, 0.0)
        )
    return plan_by_norm, fact_by_norm


def ser_estimate(e, refs: RefMaps, fact_by_txn_cat: dict[str, float]) -> dict:
    items = [_estimate_item(it) for it in sorted(e.items, key=lambda x: x.id)]
    total_plan = money(sum(i["amount_plan"] for i in items))
    _plan_norm, fact_by_norm = _estimate_fact_norms(items, fact_by_txn_cat)
    total_fact = money(sum(fact_by_norm.values()))
    return {
        "id": e.id,
        "object_id": e.object_id,
        "object_name": object_name(refs, e.object_id),
        "name": e.name,
        "note": e.note,
        "created_at": e.created_at,
        "items": items,
        "total_plan": total_plan,
        "total_fact": total_fact,
    }


def estimate_compare(e, refs: RefMaps, fact_by_txn_cat: dict[str, float]) -> dict:
    items = [_estimate_item(it) for it in e.items]
    plan_by_norm, fact_by_norm = _estimate_fact_norms(items, fact_by_txn_cat)

    rows = []
    total_plan = 0.0
    total_fact = 0.0
    for norm in _NORM_ORDER:
        plan = money(plan_by_norm.get(norm, 0.0))
        fact = money(fact_by_norm.get(norm, 0.0))
        if plan == 0 and fact == 0:
            continue
        diff = money(fact - plan)
        percent = round((fact / plan * 100.0), 1) if plan else 0.0
        rows.append(
            {
                "category": norm,
                "label": _NORM_LABELS[norm],
                "plan": plan,
                "fact": fact,
                "diff": diff,
                "percent": percent,
            }
        )
        total_plan += plan
        total_fact += fact

    total_plan = money(total_plan)
    total_fact = money(total_fact)
    return {
        "estimate_id": e.id,
        "object_id": e.object_id,
        "object_name": object_name(refs, e.object_id),
        "total_plan": total_plan,
        "total_fact": total_fact,
        "diff": money(total_fact - total_plan),
        "percent": round((total_fact / total_plan * 100.0), 1) if total_plan else 0.0,
        "by_category": rows,
    }


# ─────────────────────────── Финансы / касса ───────────────────────
def ser_txn(t, refs: RefMaps) -> dict:
    return {
        "id": t.id,
        "object_id": t.object_id,
        "object_name": object_name(refs, t.object_id),
        "cash_id": t.cash_id,
        "cash_name": refs.cash.get(t.cash_id) if t.cash_id else None,
        "type": t.type,
        "category": t.category,
        "amount": money(t.amount),
        "payment_method": t.payment_method,
        "is_admin": t.is_admin,
        "op_date": t.op_date,
        "description": t.description,
        "ref_type": t.ref_type,
        "ref_id": t.ref_id,
        "approval_status": t.approval_status,
        "created_at": t.created_at,
    }


def ser_cash(c: CashRegister, refs: RefMaps, income: float, expense: float) -> dict:
    balance = money(income - expense)
    turnover = money(income + expense)
    return {
        "id": c.id,
        "name": c.name,
        "object_id": c.object_id,
        "object_name": object_name(refs, c.object_id),
        "limit_amount": money(c.limit_amount),
        "is_active": c.is_active,
        "balance": balance,
        "turnover": turnover,
        "over_limit": bool(c.limit_amount and turnover > c.limit_amount),
    }


# ─────────────────────────── Инвентаризация ────────────────────────
def _inventory_item(it, refs: RefMaps) -> dict:
    m = refs.materials.get(it.material_id)
    diff = 0.0
    cost = 0.0
    if it.qty_fact is not None:
        diff = qty(it.qty_fact - it.qty_system)
        cost = money(diff * it.unit_price)
    return {
        "id": it.id,
        "material_id": it.material_id,
        "material_name": m.name if m else None,
        "unit": m.unit if m else None,
        "category": m.category if m else None,
        "qty_system": qty(it.qty_system),
        "qty_fact": qty(it.qty_fact) if it.qty_fact is not None else None,
        "unit_price": money(it.unit_price),
        "qty_diff": diff,
        "cost_diff": cost,
    }


def ser_inventory(inv, refs: RefMaps) -> dict:
    items = [_inventory_item(it, refs) for it in sorted(inv.items, key=lambda x: x.id)]
    return {
        "id": inv.id,
        "number": inv.number,
        "type": inv.type,
        "status": inv.status,
        "category_filter": inv.category_filter,
        "note": inv.note,
        "created_at": inv.created_at,
        "completed_at": inv.completed_at,
        "items": items,
        "total_qty_diff": qty(sum(i["qty_diff"] for i in items)),
        "total_cost_diff": money(sum(i["cost_diff"] for i in items)),
    }


# ─────────────────────────── Движения ──────────────────────────────
def ser_movement(mv, refs: RefMaps) -> dict:
    m = refs.materials.get(mv.material_id)
    return {
        "id": mv.id,
        "material_id": mv.material_id,
        "material_name": m.name if m else None,
        "unit": m.unit if m else None,
        "from_type": mv.from_type,
        "from_id": mv.from_id,
        "from_name": location_name(refs, mv.from_type, mv.from_id),
        "to_type": mv.to_type,
        "to_id": mv.to_id,
        "to_name": location_name(refs, mv.to_type, mv.to_id),
        "quantity": qty(mv.quantity),
        "unit_price": money(mv.unit_price),
        "reason": mv.reason,
        "ref_type": mv.ref_type,
        "ref_id": mv.ref_id,
        "note": mv.note,
        "created_at": mv.created_at,
    }
