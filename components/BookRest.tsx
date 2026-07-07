"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  createLoadingPaperTexture,
  createPaperTexture,
  textureFromCanvas,
} from "@/lib/paperTexture";
import { getWoodTexture } from "@/lib/woodTexture";
import type { LensInfo } from "./MagnifierLens";

type Props = {
  position: [number, number, number];
  rotation: [number, number, number];
  title: string | null;
  preview: HTMLCanvasElement | null;
  loading: boolean;
  interactive: boolean;
  onSelect: () => void;
  magnify?: boolean;
  onMagnify?: (lens: LensInfo | null) => void;
  /** When false (read-only stands), an empty rest is bare wood — no "Assign a PDF" cover. */
  editable?: boolean;
};

export default function BookRest({
  position,
  rotation,
  title,
  preview,
  loading,
  interactive,
  onSelect,
  magnify = false,
  onMagnify,
  editable = true,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const showPaper = Boolean(title) || editable;
  const texture = useMemo(() => {
    if (!showPaper) return null;
    if (preview) return textureFromCanvas(preview);
    if (loading && title) return createLoadingPaperTexture(title);
    return createPaperTexture(title);
  }, [showPaper, title, preview, loading]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    if (hovered && interactive) {
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = "auto";
      };
    }
  }, [hovered, interactive]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Backing board */}
      <mesh>
        <boxGeometry args={[1.35, 1.6, 0.06]} />
        <meshStandardMaterial
          map={getWoodTexture("board")}
          bumpMap={getWoodTexture("board")}
          bumpScale={0.2}
          roughness={0.68}
        />
      </mesh>
      {/* Ledge the paper rests on */}
      <mesh position={[0, -0.83, 0.06]}>
        <boxGeometry args={[1.35, 0.09, 0.16]} />
        <meshStandardMaterial
          map={getWoodTexture("trim")}
          bumpMap={getWoodTexture("trim")}
          bumpScale={0.15}
          roughness={0.68}
        />
      </mesh>
      {/* The paper itself */}
      {showPaper && (
        <mesh
          position={[0, -0.05, 0.034]}
          onPointerMove={
            magnify && interactive && preview && onMagnify
              ? (event) => {
                  if (!event.uv) return;
                  event.stopPropagation();
                  onMagnify({
                    u: event.uv.x,
                    v: event.uv.y,
                    x: event.nativeEvent.clientX,
                    y: event.nativeEvent.clientY,
                    canvas: preview,
                  });
                }
              : undefined
          }
          onPointerOut={magnify && onMagnify ? () => onMagnify(null) : undefined}
        >
          <planeGeometry args={[1.0, 1.32]} />
          <meshStandardMaterial
            map={texture}
            color={interactive ? "#ffffff" : "#b8b0a0"}
            emissive={hovered && interactive ? "#8a6d1d" : "#000000"}
            emissiveIntensity={0.25}
            roughness={0.9}
          />
        </mesh>
      )}
    </group>
  );
}
