"use client";

import { useEffect, useRef, useState } from "react";
import { studyAudio } from "@/lib/audio";
import { STATIONS } from "./AudioPanel";
import type { AudioSettings } from "@/lib/standState";

/**
 * The Study, as the curator left it — a visitor can listen or not, but the
 * station, volumes, and window stay fixed. One button starts the whole
 * soundscape (browsers need the gesture anyway).
 */
export default function StudyPanelFixed({ settings }: { settings: AudioSettings }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const station = STATIONS[Math.min(settings.station, STATIONS.length - 1)];
  const hasSound = settings.radioOn || settings.ambienceOn;

  useEffect(() => {
    studyAudio.clicksEnabled = settings.clicks;
  }, [settings.clicks]);

  useEffect(() => {
    const el = audioRef.current;
    if (!listening) {
      studyAudio.stopAmbience();
      if (el) {
        el.pause();
        el.removeAttribute("src");
      }
      return;
    }
    studyAudio.unlock();
    if (settings.ambienceOn) {
      studyAudio.startAmbience();
      studyAudio.setAmbienceVolume(settings.ambienceVolume);
    }
    let cancelled = false;
    if (settings.radioOn && el) {
      el.src = station.url;
      el.volume = settings.radioVolume;
      el.play().catch(() => {
        if (!cancelled) setError("The stream wouldn't start — try again.");
      });
    }
    return () => {
      cancelled = true;
    };
  }, [listening, settings, station]);

  useEffect(() => () => studyAudio.stopAmbience(), []);

  const description = [
    settings.radioOn ? station.name : null,
    settings.ambienceOn ? "an open window" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="hud audio-panel">
      <h2>The Study</h2>
      {hasSound ? (
        <>
          <div className="audio-row">
            <button
              className="btn btn-round"
              onClick={() => {
                setError(null);
                setListening((on) => !on);
              }}
              aria-label={listening ? "Pause the study" : "Listen to the study"}
            >
              {listening ? "❚❚" : "▶"}
            </button>
            <span className="study-fixed-desc">{description}</span>
          </div>
          {error && <p className="audio-error">{error}</p>}
          <p className="panel-note">The study sounds as the curator left it.</p>
        </>
      ) : (
        <p className="panel-note">The curator kept the study quiet.</p>
      )}
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
