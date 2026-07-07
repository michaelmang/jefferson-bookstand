"use client";

import dynamic from "next/dynamic";

// The 3D studio touches window/AudioContext everywhere; render it client-only.
const BookstandApp = dynamic(() => import("@/components/BookstandApp"), {
  ssr: false,
  loading: () => <div className="loading">Setting up the bookstand…</div>,
});

export default function StudioLoader() {
  return <BookstandApp />;
}
