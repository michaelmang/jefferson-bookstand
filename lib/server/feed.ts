import type { Client, InValue } from "@libsql/client";
import { sanitizeAudioSettings, type AudioSettings } from "@/lib/standState";
import { getDb } from "./db";
import { fileUrl } from "./uploads";

export type StandCard = {
  id: number;
  title: string;
  postedAt: number;
  author: { name: string; picture: string | null };
  /** True when the viewer is the curator of this stand. */
  mine: boolean;
  stampCount: number;
  letterCount: number;
  slotTitles: string[];
};

export type StandDetail = {
  id: number;
  title: string;
  postedAt: number;
  author: { name: string; picture: string | null };
  /** True when the viewer is the curator of this stand. */
  mine: boolean;
  background: string;
  audio: AudioSettings | null;
  stampCount: number;
  stamped: boolean;
  slots: ({
    id: number;
    idx: number;
    title: string;
    url: string;
    stampCount: number;
    stamped: boolean;
  } | null)[];
  letters: {
    id: number;
    body: string;
    createdAt: number;
    author: { name: string; picture: string | null };
  }[];
};

/** Most recent Sunday, 00:00 local time — the weekly ledger resets here. */
export function weekStart(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function todayStart(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function rows<T>(db: Client, sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

type CardRow = {
  id: number;
  title: string;
  posted_at: number;
  user_id: number;
  name: string;
  picture: string | null;
  stamp_count: number;
  letter_count: number;
};

async function toCard(db: Client, row: CardRow, userId: number | null): Promise<StandCard> {
  const titles = await rows<{ title: string }>(
    db,
    "SELECT title FROM slots WHERE stand_id = ? ORDER BY idx",
    [row.id],
  );
  return {
    id: Number(row.id),
    title: row.title,
    postedAt: Number(row.posted_at),
    author: { name: row.name, picture: row.picture },
    mine: Number(row.user_id) === userId,
    stampCount: Number(row.stamp_count),
    letterCount: Number(row.letter_count),
    slotTitles: titles.map((s) => s.title),
  };
}

const CARD_SELECT = `SELECT s.id, s.title, s.posted_at, s.user_id, u.name, u.picture,
         (SELECT COUNT(*) FROM stand_stamps ss WHERE ss.stand_id = s.id) AS stamp_count,
         (SELECT COUNT(*) FROM letters l WHERE l.stand_id = s.id) AS letter_count
  FROM stands s JOIN users u ON u.id = s.user_id`;

export async function todaysStands(userId: number | null): Promise<StandCard[]> {
  const db = await getDb();
  const cards = await rows<CardRow>(
    db,
    `${CARD_SELECT} WHERE s.posted_at >= ? ORDER BY s.posted_at DESC LIMIT 50`,
    [todayStart()],
  );
  return Promise.all(cards.map((row) => toCard(db, row, userId)));
}

export async function weeklyMostTreasured(userId: number | null): Promise<StandCard[]> {
  // SQLite can't reference a SELECT alias in WHERE, so the weekly-stamp
  // subquery appears twice.
  const db = await getDb();
  const cards = await rows<CardRow>(
    db,
    `SELECT s.id, s.title, s.posted_at, s.user_id, u.name, u.picture,
            (SELECT COUNT(*) FROM stand_stamps ss WHERE ss.stand_id = s.id) AS stamp_count,
            (SELECT COUNT(*) FROM letters l WHERE l.stand_id = s.id) AS letter_count,
            (SELECT COUNT(*) FROM stand_stamps sw
              WHERE sw.stand_id = s.id AND sw.created_at >= ?) AS week_stamps
     FROM stands s JOIN users u ON u.id = s.user_id
     WHERE s.posted_at >= ?
        OR (SELECT COUNT(*) FROM stand_stamps sw
             WHERE sw.stand_id = s.id AND sw.created_at >= ?) > 0
     ORDER BY week_stamps DESC, s.posted_at DESC
     LIMIT 10`,
    [weekStart(), weekStart(), weekStart()],
  );
  return Promise.all(cards.map((row) => toCard(db, row, userId)));
}

export type MyStandsPage = {
  stands: StandCard[];
  total: number;
  /** Zero-based, already clamped to the last page. */
  page: number;
  pageCount: number;
};

/** The viewer's own posting history, searchable by title, newest first. */
export async function myStands(
  userId: number,
  query: string,
  page: number,
  pageSize = 12,
): Promise<MyStandsPage> {
  const db = await getDb();
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [count] = await rows<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM stands WHERE user_id = ? AND title LIKE ? ESCAPE '\\'",
    [userId, like],
  );
  const total = Number(count.n);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(0, page), pageCount - 1);
  const cards = await rows<CardRow>(
    db,
    `${CARD_SELECT} WHERE s.user_id = ? AND s.title LIKE ? ESCAPE '\\'
     ORDER BY s.posted_at DESC LIMIT ? OFFSET ?`,
    [userId, like, pageSize, clamped * pageSize],
  );
  return {
    stands: await Promise.all(cards.map((row) => toCard(db, row, userId))),
    total,
    page: clamped,
    pageCount,
  };
}

export async function getStandDetail(
  id: number,
  userId: number | null,
): Promise<StandDetail | null> {
  const db = await getDb();
  const [stand] = await rows<
    CardRow & { background: string; audio_json: string | null; stamp_count: number }
  >(
    db,
    `SELECT s.id, s.title, s.posted_at, s.user_id, s.background, s.audio_json,
            u.name, u.picture,
            (SELECT COUNT(*) FROM stand_stamps ss WHERE ss.stand_id = s.id) AS stamp_count
     FROM stands s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [id],
  );
  if (!stand) return null;

  let audio: AudioSettings | null = null;
  if (stand.audio_json) {
    try {
      audio = sanitizeAudioSettings(JSON.parse(stand.audio_json));
    } catch {
      audio = null;
    }
  }

  const slotRows = await rows<{
    id: number;
    idx: number;
    title: string;
    pdf_path: string;
    stamp_count: number;
  }>(
    db,
    `SELECT sl.id, sl.idx, sl.title, sl.pdf_path,
            (SELECT COUNT(*) FROM slot_stamps st WHERE st.slot_id = sl.id) AS stamp_count
     FROM slots sl WHERE sl.stand_id = ? ORDER BY sl.idx`,
    [id],
  );

  const stampedStand = userId
    ? (
        await rows(db, "SELECT 1 FROM stand_stamps WHERE stand_id = ? AND user_id = ?", [
          id,
          userId,
        ])
      ).length > 0
    : false;
  const stampedSlotIds = new Set(
    userId
      ? (
          await rows<{ slot_id: number }>(
            db,
            `SELECT slot_id FROM slot_stamps
             WHERE user_id = ? AND slot_id IN (SELECT id FROM slots WHERE stand_id = ?)`,
            [userId, id],
          )
        ).map((r) => Number(r.slot_id))
      : [],
  );

  const slots: StandDetail["slots"] = [null, null, null, null, null];
  for (const row of slotRows) {
    const idx = Number(row.idx);
    if (idx < 0 || idx > 4) continue;
    slots[idx] = {
      id: Number(row.id),
      idx,
      title: row.title,
      url: fileUrl(row.pdf_path)!,
      stampCount: Number(row.stamp_count),
      stamped: stampedSlotIds.has(Number(row.id)),
    };
  }

  const letters = (
    await rows<{
      id: number;
      body: string;
      created_at: number;
      name: string;
      picture: string | null;
    }>(
      db,
      `SELECT l.id, l.body, l.created_at, u.name, u.picture
       FROM letters l JOIN users u ON u.id = l.user_id
       WHERE l.stand_id = ? ORDER BY l.created_at DESC LIMIT 100`,
      [id],
    )
  ).map((l) => ({
    id: Number(l.id),
    body: l.body,
    createdAt: Number(l.created_at),
    author: { name: l.name, picture: l.picture },
  }));

  return {
    id: Number(stand.id),
    title: stand.title,
    postedAt: Number(stand.posted_at),
    author: { name: stand.name, picture: stand.picture },
    mine: Number(stand.user_id) === userId,
    background: stand.background,
    audio,
    stampCount: Number(stand.stamp_count),
    stamped: stampedStand,
    slots,
    letters,
  };
}
