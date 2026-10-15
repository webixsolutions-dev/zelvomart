// Converts an image in the browser before it is uploaded: WebP, longest side 1200 px
// (never upscaled, never cropped), quality about 80, aiming at 150-250 KB. GIFs upload
// as they are (they may be animated). Keeps every request under Vercel's 4.5 MB limit.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1200;
const TARGET_BYTES = 250 * 1024;
const QUALITIES = [0.8, 0.74, 0.68, 0.62];

function baseName(name: string) {
  return (name.split("/").pop() || "image").replace(/\.[^.]+$/, "").trim() || "image";
}

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall back to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("the image is damaged or not a supported format");
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns the file to upload. Throws a readable error when the image cannot be read or is
 * still above 4 MB after conversion.
 */
export async function prepareImageForUpload(input: Blob, name: string): Promise<File> {
  const type = input.type || "";
  const label = name.split("/").pop() || name;
  if (type === "image/gif" || /\.gif$/i.test(name)) {
    if (input.size > MAX_UPLOAD_BYTES) throw new Error(`"${label}" is a ${megabytes(input.size)} GIF. GIFs upload as they are; the limit is 4 MB.`);
    return new File([input], `${baseName(name)}.gif`, { type: "image/gif" });
  }

  let decoded;
  try {
    decoded = await decode(input);
  } catch (error) {
    throw new Error(`"${label}" cannot be read: ${error instanceof Error ? error.message : "damaged image"}.`);
  }
  try {
    const { width, height } = decoded;
    if (!width || !height) throw new Error(`"${label}" has no size; it may be damaged.`);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
    // Already a small WebP: keep the original bytes instead of re-compressing them.
    if (type === "image/webp" && scale === 1 && input.size <= TARGET_BYTES) {
      return new File([input], `${baseName(name)}.webp`, { type: "image/webp" });
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("this browser cannot convert images");
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    let output: Blob | null = null;
    for (const quality of QUALITIES) {
      output = await encode(canvas, "image/webp", quality);
      if (!output || output.type !== "image/webp" || output.size <= TARGET_BYTES) break;
    }
    // Browsers without a WebP encoder return PNG; send a JPEG instead.
    if (!output || output.type !== "image/webp") {
      const jpeg = await encode(canvas, "image/jpeg", 0.82);
      if (!jpeg) throw new Error(`"${label}" could not be converted.`);
      if (jpeg.size > MAX_UPLOAD_BYTES) throw new Error(`"${label}" is still ${megabytes(jpeg.size)} after conversion. The limit is 4 MB.`);
      return new File([jpeg], `${baseName(name)}.jpg`, { type: "image/jpeg" });
    }
    if (output.size > MAX_UPLOAD_BYTES) throw new Error(`"${label}" is still ${megabytes(output.size)} after conversion. The limit is 4 MB.`);
    return new File([output], `${baseName(name)}.webp`, { type: "image/webp" });
  } finally {
    decoded.close();
  }
}
