import { createSession, upsertUser, verifyGoogleCredential } from "@/lib/server/auth";

export async function POST(request: Request) {
  let credential: unknown;
  try {
    ({ credential } = await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (typeof credential !== "string" || !credential) {
    return Response.json({ error: "Missing credential" }, { status: 400 });
  }
  try {
    const profile = await verifyGoogleCredential(credential);
    await createSession(await upsertUser(profile));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not verify the Google sign-in." }, { status: 401 });
  }
}
