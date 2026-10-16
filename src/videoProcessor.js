import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { createWatermarkBadgeCanvas } from './watermark';

// La app lleva empaquetados los archivos del núcleo de ffmpeg.wasm (public/ffmpeg)
// para poder comprimir y marcar vídeos en el dispositivo sin depender de internet.

let ffmpegInstance = null;
let loadingPromise = null;

export const terminateFFmpeg = () => {
    if (ffmpegInstance) {
        try {
            ffmpegInstance.terminate();
        } catch (e) {
            console.warn('[FFmpeg] Error al terminar instancia:', e);
        }
        ffmpegInstance = null;
        loadingPromise = null;
    }
};

export const getFFmpeg = async (onStatus = () => {}) => {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            onStatus('Iniciando motor de compresión...');
            const ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                // Descomentar para depuración si es necesario:
                // console.log('[FFmpeg Log]', message);
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

/**
 * Obtiene la duración y dimensiones reales del vídeo antes de procesarlo
 * usando el elemento HTML5 <video> nativo del navegador/WebView.
 */
export const getVideoMetadata = (file) => {
    return new Promise((resolve) => {
        try {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const url = URL.createObjectURL(file);
            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    URL.revokeObjectURL(url);
                }
            };

            const timer = setTimeout(() => {
                cleanup();
                resolve({ duration: 0, width: 0, height: 0 });
            }, 4000);

            video.onloadedmetadata = () => {
                clearTimeout(timer);
                const duration = video.duration && isFinite(video.duration) ? video.duration : 0;
                const width = video.videoWidth || 0;
                const height = video.videoHeight || 0;
                cleanup();
                resolve({ duration, width, height });
            };

            video.onerror = () => {
                clearTimeout(timer);
                cleanup();
                resolve({ duration: 0, width: 0, height: 0 });
            };

            video.src = url;
        } catch (e) {
            resolve({ duration: 0, width: 0, height: 0 });
        }
    });
};

/**
 * Calcula dimensiones de salida proporcionales limitando la dimensión mayor a maxDim (por defecto 720px)
 * y garantizando que tanto el ancho como el alto sean números pares (obligatorio para libx264/yuv420p).
 */
export const computeTargetDimensions = (width, height, maxDim = 720) => {
    if (!width || !height) {
        return { width: 720, height: null };
    }
    let targetW = width;
    let targetH = height;

    if (targetW > maxDim || targetH > maxDim) {
        if (targetW >= targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
        } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
        }
    }

    // Asegurar pares (mínimo 2px)
    targetW = Math.max(2, Math.trunc(targetW / 2) * 2);
    targetH = Math.max(2, Math.trunc(targetH / 2) * 2);

    return { width: targetW, height: targetH };
};

const PADDING = 10;

/**
 * Comprime un vídeo y le aplica una marca de agua unificada (logo + texto juntos)
 * en la esquina inferior derecha, con reporte de progreso continuo y soporte de cancelación/skip.
 *
 * @param {File} file - vídeo original
 * @param {string} watermarkText - texto de la marca de agua (ej. moratalla-murcia.com)
 * @param {string|null} logoUrl - ruta o dataURL del logo (opcional)
 * @param {(progressInfo:object) => void} onProgress - callback con objeto de progreso detallado
 * @param {AbortSignal|null} signal - señal de cancelación para abortar inmediatamente si el usuario salta
 * @returns {Promise<File>} nuevo vídeo .mp4 comprimido y marcado
 */
export const processVideo = async (file, watermarkText, logoUrl = null, onProgress = () => {}, signal = null) => {
    if (signal?.aborted) {
        throw new Error('COMPRESSION_ABORTED');
    }

    onProgress({
        stage: 'engine',
        percent: 0,
        currentSec: 0,
        totalSec: 0,
        speed: '',
        fps: 0,
        message: 'Cargando motor de vídeo...'
    });

    const ffmpeg = await getFFmpeg((msg) => {
        onProgress({
            stage: 'engine',
            percent: 5,
            currentSec: 0,
            totalSec: 0,
            speed: '',
            fps: 0,
            message: msg
        });
    });

    if (signal?.aborted) {
        throw new Error('COMPRESSION_ABORTED');
    }

    onProgress({
        stage: 'analyzing',
        percent: 10,
        currentSec: 0,
        totalSec: 0,
        speed: '',
        fps: 0,
        message: 'Analizando resolución y duración...'
    });

    const meta = await getVideoMetadata(file);
    const totalDuration = meta.duration;
    const { width: targetW, height: targetH } = computeTargetDimensions(meta.width, meta.height, 720);

    const ts = Date.now();
    const extMatch = file.name.match(/\.\w+$/);
    const inputExt = extMatch ? extMatch[0] : '.mp4';
    const inputName = `input_${ts}${inputExt}`;
    const outputName = `output_${ts}.mp4`;
    const badgeName = `badge_${ts}.png`;

    let lastPercent = 10;
    let lastSpeed = '';
    let lastFps = 0;
    let lastCurrentSec = 0;

    const emitProgress = (percent, currentSec = 0, speed = null, fps = null) => {
        if (typeof percent === 'number' && !isNaN(percent)) {
            lastPercent = Math.max(lastPercent, Math.min(99, Math.round(percent)));
        }
        if (speed) lastSpeed = speed;
        if (fps) lastFps = fps;
        if (currentSec > 0) lastCurrentSec = currentSec;

        onProgress({
            stage: 'compressing',
            percent: lastPercent,
            currentSec: lastCurrentSec,
            totalSec: totalDuration,
            speed: lastSpeed,
            fps: lastFps,
            message: `Compactando vídeo ${lastPercent}%...`
        });
    };

    const progressHandler = ({ progress, time }) => {
        let p = 0;
        let sec = 0;
        if (typeof time === 'number' && time > 0) {
            sec = time / 1000000;
            if (totalDuration > 0) {
                p = (sec / totalDuration) * 100;
            }
        }
        if (p <= 0 && typeof progress === 'number' && isFinite(progress) && progress > 0) {
            p = progress * 100;
        }
        if (p > 0 || sec > 0) {
            emitProgress(p, sec, null, null);
        }
    };

    const logHandler = ({ message }) => {
        if (!message) return;
        const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
        const speedMatch = message.match(/speed=\s*([\d\.]+)x/);
        const fpsMatch = message.match(/fps=\s*([\d\.]+)/);

        let sec = 0;
        let p = 0;
        if (timeMatch) {
            const h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const s = parseFloat(timeMatch[3]);
            sec = h * 3600 + m * 60 + s;
            if (totalDuration > 0) {
                p = (sec / totalDuration) * 100;
            }
        }
        const speed = speedMatch ? `${speedMatch[1]}x` : null;
        const fps = fpsMatch ? parseFloat(fpsMatch[1]) : null;

        if (p > 0 || speed || fps || sec > 0) {
            emitProgress(p, sec, speed, fps);
        }
    };

    ffmpeg.on('progress', progressHandler);
    ffmpeg.on('log', logHandler);

    try {
        if (signal?.aborted) throw new Error('COMPRESSION_ABORTED');

        await ffmpeg.writeFile(inputName, await fetchFile(file));

        if (signal?.aborted) throw new Error('COMPRESSION_ABORTED');

        // Generamos la marca de agua adaptada a la escala
        const badgeCanvas = await createWatermarkBadgeCanvas(watermarkText, logoUrl, 14);
        const badgeBlob = await new Promise(resolve => badgeCanvas.toBlob(resolve, 'image/png'));
        await ffmpeg.writeFile(badgeName, await fetchFile(badgeBlob));

        if (signal?.aborted) throw new Error('COMPRESSION_ABORTED');

        // Escala a máx. 720px y superpone el badge en la esquina inferior derecha
        const filterComplex = targetW && targetH
            ? `[0:v]scale=${targetW}:${targetH}[scaled];[scaled][1:v]overlay=W-w-${PADDING}:H-h-${PADDING}[outv]`
            : `[0:v]scale='trunc(min(720,iw)/2)*2':-2[scaled];[scaled][1:v]overlay=W-w-${PADDING}:H-h-${PADDING}[outv]`;

        const args = [
            '-i', inputName,
            '-i', badgeName,
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-map', '0:a?',
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // Máxima velocidad para procesar en móviles
            '-crf', '28',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ];

        emitProgress(12, 0, null, null);

        const exitCode = await ffmpeg.exec(args, -1, signal ? { signal } : undefined);
        if (exitCode !== 0) {
            if (signal?.aborted) {
                throw new Error('COMPRESSION_ABORTED');
            }
            throw new Error(`FFmpeg falló al procesar el vídeo (código ${exitCode})`);
        }

        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        onProgress({
            stage: 'finished',
            percent: 100,
            currentSec: totalDuration,
            totalSec: totalDuration,
            speed: lastSpeed,
            fps: lastFps,
            message: 'Vídeo compactado con éxito'
        });

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
    } catch (err) {
        if (signal?.aborted || err.message === 'COMPRESSION_ABORTED') {
            terminateFFmpeg();
            throw new Error('COMPRESSION_ABORTED');
        }
        throw err;
    } finally {
        ffmpeg.off('progress', progressHandler);
        ffmpeg.off('log', logHandler);
    }
};
