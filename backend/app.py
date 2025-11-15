import os
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import fitz  # PyMuPDF
from PIL import Image
import torch
import uuid

# =======================
# Создаем FastAPI
# =======================
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Папки для сохранения
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)

# =======================
# Безопасная загрузка YOLOv8 модели (для PyTorch >=2.6)
# =======================
MODEL_PATH = "models/last.pt"

# Добавляем все нужные классы в безопасный глобальный контекст
safe_classes = [
    "ultralytics.nn.tasks.DetectionModel",
    "ultralytics.nn.modules.conv.Conv",
    "torch.nn.modules.conv.Conv2d",
    "torch.nn.modules.batchnorm.BatchNorm2d",
    "torch.nn.modules.activation.SiLU",
    "torch.nn.modules.container.Sequential",
    "ultralytics.nn.modules.block.C2f"
]

with torch.serialization.safe_globals(safe_classes):
    model = YOLO(MODEL_PATH)

# =======================
# Функция PDF -> JPG
# =======================
def pdf_to_jpg(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        filename = f"{uuid.uuid4().hex}.jpg"
        path = os.path.join("static", filename)
        img.save(path)
        images.append((path, pix.width, pix.height))
    return images

# =======================
# Функция детекции
# =======================
def run_detection(image_path):
    results = model.predict(image_path)
    annotations = []
    for r in results:
        for box in r.boxes:
            annotations.append({
                "label": r.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy.tolist()
            })
    return annotations

# =======================
# Эндпоинт загрузки PDF
# =======================
@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    jpg_files = pdf_to_jpg(pdf_bytes)

    response_json = {}
    for idx, (jpg_path, width, height) in enumerate(jpg_files, start=1):
        annotations = run_detection(jpg_path)
        response_json[f"page_{idx}"] = {
            "page_size": {"width": width, "height": height},
            "annotations": annotations,
            "processed_image": jpg_path.replace("\\", "/")
        }

    return JSONResponse(response_json)

# =======================
# Запуск сервера
# =======================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
