"use client";
import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Mesh, Vector3 } from "three";

type TyreDiagram3DProps = {
  positions: string[];
  sizes: Record<string, string>;
  selected: string | null;
  onSelect: (pos: string) => void;
};

// ─────────────────────── Layout helpers ───────────────────────

const baseRow = (pos: string): string => {
  if (pos === "SPARE") return "SPARE";
  if (pos.startsWith("FL") || pos.startsWith("FR") || pos === "F") return "F";
  if (pos.startsWith("ML") || pos.startsWith("MR") || pos === "M") return "M";
  if (pos.startsWith("RL") || pos.startsWith("RR") || pos === "R") return "R";
  return pos;
};
const sideOf = (pos: string): "L" | "R" | "C" => {
  if (pos.includes("L") && pos !== "F" && pos !== "M") return "L";
  if (pos.includes("R") && pos !== "F" && pos !== "M") return "R";
  return "C";
};
const axleOrder = ["F", "FL", "FR", "M", "ML", "MR", "R", "RL", "RR"];

type TyreLayout = { pos: string; x: number; z: number };

function computeLayout(positions: string[]) {
  const drivable = positions.filter((p) => p !== "SPARE");
  const grouped = new Map<string, string[]>();
  for (const p of drivable) {
    const row = baseRow(p);
    if (!grouped.has(row)) grouped.set(row, []);
    grouped.get(row)!.push(p);
  }
  const rows = Array.from(grouped.entries()).sort(
    (a, b) => axleOrder.indexOf(a[0]) - axleOrder.indexOf(b[0]),
  );

  // Wider spacing per tyre count so labels don't collide.
  const drivableCount = drivable.length;
  const axleSpacing = drivableCount >= 10 ? 2.4 : drivableCount >= 6 ? 2.0 : 2.2;
  const sideOffset = 1.35;
  const innerOffset = 0.42;

  const tyres: TyreLayout[] = [];
  const axleZs: number[] = [];
  const startZ = -((rows.length - 1) * axleSpacing) / 2;

  rows.forEach(([, posList], idx) => {
    const z = startZ + idx * axleSpacing;
    axleZs.push(z);
    const left = posList.filter((p) => sideOf(p) === "L");
    const right = posList.filter((p) => sideOf(p) === "R");
    left.forEach((p, i) => {
      const offset = (i - (left.length - 1) / 2) * innerOffset * 2;
      tyres.push({ pos: p, x: -sideOffset - offset, z });
    });
    right.forEach((p, i) => {
      const offset = (i - (right.length - 1) / 2) * innerOffset * 2;
      tyres.push({ pos: p, x: sideOffset + offset, z });
    });
  });

  const bodyLength = (rows.length - 1) * axleSpacing + 2.4;
  return { tyres, axleZs, bodyLength, drivableCount };
}

// ─────────────────────── Single tyre ───────────────────────

function Tyre({
  pos,
  x,
  z,
  size = 0.5,
  selected,
  hasSize,
  sizeValue,
  onClick,
}: {
  pos: string;
  x: number;
  z: number;
  size?: number;
  selected: boolean;
  hasSize: boolean;
  sizeValue?: string;
  onClick: () => void;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (selected) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.05;
      meshRef.current.scale.set(s, 1, s);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  const tyreColor = "#1a1a1a";
  const rimColor = selected ? "#facc15" : hasSize ? "#10b981" : "#9ca3af";

  return (
    <group position={[x, size, z]}>
      {/* Outer rubber */}
      <mesh
        ref={meshRef}
        rotation={[0, 0, Math.PI / 2]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
        castShadow
      >
        <cylinderGeometry args={[size, size, size * 0.7, 32]} />
        <meshStandardMaterial color={tyreColor} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Rim — colored to indicate state */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[size * 0.5, size * 0.5, size * 0.72, 24]} />
        <meshStandardMaterial color={rimColor} roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Hub cap */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[size * 0.18, size * 0.18, size * 0.74, 16]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Floating label — shows position code and the entered tyre size when present */}
      <Html
        position={[0, size + 0.55, 0]}
        center
        distanceFactor={9}
        zIndexRange={[1, 0]}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`pointer-events-auto cursor-pointer rounded-md px-1.5 py-0.5 text-center whitespace-nowrap select-none shadow-md ${
            selected
              ? "bg-yellow-500 text-white ring-2 ring-yellow-300"
              : hasSize
                ? "bg-emerald-500 text-white"
                : "bg-gray-800/90 text-white"
          }`}
        >
          <div className="text-[9px] font-bold leading-tight">{pos}</div>
          {hasSize && sizeValue && (
            <div className="text-[8px] font-mono leading-tight opacity-95 mt-0.5">{sizeValue}</div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ─────────────────────── Vehicle bodies (per type) ───────────────────────

const PAINT = "#fbbf24";
const PAINT_DARK = "#f59e0b";
const GLASS = "#1e3a8a";
const GLASS_LIGHT = "#3b82f6";
const HEADLIGHT = "#fef3c7";
const TAILLIGHT = "#dc2626";
const TYRE_DARK = "#1f2937";

/** Sedan / SUV — 4 tyres */
function CarBody({ length }: { length: number }) {
  const wheelClearance = 0.5;
  return (
    <group position={[0, wheelClearance + 0.05, 0]}>
      {/* Lower chassis */}
      <RoundedBox args={[2.0, 0.55, length]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={PAINT} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Hood (front-z) */}
      <RoundedBox args={[1.95, 0.25, length * 0.32]} radius={0.08} smoothness={4} position={[0, 0.4, -length * 0.30]} castShadow>
        <meshStandardMaterial color={PAINT} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Cabin */}
      <RoundedBox args={[1.85, 0.7, length * 0.45]} radius={0.18} smoothness={4} position={[0, 0.6, 0.05]} castShadow>
        <meshStandardMaterial color={PAINT_DARK} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Trunk */}
      <RoundedBox args={[1.95, 0.25, length * 0.32]} radius={0.08} smoothness={4} position={[0, 0.4, length * 0.30]} castShadow>
        <meshStandardMaterial color={PAINT} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Windshield (front, slanted) */}
      <mesh position={[0, 0.7, -length * 0.18]} rotation={[Math.PI / 2.6, 0, 0]}>
        <planeGeometry args={[1.7, 0.55]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.85} metalness={0.6} roughness={0.1} />
      </mesh>
      {/* Rear window */}
      <mesh position={[0, 0.7, length * 0.18]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <planeGeometry args={[1.7, 0.55]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.85} metalness={0.6} roughness={0.1} />
      </mesh>
      {/* Side windows (left/right) */}
      <mesh position={[-0.93, 0.7, 0.05]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length * 0.4, 0.4]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.93, 0.7, 0.05]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length * 0.4, 0.4]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.65, 0.05, -length / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.18, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.65, 0.05, -length / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.18, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.65, 0.05, length / 2 + 0.01]}>
        <boxGeometry args={[0.4, 0.18, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.65, 0.05, length / 2 + 0.01]}>
        <boxGeometry args={[0.4, 0.18, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Pickup / LCV — 6 tyres */
function PickupBody({ length }: { length: number }) {
  const cabinLen = length * 0.45;
  const bedLen = length * 0.55;
  return (
    <group position={[0, 0.55, 0]}>
      {/* Chassis */}
      <RoundedBox args={[2.1, 0.5, length]} radius={0.1} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={PAINT} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Cabin (front half) */}
      <RoundedBox args={[2.0, 0.95, cabinLen]} radius={0.12} smoothness={4} position={[0, 0.7, -bedLen / 2 + cabinLen / 2 - length / 2 + cabinLen / 2]} castShadow>
        <meshStandardMaterial color={PAINT_DARK} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Cargo bed walls */}
      <RoundedBox args={[2.0, 0.55, bedLen - 0.1]} radius={0.06} smoothness={3} position={[0, 0.5, length / 2 - bedLen / 2]} castShadow>
        <meshStandardMaterial color={PAINT} roughness={0.45} metalness={0.4} />
      </RoundedBox>
      {/* Bed inner (darker, recessed) */}
      <mesh position={[0, 0.7, length / 2 - bedLen / 2]}>
        <boxGeometry args={[1.7, 0.05, bedLen - 0.4]} />
        <meshStandardMaterial color={TYRE_DARK} roughness={0.9} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 1.05, -length / 2 + cabinLen - 0.05]} rotation={[Math.PI / 2.4, 0, 0]}>
        <planeGeometry args={[1.7, 0.6]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.85} metalness={0.6} roughness={0.1} />
      </mesh>
      {/* Side windows */}
      <mesh position={[-1.01, 0.95, -length / 2 + cabinLen / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.7, 0.5]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      <mesh position={[1.01, 0.95, -length / 2 + cabinLen / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.7, 0.5]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.7, 0, -length / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.2, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.7, 0, -length / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.2, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.85, 0.4, length / 2 + 0.01]}>
        <boxGeometry args={[0.25, 0.5, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.85, 0.4, length / 2 + 0.01]}>
        <boxGeometry args={[0.25, 0.5, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Box truck / Mini truck — 8 tyres */
function BoxTruckBody({ length }: { length: number }) {
  const cabinLen = Math.min(2.0, length * 0.32);
  const cargoLen = length - cabinLen - 0.05;
  const cabinZ = -length / 2 + cabinLen / 2;
  const cargoZ = -length / 2 + cabinLen + cargoLen / 2;
  return (
    <group position={[0, 0.55, 0]}>
      {/* Chassis */}
      <RoundedBox args={[2.1, 0.45, length]} radius={0.08} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={TYRE_DARK} roughness={0.6} />
      </RoundedBox>
      {/* Cabin */}
      <RoundedBox args={[2.0, 1.1, cabinLen]} radius={0.14} smoothness={4} position={[0, 0.8, cabinZ]} castShadow>
        <meshStandardMaterial color={PAINT_DARK} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Cargo box */}
      <RoundedBox args={[2.05, 1.5, cargoLen]} radius={0.06} smoothness={3} position={[0, 1.0, cargoZ]} castShadow>
        <meshStandardMaterial color={PAINT} roughness={0.45} metalness={0.3} />
      </RoundedBox>
      {/* Cargo door lines */}
      <mesh position={[0, 1.0, length / 2 + 0.001]}>
        <planeGeometry args={[1.95, 1.4]} />
        <meshStandardMaterial color={PAINT_DARK} roughness={0.7} />
      </mesh>
      <mesh position={[-0.03, 1.0, length / 2 + 0.002]}>
        <boxGeometry args={[0.04, 1.3, 0.005]} />
        <meshStandardMaterial color={TYRE_DARK} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 1.2, cabinZ - cabinLen / 2 + 0.05]} rotation={[Math.PI / 2.3, 0, 0]}>
        <planeGeometry args={[1.75, 0.7]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.85} metalness={0.6} roughness={0.1} />
      </mesh>
      {/* Side windows */}
      <mesh position={[-1.01, 1.05, cabinZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.7, 0.5]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      <mesh position={[1.01, 1.05, cabinZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.7, 0.5]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.7, 0.3, -length / 2 - 0.01]}>
        <boxGeometry args={[0.35, 0.22, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.7, 0.3, -length / 2 - 0.01]}>
        <boxGeometry args={[0.35, 0.22, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** Heavy truck / Bus — 10+ tyres */
function HeavyTruckBody({ length }: { length: number }) {
  const cabinLen = 2.2;
  const cargoLen = length - cabinLen - 0.1;
  const cabinZ = -length / 2 + cabinLen / 2;
  const cargoZ = -length / 2 + cabinLen + 0.05 + cargoLen / 2;
  return (
    <group position={[0, 0.6, 0]}>
      {/* Chassis */}
      <RoundedBox args={[2.2, 0.4, length]} radius={0.06} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color={TYRE_DARK} roughness={0.7} />
      </RoundedBox>
      {/* Cabin (taller, more imposing) */}
      <RoundedBox args={[2.15, 1.6, cabinLen]} radius={0.16} smoothness={4} position={[0, 1.0, cabinZ]} castShadow>
        <meshStandardMaterial color={PAINT_DARK} roughness={0.35} metalness={0.5} />
      </RoundedBox>
      {/* Cargo container */}
      <RoundedBox args={[2.2, 1.9, cargoLen]} radius={0.05} smoothness={3} position={[0, 1.15, cargoZ]} castShadow>
        <meshStandardMaterial color={PAINT} roughness={0.5} metalness={0.25} />
      </RoundedBox>
      {/* Container ribs */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 1.15, cargoZ - cargoLen / 2 + (cargoLen / 5) * (i + 0.5)]}>
          <boxGeometry args={[2.21, 1.85, 0.04]} />
          <meshStandardMaterial color={PAINT_DARK} roughness={0.6} />
        </mesh>
      ))}
      {/* Windshield (large, vertical-ish) */}
      <mesh position={[0, 1.45, cabinZ - cabinLen / 2 + 0.04]} rotation={[Math.PI / 2.15, 0, 0]}>
        <planeGeometry args={[1.9, 0.95]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.85} metalness={0.6} roughness={0.1} />
      </mesh>
      {/* Side windows */}
      <mesh position={[-1.08, 1.3, cabinZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.65, 0.65]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      <mesh position={[1.08, 1.3, cabinZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[cabinLen * 0.65, 0.65]} />
        <meshStandardMaterial color={GLASS_LIGHT} transparent opacity={0.6} />
      </mesh>
      {/* Grille */}
      <mesh position={[0, 0.5, -length / 2 - 0.01]}>
        <boxGeometry args={[1.6, 0.5, 0.02]} />
        <meshStandardMaterial color={TYRE_DARK} roughness={0.9} />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.85, 0.85, -length / 2 - 0.01]}>
        <boxGeometry args={[0.35, 0.22, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.85, 0.85, -length / 2 - 0.01]}>
        <boxGeometry args={[0.35, 0.22, 0.02]} />
        <meshStandardMaterial color={HEADLIGHT} emissive={HEADLIGHT} emissiveIntensity={0.5} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.95, 0.5, length / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.4, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.95, 0.5, length / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.4, 0.02]} />
        <meshStandardMaterial color={TAILLIGHT} emissive={TAILLIGHT} emissiveIntensity={0.5} />
      </mesh>
      {/* Side mirrors */}
      <mesh position={[-1.2, 1.4, cabinZ - cabinLen / 2 + 0.3]}>
        <boxGeometry args={[0.18, 0.3, 0.12]} />
        <meshStandardMaterial color={PAINT_DARK} roughness={0.5} />
      </mesh>
      <mesh position={[1.2, 1.4, cabinZ - cabinLen / 2 + 0.3]}>
        <boxGeometry args={[0.18, 0.3, 0.12]} />
        <meshStandardMaterial color={PAINT_DARK} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ─────────────────────── Camera rig ───────────────────────
// When the selected tyre changes, smoothly orbit the camera so that tyre
// faces the viewer. After the short transition completes, OrbitControls is
// fully manual again until the next selection change.
function CameraRig({
  tyres,
  selected,
}: {
  tyres: TyreLayout[];
  selected: string | null;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const transitioningUntil = useRef(0);
  const targetCam = useRef(new Vector3());
  const targetLook = useRef(new Vector3());

  useEffect(() => {
    if (!selected) return;
    const t = tyres.find((x) => x.pos === selected);
    if (!t) return;
    const len = Math.sqrt(t.x * t.x + t.z * t.z) || 1;
    const distance = 7.5;
    // Camera placed in the same direction as the tyre, at a fixed orbit radius
    targetCam.current.set((t.x / len) * distance, 3.5, (t.z / len) * distance);
    // Look at the tyre itself (slight elevation so wheel + label both fit)
    targetLook.current.set(t.x, 0.6, t.z);
    transitioningUntil.current = Date.now() + 900;
  }, [selected, tyres]);

  useFrame(() => {
    if (Date.now() > transitioningUntil.current) return;
    if (!controlsRef.current) return;
    controlsRef.current.target.lerp(targetLook.current, 0.09);
    camera.position.lerp(targetCam.current, 0.09);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={5}
      maxDistance={18}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function VehicleBody({ tyreCount, length }: { tyreCount: number; length: number }) {
  if (tyreCount <= 4) return <CarBody length={length} />;
  if (tyreCount <= 6) return <PickupBody length={length} />;
  if (tyreCount <= 7) return <BoxTruckBody length={length} />;
  return <HeavyTruckBody length={length} />;
}

// ─────────────────────── Scene ───────────────────────

function Scene({ positions, sizes, selected, onSelect }: TyreDiagram3DProps) {
  const layout = useMemo(() => computeLayout(positions), [positions]);
  const spare = positions.includes("SPARE") ? "SPARE" : null;

  // Bigger tyres for heavier vehicles for visual realism
  const tyreSize =
    layout.drivableCount >= 10 ? 0.55 :
    layout.drivableCount >= 6 ? 0.5 : 0.42;

  return (
    <>
      {/* Sky-style ambient + sun */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#e5e7eb" roughness={1} />
      </mesh>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.45}
        scale={12}
        blur={2.4}
        far={6}
      />

      <VehicleBody tyreCount={layout.drivableCount} length={layout.bodyLength} />

      {/* Axle rods */}
      {layout.axleZs.map((z) => (
        <mesh key={z} position={[0, tyreSize, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 2.7, 12]} />
          <meshStandardMaterial color="#374151" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}

      {/* Tyres */}
      {layout.tyres.map((t) => (
        <Tyre
          key={t.pos}
          pos={t.pos}
          x={t.x}
          z={t.z}
          size={tyreSize}
          selected={selected === t.pos}
          hasSize={!!(sizes[t.pos] && sizes[t.pos].trim())}
          sizeValue={sizes[t.pos]}
          onClick={() => onSelect(t.pos)}
        />
      ))}

      {/* Spare — beside the rear */}
      {spare && (
        <Tyre
          pos="SPARE"
          x={3.0}
          z={layout.bodyLength / 2 - 0.4}
          size={tyreSize}
          selected={selected === "SPARE"}
          hasSize={!!(sizes["SPARE"] && sizes["SPARE"].trim())}
          sizeValue={sizes["SPARE"]}
          onClick={() => onSelect("SPARE")}
        />
      )}

      <CameraRig
        tyres={spare ? [...layout.tyres, { pos: "SPARE", x: 3.0, z: layout.bodyLength / 2 - 0.4 }] : layout.tyres}
        selected={selected}
      />
    </>
  );
}

// ─────────────────────── Public component ───────────────────────

export default function TyreDiagram3D(props: TyreDiagram3DProps) {
  const drivable = props.positions.filter((p) => p !== "SPARE").length;
  const vehicleLabel =
    drivable <= 4 ? "Car / SUV" :
    drivable <= 6 ? "Pickup / LCV" :
    drivable <= 7 ? "Box Truck" :
    "Heavy Truck";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{vehicleLabel}</span>
        <span className="text-[10px] text-gray-400">Click a tyre · drag to rotate · scroll to zoom</span>
      </div>
      <div style={{ height: 380 }} className="bg-gradient-to-b from-sky-100 via-sky-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Canvas
          camera={{ position: [5, 4, 7], fov: 42 }}
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <Scene {...props} />
        </Canvas>
      </div>
    </div>
  );
}
