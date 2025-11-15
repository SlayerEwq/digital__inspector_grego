const API_BASE = "http://localhost:1339";

const form = document.getElementById("uploadForm");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const jsonPreview = document.getElementById("jsonPreview");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const countSign = document.getElementById("countSign");
const countStamp = document.getElementById("countStamp");
const countQR = document.getElementById("countQR");

const downloadJSONBtn = document.getElementById("downloadJSON");
const downloadImageBtn = document.getElementById("downloadImage");

// ===============================
// ЗАГРУЗКА PDF
// ===============================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("pdfFile");
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    progressText.textContent = "Загрузка файла...";
    progressBar.style.width = "0%";

    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += 5;
        if (progress > 90) progress = 90;
        progressBar.style.width = progress + "%";
    }, 150);

    // ===============================
    // ОТПРАВКА НА BACKEND
    // ===============================
    let response;
    try {
        response = await fetch(`${API_BASE}/upload_pdf`, {
            method: "POST",
            body: formData,
        });
    } catch (err) {
        clearInterval(loadingInterval);
        progressText.textContent = "Ошибка подключения к серверу";
        console.error(err);
        return;
    }

    let data;
    try {
        data = await response.json();
    } catch (err) {
        clearInterval(loadingInterval);
        progressText.textContent = "Ошибка парсинга ответа сервера";
        console.error(err);
        return;
    }

    clearInterval(loadingInterval);
    progressBar.style.width = "100%";
    progressText.textContent = "Готово!";

    // ===============================
    // ПРЕДПРОСМОТР JSON
    // ===============================
    jsonPreview.textContent = JSON.stringify(data, null, 2);

    // Берём первую страницу
    const pageKey = Object.keys(data)[0];
    if (!pageKey) {
        progressText.textContent = "В ответе нет страниц";
        return;
    }

    const page = data[pageKey];
    const imagePath = page["processed_image"]; // "/static/xxxx.jpg"

    // ===============================
    // ЗАГРУЗКА ИЗОБРАЖЕНИЯ
    // ===============================
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${API_BASE}${imagePath}`;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        let signCount = 0,
            stampCount = 0,
            qrCount = 0;

        // ===============================
        // РИСУЕМ БОКСЫ
        // ===============================
        (page.annotations || []).forEach((ann) => {
            // bbox: [[x1,y1,x2,y2]] или [x1,y1,x2,y2]
            let raw = ann.bbox;
            let coords = Array.isArray(raw[0]) ? raw[0] : raw;
            const [x1, y1, x2, y2] = coords;
            const w = x2 - x1;
            const h = y2 - y1;

            let color = "black";
            if (ann.label === "signature") {
                color = "blue";
                signCount++;
            } else if (ann.label === "seal") {
                color = "red";
                stampCount++;
            } else if (ann.label === "QR") {
                color = "green";
                qrCount++;
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, w, h);
        });

        countSign.textContent = signCount;
        countStamp.textContent = stampCount;
        countQR.textContent = qrCount;
    };

    img.onerror = (e) => {
        console.error("Ошибка загрузки изображения", e);
        progressText.textContent = "Не удалось загрузить изображение страницы";
    };

    // ===============================
    // КНОПКА СКАЧАТЬ JSON
    // ===============================
    downloadJSONBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ===============================
    // СКАЧАТЬ ИЗОБРАЖЕНИЕ
    // ===============================
    downloadImageBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = `${file.name}_preview.jpg`;
        link.href = canvas.toDataURL("image/jpeg");
        link.click();
    };
});
