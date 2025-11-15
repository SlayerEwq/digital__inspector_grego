from ultralytics import YOLO

# ====== ЗАГРУЗКА МОДЕЛИ ======
model = YOLO("models/last.pt")  # твоя обученная модель


# ====== ФУНКЦИЯ ЗАПУСКА CV ======
def run_detection(image_path):
    """
    Запускает YOLOv8 last.pt на JPG изображении.
    Возвращает список аннотаций в нужном формате.
    """

    results = model(image_path)[0]  # результат инференса

    annotations = []

    for i, box in enumerate(results.boxes):
        cls = int(box.cls[0])  # ID класса
        conf = float(box.conf[0])  # confidence
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        width = x2 - x1
        height = y2 - y1
        area = width * height

        # имена классов из твоего data.yaml
        categories = ["QR", "signature", "seal"]
        category_name = categories[cls]

        # JSON структура
        annotations.append({
            f"annotation_{i}": {
                "category": category_name,
                "bbox": {
                    "x": float(x1),
                    "y": float(y1),
                    "width": float(width),
                    "height": float(height)
                },
                "area": float(area),
                "confidence": conf
            }
        })

    return annotations
