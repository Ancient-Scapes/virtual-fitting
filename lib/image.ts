const MAX_DIMENSION = 1024;
const MAX_BYTES = 1024 * 1024; // 1MB
const MIN_DIMENSION = 320;
const INITIAL_QUALITY = 0.9;
const MIN_QUALITY = 0.4;
const RESIZE_STEP = 0.9;

type ResizeResult = {
  dataUrl: string;
  width: number;
  height: number;
};

function getCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIMENSION;
  canvas.height = MAX_DIMENSION;
  return canvas;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function estimateDataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

export async function resizeImageToDataUrl(file: File): Promise<ResizeResult> {
  const reader = new FileReader();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await loadImage(dataUrl);
  const { naturalWidth, naturalHeight } = image;
  const longerSide = Math.max(naturalWidth, naturalHeight);
  const canvas = getCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvasがサポートされていません");
  }

  let width = longerSide > MAX_DIMENSION
    ? Math.round((naturalWidth / longerSide) * MAX_DIMENSION)
    : naturalWidth;
  let height = longerSide > MAX_DIMENSION
    ? Math.round((naturalHeight / longerSide) * MAX_DIMENSION)
    : naturalHeight;

  let quality = INITIAL_QUALITY;
  const mimeType = "image/jpeg";

  const exportDataUrl = () => {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(mimeType, quality);
  };

  let resizedDataUrl = exportDataUrl();
  let size = estimateDataUrlSize(resizedDataUrl);

  while (
    size > MAX_BYTES &&
    (quality > MIN_QUALITY || Math.max(width, height) > MIN_DIMENSION)
  ) {
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
    } else {
      width = Math.max(MIN_DIMENSION, Math.round(width * RESIZE_STEP));
      height = Math.max(MIN_DIMENSION, Math.round(height * RESIZE_STEP));
    }
    resizedDataUrl = exportDataUrl();
    size = estimateDataUrlSize(resizedDataUrl);
  }

  return { dataUrl: resizedDataUrl, width, height };
}
