"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { puffTexture } from "./geometry";

/** The light the plane flies in: late afternoon by day, last light after dark. */
export type Light = {
  zenith: string;
  horizon: string;
  /** The band of colour low in the sky, towards the sun. */
  glow: string;
  sun: string;
  sunStrength: number;
  /** Height of the sun above the horizon, in radians. */
  sunHeight: number;
  /** What shows between the clouds, far below. */
  below: string;
  cloud: string;
  cloudShade: string;
  fill: number;
  exposure: number;
};

export const LIGHTS: Record<"day" | "night", Light> = {
  day: {
    zenith: "#1f5fc0",
    horizon: "#cfe3f5",
    glow: "#ffc98a",
    sun: "#ffe2b8",
    sunStrength: 3.4,
    sunHeight: 0.3,
    below: "#7ea2cc",
    cloud: "#fff3e2",
    cloudShade: "#e9c9a8",
    fill: 0.9,
    exposure: 1,
  },
  night: {
    zenith: "#0a1336",
    horizon: "#3b4b88",
    glow: "#f08a4b",
    sun: "#ffdcc4",
    sunStrength: 0.75,
    sunHeight: 0.06,
    below: "#0b1029",
    cloud: "#414a7c",
    cloudShade: "#161a38",
    fill: 1.1,
    exposure: 1.1,
  },
};

const SUN_BEARING = 2.5;
const SKY_RADIUS = 600;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 glow;
  uniform vec3 below;
  uniform vec3 sunColour;
  uniform vec3 sunDirection;
  uniform float stars;
  varying vec3 vDirection;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDirection);
    float height = clamp(d.y, -1.0, 1.0);
    vec3 colour = mix(horizon, zenith, pow(smoothstep(0.0, 0.5, height), 0.6));
    float towardSun = max(dot(d, sunDirection), 0.0);
    // Warm light pools low in the sky on the sun's side.
    float low = 1.0 - smoothstep(0.0, 0.3, abs(height));
    colour = mix(colour, glow, low * (0.1 + 0.9 * pow(towardSun, 3.0)) * 0.8);
    colour += sunColour * (pow(towardSun, 900.0) * 6.0 + pow(towardSun, 40.0) * 0.35);
    if (stars > 0.0) {
      vec3 cell = floor(d * 220.0);
      float spark = step(0.9975, hash(cell)) * smoothstep(0.1, 0.5, height);
      colour += vec3(spark) * stars;
    }
    // Below the horizon the sky fades to the haze the clouds sit in.
    colour = mix(colour, below, smoothstep(-0.01, -0.3, height));
    gl_FragColor = vec4(colour, 1.0);
  }
`;

function sunDirection(height: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(height) * Math.cos(SUN_BEARING),
    Math.sin(height),
    Math.cos(height) * Math.sin(SUN_BEARING),
  ).normalize();
}

/** The sky dome, the sun, and the reflections the plane's paint picks up from them. */
export function Sky({ light, night }: { light: Light; night: boolean }) {
  const { gl, scene, camera } = useThree();
  const dome = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => sunDirection(light.sunHeight), [light.sunHeight]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        uniforms: {
          zenith: { value: new THREE.Color(light.zenith) },
          horizon: { value: new THREE.Color(light.horizon) },
          glow: { value: new THREE.Color(light.glow) },
          below: { value: new THREE.Color(light.below) },
          sunColour: { value: new THREE.Color(light.sun) },
          sunDirection: { value: direction },
          stars: { value: night ? 0.9 : 0 },
        },
      }),
    [light, night, direction],
  );

  // The paint reflects the same sky that is drawn behind the plane.
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const world = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(50, 32, 16);
    world.add(new THREE.Mesh(geometry, material));
    const target = generator.fromScene(world, 0.02);
    scene.environment = target.texture;
    scene.environmentIntensity = night ? 0.7 : 1;
    scene.fog = new THREE.Fog(light.horizon, 260, 900);
    return () => {
      scene.environment = null;
      scene.fog = null;
      target.dispose();
      generator.dispose();
      geometry.dispose();
    };
  }, [gl, scene, material, light.horizon, night]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => dome.current?.position.copy(camera.position));

  return (
    <>
      <mesh ref={dome} material={material} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
      </mesh>
      <directionalLight
        position={direction.clone().multiplyScalar(100)}
        color={light.sun}
        intensity={light.sunStrength}
      />
      <hemisphereLight args={[light.horizon, light.cloudShade, light.fill]} />
    </>
  );
}

const DECK_LENGTH = 1100;
const DECK_WIDTH = 900;
const AIRSPEED = 22;

type Puff = { x: number; y: number; z: number; size: number; squash: number; shade: number };

/** A small repeatable random stream, so the cloud deck looks the same on every visit. */
function stream(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * The cloud deck below the plane. The clouds slide backwards and wrap round, which is what makes
 * the plane look as if it is flying while it stays in the middle of the view.
 */
export function Clouds({ light, count, moving }: { light: Light; count: number; moving: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const texture = useMemo(() => puffTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  const puffs = useMemo<Puff[]>(() => {
    const random = stream(20261115);
    return Array.from({ length: count }, () => {
      const layer = random();
      return {
        x: (random() - 0.5) * DECK_LENGTH,
        y: -34 - layer * 26,
        z: (random() - 0.5) * DECK_WIDTH,
        size: 52 + random() * 64,
        squash: 0.4 + random() * 0.2,
        shade: layer,
      };
    });
  }, [count]);

  const colours = useMemo(() => {
    const top = new THREE.Color(light.cloud);
    const under = new THREE.Color(light.cloudShade);
    return puffs.map((puff) => top.clone().lerp(under, puff.shade * 0.8));
  }, [puffs, light]);

  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    colours.forEach((colour, i) => target.setColorAt(i, colour));
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [colours]);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const target = mesh.current;
    if (!target) return;
    const drift = moving ? AIRSPEED * Math.min(delta, 0.1) : 0;
    puffs.forEach((puff, i) => {
      puff.x -= drift;
      if (puff.x < -DECK_LENGTH / 2) puff.x += DECK_LENGTH;
      position.set(puff.x, puff.y, puff.z);
      scale.set(puff.size, puff.size * puff.squash, 1);
      // Each puff is a flat card turned to face the camera.
      matrix.compose(position, camera.quaternion, scale);
      target.setMatrixAt(i, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      renderOrder={-1}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.95} />
    </instancedMesh>
  );
}
