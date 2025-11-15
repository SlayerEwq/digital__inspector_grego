import os
from pathlib import Path
import uuid

import fitz
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# -------------------------------------------------
# БАЗОВЫЕ ПУТИ
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
MODEL_PATH = BASE_DIR / "models" / "grisha.pt"

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# -------------------------------------------------
# FASTAPI + CORS
# -------------------------------------------------
app = FastAPI(
    title="Digital Inspector Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# -------------------------------------------------
# ЗАГРУЗКА МОДЕЛИ YOLO
# -------------------------------------------------
if not MODEL_PATH.exists():
    raise RuntimeError(f"Model file not found: {MODEL_PATH}")

# Классы в том же порядке, что и при обучении
CLASS_NAMES = ["QR", "signature", "seal"]

model = YOLO(str(MODEL_PATH))


# -------------------------------------------------
# PDF -> JPG
# -------------------------------------------------
def pdf_to_images(pdf_bytes: bytes):
    """
    Конвертация PDF в JPG через PyMuPDF.
    Возвращает список страниц с путями и размерами.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []

    for idx, page in enumerate(doc, start=1):
        pix = page.get_pixmap()
        filename = f"{uuid.uuid4().hex}_page_{idx}.jpg"

        fs_path = STATIC_DIR / filename          # путь в ФС (для модели)
        web_path = f"/static/{filename}"         # путь, который увидит браузер

        pix.save(fs_path)
        pages.append(
            {
                "page_index": idx,
                "fs_path": fs_path,
                "web_path": web_path,
                "width": pix.width,
                "height": pix.height,
            }
        )

    return pages


# -------------------------------------------------
# ЗАПУСК МОДЕЛИ НА ОДНОМ ИЗОБРАЖЕНИИ
# -------------------------------------------------
def run_detection(image_path: Path):
    """
    Запускает YOLOv8 на JPG и возвращает список аннотаций
    в формате, близком к тому, что делал коллега.
    """

    results = model(str(image_path))[0]

    annotations = []

    for i, box in enumerate(results.boxes):
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])

        # базовый порог
        if conf < 0.25:
            continue

        x1, y1, x2, y2 = box.xyxy[0].tolist()
        width = x2 - x1
        height = y2 - y1
        area = width * height

        if 0 <= cls_id < len(CLASS_NAMES):
            category_name = CLASS_NAMES[cls_id]
        else:
            category_name = f"class_{cls_id}"

        annotations.append(
            {
                f"annotation_{i}": {
                    "category": category_name,  # "QR" | "signature" | "seal"
                    "bbox": {
                        "x": float(x1),
                        "y": float(y1),
                        "width": float(width),
                        "height": float(height),
                    },
                    "area": float(area),
                    "confidence": conf,
                }
            }
        )

    return annotations


# -------------------------------------------------
# ЭНДПОИНТ ЗАГРУЗКИ PDF
# -------------------------------------------------
@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Нужен PDF-файл")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Пустой файл")

    pages = pdf_to_images(pdf_bytes)

    result = {}
    for page in pages:
        anns = run_detection(page["fs_path"])
        result[f"page_{page['page_index']}"] = {
            "page_size": {
                "width": page["width"],
                "height": page["height"],
            },
            "annotations": anns,
            "processed_image": page["web_path"],  # типа "/static/xxx.jpg"
        }

    return JSONResponse(result)


# -------------------------------------------------
# ПРОСТОЙ HEALTHCHECK
# -------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "model": MODEL_PATH.name}
