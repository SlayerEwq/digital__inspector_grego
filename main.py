import json
from pathlib import Path
from pdf2image import convert_from_path
from ultralytics import YOLO

BASE_FOLDER = Path(__file__).parent
PDFS_FOLDER = BASE_FOLDER / "pdfs"
MODELS_FOLDER = BASE_FOLDER / "models"
RESULTS_FOLDER = BASE_FOLDER / "results"
RESULTS_FOLDER.mkdir(exist_ok=True)

SIGNATURE_MODEL = YOLO(MODELS_FOLDER / "yolov8s.pt")  # подписи
BARCODE_MODEL = YOLO(MODELS_FOLDER / "YOLOV8s_Barcode_Detection.pt")  # печати, QR

POPPLER_PATH = r"C:\poppler-25.11.0\Library\bin"

pdf_filename = "Археология-2.pdf"
pdf_path = PDFS_FOLDER / pdf_filename

def process_pdf(pdf_path):
    print(f"Processing {pdf_path}...")
    pages = convert_from_path(pdf_path, dpi=400, poppler_path=POPPLER_PATH)
    pdf_results = []

    for i, page in enumerate(pages, start=1):
        page_file = RESULTS_FOLDER / f"{pdf_path.stem}_page{i}.png"
        page.save(page_file)
        print(f"Saved page {i} as {page_file.name}")

        # Подписи
        sig_results = SIGNATURE_MODEL(str(page_file))
        signatures = []
        for r in sig_results:
            if r.boxes is not None:
                for box, conf in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist()):
                    if conf > 0.0001:  # фильтр по уверенности
                        signatures.append({"box": box, "conf": conf})

        # Штрихкоды и печати
        barcode_results = BARCODE_MODEL(str(page_file))
        barcodes = []
        for r in barcode_results:
            if r.boxes is not None:
                for box, conf in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist()):
                    if conf > 0.0001:
                        barcodes.append({"box": box, "conf": conf})

        print(f"Page {i}: {len(signatures)} signatures, {len(barcodes)} barcodes")

        pdf_results.append({
            "page": i,
            "signatures": signatures,
            "barcodes": barcodes
        })

    return pdf_results

results = process_pdf(pdf_path)

output_file = RESULTS_FOLDER / f"{pdf_path.stem}_results.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=4)

print(f"Results saved to {output_file}")
