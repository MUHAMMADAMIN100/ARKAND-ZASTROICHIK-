from __future__ import annotations

import asyncio
from datetime import date, timedelta

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db import AsyncSessionLocal, Base, engine
from app.enums import (
    EstimateCategory,
    InvoiceStatus,
    InvoiceType,
    LocationType,
    MovementReason,
    ObjectStatus,
    PaymentMethod,
    RequestStatus,
    Role,
    StageStatus,
    TxnCategory,
    TxnType,
)
from app.models import (
    CashRegister,
    City,
    ConstructionObject,
    Estimate,
    EstimateItem,
    FinanceTransaction,
    Invoice,
    InvoiceItem,
    Material,
    MaterialRequest,
    MaterialRequestItem,
    ObjectStage,
    Setting,
    Supplier,
    User,
)
from app.services import apply_movement


async def seed_if_empty() -> None:
    async with AsyncSessionLocal() as db:
        count = await db.scalar(select(func.count()).select_from(User))
        if count and count > 0:
            return
        await _seed(db)


async def _seed(db) -> None:
    # ── Пользователи (по одному на роль) ──
    users = [
        User(full_name="Администратор", username="admin", hashed_password=hash_password("admin123"), role=Role.ADMIN.value),
        User(full_name="Сохиб (владелец)", username="sohib", hashed_password=hash_password("sohib123"), role=Role.OWNER.value),
        User(full_name="Прораб Рустам", username="prorab", hashed_password=hash_password("prorab123"), role=Role.FOREMAN.value),
        User(full_name="Кладовщик Фаррух", username="sklad", hashed_password=hash_password("sklad123"), role=Role.STOREKEEPER.value),
        User(full_name="Менеджер Далер", username="prodaji", hashed_password=hash_password("prodaji123"), role=Role.SALES.value),
        User(full_name="Кассир Нигина", username="kassa", hashed_password=hash_password("kassa123"), role=Role.CASHIER.value),
        User(full_name="Снабжение", username="snab", hashed_password=hash_password("snab123"), role=Role.SUPPLY.value),
    ]
    db.add_all(users)
    await db.flush()
    foreman = users[2]

    # ── Города ──
    cities = [City(name="Душанбе"), City(name="Худжанд"), City(name="Бохтар")]
    db.add_all(cities)
    await db.flush()

    # ── Материалы ──
    mats = [
        Material(name="Цемент М400", unit="мешок", category="Вяжущие", sku="CEM-400", min_stock=100, default_price=45),
        Material(name="Песок строительный", unit="м³", category="Инертные", sku="SAND", min_stock=20, default_price=90),
        Material(name="Щебень фр.5-20", unit="м³", category="Инертные", sku="GRV-520", min_stock=20, default_price=150),
        Material(name="Кирпич红 полнотелый", unit="шт", category="Стеновые", sku="BRK", min_stock=2000, default_price=3.2),
        Material(name="Арматура 12мм", unit="тонна", category="Металл", sku="ARM-12", min_stock=2, default_price=6500),
        Material(name="Бетон М300", unit="м³", category="Бетон", sku="BET-300", min_stock=0, default_price=520),
        Material(name="Утеплитель 50мм", unit="м²", category="Изоляция", sku="ISO-50", min_stock=100, default_price=38),
        Material(name="Гипсокартон", unit="лист", category="Отделка", sku="GKL", min_stock=50, default_price=42),
        Material(name="Профиль CD", unit="шт", category="Отделка", sku="PROF-CD", min_stock=100, default_price=18),
        Material(name="Краска фасадная", unit="кг", category="Отделка", sku="PNT", min_stock=40, default_price=55),
    ]
    # исправляем случайный символ
    mats[3].name = "Кирпич полнотелый"
    db.add_all(mats)
    await db.flush()

    # ── Поставщики ──
    suppliers = [
        Supplier(name="ТД СтройМаркет", phone="+992 900 11 22 33"),
        Supplier(name="Бетонный завод (холдинг)", phone="+992 900 44 55 66", is_internal=True),
    ]
    db.add_all(suppliers)
    await db.flush()

    # ── Объекты ──
    today = date.today()
    objects = [
        ConstructionObject(
            name="ЖК «Феникс», 12 этажей", address="ул. Рудаки, 145", city_id=cities[0].id,
            responsible_id=foreman.id, status=ObjectStatus.IN_PROGRESS.value,
            start_date=today - timedelta(days=120), deadline=today + timedelta(days=240),
            description="Монолитно-каркасный жилой дом, 96 квартир.",
        ),
        ConstructionObject(
            name="ЖК «Сомон», 9 этажей", address="пр. Исмоили Сомони, 30", city_id=cities[1].id,
            responsible_id=foreman.id, status=ObjectStatus.IN_PROGRESS.value,
            start_date=today - timedelta(days=60), deadline=today + timedelta(days=400),
            description="Кирпичный жилой дом, 54 квартиры.",
        ),
        ConstructionObject(
            name="Дом на Фирдавси", address="ул. Фирдавси, 5", city_id=cities[0].id,
            responsible_id=foreman.id, status=ObjectStatus.PLANNING.value,
            start_date=today + timedelta(days=30), deadline=today + timedelta(days=500),
            description="Индивидуальный проект.",
        ),
    ]
    db.add_all(objects)
    await db.flush()

    db.add_all([
        ObjectStage(object_id=objects[0].id, name="Фундамент", status=StageStatus.DONE.value,
                    planned_start=today - timedelta(days=120), planned_end=today - timedelta(days=80)),
        ObjectStage(object_id=objects[0].id, name="Каркас", status=StageStatus.IN_PROGRESS.value,
                    planned_start=today - timedelta(days=80), planned_end=today + timedelta(days=60)),
        ObjectStage(object_id=objects[0].id, name="Кровля", status=StageStatus.PENDING.value,
                    planned_start=today + timedelta(days=60), planned_end=today + timedelta(days=120)),
        ObjectStage(object_id=objects[1].id, name="Фундамент", status=StageStatus.IN_PROGRESS.value),
    ])

    # ── Настройки лимитов (заглушка согласований) ──
    db.add_all([
        Setting(key="expense_limit", value="50000"),
        Setting(key="large_threshold", value="30000"),
    ])

    # ── Начальные остатки склада (приход) ──
    initial = [
        (mats[0].id, 800, 45), (mats[1].id, 150, 90), (mats[2].id, 120, 150),
        (mats[3].id, 15000, 3.2), (mats[4].id, 8, 6500), (mats[6].id, 400, 38),
        (mats[7].id, 200, 42), (mats[8].id, 300, 18), (mats[9].id, 60, 55),
    ]
    for mid, q, price in initial:
        await apply_movement(
            db, material_id=mid, quantity=q, unit_price=price,
            to_type=LocationType.WAREHOUSE.value, to_id=0,
            reason=MovementReason.RECEIPT.value, note="Начальный остаток",
        )

    # ── Касса объекта (минимальная) ──
    db.add(CashRegister(name="Касса ЖК «Феникс»", object_id=objects[0].id, limit_amount=20000))

    # ── Смета по объекту 1 ──
    est = Estimate(object_id=objects[0].id, name="Смета — ЖК «Феникс»")
    est.items = [
        EstimateItem(category=EstimateCategory.MATERIAL.value, name="Цемент М400", unit="мешок", qty_plan=2000, price_plan=45),
        EstimateItem(category=EstimateCategory.MATERIAL.value, name="Арматура 12мм", unit="тонна", qty_plan=40, price_plan=6500),
        EstimateItem(category=EstimateCategory.WORK.value, name="Монолитные работы", unit="м³", qty_plan=1200, price_plan=120),
        EstimateItem(category=EstimateCategory.TECH.value, name="Аренда крана", unit="смена", qty_plan=60, price_plan=1500),
        EstimateItem(category=EstimateCategory.OTHER.value, name="Прочие расходы", unit="—", qty_plan=1, price_plan=25000),
    ]
    db.add(est)

    # ── Финансы объекта 1: доход (продажи) + расходы работ/техники ──
    db.add_all([
        FinanceTransaction(object_id=objects[0].id, type=TxnType.INCOME.value,
                           category=TxnCategory.SALE_INCOME.value, amount=284500,
                           payment_method=PaymentMethod.TRANSFER.value, op_date=today,
                           description="Продажа квартир (внешняя система)"),
        FinanceTransaction(object_id=objects[0].id, type=TxnType.EXPENSE.value,
                           category=TxnCategory.WORK.value, amount=48000,
                           payment_method=PaymentMethod.TRANSFER.value, op_date=today,
                           description="Монолитные работы, этап 1"),
        FinanceTransaction(object_id=objects[0].id, type=TxnType.EXPENSE.value,
                           category=TxnCategory.TECH.value, amount=15000,
                           payment_method=PaymentMethod.CASH.value, op_date=today,
                           description="Аренда крана"),
    ])

    # ── Заявка на материалы (объект 2, ожидает снабжение) ──
    req = MaterialRequest(
        number="ЗАЯ-0001", object_id=objects[1].id, created_by=foreman.id,
        status=RequestStatus.SUBMITTED.value, needed_date=today + timedelta(days=5),
        note="Для устройства фундамента",
    )
    req.items = [
        MaterialRequestItem(material_id=mats[0].id, quantity=200),
        MaterialRequestItem(material_id=mats[2].id, quantity=40),
    ]
    db.add(req)

    # ── Накладная-выдача (объект 1, ожидает приёмку) ──
    inv = Invoice(
        number="НАК-0001", type=InvoiceType.ISSUE.value, status=InvoiceStatus.SHIPPED.value,
        source_type=LocationType.WAREHOUSE.value, source_id=0,
        dest_type=LocationType.OBJECT.value, dest_id=objects[0].id,
        note="Выдача на объект — каркас", created_by=foreman.id,
    )
    inv.items = [
        InvoiceItem(material_id=mats[0].id, qty_planned=150, unit_price=45),
        InvoiceItem(material_id=mats[4].id, qty_planned=2, unit_price=6500),
    ]
    db.add(inv)

    await db.commit()


if __name__ == "__main__":
    async def _main():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await seed_if_empty()
        print("Seed complete.")

    asyncio.run(_main())
