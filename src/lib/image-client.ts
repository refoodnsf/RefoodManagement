// Browser-only helpers for images (camera capture and uploads).

const MAX_SIDE = 1600;

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
}

function fit(w: number, h: number) {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/** Grab the current camera frame as a JPEG (max 1600 px). */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const { w, h } = fit(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return canvasToJpeg(canvas);
}

/** Shrink an uploaded image to a JPEG of at most 1600 px so it stays well under the 4 MB limit. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { w, h } = fit(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await canvasToJpeg(canvas);
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
