import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/supabase/admin";

export const BUCKET = "media";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type MediaFolder = "kiosk" | "admin" | "tasks" | "events";

/** Browser URL for a stored image. Served by /media/[...path] after an auth check. */
export function mediaUrl(path: string | null | undefined) {
  return path ? `/media/${path}` : null;
}

/** Validate and store one image; returns its storage path. */
export async function uploadImage(file: Blob, folder: MediaFolder): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem é demasiado grande (máximo 4 MB).");
  const path = `${folder}/${randomUUID()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("upload failed", error);
    throw new Error("Não foi possível guardar a imagem.");
  }
  return path;
}

export async function deleteImages(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  const { error } = await db().storage.from(BUCKET).remove(list);
  if (error) console.error("delete images failed", error);
}

/** Read an image file from a server-action FormData entry (or null when empty). */
export function imageFrom(form: FormData, field: string): File | null {
  const v = form.get(field);
  return v instanceof File && v.size > 0 ? v : null;
}
