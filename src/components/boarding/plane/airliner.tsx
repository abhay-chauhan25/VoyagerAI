"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { damping } from "@/lib/boarding/flight";
import { hullPoint } from "@/lib/boarding/hull";
import { PLANE_SECTION_IDS, type PlaneSectionId, type Vec3 } from "@/lib/boarding/sections";
import { HUES, type Hue } from "@/lib/hues";
import { hullPatch, liveryTexture, loft, revolve, type Rib } from "./geometry";

const TURN = Math.PI * 2;
const ROOF = -Math.PI / 2;
/** Where the hull is cut into the three parts a traveller can step into. */
const GALLEY_END = -5.2;
const CABIN_END = 11.6;
const NOSE_TIP = 18.495;
const TAIL_TIP = -19;

const WINDOW_ANGLE = -0.2;
const WINDOW_PITCH = 0.56;

const PAINT = "#f3efe6";
const DUSK = "#16233f";
const BRASS = "#c99a3c";

const WING_RIBS: readonly Rib[] = [
  { le: [4.2, -1.15, 0.6], chord: 8.2, thick: 0.14, up: [0, 1, 0] },
  { le: [3.2, -1.05, 2.0], chord: 7.4, thick: 0.135, up: [0, 1, 0] },
  { le: [0.6, -0.72, 6.2], chord: 4.4, thick: 0.12, up: [0, 1, 0] },
  { le: [-5.6, 0.15, 16.6], chord: 1.9, thick: 0.1, up: [0, 1, 0] },
  { le: [-6.3, 0.55, 17.25], chord: 1.5, thick: 0.1, up: [0, 0.75, -0.66] },
  { le: [-7.3, 2.3, 17.75], chord: 0.85, thick: 0.09, up: [0, 0.25, -0.97] },
  { le: [-7.55, 2.6, 17.78], chord: 0.35, thick: 0.05, up: [0, 0.25, -0.97] },
];
const STABILISER_RIBS: readonly Rib[] = [
  { le: [-12.8, 0.9, 0.2], chord: 4.4, thick: 0.1, up: [0, 1, 0] },
  { le: [-16.6, 1.45, 6.6], chord: 1.6, thick: 0.09, up: [0, 1, 0] },
  { le: [-16.9, 1.48, 6.85], chord: 0.8, thick: 0.05, up: [0, 1, 0] },
];
const FIN_RIBS: readonly Rib[] = [
  { le: [-9.2, 1.4, 0], chord: 7.6, thick: 0.1, up: [0, 0, -1] },
  { le: [-11.2, 3.0, 0], chord: 5.6, thick: 0.1, up: [0, 0, -1] },
  { le: [-16.0, 8.9, 0], chord: 2.5, thick: 0.09, up: [0, 0, -1] },
  { le: [-16.35, 9.2, 0], chord: 1.6, thick: 0.05, up: [0, 0, -1] },
];

const ENGINE: Vec3 = [-0.6, -2.55, 5.7];
const NACELLE_PROFILE = [
  [0, 0.62],
  [0.5, 0.82],
  [1.6, 1.08],
  [3.0, 1.2],
  [4.2, 1.16],
  [4.7, 1.02],
  [4.8, 0.93],
  [4.7, 0.86],
  [4.1, 0.88],
] as const;
const EXHAUST_PROFILE = [
  [-1.3, 0.04],
  [0, 0.44],
  [0.4, 0.5],
] as const;
const FAN_STATION = 4.1;
const FAN_SPIN = 9;

/** A window's place and facing on the skin, as a matrix for an instanced mesh. */
function windowMatrix(x: number, angle: number): THREE.Matrix4 {
  const normal = new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle));
  const along = new THREE.Vector3(1, 0, 0);
  const up = normal.clone().cross(along);
  const p = hullPoint(x, angle, 0.014);
  return new THREE.Matrix4()
    .makeBasis(along, up, normal)
    .scale(new THREE.Vector3(0.15, 0.21, 1))
    .setPosition(p[0], p[1], p[2]);
}

function windowMatrices(from: number, to: number): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  for (let x = from; x <= to; x += WINDOW_PITCH) {
    matrices.push(windowMatrix(x, WINDOW_ANGLE), windowMatrix(x, Math.PI - WINDOW_ANGLE));
  }
  return matrices;
}

function Instances({
  matrices,
  geometry,
  material,
  colours,
}: {
  matrices: readonly THREE.Matrix4[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  colours?: readonly THREE.Color[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    colours?.forEach((colour, i) => mesh.setColorAt(i, colour));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colours]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} />;
}

/** The fan seen through the intake: blades painted on a disc, which is then spun. */
function fanTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#0b0d12";
    context.fillRect(0, 0, size, size);
    context.translate(size / 2, size / 2);
    const blades = 22;
    for (let i = 0; i < blades; i++) {
      context.rotate(TURN / blades);
      context.fillStyle = i % 2 ? "#3a3f4a" : "#2a2e37";
      context.beginPath();
      context.moveTo(0, 0);
      context.quadraticCurveTo(size * 0.2, size * 0.1, size * 0.47, size * 0.02);
      context.lineTo(size * 0.47, size * 0.1);
      context.quadraticCurveTo(size * 0.2, size * 0.2, 0, 0);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Props = {
  /** The part being pointed at, if any. */
  active: PlaneSectionId | null;
  /** The resolved colour of each travel hue in the current theme. */
  hues: Record<Hue, string>;
  /** True after dark: the cabin lights are on. */
  night: boolean;
  /** False under reduced motion: no bobbing, no spinning. */
  moving: boolean;
  onHover?: (id: PlaneSectionId | null) => void;
  onPick?: (id: PlaneSectionId) => void;
};

/** How far a pointer may travel between press and release and still count as a click. */
const CLICK_SLOP = 6;

/**
 * The aircraft, built from its shape rather than loaded from a file. Each part a traveller can
 * step into is its own piece: pointing at it turns that stretch of skin to glass and brings up the
 * lights inside.
 */
export function Airliner({ active, hues, night, moving, onHover, onPick }: Props) {
  const body = useRef<THREE.Group>(null);
  const fans = useRef<THREE.Mesh[]>([]);
  const interiors = useRef<Partial<Record<PlaneSectionId, THREE.Group | null>>>({});
  const levels = useRef<Record<PlaneSectionId, number>>({
    cockpit: 0,
    cabin: 0,
    galley: 0,
    wing: 0,
    fin: 0,
    hold: 0,
  });

  const shapes = useMemo(() => {
    const tube = (from: number, to: number, along: number) =>
      hullPatch(from, to, 0, TURN, { along, around: 56 });
    const side = (from: number, to: number, a0: number, a1: number, offset: number, along = 24) => [
      hullPatch(from, to, a0, a1, { offset, along, around: 6 }),
      hullPatch(from, to, Math.PI - a1, Math.PI - a0, { offset, along, around: 6 }),
    ];
    return {
      cockpit: tube(CABIN_END, NOSE_TIP, 44),
      cabin: tube(GALLEY_END, CABIN_END, 10),
      galley: tube(TAIL_TIP, GALLEY_END, 40),
      belly: hullPatch(-18.4, 16.4, 0.44, Math.PI - 0.44, { offset: 0.012, along: 70, around: 20 }),
      cheatline: side(-17.4, 15.8, 0.3, 0.37, 0.016, 70),
      dashes: HUES.map((_, i) => side(-7 - i * 1.15, -6.15 - i * 1.15, -0.02, 0.17, 0.016, 4)),
      doors: [
        ...side(12.1, 12.95, -0.62, 0.22, 0.006, 4),
        ...side(-9.9, -9.05, -0.62, 0.22, 0.006, 4),
      ],
      hold: side(7.4, 9.5, 0.52, 0.98, 0.022, 8),
      windscreen: hullPatch(0, 0, -Math.PI + 0.42, -0.42, {
        offset: 0.012,
        along: 10,
        around: 40,
        // Deep at the sides, shallow over the brow, like a visor.
        span: (across) => {
          const brow = Math.sin(Math.PI * across) ** 1.4;
          return [15.3 + 1.1 * brow, 17.0 + 0.15 * brow];
        },
      }),
      posts: [-0.72, 0, 0.72].map((lean) =>
        hullPatch(15.3, 17.2, ROOF + lean - 0.028, ROOF + lean + 0.028, {
          offset: 0.02,
          along: 8,
          around: 2,
        }),
      ),
      wing: loft(WING_RIBS, { half: 14 }),
      stabiliser: loft(STABILISER_RIBS),
      fin: loft(FIN_RIBS, { under: 1 }),
      nacelle: revolve(NACELLE_PROFILE),
      exhaust: revolve(EXHAUST_PROFILE, 24),
      fan: new THREE.CircleGeometry(0.9, 40),
      spinner: new THREE.ConeGeometry(0.26, 0.7, 24),
      pane: new THREE.CircleGeometry(1, 14),
      seat: new THREE.BoxGeometry(0.5, 0.78, 0.4),
      box: new THREE.BoxGeometry(1, 1, 1),
      lamp: new THREE.SphereGeometry(0.11, 12, 8),
      fairing: new THREE.SphereGeometry(1, 28, 16),
    };
  }, []);

  const materials = useMemo(() => {
    const paint = () =>
      new THREE.MeshPhysicalMaterial({
        color: PAINT,
        roughness: 0.3,
        metalness: 0.04,
        clearcoat: 0.85,
        clearcoatRoughness: 0.22,
      });
    const glow = (colour: string, base = 0, body = "#fff4dc") =>
      new THREE.MeshStandardMaterial({
        color: body,
        emissive: colour,
        emissiveIntensity: base,
        roughness: 0.4,
      });
    return {
      hull: { cockpit: paint(), cabin: paint(), galley: paint() },
      trim: new THREE.MeshPhysicalMaterial({ color: PAINT, roughness: 0.3, clearcoat: 0.85 }),
      door: new THREE.MeshPhysicalMaterial({ color: "#ebe6dc", roughness: 0.34, clearcoat: 0.6 }),
      dusk: new THREE.MeshPhysicalMaterial({
        color: DUSK,
        roughness: 0.3,
        metalness: 0.25,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
      }),
      brass: new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.3, metalness: 0.85 }),
      wing: new THREE.MeshPhysicalMaterial({
        color: "#dedcd6",
        roughness: 0.34,
        metalness: 0.4,
        clearcoat: 0.5,
        emissive: hues.vermilion,
        emissiveIntensity: 0,
      }),
      tailplane: new THREE.MeshPhysicalMaterial({
        color: "#dedcd6",
        roughness: 0.34,
        metalness: 0.4,
        clearcoat: 0.5,
      }),
      fin: (() => {
        const livery = liveryTexture(
          DUSK,
          HUES.map((hue) => hues[hue]),
        );
        return new THREE.MeshPhysicalMaterial({
          map: livery,
          roughness: 0.32,
          metalness: 0.15,
          clearcoat: 0.8,
          // The paint lights itself when pointed at, so the stripes keep their colours.
          emissive: "#ffffff",
          emissiveMap: livery,
          emissiveIntensity: 0,
        });
      })(),
      hold: new THREE.MeshPhysicalMaterial({
        color: "#31436f",
        roughness: 0.32,
        metalness: 0.3,
        clearcoat: 0.7,
        emissive: hues.saffron,
        emissiveIntensity: 0,
      }),
      nacelle: new THREE.MeshPhysicalMaterial({
        color: DUSK,
        roughness: 0.28,
        metalness: 0.3,
        clearcoat: 0.8,
        side: THREE.DoubleSide,
      }),
      steel: new THREE.MeshStandardMaterial({ color: "#aeb2b9", roughness: 0.24, metalness: 0.95 }),
      fan: new THREE.MeshBasicMaterial({ map: fanTexture() }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#0b1322",
        roughness: 0.05,
        metalness: 0.9,
        envMapIntensity: 1.7,
        emissive: hues.cobalt,
        emissiveIntensity: 0,
      }),
      panes: { cabin: glow("#ffcf87", 0, "#1b2437"), galley: glow("#ffcf87", 0, "#1b2437") },
      floor: new THREE.MeshStandardMaterial({ color: "#bfae90", roughness: 0.8 }),
      seat: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
      strips: {
        cockpit: glow(hues.cobalt),
        cabin: glow("#ffd9a0"),
        galley: glow(hues.rose),
      },
      port: new THREE.MeshBasicMaterial({ color: "#ff3b30" }),
      starboard: new THREE.MeshBasicMaterial({ color: "#34d17a" }),
      beacon: new THREE.MeshBasicMaterial({ color: "#ff3b30" }),
    };
  }, [hues]);

  useEffect(() => {
    return () => {
      const dispose = (thing: unknown) => {
        if (thing instanceof THREE.BufferGeometry) thing.dispose();
        else if (thing instanceof THREE.Material) {
          for (const value of Object.values(thing)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          thing.dispose();
        } else if (Array.isArray(thing)) thing.forEach(dispose);
        else if (thing && typeof thing === "object") Object.values(thing).forEach(dispose);
      };
      dispose(shapes);
      dispose(materials);
    };
  }, [shapes, materials]);

  const fittings = useMemo(() => {
    const seats: THREE.Matrix4[] = [];
    const seatColours: THREE.Color[] = [];
    const crew = [hues.sea, hues.vermilion, hues.saffron, hues.rose, hues.cobalt, hues.moss];
    let seatIndex = 0;
    for (let x = -4.4; x <= 10.6; x += 0.86) {
      for (const z of [-1.38, -0.93, -0.48, 0.48, 0.93, 1.38]) {
        seats.push(new THREE.Matrix4().setPosition(x, -0.32, z));
        // A few seats are taken: the crew, each in their own colour.
        const taken = seatIndex % 11 === 3;
        seatColours.push(
          new THREE.Color(taken ? crew[((seatIndex / 11) % crew.length) | 0]! : "#27365c"),
        );
        seatIndex++;
      }
    }
    return {
      seats,
      seatColours,
      cabinPanes: windowMatrices(-4.5, 11),
      galleyPanes: windowMatrices(-8.6, -6),
    };
  }, [hues]);

  useFrame((state, delta) => {
    const ease = damping(9, delta);
    for (const id of PLANE_SECTION_IDS) {
      const goal = active === id ? 1 : 0;
      levels.current[id] += (goal - levels.current[id]) * ease;
    }
    const level = levels.current;

    for (const id of ["cockpit", "cabin", "galley"] as const) {
      const skin = materials.hull[id];
      const open = level[id] > 0.01;
      if (skin.transparent !== open) {
        skin.transparent = open;
        skin.depthWrite = !open;
        skin.needsUpdate = true;
      }
      skin.opacity = 1 - 0.8 * level[id];
      materials.strips[id].emissiveIntensity = 0.4 + 2.2 * level[id];
      const interior = interiors.current[id];
      if (interior) interior.visible = open;
    }
    const lit = night ? 1.6 : 0;
    materials.panes.cabin.emissiveIntensity = lit + 2.4 * level.cabin;
    materials.panes.galley.emissiveIntensity = lit + 2.4 * level.galley;
    materials.glass.emissiveIntensity = 0.9 * level.cockpit;
    materials.wing.emissiveIntensity = 0.42 * level.wing;
    materials.fin.emissiveIntensity = 0.9 * level.fin;
    materials.hold.emissiveIntensity = 1.1 * level.hold;

    const t = state.clock.elapsedTime;
    // Anti-collision beacon: a short flash once a second.
    materials.beacon.opacity = t % 1.1 < 0.12 ? 1 : 0.08;
    if (!moving) return;
    for (const fan of fans.current) fan.rotation.x -= FAN_SPIN * delta;
    if (body.current) {
      body.current.position.y = Math.sin(t * 0.55) * 0.22;
      body.current.rotation.x = Math.sin(t * 0.4) * 0.018;
      body.current.rotation.z = Math.sin(t * 0.31 + 1) * 0.012;
    }
  });

  /** Pointer handlers for a part the traveller can step into. */
  const part = (id: PlaneSectionId) => ({
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHover?.(id);
    },
    onPointerOut: () => onHover?.(null),
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.delta <= CLICK_SLOP) onPick?.(id);
    },
  });

  const engine = (sign: 1 | -1, index: number) => (
    <group key={sign} position={[ENGINE[0], ENGINE[1], ENGINE[2] * sign]}>
      <mesh geometry={shapes.nacelle} material={materials.nacelle} />
      <mesh geometry={shapes.exhaust} material={materials.steel} />
      <mesh
        ref={(mesh) => {
          if (mesh) fans.current[index] = mesh;
        }}
        geometry={shapes.fan}
        material={materials.fan}
        position={[FAN_STATION, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <mesh
        geometry={shapes.spinner}
        material={materials.trim}
        position={[FAN_STATION + 0.3, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      />
      {/* Pylon */}
      <mesh
        geometry={shapes.box}
        material={materials.dusk}
        position={[1.5, 1.38, 0]}
        rotation={[0, 0, 0.14]}
        scale={[3.9, 0.7, 0.2]}
      />
    </group>
  );

  return (
    <group ref={body}>
      {/* Cockpit */}
      <group {...part("cockpit")}>
        <mesh geometry={shapes.cockpit} material={materials.hull.cockpit} />
        <mesh geometry={shapes.windscreen} material={materials.glass} />
        {shapes.posts.map((post, i) => (
          <mesh key={i} geometry={post} material={materials.trim} />
        ))}
        <group
          ref={(group) => {
            interiors.current.cockpit = group;
          }}
          visible={false}
        >
          <mesh
            geometry={shapes.box}
            material={materials.floor}
            position={[14, -0.78, 0]}
            scale={[4.4, 0.08, 2.9]}
          />
          {[-0.62, 0.62].map((z) => (
            <mesh
              key={z}
              geometry={shapes.seat}
              material={materials.dusk}
              position={[14.5, -0.3, z]}
              scale={[1.2, 1.25, 1.3]}
            />
          ))}
          <mesh
            geometry={shapes.box}
            material={materials.strips.cockpit}
            position={[15.7, 0.02, 0]}
            rotation={[0, 0, -0.5]}
            scale={[0.12, 0.62, 2.3]}
          />
        </group>
      </group>

      {/* Main cabin */}
      <group {...part("cabin")}>
        <mesh geometry={shapes.cabin} material={materials.hull.cabin} />
        <Instances
          matrices={fittings.cabinPanes}
          geometry={shapes.pane}
          material={materials.panes.cabin}
        />
        <group
          ref={(group) => {
            interiors.current.cabin = group;
          }}
          visible={false}
        >
          <mesh
            geometry={shapes.box}
            material={materials.floor}
            position={[3.2, -0.78, 0]}
            scale={[16.6, 0.08, 3.4]}
          />
          <Instances
            matrices={fittings.seats}
            colours={fittings.seatColours}
            geometry={shapes.seat}
            material={materials.seat}
          />
          <mesh
            geometry={shapes.box}
            material={materials.strips.cabin}
            position={[3.2, 1.62, 0]}
            scale={[16.2, 0.05, 0.5]}
          />
        </group>
      </group>

      {/* Rear galley */}
      <group {...part("galley")}>
        <mesh geometry={shapes.galley} material={materials.hull.galley} />
        <Instances
          matrices={fittings.galleyPanes}
          geometry={shapes.pane}
          material={materials.panes.galley}
        />
        <group
          ref={(group) => {
            interiors.current.galley = group;
          }}
          visible={false}
        >
          <mesh
            geometry={shapes.box}
            material={materials.floor}
            position={[-8.2, -0.5, 0]}
            scale={[5.6, 0.08, 2.9]}
          />
          {[-9.6, -8.6, -7.6].map((x, i) => (
            <mesh
              key={x}
              geometry={shapes.box}
              material={materials.steel}
              position={[x, 0.05, i % 2 ? -0.75 : 0.75]}
              scale={[0.7, 1.05, 0.5]}
            />
          ))}
          <mesh
            geometry={shapes.box}
            material={materials.strips.galley}
            position={[-8.4, 1.5, 0]}
            scale={[4.6, 0.05, 0.5]}
          />
        </group>
      </group>

      {/* Paintwork that sits on the skin */}
      <mesh geometry={shapes.belly} material={materials.dusk} />
      {shapes.cheatline.map((line, i) => (
        <mesh key={i} geometry={line} material={materials.brass} />
      ))}
      {shapes.doors.map((door, i) => (
        <mesh key={i} geometry={door} material={materials.door} />
      ))}
      {shapes.dashes.map((pair, i) =>
        pair.map((dash, j) => (
          <mesh key={`${i}-${j}`} geometry={dash}>
            <meshStandardMaterial color={hues[HUES[i]!]} roughness={0.4} />
          </mesh>
        )),
      )}
      <mesh
        geometry={shapes.fairing}
        material={materials.dusk}
        position={[0.2, -1.5, 0]}
        scale={[7.4, 0.95, 2.35]}
      />

      {/* Hold doors */}
      <group {...part("hold")}>
        {shapes.hold.map((door, i) => (
          <mesh key={i} geometry={door} material={materials.hold} />
        ))}
      </group>

      {/* Wings and engines */}
      <group {...part("wing")}>
        {([1, -1] as const).map((sign) => (
          <group key={sign} scale={[1, 1, sign]}>
            <mesh geometry={shapes.wing} material={materials.wing} />
            <mesh
              geometry={shapes.lamp}
              material={sign === 1 ? materials.starboard : materials.port}
              position={[-6.05, 0.5, 17.3]}
            />
          </group>
        ))}
        {engine(1, 0)}
        {engine(-1, 1)}
      </group>

      {/* Tail */}
      {([1, -1] as const).map((sign) => (
        <mesh
          key={sign}
          geometry={shapes.stabiliser}
          material={materials.tailplane}
          scale={[1, 1, sign]}
        />
      ))}
      <group {...part("fin")}>
        <mesh geometry={shapes.fin} material={materials.fin} />
      </group>
      <mesh geometry={shapes.lamp} position={[2, 2.08, 0]}>
        <primitive object={materials.beacon} attach="material" transparent />
      </mesh>
    </group>
  );
}
