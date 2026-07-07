"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import BookRest from "./BookRest";
import type { SlotView } from "@/lib/slots";
import type { LensInfo } from "./MagnifierLens";
import { getWoodTexture } from "@/lib/woodTexture";
import { studyAudio } from "@/lib/audio";

const QUARTER = Math.PI / 2;
const TOP_SLOT = 4;
const DRAG_CLICK_THRESHOLD = 6;

// Détente physics, tuned by simulation: while spinning freely the stand coasts
// against light friction over a mild cogging spring; once slow it is captured
// by a stiff, near-critically-damped détente — like a weighted indexing head.
const K_FREE = 15;
const C_FREE = 1.8;
const K_CAPTURE = 45;
const C_CAPTURE = 11;
const V_CAPTURE = 2.2;
// Impulse that reliably carries the stand exactly one rest from settled.
const TURN_IMPULSE = 5.8;
const MAX_VELOCITY = 20;

export type BookstandControls = { turn: (direction: 1 | -1) => void };

type Props = {
  slots: SlotView[];
  activeIndex: number;
  onSlotClick: (index: number) => void;
  onInactiveClick: () => void;
  onActiveChange: (index: number) => void;
  controlsRef: { current: BookstandControls | null };
  magnify?: boolean;
  onMagnify?: (lens: LensInfo | null) => void;
  /** When false (read-only stands), empty rests are bare wood and inert. */
  editable?: boolean;
};

export default function Bookstand({
  slots,
  activeIndex,
  onSlotClick,
  onInactiveClick,
  onActiveChange,
  controlsRef,
  magnify = false,
  onMagnify,
  editable = true,
}: Props) {
  const spinner = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(0);
  const lastDetent = useRef(0);
  const reportedActive = useRef(0);

  const bodyWood = getWoodTexture("body");
  const trimWood = getWoodTexture("trim");
  const darkWood = getWoodTexture("dark");

  useEffect(() => {
    controlsRef.current = {
      turn: (direction) => {
        studyAudio.unlock();
        velocity.current = THREE.MathUtils.clamp(
          velocity.current - direction * TURN_IMPULSE,
          -MAX_VELOCITY,
          MAX_VELOCITY,
        );
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    studyAudio.unlock();
    dragging.current = true;
    moved.current = 0;
    velocity.current = 0;
    let lastX = event.clientX;
    let lastMoveAt = performance.now();
    const onMove = (moveEvent: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max((now - lastMoveAt) / 1000, 1e-3);
      const dx = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      lastMoveAt = now;
      moved.current += Math.abs(dx);
      const dSpin = dx * 0.008;
      spin.current += dSpin;
      // Smoothed release velocity estimate from recent pointer motion.
      velocity.current = 0.75 * velocity.current + 0.25 * (dSpin / dt);
    };
    const onUp = () => {
      dragging.current = false;
      // A pause before release means the hand stopped the stand: no fling.
      if (performance.now() - lastMoveAt > 120) velocity.current = 0;
      velocity.current = THREE.MathUtils.clamp(velocity.current, -MAX_VELOCITY, MAX_VELOCITY);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (!dragging.current) {
      const nearest = Math.round(spin.current / QUARTER) * QUARTER;
      const captured = Math.abs(velocity.current) < V_CAPTURE;
      const k = captured ? K_CAPTURE : K_FREE;
      const c = captured ? C_CAPTURE : C_FREE;
      velocity.current += -k * (spin.current - nearest) * dt;
      velocity.current *= Math.exp(-c * dt);
      spin.current += velocity.current * dt;
      if (Math.abs(velocity.current) < 0.05 && Math.abs(spin.current - nearest) < 0.005) {
        spin.current = nearest;
        velocity.current = 0;
      }
    }
    if (spinner.current) spinner.current.rotation.y = spin.current;

    // Each détente crossing is one rest clacking past: click + facing update.
    const detent = Math.round(spin.current / QUARTER);
    if (detent !== lastDetent.current) {
      lastDetent.current = detent;
      studyAudio.playDetentClick(Math.min(1, 0.35 + Math.abs(velocity.current) / 12));
    }
    const active = ((-detent % 4) + 4) % 4;
    if (active !== reportedActive.current) {
      reportedActive.current = active;
      onActiveChange(active);
    }
  });

  const handleSelect = (index: number) => {
    if (moved.current > DRAG_CLICK_THRESHOLD) return;
    // Can't read a paper while the stand is still turning.
    if (Math.abs(velocity.current) > 1) return;
    // A bare rest on a read-only stand is nothing to click.
    if (!slots[index] && !editable) return;
    if (index === TOP_SLOT || index === activeIndex) onSlotClick(index);
    else onInactiveClick();
  };

  return (
    <group>
      {/* Pedestal (fixed — the stand spins on top of it) */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[1.05, 1.18, 0.12, 48]} />
        <meshStandardMaterial map={darkWood} bumpMap={darkWood} bumpScale={0.15} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.42, 0.55, 0.14, 48]} />
        <meshStandardMaterial map={trimWood} bumpMap={trimWood} bumpScale={0.15} roughness={0.7} />
      </mesh>

      <group ref={spinner} onPointerDown={handlePointerDown}>
        {/* Spindle */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.11, 0.17, 0.85, 24]} />
          <meshStandardMaterial
            map={trimWood}
            bumpMap={trimWood}
            bumpScale={0.15}
            roughness={0.72}
          />
        </mesh>
        {/* Cube body */}
        <mesh position={[0, 1.75, 0]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial
            map={bodyWood}
            bumpMap={bodyWood}
            bumpScale={0.2}
            roughness={0.62}
          />
        </mesh>
        {/* Four side rests */}
        {[0, 1, 2, 3].map((index) => (
          <group key={index} rotation={[0, index * QUARTER, 0]}>
            <BookRest
              position={[0, 1.72, 1.15]}
              rotation={[-0.5, 0, 0]}
              title={slots[index]?.name ?? null}
              preview={slots[index]?.preview ?? null}
              loading={slots[index]?.previewPending ?? false}
              interactive={index === activeIndex && (editable || !!slots[index])}
              onSelect={() => handleSelect(index)}
              magnify={magnify}
              onMagnify={onMagnify}
              editable={editable}
            />
          </group>
        ))}
        {/* Top rest — readable from any angle */}
        <BookRest
          position={[0, 2.84, 0.05]}
          rotation={[-Math.PI / 2 + 0.35, 0, 0]}
          title={slots[TOP_SLOT]?.name ?? null}
          preview={slots[TOP_SLOT]?.preview ?? null}
          loading={slots[TOP_SLOT]?.previewPending ?? false}
          interactive={editable || !!slots[TOP_SLOT]}
          onSelect={() => handleSelect(TOP_SLOT)}
          magnify={magnify}
          onMagnify={onMagnify}
          editable={editable}
        />
      </group>
    </group>
  );
}
