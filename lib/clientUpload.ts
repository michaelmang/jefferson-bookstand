"use client";

import { upload } from "@vercel/blob/client";

/**
 * Uploads a PDF straight from the browser to Vercel Blob via /api/blob-upload,
 * never passing through our own server action's request body — that's what
 * keeps posting/replacing rests under Vercel's ~4.5MB function payload limit.
 */
export async function uploadPdf(file: File): Promise<string> {
  const blob = await upload(`pdfs/${crypto.randomUUID()}.pdf`, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
  });
  return blob.url;
}
