"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import BookstandScene from "./BookstandScene";
import PdfReaderOverlay from "./PdfReaderOverlay";
import AudioPanel from "./AudioPanel";
import MagnifierLens, { type LensInfo } from "./MagnifierLens";
import type { BookstandControls } from "./Bookstand";
import { renderPdfPreview } from "@/lib/pdfPreview";
import { SLOT_COUNT, SLOT_LABELS, TOP_SLOT, type SlotView } from "@/lib/slots";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_BACKGROUND,
  ROOM_BACKGROUNDS,
  backgroundById,
  sanitizeAudioSettings,
  type AudioSettings,
} from "@/lib/standState";
import type { StoredStand } from "@/lib/standsStore";
import SavedStandsList, { type WorkbenchCapture } from "./SavedStandsList";

export type SlotData = (NonNullable<SlotView> & { blob: Blob }) | null;

export default function BookstandApp() {
  const [slots, setSlots] = useState<SlotData[]>(() => Array(SLOT_COUNT).fill(null));
  const [activeIndex, setActiveIndex] = useState(0);
  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [hudHidden, setHudHidden] = useState(false);
  const [magnify, setMagnify] = useState(false);
  const [lens, setLens] = useState<LensInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<number | null>(null);
  const controlsRef = useRef<BookstandControls | null>(null);
  const toastTimer = useRef<number | null>(null);
  const slotsRef = useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(
    () => () => {
      for (const slot of slotsRef.current) {
        if (slot) URL.revokeObjectURL(slot.url);
      }
    },
    [],
  );

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

  const requestAssign = useCallback((index: number) => {
    pendingSlot.current = index;
    fileInputRef.current?.click();
  }, []);

  /** Rasterizes the first page and attaches it, unless the slot changed meanwhile. */
  const attachPreview = useCallback(async (index: number, blob: Blob) => {
    const preview = await renderPdfPreview(await blob.arrayBuffer());
    setSlots((prev) => {
      const current = prev[index];
      if (!current || current.blob !== blob) return prev;
      const next = [...prev];
      next[index] = { ...current, preview, previewPending: false };
      return next;
    });
  }, []);

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const index = pendingSlot.current;
    pendingSlot.current = null;
    event.target.value = "";
    if (!file || index === null) return;
    setSlots((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index].url);
      next[index] = {
        name: file.name,
        url: URL.createObjectURL(file),
        blob: file,
        preview: null,
        previewPending: true,
      };
      return next;
    });
    await attachPreview(index, file);
  };

  const clearSlot = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index].url);
      next[index] = null;
      return next;
    });
    if (readerIndex === index) setReaderIndex(null);
  };

  const captureCurrent = async (): Promise<WorkbenchCapture> => ({
    slots: slots.map((slot) => (slot ? { name: slot.name, blob: slot.blob } : null)),
    background,
    audio,
  });

  const applyStoredStand = (stand: StoredStand) => {
    setReaderIndex(null);
    setSlots((prev) => {
      for (const slot of prev) {
        if (slot) URL.revokeObjectURL(slot.url);
      }
      return stand.slots.map((stored) =>
        stored
          ? {
              name: stored.name,
              url: URL.createObjectURL(stored.blob),
              blob: stored.blob,
              preview: null,
              previewPending: true,
            }
          : null,
      );
    });
    setBackground(backgroundById(stand.background).id);
    if (stand.audio) setAudio(sanitizeAudioSettings(stand.audio));
    stand.slots.forEach((stored, index) => {
      if (stored) void attachPreview(index, stored.blob);
    });
    showToast(`Loaded stand “${stand.name}”.`);
  };

  const handleSlotClick = useCallback(
    (index: number) => {
      if (slots[index]) setReaderIndex(index);
      else requestAssign(index);
    },
    [slots, requestAssign],
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
      />

      {/* Hidden with CSS (not unmounted) so the study keeps playing. */}
      <div className={hudHidden ? "hud-layer hud-layer-hidden" : "hud-layer"}>
        <header className="hud hud-top">
          <h1>{loadedName ?? "Jefferson's Revolving Bookstand"}</h1>
          {loadedName && <p className="viewer-byline">From your saved stands</p>}
          <p>Drag the stand (or use ◀ ▶) to spin it. Click the paper facing you to read it.</p>
          <Link className="hud-home-link" href="/">
            ← Back to the Commons
          </Link>
        </header>

        <aside className="hud panel">
          <h2>The Five Rests</h2>
          {slots.map((slot, index) => {
            const isFacing = index === activeIndex || index === TOP_SLOT;
            return (
              <div key={SLOT_LABELS[index]} className="rest-row">
                <div className="rest-head">
                  <span className={`slot-label${isFacing ? " slot-facing" : ""}`}>
                    {index === activeIndex ? "▸ " : ""}
                    {SLOT_LABELS[index]}
                  </span>
                  <span className="rest-head-actions">
                    <button className="btn" onClick={() => requestAssign(index)}>
                      {slot ? "Replace" : "Assign"}
                    </button>
                    {slot && (
                      <button
                        className="btn btn-tertiary saved-delete"
                        aria-label={`Clear ${SLOT_LABELS[index]}`}
                        onClick={() => clearSlot(index)}
                      >
                        Clear
                      </button>
                    )}
                  </span>
                </div>
                <div className={`rest-title${slot ? "" : " empty"}`}>
                  {slot ? slot.name : "empty"}
                </div>
              </div>
            );
          })}

          <h2>The Room</h2>
          <div className="room-row">
            {ROOM_BACKGROUNDS.map((room) => (
              <button
                key={room.id}
                className={`room-swatch${room.id === background ? " room-active" : ""}`}
                style={{ backgroundImage: room.image }}
                title={room.name}
                aria-label={`Room: ${room.name}`}
                onClick={() => setBackground(room.id)}
              />
            ))}
          </div>
          <p className="panel-note">{backgroundById(background).name}</p>

          <h2>Saved Stands</h2>
          <SavedStandsList
            emptyNote="Name the current curation — a daily stand, a monthly stand — then load it back or publish it to the Commons. PDFs are stored in your browser."
            loadedName={loadedName}
            onLoadedNameChange={setLoadedName}
            captureCurrent={captureCurrent}
            onLoad={applyStoredStand}
            onToast={showToast}
          />
        </aside>

        <AudioPanel
          settings={audio}
          onChange={(patch) => setAudio((prev) => ({ ...prev, ...patch }))}
        />

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

      <MagnifierLens lens={lens} />

      {toast && <div className="toast">{toast}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={handleFileChosen}
      />

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
