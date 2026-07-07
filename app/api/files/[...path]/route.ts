import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/server/auth";
import { UPLOADS_DIR } from "@/lib/server/db";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  if (!(await getSessionUser())) {
    return Response.json({ error: "Sign in to view files." }, { status: 401 });
  }
  const { path: segments } = await ctx.params;
  const abs = path.resolve(UPLOADS_DIR, ...segments);
  if (!abs.startsWith(UPLOADS_DIR + path.sep)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const type = CONTENT_TYPES[path.extname(abs).toLowerCase()];
  if (!type) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
    return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        // Upload names are UUIDs, so the content behind a URL never changes.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
