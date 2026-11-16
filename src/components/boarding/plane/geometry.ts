import * as THREE from "three";
import { hullPoint } from "@/lib/boarding/hull";
import type { Vec3 } from "@/lib/boarding/sections";

const STEP = 1e-3;

function sub(a: Vec3, b: Vec3): THREE.Vector3 {
  return new THREE.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * A piece of fuselage skin between two stations and two angles, `offset` metres proud of the hull.
 * A full turn makes a section of the tube; a narrow strip makes a door, a stripe or a windscreen.
 */
export function hullPatch(
  x0: number,
  x1: number,
  angle0: number,
  angle1: number,
  {
    offset = 0,
    along = 40,
    around = 28,
    span,
  }: {
    offset?: number;
    along?: number;
    around?: number;
    /** Lets the patch's ends vary across its width (0 to 1), for shapes like the windscreen. */
    span?: (across: number) => readonly [number, number];
  } = {},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= along; i++) {
    for (let j = 0; j <= around; j++) {
      const angle = angle0 + ((angle1 - angle0) * j) / around;
      const [from, to] = span ? span(j / around) : [x0, x1];
      const x = from + ((to - from) * i) / along;
      const p = hullPoint(x, angle, offset);
      positions.push(p[0], p[1], p[2]);
      // The skin's normal from its slope along the tube and around it.
      const alongSlope = sub(
        hullPoint(x + STEP, angle, offset),
        hullPoint(x - STEP, angle, offset),
      );
      const aroundSlope = sub(
        hullPoint(x, angle + STEP, offset),
        hullPoint(x, angle - STEP, offset),
      );
      const normal = aroundSlope.cross(alongSlope);
      if (normal.lengthSq() < 1e-12) normal.set(Math.sign(x) || 1, 0, 0);
      normal.normalize();
      normals.push(normal.x, normal.y, normal.z);
    }
  }
  const row = around + 1;
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** One cross-section of a wing or tail surface. */
export type Rib = {
  /** Leading edge. */
  le: Vec3;
  chord: number;
  /** Thickness as a fraction of the chord. */
  thick: number;
  /** The direction the upper surface faces. */
  up: Vec3;
};

/** Half-thickness of a symmetric aerofoil at chord fraction u, for unit chord and unit thickness. */
function aerofoil(u: number): number {
  return (
    5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 + 0.2843 * u ** 3 - 0.1036 * u ** 4)
  );
}

/**
 * Skins a wing-like surface over its ribs. The chord runs back along -x from each leading edge.
 * `u` texture coordinates follow the chord and `v` the span, so livery can be painted on. `under`
 * is how full the lower surface is next to the upper one (1 makes a symmetric fin).
 */
export function loft(
  ribs: readonly Rib[],
  { half = 12, under = 0.72 }: { half?: number; under?: number } = {},
): THREE.BufferGeometry {
  const ring = half * 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  ribs.forEach((rib, i) => {
    const up = new THREE.Vector3(...rib.up).normalize();
    for (let k = 0; k < ring; k++) {
      const upper = k < half;
      const s = upper ? k / half : 1 - (k - half) / half;
      // Cosine spacing puts more points round the leading edge, where the curve is tight.
      const u = (1 - Math.cos(Math.PI * s)) / 2;
      const lift = rib.chord * rib.thick * aerofoil(u) * (upper ? 1 : -under);
      positions.push(
        rib.le[0] - rib.chord * u + up.x * lift,
        rib.le[1] + up.y * lift,
        rib.le[2] + up.z * lift,
      );
      uvs.push(u, i / (ribs.length - 1));
    }
  });
  for (let i = 0; i < ribs.length - 1; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      indices.push(a, b, a + ring, b, b + ring, a + ring);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A body of revolution along +x from a profile of [station, radius] pairs. */
export function revolve(profile: readonly (readonly [number, number])[], segments = 40) {
  const points = profile.map(([station, radius]) => new THREE.Vector2(radius, station));
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

/** A soft round puff of cloud, drawn once and shared by every cloud in the deck. */
export function puffTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const blobs: readonly (readonly [number, number, number])[] = [
      [0.5, 0.55, 0.42],
      [0.34, 0.5, 0.26],
      [0.66, 0.48, 0.28],
      [0.5, 0.36, 0.24],
    ];
    for (const [x, y, r] of blobs) {
      const gradient = context.createRadialGradient(
        x * size,
        y * size,
        0,
        x * size,
        y * size,
        r * size,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.5, "rgba(255,255,255,0.5)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The tail fin's paint: a dusk ground crossed by the six travel hues. */
export function liveryTexture(ground: string, stripes: readonly string[]): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = ground;
    context.fillRect(0, 0, size, size);
    // v runs up the fin, so level bands on the canvas wrap the fin as clean stripes.
    const band = size * 0.02;
    stripes.forEach((colour, i) => {
      context.fillStyle = colour;
      context.fillRect(0, size * 0.36 + i * band * 1.7, size, band);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The fin is usually seen at a slant; without this the stripes smear.
  texture.anisotropy = 8;
  return texture;
}
