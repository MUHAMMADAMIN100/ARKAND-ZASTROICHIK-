FROM python:3.12-slim

# Устанавливаем системные зависимости для сборки C-пакетов и работы с Postgres
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы проекта
COPY . .

# Открываем порт для FastAPI
EXPOSE 8000

# Команда запуска (Railway автоматически заменит её на твой Procfile, 
# но пускай будет как запасной вариант)
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT