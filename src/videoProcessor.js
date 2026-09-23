import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { createWatermarkBadgeCanvas } from './watermark';

// La app lleva empaquetados los archivos del núcleo de ffmpeg.wasm (public/ffmpeg)
// para poder comprimir y marcar vídeos en el dispositivo sin depender de internet.

let ffmpegInstance = null;
let loadingPromise = null;

const getFFmpeg = async () => {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            const ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]', message);
            });

            const baseURL = `${window.location.origin}/ffmpeg`;
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });

            ffmpegInstance = ffmpeg;
            return ffmpeg;
        } catch (err) {
            console.error('[FFmpeg load error]', err);
            loadingPromise = null;
            ffmpegInstance = null;
            throw err;
        }
    })();

    return loadingPromise;
};

const PADDING = 10;

/**
 * Comprime un vídeo y le aplica una marca de agua unificada (logo + texto juntos)
 * en la esquina inferior derecha.
 *
 * @param {File} file - vídeo original
 * @param {string} watermarkText - texto de la marca de agua (ej. moratalla-murcia.com)
 * @param {string|null} logoUrl - ruta o dataURL del logo (opcional)
 * @param {(ratio:number) => void} onProgress - callback 0..1 con el progreso de codificación
 * @returns {Promise<File>} nuevo vídeo .mp4 comprimido y marcado
 */
export const processVideo = async (file, watermarkText, logoUrl = null, onProgress = () => {}) => {
    const ffmpeg = await getFFmpeg();

    const ts = Date.now();
    const extMatch = file.name.match(/\.\w+$/);
    const inputExt = extMatch ? extMatch[0] : '.mp4';
    const inputName = `input_${ts}${inputExt}`;
    const outputName = `output_${ts}.mp4`;
    const badgeName = `badge_${ts}.png`;

    const progressHandler = ({ progress }) => {
        if (typeof progress === 'number' && isFinite(progress)) {
            onProgress(Math.min(1, Math.max(0, progress)));
        }
    };
    ffmpeg.on('progress', progressHandler);

    try {
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Generamos la marca de agua idéntica a las fotos (un único badge con logo y texto juntos)
        const badgeCanvas = await createWatermarkBadgeCanvas(watermarkText, logoUrl, 16);
        const badgeBlob = await new Promise(resolve => badgeCanvas.toBlob(resolve, 'image/png'));
        await ffmpeg.writeFile(badgeName, await fetchFile(badgeBlob));

        // Escala a máx. 1280px asegurando dimensiones pares (exigidas por H.264)
        // y superpone el badge en la esquina inferior derecha.
        const filterComplex = `[0:v]scale='trunc(min(1280,iw)/2)*2':-2[scaled];[scaled][1:v]overlay=W-w-${PADDING}:H-h-${PADDING}[outv]`;

        const args = [
            '-i', inputName,
            '-i', badgeName,
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-map', '0:a?',
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '30',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ];

        const exitCode = await ffmpeg.exec(args);
        if (exitCode !== 0) {
            throw new Error(`FFmpeg falló al procesar el vídeo (código ${exitCode})`);
        }

        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        // Limpieza de la memoria virtual de ffmpeg
        try {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
            await ffmpeg.deleteFile(badgeName);
        } catch (cleanupErr) {
            console.warn('Error al limpiar archivos temporales de ffmpeg:', cleanupErr);
        }

        const newName = file.name.replace(/\.\w+$/, '') + '.mp4';
        return new File([blob], newName, { type: 'video/mp4' });
    } finally {
        ffmpeg.off('progress', progressHandler);
    }
};
