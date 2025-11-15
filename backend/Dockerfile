FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Опционально: зависимости для opencv и прочего
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Сначала зависимости — для кеша
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Теперь приложение
COPY . .

# Нерутовый пользователь
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 1339

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "1339"]
