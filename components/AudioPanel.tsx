"use client";

import { useEffect, useRef, useState } from "react";
import { studyAudio } from "@/lib/audio";
import type { AudioSettings } from "@/lib/standState";

export const STATIONS = [
  { name: "Radio Swiss Classic", url: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128" },
  { name: "Venice Classic Radio", url: "https://uk2.streamingpulse.com/ssl/vcr1" },
  { name: "WQXR New York", url: "https://stream.wqxr.org/wqxr" },
  {
    name: "KUSC Los Angeles",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KUSCMP128.mp3",
  },
];

type Props = {
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
};

/**
 * Controlled audio controls — the settings live with the stand state so they
 * can be saved and shared. Applying a shared stand may set radioOn before
 * any user gesture; the blocked play() is surfaced as a gentle hint.
 */
export default function AudioPanel({ settings, onChange }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [radioError, setRadioError] = useState<string | null>(null);
  const station = Math.min(settings.station, STATIONS.length - 1);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.radioVolume;
  }, [settings.radioVolume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!settings.radioOn) {
      el.pause();
      el.removeAttribute("src");
      return;
    }
    studyAudio.unlock();
    el.src = STATIONS[station].url;
    let cancelled = false;
    el.play().catch(() => {
      if (cancelled) return;
      setRadioError("The stream needs a click first — press play.");
      onChange({ radioOn: false });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the source changes
  }, [settings.radioOn, station]);

  useEffect(() => {
    if (settings.ambienceOn) {
      studyAudio.startAmbience();
      studyAudio.setAmbienceVolume(settings.ambienceVolume);
    } else {
      studyAudio.stopAmbience();
    }
  }, [settings.ambienceOn, settings.ambienceVolume]);

  useEffect(() => () => studyAudio.stopAmbience(), []);

  useEffect(() => {
    studyAudio.clicksEnabled = settings.clicks;
  }, [settings.clicks]);

  return (
    <div className="hud audio-panel">
      <h2>The Study</h2>
      <div className="audio-row">
        <button
          className="btn btn-round"
          onClick={() => {
            setRadioError(null);
            onChange({ radioOn: !settings.radioOn });
          }}
          aria-label={settings.radioOn ? "Pause radio" : "Play radio"}
        >
          {settings.radioOn ? "❚❚" : "▶"}
        </button>
        <select
          className="audio-select"
          value={station}
          onChange={(event) => {
            setRadioError(null);
            onChange({ station: Number(event.target.value) });
          }}
          aria-label="Radio station"
        >
          {STATIONS.map((s, index) => (
            <option key={s.name} value={index}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.radioVolume}
          onChange={(event) => onChange({ radioVolume: Number(event.target.value) })}
          aria-label="Radio volume"
        />
      </div>
      {radioError && <p className="audio-error">{radioError}</p>}
      <div className="audio-row">
        <label className="audio-toggle">
          <input
            type="checkbox"
            checked={settings.ambienceOn}
            onChange={(event) => onChange({ ambienceOn: event.target.checked })}
          />
          Open window
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.ambienceVolume}
          onChange={(event) => onChange({ ambienceVolume: Number(event.target.value) })}
          disabled={!settings.ambienceOn}
          aria-label="Ambience volume"
        />
      </div>
      <div className="audio-row">
        <label className="audio-toggle">
          <input
            type="checkbox"
            checked={settings.clicks}
            onChange={(event) => onChange({ clicks: event.target.checked })}
          />
          Wood clicks on turn
        </label>
      </div>
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
