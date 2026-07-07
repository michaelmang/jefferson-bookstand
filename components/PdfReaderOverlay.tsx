"use client";

import { useEffect } from "react";

type Props = {
  title: string;
  url: string;
  onClose: () => void;
};

export default function PdfReaderOverlay({ title, url, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="reader-backdrop" onClick={onClose}>
      <div className="reader" onClick={(event) => event.stopPropagation()}>
        <div className="reader-header">
          <span className="reader-title">{title}</span>
          <button className="btn" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <iframe className="reader-frame" src={url} title={title} />
      </div>
    </div>
  );
}
