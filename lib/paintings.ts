/**
 * Public-domain paintings (PD-Art), hotlinked from Wikimedia Commons via the
 * filename-based Special:FilePath redirect — stable without hash paths. All
 * verified to resolve. CSS keeps a gradient underneath in case one doesn't.
 */
export type Painting = { file: string; title: string; artist: string };

export const PAINTINGS = {
  philosopher: {
    file: "Rembrandt - The Philosopher in Meditation.jpg",
    title: "Philosopher in Meditation",
    artist: "Rembrandt van Rijn, 1632",
  },
  astronomer: {
    file: "Johannes Vermeer - The Astronomer - WGA24685.jpg",
    title: "The Astronomer",
    artist: "Johannes Vermeer, 1668",
  },
  reader: {
    file: "Fragonard, The Reader.jpg",
    title: "A Young Girl Reading",
    artist: "Jean-Honoré Fragonard, c. 1770",
  },
  jefferson: {
    file: "Thomas Jefferson by Rembrandt Peale, 1800.jpg",
    title: "Thomas Jefferson",
    artist: "Rembrandt Peale, 1800",
  },
} satisfies Record<string, Painting>;

export function paintingUrl(painting: Painting, width = 1600): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    painting.file,
  )}?width=${width}`;
}
