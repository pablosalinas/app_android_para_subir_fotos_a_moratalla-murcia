// Aplica una marca de agua (texto + logo opcional) en la esquina inferior derecha
// de una imagen, con fondo semitransparente, y devuelve un nuevo File listo para subir.

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

/**
 * Genera un canvas con el badge de la marca de agua (fondo oscuro redondeado con logo + texto juntos).
 * Se comparte entre fotos y vídeos para garantizar un diseño idéntico, discreto y sin marcas duplicadas.
 *
 * @param {string} text - texto de la web (ej. moratalla-murcia.com)
 * @param {string|null} logoUrl - URL o dataURL del logo
 * @param {number} fontSize - tamaño de fuente deseado
 * @returns {Promise<HTMLCanvasElement>} canvas con el badge dibujado
 */
export const createWatermarkBadgeCanvas = async (text, logoUrl = null, fontSize = 16) => {
    const padding = Math.round(fontSize * 0.5);
    const logoHeight = logoUrl ? Math.round(fontSize * 1.35) : 0;

    let logoImg = null;
    let logoWidth = 0;
    if (logoUrl) {
        try {
            logoImg = await loadImage(logoUrl);
            logoWidth = Math.round(logoHeight * (logoImg.width / logoImg.height));
            if (logoWidth % 2 !== 0) logoWidth += 1;
        } catch (e) {
            console.warn('No se pudo cargar el logo para la marca de agua:', e);
        }
    }

    // Medir texto
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const textWidth = text ? Math.ceil(measureCtx.measureText(text).width) : 0;

    const contentWidth = (logoImg ? logoWidth : 0) + (logoImg && text ? padding : 0) + textWidth;
    const boxWidth = contentWidth + padding * 2;
    const boxHeight = Math.max(fontSize, logoHeight) + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = boxWidth % 2 === 0 ? boxWidth : boxWidth + 1; // siempre par para códecs de vídeo
    canvas.height = boxHeight % 2 === 0 ? boxHeight : boxHeight + 1;
    const ctx = canvas.getContext('2d');

    // Fondo semitransparente redondeado
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    const radius = Math.min(8, Math.round(fontSize * 0.35));
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, radius);
    ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, radius);
    ctx.arcTo(0, canvas.height, 0, 0, radius);
    ctx.arcTo(0, 0, canvas.width, 0, radius);
    ctx.closePath();
    ctx.fill();

    let cursorX = padding;

    if (logoImg) {
        const logoY = Math.round((canvas.height - logoHeight) / 2);
        ctx.drawImage(logoImg, cursorX, logoY, logoWidth, logoHeight);
        cursorX += logoWidth + padding;
    }

    if (text) {
        ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cursorX, canvas.height / 2);
    }

    return canvas;
};

/**
 * @param {File} file - imagen original
 * @param {string} text - texto de la marca de agua (ej. moratalla-murcia.com)
 * @param {string|null} logoUrl - URL o dataURL del logo (opcional)
 * @returns {Promise<File>} nueva imagen con marca de agua, mismo tipo mime que el original
 */
export const applyImageWatermark = async (file, text, logoUrl = null) => {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);

    // Tamaño más discreto y compacto (aprox. 1.35% del ancho de la foto)
    const fontSize = Math.max(12, Math.round(img.width * 0.0135));
    const badgeCanvas = await createWatermarkBadgeCanvas(text, logoUrl, fontSize);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const margin = Math.round(fontSize * 0.8);
    const badgeX = img.width - badgeCanvas.width - margin;
    const badgeY = img.height - badgeCanvas.height - margin;

    ctx.drawImage(badgeCanvas, badgeX, badgeY);

    const mimeType = file.type || 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
    return new File([blob], file.name, { type: mimeType });
};
