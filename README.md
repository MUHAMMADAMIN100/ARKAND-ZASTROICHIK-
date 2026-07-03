# Arkand · Система застройщика

Модуль **«Застройщик»** единой CRM-экосистемы холдинга (Часть 1 ТЗ). Ведёт строительство
многоэтажных домов: объекты, заявки на материалы, склад и движение по накладным, смету
план/факт, финансы по объекту, инвентаризацию и отчёты — в разрезе объекта и города.

## Стек

| Слой | Технология | Хостинг |
|------|-----------|---------|
| Фронтенд | React + TypeScript + Vite, архитектура **Feature-Sliced Design**, TanStack Query (оптимистические обновления) | Vercel |
| Бэкенд | Python **FastAPI** (async SQLAlchemy 2.0), JWT-авторизация | Railway |
| БД | **PostgreSQL** (локально — SQLite без настройки) | Railway |

- Интерфейс — русский. Все мутации — оптимистические (мгновенный отклик, откат при ошибке).
- Дизайн выведен из логотипа Arkand; деньги отделены от бренда (расход/минус — сигнальный красный,
  доход — зелёный, вишнёвый — только бренд).
- Адаптив: мобильная раскладка едина для диапазона 320–425px.

## Структура

```
backend/          FastAPI-приложение
  app/
    api/          роутеры (auth, objects, catalog, warehouse, requests, invoices,
                  estimates, finance, inventory, reports, admin)
    models.py     модели SQLAlchemy
    schemas.py    Pydantic-схемы
    services.py   бизнес-логика (движение материалов, себестоимость, факт сметы)
    serializers.py денормализация ORM → DTO
    seed.py       демо-данные
frontend/         React + TS (FSD)
  src/
    app/          провайдеры, роутинг, стили-токены
    pages/        экраны
    widgets/      app-shell (сайдбар, топбар, drawer)
    features/     формы и действия (заявки, накладные, смета, финансы, инвентаризация)
    entities/     доменные модели + хуки данных (оптимистика)
    shared/       UI-кит, API-клиент, утилиты, дизайн-токены
```

## Локальный запуск

### Бэкенд

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
# Linux/macOS:
# source .venv/bin/activate && pip install -r requirements.txt
# uvicorn app.main:app --reload --port 8000
```

- При первом старте создаются таблицы и загружаются демо-данные (SQLite `arkand.db`).
- Swagger-документация: http://127.0.0.1:8000/docs

### Фронтенд

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (проксирует /api на бэкенд :8000)
```

### Демо-доступы

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin` | `admin123` |
| Владелец (Сохиб) | `sohib` | `sohib123` |
| Прораб | `prorab` | `prorab123` |
| Кладовщик | `sklad` | `sklad123` |
| Менеджер по продажам | `prodaji` | `prodaji123` |
| Кассир | `kassa` | `kassa123` |
| Снабжение | `snab` | `snab123` |

## Деплой

### Бэкенд → Railway

1. Создать проект Railway, добавить плагин **PostgreSQL** (переменная `DATABASE_URL` подставится сама).
2. Задеплоить папку `backend/` (Nixpacks определит Python). Старт-команда уже в `railway.json` / `Procfile`:
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Переменные окружения: `SECRET_KEY` (длинная случайная строка), `CORS_ORIGINS` (домен фронта на Vercel),
   `SEED_ON_STARTUP=true` (для первичного наполнения).

### Фронтенд → Vercel

1. Импортировать репозиторий, Root Directory = `frontend/`.
2. Переменная окружения `VITE_API_URL = https://<ваш-бэкенд>.up.railway.app/api`.
3. Build: `npm run build`, Output: `dist` (уже в `vercel.json`).

## Покрытие ТЗ (ЗАС)

Объекты (01–03) · Заявки и обеспечение (10–14) · Накладные и движение (20–24) ·
Смета план/факт (30–32) · Финансы по объекту (40–42) · Инвентаризация (50–52) ·
Роли (прораб, менеджер, кладовщик, кассир) · Отчёты (60–62).

Общие сервисы холдинга реализованы в согласованном объёме: снабжение — роль-заглушка,
касса — минимальная, согласование крупных закупок — заглушка на будущее, доход из внешней
системы продаж — ручной ввод.
