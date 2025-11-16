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
    rawData: null,   // полный ответ сервера (с уровнем "Имя файла" -> "page_N" -> ...)
    pages: [],       // массив [key, page] только для страниц (page_1, page_2, ...)
    currentIndex: 0, // индекс в pages
};

const progressSection = document.querySelector('.progress-section');
const previewSection = document.querySelector('.preview-section');
const jsonCard = document.querySelector('.json-card');

const chooseFileLabel = document.getElementById('chooseFileLabel');
const selectedFileName = document.getElementById('selectedFileName');

// Скрыть секции при инициализации страницы
document.addEventListener('DOMContentLoaded', function() {
    if (progressSection) progressSection.classList.add('hidden');
    if (previewSection) previewSection.classList.add('hidden');
    if (jsonCard) jsonCard.classList.add('hidden');
});

const centerFileSection = document.getElementById('centerFileSection');
const chooseFileHeaderBtn = document.getElementById('chooseFileHeaderBtn');
const fileInput = document.getElementById('pdfFile');

chooseFileHeaderBtn.addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', async function() {
    if (fileInput.files.length > 0) {
        // Скрыть label выбора PDF по центру
        if (chooseFileLabel) chooseFileLabel.style.display = 'none';
        // Скрыть центральную секцию
        if (centerFileSection) centerFileSection.style.display = 'none';
        // Показать предпросмотр/json
        if (previewSection) previewSection.classList.remove('hidden');
        if (jsonCard) jsonCard.classList.remove('hidden');
        // Показать имя файла над предпросмотром
        if (selectedFileName) {
            selectedFileName.textContent = fileInput.files[0].name;
        }
        // Показать чёрную кнопку в header
        if (chooseFileHeaderBtn) chooseFileHeaderBtn.style.display = 'inline-block';

        // --- Логика загрузки PDF и запуска обработки ---
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);

        let response;
        try {
            response = await fetch(`${API_BASE}/upload_pdf`, {
                method: "POST",
                body: formData,
            });
        } catch (err) {
            alert("Ошибка подключения к серверу");
            console.error(err);
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            alert("Ошибка парсинга ответа сервера");
            console.error(err);
            return;
        }

        // Сохраняем ПОЛНЫЙ ответ как есть (с уровнем "Имя файла")
        pagesState.rawData = data;

        // Извлекаем карту страниц для внутреннего использования:
        let pagesMap = null;
        const topKeys = Object.keys(data);
        if (topKeys.length === 1 && !topKeys[0].startsWith("page_")) {
            const onlyKey = topKeys[0];
            const inner = data[onlyKey];
            if (inner && typeof inner === "object") {
                pagesMap = inner;
            }
        } else {
            pagesMap = data;
        }
        if (!pagesMap) {
            alert("Некорректный формат ответа сервера");
            console.error("Не удалось извлечь страницы из ответа:", data);
            return;
        }
        pagesState.pages = Object.entries(pagesMap).sort((a, b) => {
            const ai = parseInt(a[0].split("_")[1] || "0", 10);
            const bi = parseInt(b[0].split("_")[1] || "0", 10);
            return ai - bi;
        });
        pagesState.currentIndex = 0;
        jsonPreview.textContent = JSON.stringify(pagesState.rawData, null, 2);
        if (!pagesState.pages.length) {
            alert("В ответе нет страниц");
            updatePageControls();
            return;
        }
        updateGlobalStats();
        renderPage(0);
    }
});

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    // Скрыть центральную секцию
    if (centerFileSection) centerFileSection.style.display = 'none';
    // Показать предпросмотр/json
    if (previewSection) previewSection.classList.remove('hidden');
    if (jsonCard) jsonCard.classList.remove('hidden');
    // Показать имя файла над предпросмотром
    if (selectedFileName) {
        selectedFileName.textContent = fileInput.files[0].name;
    }
    // Показать чёрную кнопку в header
    if (chooseFileHeaderBtn) chooseFileHeaderBtn.style.display = 'inline-block';
    // ...логика загрузки PDF и запуска обработки...
});

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

        // ВАЖНО: боксы уже нарисованы на processed_image на бэке,
        // поэтому на фронте ничего поверх не рисуем.
    };

    img.onerror = (e) => {
        console.error("Ошибка загрузки изображения", e);
        progressText.textContent = "Не удалось загрузить изображение страницы";
    };
}

// Счётчик по всему документу на основе новой структуры аннотаций
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
        (page.annotations || []).forEach((annObj) => {
            // annObj имеет вид { "annotation_0": { category, bbox, area } }
            const keys = Object.keys(annObj);
            if (!keys.length) return;

            const inner = annObj[keys[0]];
            if (!inner || !inner.category) return;

            const category = String(inner.category).toLowerCase();

            if (category === "signature") {
                totalSign++;
            } else if (category === "stamp") {
                totalStamp++;
            } else if (category === "qr") {
                totalQR++;
            }
        });
    });

    countSign.textContent = totalSign;
    countStamp.textContent = totalStamp;
    countQR.textContent = totalQR;
}

// ===============================
// ОБРАБОТКА ФОРМЫ
// ===============================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("pdfFile");
    if (!fileInput.files.length) return;

    // Показать скрытые секции
    if (progressSection) progressSection.classList.remove('hidden');
    if (previewSection) previewSection.classList.remove('hidden');
    if (jsonCard) jsonCard.classList.remove('hidden');

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

    // Сохраняем ПОЛНЫЙ ответ как есть (с уровнем "Имя файла")
    pagesState.rawData = data;

    // Извлекаем карту страниц для внутреннего использования:
    // ожидаем формат:
    // {
    //   "fileName.pdf": {
    //       "page_1": { ... },
    //       "page_2": { ... }
    //   }
    // }
    let pagesMap = null;
    const topKeys = Object.keys(data);

    if (topKeys.length === 1 && !topKeys[0].startsWith("page_")) {
        const onlyKey = topKeys[0];
        const inner = data[onlyKey];
        if (inner && typeof inner === "object") {
            pagesMap = inner;
        }
    } else {
        // fallback, если вдруг когда-нибудь вернётся старый формат
        pagesMap = data;
    }

    if (!pagesMap) {
        progressText.textContent = "Некорректный формат ответа сервера";
        console.error("Не удалось извлечь страницы из ответа:", data);
        return;
    }

    pagesState.pages = Object.entries(pagesMap).sort((a, b) => {
        const ai = parseInt(a[0].split("_")[1] || "0", 10);
        const bi = parseInt(b[0].split("_")[1] || "0", 10);
        return ai - bi;
    });
    pagesState.currentIndex = 0;

    // В предпросмотр вывожим полный JSON, такой же, как пойдёт на скачивание
    jsonPreview.textContent = JSON.stringify(pagesState.rawData, null, 2);

    if (!pagesState.pages.length) {
        progressText.textContent = "В ответе нет страниц";
        updatePageControls();
        return;
    }

    // Сначала считаем статистику по всему документу
    updateGlobalStats();

    // Потом показываем первую страницу
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
// СКАЧАТЬ JSON (ровно тот, что вернул бэк)
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
