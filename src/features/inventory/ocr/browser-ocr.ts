import {
  extractExpirationDatesFromOcrText,
  type OcrExpirationExtraction
} from "@/features/inventory/ocr/expiration-date-extraction";
import type { IsoDate } from "@/types/inventory";

declare global {
  interface Window {
    __CONTROLE_VALIDADES_OCR_TEXT__?: string;
  }
}

type OcrProgressHandler = (progress: number, status: string) => void;

export async function recognizeExpirationDatesFromImage(
  file: File,
  options: Readonly<{
    referenceDate: IsoDate;
    onProgress?: OcrProgressHandler;
  }>
): Promise<OcrExpirationExtraction> {
  if (typeof window !== "undefined" && window.__CONTROLE_VALIDADES_OCR_TEXT__) {
    options.onProgress?.(1, "fixture");

    return extractExpirationDatesFromOcrText(window.__CONTROLE_VALIDADES_OCR_TEXT__, {
      referenceDate: options.referenceDate
    });
  }

  const image = await preprocessImageForOcr(file);
  const { recognize } = await import("tesseract.js");
  const result = await recognize(image, "por+eng", {
    logger(message) {
      options.onProgress?.(message.progress, message.status);
    }
  });

  return extractExpirationDatesFromOcrText(result.data.text, {
    referenceDate: options.referenceDate
  });
}

async function preprocessImageForOcr(file: File): Promise<File | Blob> {
  if (typeof document === "undefined") {
    return file;
  }

  try {
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      const contrasted = gray > 145 ? 255 : 0;
      data[index] = contrasted;
      data[index + 1] = contrasted;
      data[index + 2] = contrasted;
    }

    context.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 0.92)
    );

    return blob ?? file;
  } catch {
    return file;
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    image.src = url;
  });
}
