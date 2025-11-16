import os
import io
import uuid
import zipfile

import fitz
from PIL import Image, ImageDraw

from fastapi import FastAPI, File, UploadFile, Body
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Папки
os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "static"), exist_ok=True)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE_DIR, "static")),
    name="static",
)

MODEL_PATH = os.path.join(BASE_DIR, "models", "grisha.pt")
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model file not found: {MODEL_PATH}")

model = YOLO(MODEL_PATH)


# =======================
# PDF -> JPG
# =======================
def pdf_to_jpg(pdf_bytes):
    """
    Возвращает список (fs_path, web_path, width, height) для каждой страницы.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        filename = f"{uuid.uuid4().hex}.jpg"

        fs_path = os.path.join(BASE_DIR, "static", filename)
        web_path = f"/static/{filename}"

        img.save(fs_path)
        images.append((fs_path, web_path, pix.width, pix.height))
    return images


# =======================
# Детекция
# =======================
def run_detection(image_path: str):
    results = model.predict(image_path)
    annotations = []
    for r in results:
        for box in r.boxes:
            annotations.append(
                {
                    "label": r.names[int(box.cls)],
                    "confidence": float(box.conf),
                    "bbox": box.xyxy.tolist(),  # [[x1,y1,x2,y2]]
                }
            )
    return annotations


# =======================
# Рисуем боксы на картинке
# =======================
def draw_bboxes(fs_path: str, annotations: list, out_path: str):
    img = Image.open(fs_path)
    draw = ImageDraw.Draw(img)

    for ann in annotations:
        raw = ann["bbox"]
        coords = raw[0] if isinstance(raw[0], (list, tuple)) else raw
        x1, y1, x2, y2 = coords

        label = ann["label"]
        # подпись — красный, печать — синий, QR — зелёный
        color = "black"
        if label == "signature":
            color = "red"
        elif label == "seal":
            color = "blue"
        elif label == "QR":
            color = "green"

        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

    img.save(out_path)


# =======================
# Эндпоинт загрузки PDF
# =======================
@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    jpg_files = pdf_to_jpg(pdf_bytes)

    response_json = {}

    for idx, (fs_path, web_path, width, height) in enumerate(jpg_files, start=1):
        annotations = run_detection(fs_path)

        # сохраняем ОТДЕЛЬНУЮ размеченную картинку
        annotated_name = f"annotated_{os.path.basename(fs_path)}"
        annotated_fs_path = os.path.join(BASE_DIR, "static", annotated_name)
        annotated_web_path = f"/static/{annotated_name}"

        draw_bboxes(fs_path, annotations, annotated_fs_path)

        response_json[f"page_{idx}"] = {
            "page_size": {"width": width, "height": height},
            "annotations": annotations,
            "processed_image": annotated_web_path,  # уже с боксами
            "raw_image": web_path,                  # исходная страница
        }

    return JSONResponse(response_json)


# =======================
# Архив с изображениями
# =======================
@app.post("/download_images")
async def download_images(payload: dict = Body(...)):
    """
    Ожидает { "images": ["/static/annotated_xxx.jpg", ...] }
    и возвращает ZIP с этими файлами.
    """
    images = payload.get("images", [])
    mem_file = io.BytesIO()

    with zipfile.ZipFile(mem_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel_path in images:
            rel_path = rel_path.lstrip("/")
            fs_path = os.path.join(BASE_DIR, rel_path)
            if os.path.exists(fs_path):
                zf.write(fs_path, arcname=os.path.basename(fs_path))

    mem_file.seek(0)
    return StreamingResponse(
        mem_file,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="images.zip"'},
    )


@app.get("/")
def root():
    return {"status": "ok"}
