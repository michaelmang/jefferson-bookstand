import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { put, del } from "@vercel/blob";
import { UPLOADS_DIR } from "./db";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
};

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function extensionFor(file: File): string | null {
  return EXTENSIONS[file.type] ?? null;
}

/**
 * Stores an upload and returns its reference: a relative path under
 * data/uploads in development, or a full Vercel Blob URL in production
 * (Vercel's filesystem doesn't persist).
 */
export async function saveUpload(subdir: string, file: File): Promise<string> {
  const ext = extensionFor(file);
  if (!ext) throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  const name = `${subdir}/${crypto.randomUUID()}${ext}`;
  if (blobEnabled()) {
    const blob = await put(name, file, { access: "public" });
    return blob.url;
  }
  const abs = path.join(UPLOADS_DIR, name);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Best effort — a missing file shouldn't block a takedown. */
export async function deleteUpload(ref: string): Promise<void> {
  try {
    if (ref.startsWith("http")) await del(ref);
    else await unlink(path.join(UPLOADS_DIR, ref));
  } catch {
    // Already gone, or the store is unreachable; the DB row is authoritative.
  }
}

export function fileUrl(ref: string | null): string | null {
  if (!ref) return null;
  if (ref.startsWith("http")) return ref;
  return `/api/files/${ref.split(path.sep).join("/")}`;
}
