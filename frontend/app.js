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

    // Анимация прогресса
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
        response = await fetch("http://localhost:5000/process", {
            method: "POST",
            body: formData
        });
    } catch (err) {
        clearInterval(loadingInterval);
        progressText.textContent = "Ошибка подключения к серверу";
        return;
    }

    const data = await response.json();
    clearInterval(loadingInterval);

    progressBar.style.width = "100%";
    progressText.textContent = "Готово!";

    // ===============================
    // РАБОТА С JSON
    // ===============================
    jsonPreview.textContent = JSON.stringify(data, null, 2);

    const fileName = Object.keys(data)[0];
    const pageName = Object.keys(data[fileName])[0];
    const page = data[fileName][pageName];

    const imagePath = page["processed_image"];

    // ===============================
    // ЗАГРУЗКА ИЗОБРАЖЕНИЯ
    // ===============================
    const img = new Image();
    img.src = imagePath;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        let signCount = 0, stampCount = 0, qrCount = 0;

        // ===============================
        // РИСОВАНИЕ АННОТАЦИЙ
        // ===============================
        page.annotations.forEach(ann => {
            const key = Object.keys(ann)[0];
            const obj = ann[key];
            const bbox = obj.bbox;

            let color = "black";

            if (obj.category.includes("39")) {
                color = "blue";
                signCount++;
            } else if (obj.category.includes("60")) {
                color = "red";
                stampCount++;
            } else if (obj.category.includes("42")) {
                color = "green";
                qrCount++;
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
        });

        countSign.textContent = signCount;
        countStamp.textContent = stampCount;
        countQR.textContent = qrCount;
    };

    // ===============================
    // КНОПКА СКАЧАТЬ JSON
    // ===============================
    downloadJSONBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ===============================
    // СКАЧАТЬ ИЗОБРАЖЕНИЕ
    // ===============================
    downloadImageBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = `${fileName}_preview.jpg`;
        link.href = canvas.toDataURL("image/jpeg");
        link.click();
    };
});
