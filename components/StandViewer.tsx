"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import BookstandScene from "./BookstandScene";
import PdfReaderOverlay from "./PdfReaderOverlay";
import AudioPanel from "./AudioPanel";
import MagnifierLens, { type LensInfo } from "./MagnifierLens";
import Avatar from "./Avatar";
import SavedStandsList, { type WorkbenchCapture } from "./SavedStandsList";
import type { BookstandControls } from "./Bookstand";
import {
  clearStandSlot,
  replaceStandRests,
  toggleSlotStamp,
  toggleStandStamp,
  updateStandRoom,
  updateStandSlot,
  writeLetter,
} from "@/app/actions";
import type { StandDetail } from "@/lib/server/feed";
import { renderPdfPreview } from "@/lib/pdfPreview";
import { SLOT_LABELS, TOP_SLOT, type SlotView } from "@/lib/slots";
import {
  DEFAULT_AUDIO_SETTINGS,
  ROOM_BACKGROUNDS,
  backgroundById,
  type AudioSettings,
} from "@/lib/standState";
import type { StoredStand } from "@/lib/standsStore";
import StudyPanelFixed from "./StudyPanelFixed";

function letterDate(createdAt: number): string {
  return new Date(createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildSlotViews(detailSlots: StandDetail["slots"]): SlotView[] {
  return detailSlots.map((slot) =>
    slot ? { name: slot.title, url: slot.url, preview: null, previewPending: true } : null,
  );
}

function buildSlotStamps(
  detailSlots: StandDetail["slots"],
): Record<number, { stamped: boolean; count: number }> {
  const stamps: Record<number, { stamped: boolean; count: number }> = {};
  for (const slot of detailSlots) {
    if (slot) stamps[slot.id] = { stamped: slot.stamped, count: slot.stampCount };
  }
  return stamps;
}

/**
 * A posted bookstand. For visitors it's a window: spin, read, stamp, write.
 * For its own curator it's a live room: rests can be re-papered, saved sets
 * loaded, and the room and sound changed — all persisted to the post.
 */
export default function StandViewer({ detail }: { detail: StandDetail }) {
  const [slots, setSlots] = useState<SlotView[]>(() => buildSlotViews(detail.slots));
  const [activeIndex, setActiveIndex] = useState(0);
  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hudHidden, setHudHidden] = useState(false);
  const [magnify, setMagnify] = useState(false);
  const [lens, setLens] = useState<LensInfo | null>(null);
  const [audio, setAudio] = useState<AudioSettings>(detail.audio ?? DEFAULT_AUDIO_SETTINGS);
  const [background, setBackground] = useState(detail.background);
  const [standStamp, setStandStamp] = useState({
    stamped: detail.stamped,
    count: detail.stampCount,
  });
  const [slotStamps, setSlotStamps] = useState(() => buildSlotStamps(detail.slots));
  const [letterBody, setLetterBody] = useState("");
  const [letterPending, startLetter] = useTransition();
  const [stampPending, startStamp] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [loadedName, setLoadedName] = useState<string | null>(null);

  const router = useRouter();
  const controlsRef = useRef<BookstandControls | null>(null);
  const toastTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<number | null>(null);
  const roomSaveTimer = useRef<number | null>(null);

  // After a curator edit, router.refresh() delivers new detail.slots; rebuild
  // the local views then (and only then — letters/stamps refreshes shouldn't
  // flash the previews). Adjusting state during render is React's documented
  // pattern for deriving state from a changed prop.
  const slotsSignature = detail.slots
    .map((slot) => (slot ? `${slot.id}:${slot.url}:${slot.title}` : "-"))
    .join("|");
  const [prevSignature, setPrevSignature] = useState(slotsSignature);
  if (prevSignature !== slotsSignature) {
    setPrevSignature(slotsSignature);
    setSlots(buildSlotViews(detail.slots));
    setSlotStamps(buildSlotStamps(detail.slots));
    setReaderIndex(null);
  }

  // Rasterize the first page of any rest that still needs it. Idempotent:
  // re-runs when slots change and skips everything already rendered, so it
  // also covers rebuilt slots after curator edits.
  useEffect(() => {
    let cancelled = false;
    slots.forEach(async (slot, index) => {
      if (!slot || slot.preview || !slot.previewPending) return;
      const url = slot.url;
      let preview: HTMLCanvasElement | null = null;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        preview = await renderPdfPreview(await response.arrayBuffer());
      } catch {
        preview = null;
      }
      if (cancelled) return;
      setSlots((prev) => {
        const current = prev[index];
        if (!current || current.url !== url) return prev;
        const next = [...prev];
        next[index] = { ...current, preview, previewPending: false };
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [slots]);

  // The lens clears on either toggle direction; hovering repopulates it.
  const toggleMagnify = useCallback(() => {
    setMagnify((on) => !on);
    setLens(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (readerIndex !== null) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.key === "ArrowLeft") controlsRef.current?.turn(-1);
      if (event.key === "ArrowRight") controlsRef.current?.turn(1);
      if (event.key === "h") setHudHidden((hidden) => !hidden);
      if (event.key === "m") toggleMagnify();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readerIndex, toggleMagnify]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const stampStand = () => {
    startStamp(async () => {
      const result = await toggleStandStamp(detail.id);
      if (result.ok) setStandStamp({ stamped: result.stamped, count: result.count });
      else showToast(result.error);
    });
  };

  const stampSlot = (slotId: number) => {
    startStamp(async () => {
      const result = await toggleSlotStamp(slotId);
      if (result.ok) {
        setSlotStamps((prev) => ({
          ...prev,
          [slotId]: { stamped: result.stamped, count: result.count },
        }));
      } else {
        showToast(result.error);
      }
    });
  };

  const sendLetter = () => {
    const body = letterBody.trim();
    if (!body) return;
    startLetter(async () => {
      const result = await writeLetter(detail.id, body);
      if (result.ok) {
        setLetterBody("");
        showToast("Letter delivered.");
        router.refresh();
      } else {
        showToast(result.error);
      }
    });
  };

  // --- Curator-only editing: the live room. ---

  const requestAssign = useCallback((index: number) => {
    pendingSlot.current = index;
    fileInputRef.current?.click();
  }, []);

  const handleFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const index = pendingSlot.current;
    pendingSlot.current = null;
    event.target.value = "";
    if (!file || index === null) return;
    startEdit(async () => {
      const formData = new FormData();
      formData.set("pdf", file);
      formData.set("title", file.name);
      const result = await updateStandSlot(detail.id, index, formData);
      if (result.ok) {
        showToast(`${SLOT_LABELS[index]} re-papered.`);
        router.refresh();
      } else {
        showToast(result.error);
      }
    });
  };

  const clearRest = (index: number) => {
    startEdit(async () => {
      const result = await clearStandSlot(detail.id, index);
      if (result.ok) {
        showToast(`${SLOT_LABELS[index]} cleared.`);
        router.refresh();
      } else {
        showToast(result.error);
      }
    });
  };

  const loadSetOntoStand = async (stored: StoredStand) => {
    if (!stored.slots.some(Boolean)) {
      showToast(`“${stored.name}” has no papers to load.`);
      return;
    }
    const formData = new FormData();
    stored.slots.forEach((slot, index) => {
      if (!slot) return;
      formData.set(`pdf${index}`, new File([slot.blob], slot.name, { type: "application/pdf" }));
      formData.set(`title${index}`, slot.name);
    });
    const result = await replaceStandRests(detail.id, formData);
    if (result.ok) {
      showToast(`Loaded “${stored.name}” onto the stand.`);
      router.refresh();
    } else {
      showToast(result.error);
    }
  };

  const changeRoom = (roomId: string) => {
    setBackground(roomId);
    startEdit(async () => {
      const result = await updateStandRoom(detail.id, roomId, JSON.stringify(audio));
      if (!result.ok) showToast(result.error);
    });
  };

  /** Sound tweaks persist too, but debounced — sliders fire constantly. */
  const changeAudio = (patch: Partial<AudioSettings>) => {
    setAudio((prev) => {
      const next = { ...prev, ...patch };
      if (detail.mine) {
        if (roomSaveTimer.current !== null) window.clearTimeout(roomSaveTimer.current);
        roomSaveTimer.current = window.setTimeout(() => {
          void updateStandRoom(detail.id, background, JSON.stringify(next));
        }, 1200);
      }
      return next;
    });
  };

  useEffect(
    () => () => {
      if (roomSaveTimer.current !== null) window.clearTimeout(roomSaveTimer.current);
    },
    [],
  );

  /** What's on the live stand right now — fetched back for local saving. */
  const captureCurrent = async (): Promise<WorkbenchCapture> => ({
    slots: await Promise.all(
      detail.slots.map(async (slot) => {
        if (!slot) return null;
        const response = await fetch(slot.url);
        if (!response.ok) throw new Error(String(response.status));
        return { name: slot.title, blob: await response.blob() };
      }),
    ),
    background,
    audio,
  });

  /** Unpublishing the stand that's open here sends you back to the studio. */
  const handleUnpublished = (postedId: number) => {
    if (postedId === detail.id) router.push("/studio");
  };

  const handleSlotClick = useCallback(
    (index: number) => {
      if (slots[index]) setReaderIndex(index);
      else if (detail.mine) requestAssign(index);
      else showToast("The curator left this rest empty.");
    },
    [slots, detail.mine, requestAssign, showToast],
  );

  const handleInactiveClick = useCallback(() => {
    showToast("Give the stand a spin — only the paper facing you can be read.");
  }, [showToast]);

  const readerSlot = readerIndex !== null ? slots[readerIndex] : null;
  const facing = slots[activeIndex];

  return (
    <div className="app">
      <div className="app-backdrop" style={{ backgroundImage: backgroundById(background).image }} />
      <BookstandScene
        slots={slots}
        activeIndex={activeIndex}
        onSlotClick={handleSlotClick}
        onInactiveClick={handleInactiveClick}
        onActiveChange={setActiveIndex}
        controlsRef={controlsRef}
        magnify={magnify}
        onMagnify={setLens}
        editable={detail.mine}
      />

      {/* Hidden with CSS (not unmounted) so the study keeps playing. */}
      <div className={hudHidden ? "hud-layer hud-layer-hidden" : "hud-layer"}>
        <header className="hud hud-top">
          <h1>{detail.mine ? (loadedName ?? detail.title) : detail.title}</h1>
          <p className="viewer-byline">
            <Avatar name={detail.author.name} picture={detail.author.picture} />
            {detail.mine ? " Curated by you" : ` Curated by ${detail.author.name}`}
          </p>
          <Link className="hud-home-link" href="/">
            ← Back to the Commons
          </Link>
        </header>

        <aside className="hud panel">
          <div className="viewer-stamp-row">
            {detail.mine ? (
              <span className="stamp-static" title="Stamps received">
                <span className="stamp-seal" aria-hidden>
                  ✶
                </span>
                {standStamp.count === 1
                  ? "1 stamp received"
                  : `${standStamp.count} stamps received`}
              </span>
            ) : (
              <button
                className={`btn stamp-btn${standStamp.stamped ? " stamped" : ""}`}
                onClick={stampStand}
                disabled={stampPending}
              >
                <span className="stamp-seal" aria-hidden>
                  ✶
                </span>
                {standStamp.stamped ? "Stamped" : "Stamp this stand"}
                {" · "}
                {standStamp.count}
              </button>
            )}
          </div>

          <h2>The Five Rests</h2>
          {detail.slots.map((slot, index) => {
            const isFacing = index === activeIndex || index === TOP_SLOT;
            const stamps = slot ? slotStamps[slot.id] : undefined;
            return (
              <div key={SLOT_LABELS[index]} className="rest-row">
                <div className="rest-head">
                  <span className={`slot-label${isFacing ? " slot-facing" : ""}`}>
                    {index === activeIndex ? "▸ " : ""}
                    {SLOT_LABELS[index]}
                  </span>
                  <span className="rest-head-actions">
                    {slot &&
                      stamps &&
                      (detail.mine ? (
                        <span className="stamp-static" title="Stamps received on this rest">
                          <span className="stamp-seal" aria-hidden>
                            ✶
                          </span>
                          {stamps.count}
                        </span>
                      ) : (
                        <button
                          className={`btn stamp-btn${stamps.stamped ? " stamped" : ""}`}
                          onClick={() => stampSlot(slot.id)}
                          disabled={stampPending}
                          aria-label={`Stamp ${slot.title}`}
                        >
                          <span className="stamp-seal" aria-hidden>
                            ✶
                          </span>
                          {stamps.count}
                        </button>
                      ))}
                    {detail.mine && (
                      <button
                        className="btn"
                        disabled={editPending}
                        onClick={() => requestAssign(index)}
                      >
                        {slot ? "Replace" : "Assign"}
                      </button>
                    )}
                    {detail.mine && slot && (
                      <button
                        className="btn btn-tertiary saved-delete"
                        disabled={editPending}
                        aria-label={`Clear ${SLOT_LABELS[index]}`}
                        onClick={() => clearRest(index)}
                      >
                        Clear
                      </button>
                    )}
                  </span>
                </div>
                <div className={`rest-title${slot ? "" : " empty"}`}>
                  {slot ? slot.title : "empty"}
                </div>
              </div>
            );
          })}

          {detail.mine && (
            <>
              <h2>The Room</h2>
              <div className="room-row">
                {ROOM_BACKGROUNDS.map((room) => (
                  <button
                    key={room.id}
                    className={`room-swatch${room.id === background ? " room-active" : ""}`}
                    style={{ backgroundImage: room.image }}
                    title={room.name}
                    aria-label={`Room: ${room.name}`}
                    onClick={() => changeRoom(room.id)}
                  />
                ))}
              </div>
              <p className="panel-note">
                {backgroundById(background).name} — room and sound changes save to the posted stand.
              </p>

              <h2>Saved Stands</h2>
              <SavedStandsList
                emptyNote="Save this curation above, or name sets in the studio — then load them onto this stand or publish them to the Commons."
                currentPostedId={detail.id}
                currentPostedTitle={detail.title}
                loadedName={loadedName}
                onLoadedNameChange={setLoadedName}
                captureCurrent={captureCurrent}
                onLoad={loadSetOntoStand}
                onUnpublished={handleUnpublished}
                onToast={showToast}
              />
              <p className="panel-note">
                Loading a saved set replaces the papers on this posted stand.
              </p>
            </>
          )}

          <h2>{detail.mine ? "Letters to you" : "Letters to the curator"}</h2>
          {!detail.mine && (
            <div className="letter-form">
              <textarea
                className="letter-input"
                placeholder="A short letter about this stand…"
                maxLength={500}
                rows={3}
                value={letterBody}
                onChange={(event) => setLetterBody(event.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={sendLetter}
                disabled={!letterBody.trim() || letterPending}
              >
                {letterPending ? "Sealing…" : "Send letter"}
              </button>
            </div>
          )}
          {detail.letters.length === 0 ? (
            <p className="panel-note">
              {detail.mine
                ? "No letters yet — they'll arrive here as readers write to you."
                : "No letters yet — write the first one."}
            </p>
          ) : (
            detail.letters.map((letter) => (
              <div key={letter.id} className="letter">
                <div className="letter-head">
                  <Avatar name={letter.author.name} picture={letter.author.picture} />
                  <span className="letter-author">{letter.author.name}</span>
                  <span className="letter-date">{letterDate(letter.createdAt)}</span>
                </div>
                <p className="letter-body">{letter.body}</p>
              </div>
            ))
          )}
        </aside>

        {detail.mine ? (
          <AudioPanel settings={audio} onChange={changeAudio} />
        ) : (
          <StudyPanelFixed settings={detail.audio ?? DEFAULT_AUDIO_SETTINGS} />
        )}

        <footer className="hud hud-bottom">
          <button
            className="btn btn-round"
            aria-label="Rotate left"
            onClick={() => controlsRef.current?.turn(-1)}
          >
            ◀
          </button>
          <span className="facing-label">
            Facing: <strong>{SLOT_LABELS[activeIndex]}</strong>
            {" — "}
            {facing ? facing.name : "empty"}
          </span>
          <button
            className={`btn btn-round${magnify ? " btn-active" : ""}`}
            aria-label="Toggle magnifying glass"
            aria-pressed={magnify}
            title="Magnifying glass (m) — hover the facing paper"
            onClick={toggleMagnify}
          >
            🔍
          </button>
          <button
            className="btn btn-tertiary"
            title="Hide controls (h)"
            onClick={() => setHudHidden(true)}
          >
            Hide controls
          </button>
          <button
            className="btn btn-round"
            aria-label="Rotate right"
            onClick={() => controlsRef.current?.turn(1)}
          >
            ▶
          </button>
        </footer>
      </div>

      {hudHidden && (
        <button
          className="btn show-controls"
          title="Show controls (h)"
          onClick={() => setHudHidden(false)}
        >
          Show controls
        </button>
      )}

      {detail.mine && (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handleFileChosen}
        />
      )}

      <MagnifierLens lens={lens} />

      {toast && <div className="toast">{toast}</div>}

      {readerIndex !== null && readerSlot && (
        <PdfReaderOverlay
          title={readerSlot.name}
          url={readerSlot.url}
          onClose={() => setReaderIndex(null)}
        />
      )}
    </div>
  );
}
