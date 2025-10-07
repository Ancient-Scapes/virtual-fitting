const MAX_DIMENSION = 1024;

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

  if (longerSide <= MAX_DIMENSION) {
    return { dataUrl, width: naturalWidth, height: naturalHeight };
  }

  const scale = MAX_DIMENSION / longerSide;
  const targetWidth = Math.round(naturalWidth * scale);
  const targetHeight = Math.round(naturalHeight * scale);

  const canvas = getCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvasがサポートされていません");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const mimeType = file.type || "image/png";
  const resizedDataUrl = canvas.toDataURL(mimeType, 0.95);

  return { dataUrl: resizedDataUrl, width: targetWidth, height: targetHeight };
}
