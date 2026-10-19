/** Геометрия и экспорт кадрирования фото профиля — чистые функции, без React. */

export interface CropState {
  /** Смещение центра картинки от центра окна, в пикселях окна. */
  x: number;
  y: number;
  /** 1 — картинка ровно закрывает окно короткой стороной. */
  zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const OUTPUT_SIZE = 512;

// Сервер принимает до 512 КБ; запас на заголовки формы.
const MAX_OUTPUT_BYTES = 480 * 1024;

/** Пикселей окна на пиксель исходника. */
export function displayScale(natural: { width: number; height: number }, viewport: number, zoom: number): number {
  return (viewport / Math.min(natural.width, natural.height)) * zoom;
}

/** Не даёт сдвинуть картинку так, чтобы в круге появилась пустота. */
export function clampCrop(state: CropState, natural: { width: number; height: number }, viewport: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom));
  const scale = displayScale(natural, viewport, zoom);
  const maxX = Math.max(0, (natural.width * scale - viewport) / 2);
  const maxY = Math.max(0, (natural.height * scale - viewport) / 2);
  return {
    zoom,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * Вырезает видимый квадрат в 512×512 и кодирует его заново. Перекодирование через
 * canvas заодно выбрасывает EXIF — с геолокацией и моделью телефона. WebP, если
 * браузер умеет его кодировать (Safari — нет, тогда JPEG).
 */
export async function exportCrop(
  image: HTMLImageElement,
  state: CropState,
  viewport: number,
): Promise<Blob> {
  const natural = { width: image.naturalWidth, height: image.naturalHeight };
  const scale = displayScale(natural, viewport, state.zoom);
  const side = viewport / scale;
  const centerX = natural.width / 2 - state.x / scale;
  const centerY = natural.height / 2 - state.y / scale;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas недоступен');

  // Белая подложка: у PNG с прозрачностью в JPEG иначе получился бы чёрный фон.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, centerX - side / 2, centerY - side / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  for (const quality of [0.9, 0.8, 0.65]) {
    const webp = await toBlob(canvas, 'image/webp', quality);
    const blob = webp !== null && webp.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', quality);
    if (blob !== null && blob.size <= MAX_OUTPUT_BYTES) return blob;
  }

  throw new Error('Не удалось сжать фотографию');
}
