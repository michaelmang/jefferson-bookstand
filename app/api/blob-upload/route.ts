import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser } from "@/lib/server/auth";

/**
 * Issues short-lived client tokens so the browser can upload PDFs directly
 * to Vercel Blob, bypassing the ~4.5MB request body limit on Serverless
 * Functions — posting five 18MB rests at once would blow right through it
 * if the bytes went through our own server action instead.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getSessionUser();
        if (!user) throw new Error("Sign in to upload.");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 18 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // The completion webhook can't reach localhost in dev; the client's
      // upload() call already resolves with the final URL regardless, so
      // nothing downstream depends on this firing.
      onUploadCompleted: async () => {},
    });
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
