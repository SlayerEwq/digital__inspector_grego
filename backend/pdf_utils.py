# backend/pdf_utils.py
import fitz  # PyMuPDF
import os

def convert_pdf_to_images(pdf_path: str, output_folder: str):
    """
    Конвертация PDF в JPG без внешних зависимостей (через PyMuPDF)
    Каждая страница PDF сохраняется как отдельная картинка.
    """
    doc = fitz.open(pdf_path)
    image_paths = []

    for i, page in enumerate(doc):
        pix = page.get_pixmap()  # создаём растровое изображение
        img_path = os.path.join(output_folder, f"page_{i+1}.jpg")
        pix.save(img_path)
        image_paths.append(img_path)

    return image_paths
