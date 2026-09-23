import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// La app lleva empaquetados los archivos del núcleo de ffmpeg.wasm (public/ffmpeg)
// y la fuente de la marca de agua (public/fonts) para poder comprimir y marcar
// vídeos sin depender de conexión a internet.

let ffmpegInstance = null;
let loadingPromise = null;

const getFFmpeg = async () => {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        const ffmpeg = new FFmpeg();
        const baseURL = `${window.location.origin}/ffmpeg`;
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegInstance = ffmpeg;
        return ffmpeg;
    })();

    return loadingPromise;
};

const LOGO_SIZE = 40;
const PADDING = 16;

// Devuelve el ancho en px que tendría el logo si se escala a una altura fija (LOGO_SIZE),
// respetando su proporción real en vez de deformarlo a un cuadrado.
const getScaledLogoWidth = (logoUrl) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        const width = Math.round(LOGO_SIZE * (img.width / img.height));
        resolve(width % 2 === 0 ? width : width + 1); // par, lo exige el códec de vídeo
    };
    img.onerror = reject;
    img.src = logoUrl;
});

/**
 * Comprime un vídeo y le aplica una marca de agua (texto + logo opcional)
 * en la esquina inferior derecha.
 *
 * @param {File} file - vídeo original
 * @param {string} watermarkText - texto de la marca de agua
 * @param {string|null} logoUrl - ruta o dataURL del logo (opcional)
 * @param {(ratio:number) => void} onProgress - callback 0..1 con el progreso de codificación
 * @returns {Promise<File>} nuevo vídeo .mp4 comprimido y marcado
 */
export const processVideo = async (file, watermarkText, logoUrl = null, onProgress = () => {}) => {
    const ffmpeg = await getFFmpeg();

    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4');
    const outputName = 'output.mp4';
    const fontName = 'watermark-font.ttf';
    const logoName = 'logo.png';

    const progressHandler = ({ progress }) => {
        if (typeof progress === 'number' && isFinite(progress)) {
            onProgress(Math.min(1, Math.max(0, progress)));
        }
    };
    ffmpeg.on('progress', progressHandler);

    try {
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        await ffmpeg.writeFile(fontName, await fetchFile(`${window.location.origin}/fonts/watermark-font.ttf`));

        const hasLogo = !!logoUrl;
        let logoWidth = 0;
        if (hasLogo) {
            await ffmpeg.writeFile(logoName, await fetchFile(logoUrl));
            logoWidth = await getScaledLogoWidth(logoUrl);
        }

        // Texto: caja semitransparente + texto blanco, esquina inferior derecha.
        // Si hay logo, se deja hueco a su izquierda (según su ancho real); si no, va pegado al borde.
        const textRightOffset = hasLogo ? PADDING * 2 + logoWidth : PADDING;
        const drawtext = [
            `drawtext=fontfile=${fontName}`,
            `text='${watermarkText.replace(/:/g, '\\:').replace(/'/g, "\\'")}'`,
            `fontsize=28`,
            `fontcolor=white@0.92`,
            `box=1`,
            `boxcolor=black@0.45`,
            `boxborderw=10`,
            `x=w-text_w-${textRightOffset}`,
            `y=h-text_h-${PADDING + 6}`,
        ].join(':');

        // Escala a un ancho máximo de 1280px (mantiene proporción) para reducir peso,
        // limita a 30fps y comprime con CRF alto (más compresión, calidad razonable).
        const filterComplex = hasLogo
            ? `[0:v]scale='min(1280,iw)':-2[scaled];[1:v]scale=${logoWidth}:${LOGO_SIZE}[logo];[scaled][logo]overlay=W-w-${PADDING}:H-h-${PADDING}[withlogo];[withlogo]${drawtext}[outv]`
            : `[0:v]scale='min(1280,iw)':-2,${drawtext}[outv]`;

        const args = hasLogo
            ? ['-i', inputName, '-i', logoName, '-filter_complex', filterComplex, '-map', '[outv]', '-map', '0:a?']
            : ['-i', inputName, '-filter_complex', filterComplex, '-map', '[outv]', '-map', '0:a?'];

        args.push(
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '30',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        );

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        // Limpieza de la memoria virtual de ffmpeg
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
        await ffmpeg.deleteFile(fontName);
        if (hasLogo) await ffmpeg.deleteFile(logoName);

        const newName = file.name.replace(/\.\w+$/, '') + '.mp4';
        return new File([blob], newName, { type: 'video/mp4' });
    } finally {
        ffmpeg.off('progress', progressHandler);
    }
};
