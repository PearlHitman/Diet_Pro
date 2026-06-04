const DEFAULT_MAX_EDGE = 1024;
const DEFAULT_QUALITY = 0.8;
const DEFAULT_SIZE_BUDGET = 200_000;

async function readFileAsDataUrlBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const m = result.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        reject(new Error('Failed to encode image file as base64'));
        return;
      }
      resolve({ data: m[2], mediaType: m[1] });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

async function blobToJpegBase64(blob: Blob): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const prefix = 'data:image/jpeg;base64,';
      if (!result.startsWith(prefix)) {
        reject(new Error('Encoded image was not valid JPEG base64'));
        return;
      }
      resolve({ data: result.slice(prefix.length), mediaType: 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Failed to read resized image blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Load pixels for drawing, honoring EXIF orientation when supported.
 * Call `dispose()` when the source is no longer needed (frees ImageBitmap / revokes blob URL).
 */
async function loadImageForDrawing(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}> {
  const disposeStack: (() => void)[] = [];

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      disposeStack.push(() => bitmap.close());
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => {
          disposeStack.forEach(f => f());
        },
      };
    } catch {
      // `imageOrientation` unsupported or decode failed — fall back to <img>.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  disposeStack.push(() => URL.revokeObjectURL(objectUrl));

  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to decode image (HTMLImageElement fallback)'));
    img.src = objectUrl;
  });

  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    dispose: () => {
      disposeStack.forEach(f => f());
    },
  };
}

function pickCanvas(
  width: number,
  height: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D context from OffscreenCanvas');
    return { canvas, ctx };
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not get 2D context from canvas');
  return { canvas, ctx };
}

async function canvasToJpegBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob failed for JPEG export'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Resize an image File to fit within maxEdge px on its longest side,
 * preserving aspect ratio and EXIF-derived orientation, then encode
 * as JPEG at the given quality. Returns base64 + media type ready
 * for the Anthropic vision payload.
 *
 * If the source is already smaller than maxEdge AND under
 * sizeBudgetBytes, it's returned as-is (still base64-encoded).
 */
export async function prepareImageForVision(
  file: File,
  opts?: { maxEdge?: number; quality?: number; sizeBudgetBytes?: number },
): Promise<{ data: string; mediaType: string }> {
  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts?.quality ?? DEFAULT_QUALITY;
  const sizeBudgetBytes = opts?.sizeBudgetBytes ?? DEFAULT_SIZE_BUDGET;

  let disposeDecoded: (() => void) | null = null;

  try {
    const { source, width: sw, height: sh, dispose } = await loadImageForDrawing(file);
    disposeDecoded = dispose;

    const longEdge = Math.max(sw, sh);
    const fitsEdge = longEdge <= maxEdge;
    const fitsBudget = file.size <= sizeBudgetBytes;

    if (fitsEdge && fitsBudget) {
      disposeDecoded();
      disposeDecoded = null;
      return readFileAsDataUrlBase64(file);
    }

    const scale = Math.min(1, maxEdge / longEdge);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    const { canvas, ctx } = pickCanvas(dw, dh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, sw, sh, 0, 0, dw, dh);

    disposeDecoded();
    disposeDecoded = null;

    const blob = await canvasToJpegBlob(canvas, quality);
    return blobToJpegBase64(blob);
  } catch (e) {
    disposeDecoded?.();
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`prepareImageForVision failed: ${msg}`);
  }
}
