import { createSession, upsertUser } from "@/lib/server/auth";

/**
 * Development-only sign-in so the feed can be tried before a Google client
 * ID is configured. Disabled outside `next dev`.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available" }, { status: 404 });
  }
  let name: unknown;
  try {
    ({ name } = await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const trimmed = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!trimmed) return Response.json({ error: "Missing name" }, { status: 400 });
  await createSession(await upsertUser({ sub: `dev:${trimmed}`, name: trimmed, picture: null }));
  return Response.json({ ok: true });
}
