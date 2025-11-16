# 🛠 Digital Inspector

Автоматическая проверка строительных документов: загрузка PDF, обнаружение подписей, печатей, QR-кодов и экспорт результатов.

---

## 🚀 Быстрый старт (Docker Compose)

1. Убедитесь, что установлен Docker и Docker Compose.
2. В корне проекта выполните:

```bash
docker compose up --build
```

- Backend будет доступен на [http://localhost:1339](http://localhost:1339)
- Frontend — на [http://localhost:8080](http://localhost:8080)

---

## 📦 Структура проекта

```
backend/    # Python FastAPI, ML-модель, обработка PDF
frontend/   # Современный одностраничный интерфейс (HTML/JS/CSS)
docker-compose.yml  # Автоматический запуск обоих сервисов
```

---

## 🐍 Ручной запуск (без Docker)

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
python -m http.server 8080
```

---

## ⚙️ Описание функций

- Загрузка PDF и автоматический запуск анализа
- Предпросмотр страниц, навигация
- Статистика по найденным объектам
- Экспорт JSON и изображений

---

## 📝 Авторы

Команда Grego, Хакатон 2025