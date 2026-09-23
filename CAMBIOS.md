# Cómo aplicar estos cambios a tu repositorio

1. Copia las carpetas `src/` y `public/` de este zip sobre las de tu proyecto
   (sustituyen a las actuales).
2. Sustituye tu `package.json` por este (añade las dependencias nuevas:
   `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core` y `capacitor-secure-storage-plugin`).
3. En la carpeta del proyecto:
   ```
   npm install
   npm run build
   npx cap sync android
   ```
4. Abre `android/` en Android Studio y genera el APK como siempre.

## Qué se ha añadido

- **Multi-sitio**: pantalla inicial para elegir entre Moratalla y Banda de
  Música, con configuración y login independientes para cada una
  (`src/api.js`, pantallas nuevas en `src/App.jsx`).
- **Multi-selección**: la subida de galería ahora acepta varias fotos y
  vídeos a la vez, mostrando progreso "archivo X de Y".
- **Marca de agua en fotos**: automática, con el texto de la web activa,
  esquina inferior derecha, fondo semitransparente (`src/watermark.js`).
- **Compresión y marca de agua en vídeo**: usando ffmpeg.wasm, empaquetado
  localmente (`public/ffmpeg/`) para que funcione sin conexión. Reduce
  resolución a máx. 1280px de ancho y comprime con CRF 30 antes de subir
  (`src/videoProcessor.js`).
- **Credenciales cifradas**: usuario y contraseña de cada web ya no se
  guardan en texto plano; van al almacén seguro del sistema (Keystore de
  Android) vía `capacitor-secure-storage-plugin`.

## Pendiente de tu parte

- **Logos**: en `src/api.js`, el array `SITES` tiene un campo `logoUrl: null`
  por cada web. En cuanto me digas la ruta de cada logo, lo añado para que
  aparezca también en la marca de agua (fotos y vídeo).
- Antes de compilar el APK final, prueba a subir un vídeo real desde el
  móvil para comprobar tiempos de compresión — ffmpeg.wasm es fiable pero
  puede tardar según la duración del vídeo y la potencia del teléfono.
