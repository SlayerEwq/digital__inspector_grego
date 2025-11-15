# backend/utils.py
from PIL import Image, ImageDraw

COLORS = {
    "signature": "blue",
    "stamp": "red",
    "qr": "green"
}

def draw_bboxes(image_path: str, annotations: list, output_path: str):
    """
    Рисуем bounding boxes на изображении
    """
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)

    for ann in annotations:
        for key, val in ann.items():
            category = val['category']
            bbox = val['bbox']
            color = "black"
            if category == "label_39":
                color = COLORS["signature"]
            elif category == "label_60":
                color = COLORS["stamp"]
            elif category == "label_42":
                color = COLORS["qr"]

            x = bbox['x']
            y = bbox['y']
            w = bbox['width']
            h = bbox['height']
            draw.rectangle([x, y, x + w, y + h], outline=color, width=3)

    img.save(output_path)
