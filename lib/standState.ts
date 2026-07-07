/**
 * The shareable state of a bookstand: which room you're in, how the study
 * sounds, and the five rests. Saved locally with named stands and posted to
 * the home page with shared stands. Client-safe (no server imports).
 */

export type AudioSettings = {
  station: number;
  radioOn: boolean;
  radioVolume: number;
  ambienceOn: boolean;
  ambienceVolume: number;
  clicks: boolean;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  station: 0,
  radioOn: false,
  radioVolume: 0.7,
  ambienceOn: false,
  ambienceVolume: 0.5,
  clicks: true,
};

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/** Coerces untrusted JSON (from the DB or IndexedDB) into valid settings. */
export function sanitizeAudioSettings(raw: unknown): AudioSettings {
  const d = DEFAULT_AUDIO_SETTINGS;
  if (typeof raw !== "object" || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  const station = typeof r.station === "number" ? Math.floor(r.station) : d.station;
  return {
    station: station >= 0 && station <= 8 ? station : d.station,
    radioOn: typeof r.radioOn === "boolean" ? r.radioOn : d.radioOn,
    radioVolume: clamp01(r.radioVolume, d.radioVolume),
    ambienceOn: typeof r.ambienceOn === "boolean" ? r.ambienceOn : d.ambienceOn,
    ambienceVolume: clamp01(r.ambienceVolume, d.ambienceVolume),
    clicks: typeof r.clicks === "boolean" ? r.clicks : d.clicks,
  };
}

export type RoomBackground = {
  id: string;
  name: string;
  /** CSS background-image value for the room behind the stand. */
  image: string;
};

export const ROOM_BACKGROUNDS: RoomBackground[] = [
  {
    id: "library",
    name: "Monticello Library",
    image: 'url("/jefferson-library.webp")',
  },
  {
    id: "candlelight",
    name: "Candlelit Study",
    image:
      "radial-gradient(120% 90% at 32% 24%, #6b4a20 0%, #4a3216 38%, #2a1b0c 72%, #17100a 100%)",
  },
  {
    id: "dawn",
    name: "Dawn Window",
    image:
      "linear-gradient(178deg, #e8d9b8 0%, #d3bd97 34%, #ab9271 62%, #7c6a51 88%, #5d5040 100%)",
  },
  {
    id: "evening",
    name: "Evening Blue",
    image: "linear-gradient(180deg, #3a4666 0%, #2a3350 40%, #1c2438 72%, #131a2b 100%)",
  },
  {
    id: "garden",
    name: "Garden Green",
    image: "linear-gradient(180deg, #b9c7a0 0%, #8ea474 38%, #64805a 70%, #46603f 100%)",
  },
];

export const DEFAULT_BACKGROUND = "library";

export function backgroundById(id: string | null | undefined): RoomBackground {
  return ROOM_BACKGROUNDS.find((b) => b.id === id) ?? ROOM_BACKGROUNDS[0];
}
