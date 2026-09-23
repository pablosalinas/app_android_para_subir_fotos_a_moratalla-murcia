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
 * @param {File} file - imagen original
 * @param {string} text - texto de la marca de agua (ej. www.moratalla-murcia.com)
 * @param {string|null} logoUrl - URL o dataURL del logo (opcional, se añade a la izquierda del texto)
 * @returns {Promise<File>} nueva imagen con marca de agua, mismo tipo mime que el original
 */
export const applyImageWatermark = async (file, text, logoUrl = null) => {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Tamaños relativos al ancho de la imagen para que la marca de agua se vea bien
    // tanto en fotos pequeñas como en fotos de cámara de alta resolución.
    const fontSize = Math.max(14, Math.round(img.width * 0.022));
    const padding = Math.round(fontSize * 0.6);
    const logoSize = logoUrl ? fontSize * 1.8 : 0;

    ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const textWidth = ctx.measureText(text).width;

    const boxWidth = padding * 3 + textWidth + logoSize + (logoUrl ? padding : 0);
    const boxHeight = Math.max(fontSize, logoSize) + padding * 2;

    const boxX = img.width - boxWidth - padding;
    const boxY = img.height - boxHeight - padding;

    // Fondo semitransparente redondeado
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    const radius = 10;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + boxHeight, radius);
    ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX, boxY + boxHeight, radius);
    ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY, radius);
    ctx.arcTo(boxX, boxY, boxX + boxWidth, boxY, radius);
    ctx.closePath();
    ctx.fill();

    let cursorX = boxX + padding;

    if (logoUrl) {
        try {
            const logo = await loadImage(logoUrl);
            const logoY = boxY + (boxHeight - logoSize) / 2;
            ctx.drawImage(logo, cursorX, logoY, logoSize, logoSize);
            cursorX += logoSize + padding;
        } catch (e) {
            // Si el logo no carga (ruta aún no configurada), seguimos solo con el texto
            console.warn('No se pudo cargar el logo para la marca de agua:', e);
        }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cursorX, boxY + boxHeight / 2);

    const mimeType = file.type || 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
    return new File([blob], file.name, { type: mimeType });
};
