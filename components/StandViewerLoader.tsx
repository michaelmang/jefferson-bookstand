"use client";

import dynamic from "next/dynamic";
import type { StandDetail } from "@/lib/server/feed";

const StandViewer = dynamic(() => import("@/components/StandViewer"), {
  ssr: false,
  loading: () => <div className="loading">Carrying the stand in…</div>,
});

export default function StandViewerLoader({ detail }: { detail: StandDetail }) {
  return <StandViewer detail={detail} />;
}
