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
const downloadImagesZipBtn = document.getElementById("downloadImagesZip");

// элементы управления страницами
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

// состояние страниц
const pagesState = {
    rawData: null,   // исходный объект
    pages: [],       // массив [key, page]
    currentIndex: 0, // индекс в pages
};

// ===============================
// ХЕЛПЕРЫ
// ===============================

function updatePageControls() {
    const total = pagesState.pages.length;
    const idx = pagesState.currentIndex;

    if (!pageInfo) return;

    if (!total) {
        pageInfo.textContent = "Страницы отсутствуют";
    } else {
        pageInfo.textContent = `Страница ${idx + 1} / ${total}`;
    }

    if (prevPageBtn) {
        prevPageBtn.disabled = idx <= 0;
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = idx >= total - 1;
    }
}

function renderPage(index) {
    if (!pagesState.pages.length) return;
    if (index < 0 || index >= pagesState.pages.length) return;

    const [key, page] = pagesState.pages[index];
    pagesState.currentIndex = index;
    updatePageControls();

    const imagePath = page.processed_image;
    if (!imagePath) {
        console.error("Нет processed_image для страницы:", key, page);
        progressText.textContent = "Нет изображения для отображения";
        return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${API_BASE}${imagePath}`;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        (page.annotations || []).forEach((ann) => {
            const raw = ann.bbox;
            const coords = Array.isArray(raw[0]) ? raw[0] : raw;
            const [x1, y1, x2, y2] = coords;
            const w = x2 - x1;
            const h = y2 - y1;

            let color = "black";
            if (ann.label === "signature") {
                color = "red";
            } else if (ann.label === "seal") {
                color = "blue";
            } else if (ann.label === "QR") {
                color = "green";
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, w, h);
        });
    };

    img.onerror = (e) => {
        console.error("Ошибка загрузки изображения", e);
        progressText.textContent = "Не удалось загрузить изображение страницы";
    };
}

// ===============================
// ОБРАБОТКА ФОРМЫ
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

    console.log("Ответ бэкенда:", data);

    // Ожидаем формат:
    // {
    //   "page_1": { ... },
    //   "page_2": { ... },
    //   ...
    // }

    let pagesMap = data;

    // На всякий случай, если вдруг придёт формат { "file.pdf": { page_1: {...} } }
    if (!("page_1" in data) && Object.keys(data).length === 1) {
        const onlyKey = Object.keys(data)[0];
        const inner = data[onlyKey];
        if (inner && typeof inner === "object") {
            pagesMap = inner;
        }
    }

    pagesState.rawData = pagesMap;
    pagesState.pages = Object.entries(pagesMap).sort((a, b) => {
        const ai = parseInt(a[0].split("_")[1] || "0", 10);
        const bi = parseInt(b[0].split("_")[1] || "0", 10);
        return ai - bi;
    });
    pagesState.currentIndex = 0;

    jsonPreview.textContent = JSON.stringify(pagesMap, null, 2);

    if (!pagesState.pages.length) {
        progressText.textContent = "В ответе нет страниц";
        updatePageControls();
        return;
    }

    // <<< ВАЖНО: сначала считаем статистику по всему документу
    updateGlobalStats();

    // а уже потом показываем первую страницу
    renderPage(0);
});

// ===============================
// КНОПКИ НАВИГАЦИИ ПО СТРАНИЦАМ
// ===============================
if (prevPageBtn) {
    prevPageBtn.onclick = () => {
        if (pagesState.currentIndex > 0) {
            renderPage(pagesState.currentIndex - 1);
        }
    };
}

if (nextPageBtn) {
    nextPageBtn.onclick = () => {
        if (pagesState.currentIndex < pagesState.pages.length - 1) {
            renderPage(pagesState.currentIndex + 1);
        }
    };
}

// ===============================
// СКАЧАТЬ JSON
// ===============================
downloadJSONBtn.onclick = () => {
    if (!pagesState.rawData) return;

    const blob = new Blob([JSON.stringify(pagesState.rawData, null, 2)], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "result.json";
    a.click();
    URL.revokeObjectURL(url);
};

// ===============================
// СКАЧАТЬ АРХИВ ИЗОБРАЖЕНИЙ (РАЗМЕЧЕННЫЕ)
// ===============================
downloadImagesZipBtn.onclick = async () => {
    if (!pagesState.pages.length) return;

    const images = pagesState.pages
        .map(([_, page]) => page.processed_image)
        .filter(Boolean);

    if (!images.length) {
        console.warn("Нет processed_image для скачивания");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/download_images`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ images }),
        });

        if (!res.ok) {
            console.error("Ошибка скачивания архива:", res.status, res.statusText);
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "images.zip";
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Ошибка при скачивании архива:", err);
    }
};

// Инициализация контролов при загрузке
updatePageControls();

function updateGlobalStats() {
    if (!pagesState.pages.length) {
        countSign.textContent = "0";
        countStamp.textContent = "0";
        countQR.textContent = "0";
        return;
    }

    let totalSign = 0;
    let totalStamp = 0;
    let totalQR = 0;

    pagesState.pages.forEach(([_, page]) => {
        (page.annotations || []).forEach((ann) => {
            if (ann.label === "signature") {
                totalSign++;
            } else if (ann.label === "seal") {
                totalStamp++;
            } else if (ann.label === "QR") {
                totalQR++;
            }
        });
    });

    countSign.textContent = totalSign;
    countStamp.textContent = totalStamp;
    countQR.textContent = totalQR;
}