"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleStandStamp } from "@/app/actions";
import type { StandCard as StandCardData } from "@/lib/server/feed";
import Avatar from "./Avatar";

function timeLabel(postedAt: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - postedAt) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StandCard({ stand }: { stand: StandCardData }) {
  const [stampCount, setStampCount] = useState(stand.stampCount);
  const [pending, startTransition] = useTransition();

  const stamp = () => {
    startTransition(async () => {
      const result = await toggleStandStamp(stand.id);
      if (result.ok) setStampCount(result.count);
    });
  };

  return (
    <article className="stand-card">
      <div className="stand-card-head">
        <Avatar name={stand.author.name} picture={stand.author.picture} />
        <div className="stand-card-byline">
          <Link href={`/stand/${stand.id}`} className="stand-card-title">
            {stand.title}
          </Link>
          <span className="stand-card-meta">
            {stand.mine
              ? timeLabel(stand.postedAt)
              : `${stand.author.name} · ${timeLabel(stand.postedAt)}`}
          </span>
        </div>
        {stand.mine && <span className="badge-mine">Yours</span>}
      </div>
      <ul className="stand-card-rests">
        {stand.slotTitles.map((title, index) => (
          <li key={index} title={title}>
            {title}
          </li>
        ))}
      </ul>
      <div className="stand-card-actions">
        {stand.mine ? (
          <span className="stamp-static" title="Stamps received">
            <span className="stamp-seal" aria-hidden>
              ✶
            </span>
            {stampCount}
          </span>
        ) : (
          <button
            className="btn stamp-btn"
            onClick={stamp}
            disabled={pending}
            aria-label="Stamp this stand"
          >
            <span className="stamp-seal" aria-hidden>
              ✶
            </span>
            {stampCount}
          </button>
        )}
        {stand.mine ? (
          <span className="stamp-static" title="Letters received">
            ✉ {stand.letterCount}
          </span>
        ) : (
          <Link className="btn" href={`/stand/${stand.id}`}>
            ✉ {stand.letterCount}
          </Link>
        )}
        <Link className="btn" href={`/stand/${stand.id}`}>
          Open stand
        </Link>
      </div>
    </article>
  );
}
