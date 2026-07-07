"use client";

import { Canvas } from "@react-three/fiber";
import Bookstand, { type BookstandControls } from "./Bookstand";
import type { SlotView } from "@/lib/slots";
import type { LensInfo } from "./MagnifierLens";

type Props = {
  slots: SlotView[];
  activeIndex: number;
  onSlotClick: (index: number) => void;
  onInactiveClick: () => void;
  onActiveChange: (index: number) => void;
  controlsRef: { current: BookstandControls | null };
  magnify?: boolean;
  onMagnify?: (lens: LensInfo | null) => void;
  editable?: boolean;
};

export default function BookstandScene(props: Props) {
  return (
    <div className="scene">
      <Canvas
        camera={{ position: [0, 2.7, 6.2], fov: 40 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.6, 0)}
        style={{ touchAction: "none" }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 8, 5]} intensity={1.7} />
        <directionalLight position={[-6, 4, -3]} intensity={0.35} />
        <Bookstand {...props} />
      </Canvas>
    </div>
  );
}
