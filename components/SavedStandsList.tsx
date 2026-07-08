"use client";

import { useEffect, useRef, useState } from "react";
import { postStand, takeDownStand } from "@/app/actions";
import { uploadPdf } from "@/lib/clientUpload";
import type { AudioSettings } from "@/lib/standState";
import {
  deleteStand,
  getStand,
  listStands,
  saveStand,
  setStandPostedId,
  type StandSummary,
  type StoredSlot,
  type StoredStand,
} from "@/lib/standsStore";

const PER_PAGE = 5;

/** What's on the workbench right now, ready to be saved under a name. */
export type WorkbenchCapture = {
  slots: StoredSlot[];
  background: string;
  audio: AudioSettings;
};

type Props = {
  emptyNote: string;
  /** The posted stand open in the live room, if the workbench is bound to one. */
  currentPostedId?: number;
  currentPostedTitle?: string;
  /** The saved stand currently on the workbench (owned by the parent). */
  loadedName: string | null;
  onLoadedNameChange: (name: string | null) => void;
  captureCurrent: () => Promise<WorkbenchCapture>;
  onLoad: (stand: StoredStand) => void | Promise<void>;
  /** Fired after a successful unpublish, with the posted id that went away. */
  onUnpublished?: (postedId: number) => void;
  onToast: (message: string) => void;
};

function savedDate(savedAt: number): string {
  return new Date(savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The single home of a curator's stand history: save the current curation
 * under a name, search past saves, load one onto the workbench, publish or
 * unpublish it on the home page, or delete it. Badges mark which save is on
 * the stand and which are published.
 */
export default function SavedStandsList({
  emptyNote,
  currentPostedId,
  currentPostedTitle,
  loadedName,
  onLoadedNameChange,
  captureCurrent,
  onLoad,
  onUnpublished,
  onToast,
}: Props) {
  const [stands, setStands] = useState<StandSummary[]>([]);
  const [saveName, setSaveName] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Which row's ⋯ menu is open. */
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Destructive actions want a second click; the arm decays after a moment.
  // Value is "unpublish:<key>" or "delete:<key>".
  const [armed, setArmed] = useState<string | null>(null);
  const armTimer = useRef<number | null>(null);
  const resolvedLoaded = useRef(false);

  const refresh = async () => setStands(await listStands());

  useEffect(() => {
    let cancelled = false;
    listStands()
      .then((all) => {
        if (!cancelled) setStands(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // In the live room, the save published as this stand starts out "loaded".
  useEffect(() => {
    if (resolvedLoaded.current || !currentPostedId || loadedName) return;
    const match = stands.find((stand) => stand.postedId === currentPostedId);
    if (match) {
      resolvedLoaded.current = true;
      onLoadedNameChange(match.name);
    }
  }, [stands, currentPostedId, loadedName, onLoadedNameChange]);

  useEffect(
    () => () => {
      if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    },
    [],
  );

  const arm = (key: string) => {
    setArmed(key);
    if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed(null), 3500);
  };

  const save = async () => {
    const name = saveName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const captured = await captureCurrent();
      // Overwriting a save keeps its link to the published copy; a fresh save
      // made inside a live room adopts the posted stand it captures (unless
      // another save already claims it).
      const existing = await getStand(name);
      const adoptPostedId =
        currentPostedId != null && !stands.some((stand) => stand.postedId === currentPostedId)
          ? currentPostedId
          : null;
      await saveStand({
        name,
        savedAt: Date.now(),
        postedId: existing?.postedId ?? adoptPostedId,
        ...captured,
      });
      await refresh();
      setSaveName("");
      onLoadedNameChange(name);
      onToast(`Saved “${name}”.`);
    } catch {
      onToast("Couldn't save the stand.");
    } finally {
      setBusy(false);
    }
  };

  const load = async (name: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const stand = await getStand(name);
      if (stand) {
        await onLoad(stand);
        onLoadedNameChange(name);
        setOpenMenu(null);
      }
    } catch {
      onToast("Couldn't load the stand.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (name: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const stand = await getStand(name);
      if (!stand) return;
      // Upload straight to Blob first — Serverless Functions cap request
      // bodies well under what five PDFs can total, so the server action
      // below only ever sees the resulting URLs.
      const uploaded = await Promise.all(
        stand.slots.map((slot) =>
          slot ? uploadPdf(new File([slot.blob], slot.name, { type: "application/pdf" })) : null,
        ),
      );
      const formData = new FormData();
      formData.set("title", stand.name.slice(0, 80));
      formData.set("background", stand.background ?? "library");
      formData.set("audio", JSON.stringify(stand.audio ?? {}));
      stand.slots.forEach((slot, index) => {
        const url = uploaded[index];
        if (!slot || !url) return;
        formData.set(`pdf${index}`, url);
        formData.set(`title${index}`, slot.name);
      });
      const result = await postStand(formData);
      if (result.ok) {
        await setStandPostedId(name, result.id);
        await refresh();
        setOpenMenu(null);
        onToast(`Published “${name}” to the Commons.`);
      } else {
        onToast(result.error);
      }
    } catch {
      onToast("Couldn't publish the stand.");
    } finally {
      setBusy(false);
    }
  };

  /** Takes the posted copy down. Returns false only on a real failure. */
  const takeDown = async (postedId: number): Promise<boolean> => {
    const result = await takeDownStand(postedId);
    if (!result.ok && !result.error.includes("already gone")) {
      onToast(result.error);
      return false;
    }
    return true;
  };

  const unpublish = async (name: string | null, postedId: number) => {
    if (busy) return;
    setArmed(null);
    setBusy(true);
    try {
      if (!(await takeDown(postedId))) return;
      if (name) await setStandPostedId(name, null);
      await refresh();
      setOpenMenu(null);
      onToast("Taken down from the Commons. The papers stay in your saved stands.");
      onUnpublished?.(postedId);
    } catch {
      onToast("Couldn't unpublish the stand.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string, postedId: number | null | undefined) => {
    if (busy) return;
    setArmed(null);
    setBusy(true);
    try {
      // A deleted stand shouldn't linger in the Commons.
      if (postedId != null && !(await takeDown(postedId))) return;
      await deleteStand(name);
      await refresh();
      setOpenMenu(null);
      if (loadedName === name) onLoadedNameChange(null);
      onToast(
        postedId != null
          ? `Deleted “${name}” and took it down from the Commons.`
          : `Deleted stand “${name}”.`,
      );
      if (postedId != null) onUnpublished?.(postedId);
    } catch {
      onToast("Couldn't delete the stand.");
    } finally {
      setBusy(false);
    }
  };

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? stands.filter((stand) => stand.name.toLowerCase().includes(trimmed))
    : stands;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const paged = filtered.slice(current * PER_PAGE, (current + 1) * PER_PAGE);

  // A published stand with no local save still needs a row to manage it from.
  const orphanPublished =
    currentPostedId && !stands.some((stand) => stand.postedId === currentPostedId)
      ? { title: currentPostedTitle ?? "This stand", postedId: currentPostedId }
      : null;

  return (
    <>
      <div className="stand-save-row">
        <input
          className="stand-input"
          placeholder="Save this curation as…"
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
        />
        <button className="btn" onClick={() => void save()} disabled={!saveName.trim() || busy}>
          Save
        </button>
      </div>

      {orphanPublished && (
        <div className="saved-row saved-row-orphan">
          <div className="saved-row-head">
            <span className="saved-name saved-loaded" title={orphanPublished.title}>
              ▸ {orphanPublished.title}
            </span>
            <span className="saved-date saved-on-stand">on the stand</span>
          </div>
          <div className="saved-pub">✶ Published to the Commons</div>
          <div className="saved-row-actions">
            {armed === `unpublish:#${orphanPublished.postedId}` ? (
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void unpublish(null, orphanPublished.postedId)}
              >
                Really unpublish?
              </button>
            ) : (
              <button
                className="btn"
                disabled={busy}
                onClick={() => arm(`unpublish:#${orphanPublished.postedId}`)}
              >
                Unpublish
              </button>
            )}
            <span className="saved-note">Not in your saved stands yet — save it above.</span>
          </div>
        </div>
      )}

      {stands.length === 0 ? (
        !orphanPublished && <p className="panel-note">{emptyNote}</p>
      ) : (
        <>
          <input
            className="stand-input stand-search"
            placeholder="Search saved stands…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          {filtered.length === 0 ? (
            <p className="panel-note">No saved stand matches “{query.trim()}”.</p>
          ) : (
            paged.map((stand) => {
              const isLoaded = stand.name === loadedName;
              const isPublished = stand.postedId != null;
              const menuOpen = openMenu === stand.name;
              return (
                <div key={stand.name} className="saved-row">
                  <div className="saved-row-head">
                    <span
                      className={isLoaded ? "saved-name saved-loaded" : "saved-name"}
                      title={stand.name}
                    >
                      {isLoaded ? `▸ ${stand.name}` : stand.name}
                    </span>
                    <span className={isLoaded ? "saved-date saved-on-stand" : "saved-date"}>
                      {isLoaded ? "on the stand" : savedDate(stand.savedAt)}
                    </span>
                    <button
                      className={`btn btn-menu${menuOpen ? " btn-active" : ""}`}
                      aria-label={`Actions for ${stand.name}`}
                      aria-expanded={menuOpen}
                      onClick={() => setOpenMenu(menuOpen ? null : stand.name)}
                    >
                      ⋯
                    </button>
                  </div>
                  {isPublished && <div className="saved-pub">✶ Published to the Commons</div>}
                  {menuOpen && (
                    <div className="saved-actions-menu">
                      {!isLoaded && (
                        <button
                          className="menu-item"
                          disabled={busy}
                          onClick={() => void load(stand.name)}
                        >
                          Load onto the stand
                        </button>
                      )}
                      {!isPublished && (
                        <button
                          className="menu-item"
                          disabled={busy}
                          onClick={() => void publish(stand.name)}
                        >
                          Publish to the Commons
                        </button>
                      )}
                      {isPublished && (
                        <button
                          className={`menu-item${armed === `unpublish:${stand.name}` ? " menu-danger" : ""}`}
                          disabled={busy}
                          onClick={() =>
                            armed === `unpublish:${stand.name}`
                              ? void unpublish(stand.name, stand.postedId!)
                              : arm(`unpublish:${stand.name}`)
                          }
                        >
                          {armed === `unpublish:${stand.name}` ? "Really unpublish?" : "Unpublish"}
                        </button>
                      )}
                      <button
                        className={`menu-item${armed === `delete:${stand.name}` ? " menu-danger" : ""}`}
                        disabled={busy}
                        onClick={() =>
                          armed === `delete:${stand.name}`
                            ? void remove(stand.name, stand.postedId)
                            : arm(`delete:${stand.name}`)
                        }
                      >
                        {armed === `delete:${stand.name}`
                          ? isPublished
                            ? "Really delete and unpublish?"
                            : "Really delete?"
                          : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {pageCount > 1 && (
            <div className="pager">
              <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ‹ Prev
              </button>
              <span className="pager-label">
                {current + 1}
                {" / "}
                {pageCount}
              </span>
              <button
                className="btn"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
