"use server";

import type { Client, InValue } from "@libsql/client";
import { revalidatePath } from "next/cache";
import { clearSession, getSessionUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { deleteUpload, saveUpload } from "@/lib/server/uploads";
import { backgroundById, sanitizeAudioSettings } from "@/lib/standState";
import { SLOT_COUNT } from "@/lib/slots";

const MAX_PDF_BYTES = 18 * 1024 * 1024;
const MAX_TITLE_LENGTH = 80;
const MAX_LETTER_LENGTH = 500;

export async function signOut() {
  await clearSession();
  revalidatePath("/", "layout");
}

async function query<T>(db: Client, sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

type RestUpload = { idx: number; title: string; file: File };

/** Pulls pdf0..pdf4 (+ title0..title4) out of a form and validates them. */
function parseRestUploads(
  formData: FormData,
): { ok: true; uploads: RestUpload[] } | { ok: false; error: string } {
  const uploads: RestUpload[] = [];
  for (let idx = 0; idx < SLOT_COUNT; idx++) {
    const file = formData.get(`pdf${idx}`);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.type !== "application/pdf") return { ok: false, error: "Only PDFs can rest here." };
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, error: `"${file.name}" is too large (18 MB max).` };
    }
    const slotTitle =
      String(formData.get(`title${idx}`) ?? "").trim() || file.name || `Rest ${idx + 1}`;
    uploads.push({ idx, title: slotTitle.slice(0, 120), file });
  }
  if (uploads.length === 0) {
    return { ok: false, error: "Rest at least one paper on the stand before posting." };
  }
  return { ok: true, uploads };
}

/** Loads a stand row and checks the caller curates it. */
async function ownedStand(
  standId: number,
): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const db = await getDb();
  const [stand] = await query<{ user_id: number }>(db, "SELECT user_id FROM stands WHERE id = ?", [
    standId,
  ]);
  if (!stand) return { ok: false, error: "That stand is gone." };
  if (Number(stand.user_id) !== user.id) {
    return { ok: false, error: "Only the curator can change this stand." };
  }
  return { ok: true, userId: user.id };
}

/** Removes one slot row and its stamps (explicit cascade). */
async function deleteSlotRow(db: Client, slotId: number) {
  await db.batch(
    [
      { sql: "DELETE FROM slot_stamps WHERE slot_id = ?", args: [slotId] },
      { sql: "DELETE FROM slots WHERE id = ?", args: [slotId] },
    ],
    "write",
  );
}

/**
 * Posts the current stand to the Commons: title, room background, audio
 * settings, and up to five PDFs (fields pdf0..pdf4 with title0..title4).
 */
export async function postStand(
  formData: FormData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to post a stand." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Give the stand a title." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: "That title is too long." };

  const background = backgroundById(String(formData.get("background") ?? "")).id;
  let audioJson: string | null = null;
  try {
    audioJson = JSON.stringify(sanitizeAudioSettings(JSON.parse(String(formData.get("audio")))));
  } catch {
    audioJson = null;
  }

  const parsed = parseRestUploads(formData);
  if (!parsed.ok) return parsed;

  const saved: { idx: number; title: string; path: string }[] = [];
  for (const upload of parsed.uploads) {
    saved.push({
      idx: upload.idx,
      title: upload.title,
      path: await saveUpload("pdfs", upload.file),
    });
  }

  const db = await getDb();
  const tx = await db.transaction("write");
  let standId: number;
  try {
    const result = await tx.execute({
      sql: "INSERT INTO stands (user_id, title, posted_at, background, audio_json) VALUES (?, ?, ?, ?, ?)",
      args: [user.id, title, Date.now(), background, audioJson],
    });
    standId = Number(result.lastInsertRowid);
    for (const slot of saved) {
      await tx.execute({
        sql: "INSERT INTO slots (stand_id, idx, title, pdf_path) VALUES (?, ?, ?, ?)",
        args: [standId, slot.idx, slot.title, slot.path],
      });
    }
    await tx.commit();
  } finally {
    tx.close();
  }

  revalidatePath("/");
  return { ok: true, id: standId };
}

/**
 * Rests a new paper on one rest of the curator's own posted stand. Replacing
 * a paper retires its stamps — they belonged to the old paper.
 */
export async function updateStandSlot(
  standId: number,
  idx: number,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedStand(standId);
  if (!owned.ok) return owned;
  if (!Number.isInteger(idx) || idx < 0 || idx >= SLOT_COUNT) {
    return { ok: false, error: "No such rest." };
  }
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0 || file.type !== "application/pdf") {
    return { ok: false, error: "Only PDFs can rest here." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: `"${file.name}" is too large (18 MB max).` };
  }
  const title = (String(formData.get("title") ?? "").trim() || file.name).slice(0, 120);
  const rel = await saveUpload("pdfs", file);

  const db = await getDb();
  const [old] = await query<{ id: number; pdf_path: string }>(
    db,
    "SELECT id, pdf_path FROM slots WHERE stand_id = ? AND idx = ?",
    [standId, idx],
  );
  if (old) await deleteSlotRow(db, Number(old.id));
  await db.execute({
    sql: "INSERT INTO slots (stand_id, idx, title, pdf_path) VALUES (?, ?, ?, ?)",
    args: [standId, idx, title, rel],
  });
  if (old) await deleteUpload(old.pdf_path);

  revalidatePath(`/stand/${standId}`);
  revalidatePath("/");
  revalidatePath("/mine");
  return { ok: true };
}

/** Lifts a paper off one rest of the curator's own stand. */
export async function clearStandSlot(
  standId: number,
  idx: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedStand(standId);
  if (!owned.ok) return owned;
  const db = await getDb();
  const [count] = await query<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM slots WHERE stand_id = ?",
    [standId],
  );
  if (Number(count.n) <= 1) {
    return { ok: false, error: "A posted stand needs at least one paper — replace it instead." };
  }
  const [old] = await query<{ id: number; pdf_path: string }>(
    db,
    "SELECT id, pdf_path FROM slots WHERE stand_id = ? AND idx = ?",
    [standId, idx],
  );
  if (!old) return { ok: false, error: "That rest is already empty." };
  await deleteSlotRow(db, Number(old.id));
  await deleteUpload(old.pdf_path);

  revalidatePath(`/stand/${standId}`);
  revalidatePath("/");
  revalidatePath("/mine");
  return { ok: true };
}

/**
 * Swaps a whole saved set of rests onto the curator's own posted stand
 * (pdf0..pdf4 + title0..title4, at least one). The old papers and their
 * stamps retire with them.
 */
export async function replaceStandRests(
  standId: number,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedStand(standId);
  if (!owned.ok) return owned;
  const parsed = parseRestUploads(formData);
  if (!parsed.ok) return parsed;

  const saved: { idx: number; title: string; path: string }[] = [];
  for (const upload of parsed.uploads) {
    saved.push({
      idx: upload.idx,
      title: upload.title,
      path: await saveUpload("pdfs", upload.file),
    });
  }

  const db = await getDb();
  const oldPaths = (
    await query<{ pdf_path: string }>(db, "SELECT pdf_path FROM slots WHERE stand_id = ?", [
      standId,
    ])
  ).map((row) => row.pdf_path);
  const tx = await db.transaction("write");
  try {
    await tx.execute({
      sql: "DELETE FROM slot_stamps WHERE slot_id IN (SELECT id FROM slots WHERE stand_id = ?)",
      args: [standId],
    });
    await tx.execute({ sql: "DELETE FROM slots WHERE stand_id = ?", args: [standId] });
    for (const slot of saved) {
      await tx.execute({
        sql: "INSERT INTO slots (stand_id, idx, title, pdf_path) VALUES (?, ?, ?, ?)",
        args: [standId, slot.idx, slot.title, slot.path],
      });
    }
    await tx.commit();
  } finally {
    tx.close();
  }
  for (const rel of oldPaths) await deleteUpload(rel);

  revalidatePath(`/stand/${standId}`);
  revalidatePath("/");
  revalidatePath("/mine");
  return { ok: true };
}

/** Persists the curator's room and sound choices on their posted stand. */
export async function updateStandRoom(
  standId: number,
  background: string,
  audioJson: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedStand(standId);
  if (!owned.ok) return owned;
  let audio: string | null = null;
  try {
    audio = JSON.stringify(sanitizeAudioSettings(JSON.parse(audioJson)));
  } catch {
    audio = null;
  }
  const db = await getDb();
  await db.execute({
    sql: "UPDATE stands SET background = ?, audio_json = ? WHERE id = ?",
    args: [backgroundById(background).id, audio, standId],
  });
  revalidatePath(`/stand/${standId}`);
  return { ok: true };
}

/** Stamp (or unstamp) a whole bookstand. Returns the new state. */
export async function toggleStandStamp(
  standId: number,
): Promise<{ ok: true; stamped: boolean; count: number } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to stamp." };
  const db = await getDb();
  const [stand] = await query<{ user_id: number }>(db, "SELECT user_id FROM stands WHERE id = ?", [
    standId,
  ]);
  if (!stand) return { ok: false, error: "That stand is gone." };
  if (Number(stand.user_id) === user.id) {
    return { ok: false, error: "Your own stand carries your name, not your stamp." };
  }
  const removed = await db.execute({
    sql: "DELETE FROM stand_stamps WHERE stand_id = ? AND user_id = ?",
    args: [standId, user.id],
  });
  if (removed.rowsAffected === 0) {
    await db.execute({
      sql: "INSERT INTO stand_stamps (stand_id, user_id, created_at) VALUES (?, ?, ?)",
      args: [standId, user.id, Date.now()],
    });
  }
  const [count] = await query<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM stand_stamps WHERE stand_id = ?",
    [standId],
  );
  revalidatePath("/");
  return { ok: true, stamped: removed.rowsAffected === 0, count: Number(count.n) };
}

/** Stamp (or unstamp) a single rest on a stand. */
export async function toggleSlotStamp(
  slotId: number,
): Promise<{ ok: true; stamped: boolean; count: number } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to stamp." };
  const db = await getDb();
  const [slot] = await query<{ user_id: number }>(
    db,
    "SELECT s.user_id FROM slots sl JOIN stands s ON s.id = sl.stand_id WHERE sl.id = ?",
    [slotId],
  );
  if (!slot) return { ok: false, error: "That rest is gone." };
  if (Number(slot.user_id) === user.id) {
    return { ok: false, error: "Your own papers carry your name, not your stamp." };
  }
  const removed = await db.execute({
    sql: "DELETE FROM slot_stamps WHERE slot_id = ? AND user_id = ?",
    args: [slotId, user.id],
  });
  if (removed.rowsAffected === 0) {
    await db.execute({
      sql: "INSERT INTO slot_stamps (slot_id, user_id, created_at) VALUES (?, ?, ?)",
      args: [slotId, user.id, Date.now()],
    });
  }
  const [count] = await query<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM slot_stamps WHERE slot_id = ?",
    [slotId],
  );
  return { ok: true, stamped: removed.rowsAffected === 0, count: Number(count.n) };
}

/** Takes down one of the viewer's own stands: rows, stamps, letters, PDFs. */
export async function takeDownStand(
  standId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const db = await getDb();
  const [stand] = await query<{ user_id: number }>(db, "SELECT user_id FROM stands WHERE id = ?", [
    standId,
  ]);
  if (!stand) return { ok: false, error: "That stand is already gone." };
  if (Number(stand.user_id) !== user.id) {
    return { ok: false, error: "Only the curator can take a stand down." };
  }
  const pdfPaths = (
    await query<{ pdf_path: string }>(db, "SELECT pdf_path FROM slots WHERE stand_id = ?", [
      standId,
    ])
  ).map((row) => row.pdf_path);
  await db.batch(
    [
      {
        sql: "DELETE FROM slot_stamps WHERE slot_id IN (SELECT id FROM slots WHERE stand_id = ?)",
        args: [standId],
      },
      { sql: "DELETE FROM slots WHERE stand_id = ?", args: [standId] },
      { sql: "DELETE FROM stand_stamps WHERE stand_id = ?", args: [standId] },
      { sql: "DELETE FROM letters WHERE stand_id = ?", args: [standId] },
      { sql: "DELETE FROM stands WHERE id = ?", args: [standId] },
    ],
    "write",
  );
  for (const rel of pdfPaths) await deleteUpload(rel);
  revalidatePath("/");
  revalidatePath("/mine");
  return { ok: true };
}

/** A short letter to the stand's curator. */
export async function writeLetter(
  standId: number,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to write a letter." };
  const text = body.trim();
  if (!text) return { ok: false, error: "The letter is blank." };
  if (text.length > MAX_LETTER_LENGTH) {
    return { ok: false, error: `Letters are ${MAX_LETTER_LENGTH} characters at most.` };
  }
  const db = await getDb();
  const [stand] = await query<{ user_id: number }>(db, "SELECT user_id FROM stands WHERE id = ?", [
    standId,
  ]);
  if (!stand) return { ok: false, error: "That stand is gone." };
  if (Number(stand.user_id) === user.id) {
    return { ok: false, error: "Letters go to other curators — this stand is yours." };
  }
  await db.execute({
    sql: "INSERT INTO letters (stand_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
    args: [standId, user.id, text, Date.now()],
  });
  revalidatePath(`/stand/${standId}`);
  revalidatePath("/");
  return { ok: true };
}
