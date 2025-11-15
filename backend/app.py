import os
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import fitz
from PIL import Image
import uuid

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

MODEL_PATH = "models/last.pt"
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model file not found: {MODEL_PATH}")

model = YOLO(MODEL_PATH)

def pdf_to_jpg(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        filename = f"{uuid.uuid4().hex}.jpg"

        web_path = f"/static/{filename}"          # путь, который будет видеть браузер
        fs_path = os.path.join("static", filename)  # путь в ФС внутри контейнера

        img.save(fs_path)
        images.append((web_path, pix.width, pix.height))
    return images

def run_detection(image_path: str):
    results = model.predict(image_path)
    annotations = []
    for r in results:
        for box in r.boxes:
            annotations.append({
                "label": r.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy.tolist(),  # [[x1, y1, x2, y2]]
            })
    return annotations

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    jpg_files = pdf_to_jpg(pdf_bytes)

    response_json = {}
    for idx, (web_path, width, height) in enumerate(jpg_files, start=1):
        annotations = run_detection(os.path.join(".", web_path.lstrip("/")))
        response_json[f"page_{idx}"] = {
            "page_size": {"width": width, "height": height},
            "annotations": annotations,
            "processed_image": web_path,  # уже вида /static/xxxxx.jpg
        }

    return JSONResponse(response_json)

@app.get("/")
def root():
    return {"status": "ok"}
