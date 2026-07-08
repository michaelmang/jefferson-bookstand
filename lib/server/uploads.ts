import { unlink } from "node:fs/promises";
import path from "node:path";
import { del } from "@vercel/blob";
import { UPLOADS_DIR } from "./db";

/**
 * Best effort — a missing file shouldn't block a takedown. New uploads are
 * always Blob URLs (see /api/blob-upload); the local-disk branch only
 * matters for stands posted before that existed.
 */
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
