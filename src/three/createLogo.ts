import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface LogoInstance {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  geometry: THREE.BufferGeometry;
}

function createMachinedRing(
  outerRadius: number,
  innerRadius: number,
  depth: number,
  bevelSize: number,
  bevelThickness: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  shape.absarc(
    0,
    0,
    outerRadius,
    0,
    Math.PI * 2,
    false,
  );

  const hole = new THREE.Path();

  hole.absarc(
    0,
    0,
    innerRadius,
    0,
    Math.PI * 2,
    true,
  );

  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness,
    bevelOffset: 0,
    bevelSegments: 4,
    curveSegments: 128,
    steps: 1,
  });

  geometry.translate(0, 0, -depth / 2);

  return geometry;
}

function createMachinedBarShape(
  length: number,
  width: number,
  cornerRadius: number,
): THREE.Shape {
  const halfLength = length / 2;
  const halfWidth = width / 2;

  const r = Math.min(
    cornerRadius,
    halfLength,
    halfWidth,
  );

  const shape = new THREE.Shape();

  shape.moveTo(-halfLength + r, -halfWidth);

  shape.lineTo(halfLength - r, -halfWidth);
  shape.quadraticCurveTo(
    halfLength,
    -halfWidth,
    halfLength,
    -halfWidth + r,
  );

  shape.lineTo(halfLength, halfWidth - r);
  shape.quadraticCurveTo(
    halfLength,
    halfWidth,
    halfLength - r,
    halfWidth,
  );

  shape.lineTo(-halfLength + r, halfWidth);
  shape.quadraticCurveTo(
    -halfLength,
    halfWidth,
    -halfLength,
    halfWidth - r,
  );

  shape.lineTo(-halfLength, -halfWidth + r);
  shape.quadraticCurveTo(
    -halfLength,
    -halfWidth,
    -halfLength + r,
    -halfWidth,
  );

  shape.closePath();

  return shape;
}

function createMachinedRadialBar(
  length: number,
  width: number,
  depth: number,
  cornerRadius: number,
  bevelSize: number,
  bevelThickness: number,
  angle: number,
  centerRadius: number,
): THREE.BufferGeometry {
  const shape = createMachinedBarShape(
    length,
    width,
    cornerRadius,
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness,
    bevelOffset: 0,
    bevelSegments: 4,
    curveSegments: 10,
    steps: 1,
  });

  geometry.translate(0, 0, -depth / 2);
  geometry.rotateZ(angle);

  const x = Math.cos(angle) * centerRadius;
  const y = Math.sin(angle) * centerRadius;

  geometry.translate(x, y, 0);

  return geometry;
}

export function createLogo(): LogoInstance {
  const parts: THREE.BufferGeometry[] = [];

  /*
   * ------------------------------------------------------------
   * TARGET PROPORTIONS
   * ------------------------------------------------------------
   *
   * Intentionally thinner than the previous version.
   *
   * The target should read as:
   *
   * thin machined metal
   * + narrow bevels
   * + subtle depth
   * + strong reflections
   *
   * NOT:
   *
   * thick industrial bars
   */

  const OUTER_RING_OUTER_RADIUS = 0.82;
  const OUTER_RING_INNER_RADIUS = 0.735;

  const HUB_OUTER_RADIUS = 0.15;
  const HUB_INNER_RADIUS = 0.075;

  /*
   * Much shallower than the previous implementation.
   */
  const RING_DEPTH = 0.105;
  const SPOKE_DEPTH = 0.12;
  const OUTER_SPOKE_DEPTH = 0.125;
  const HUB_DEPTH = 0.145;

  /*
   * ------------------------------------------------------------
   * OUTER RING
   * ------------------------------------------------------------
   */

  const outerRing = createMachinedRing(
    OUTER_RING_OUTER_RADIUS,
    OUTER_RING_INNER_RADIUS,
    RING_DEPTH,

    // Small bevel, enough for edge highlights.
    0.010,
    0.012,
  );

  parts.push(outerRing);

  /*
   * ------------------------------------------------------------
   * CENTER HUB
   * ------------------------------------------------------------
   */

  const hub = createMachinedRing(
    HUB_OUTER_RADIUS,
    HUB_INNER_RADIUS,
    HUB_DEPTH,
    0.009,
    0.011,
  );

  parts.push(hub);

  /*
   * ------------------------------------------------------------
   * INNER SPOKES
   * ------------------------------------------------------------
   */

  const INNER_START =
    HUB_OUTER_RADIUS + 0.006;

  const INNER_END =
    OUTER_RING_INNER_RADIUS + 0.008;

  const innerLength =
    INNER_END - INNER_START;

  const innerCenter =
    INNER_START + innerLength / 2;

  /*
   * Slimmer and flatter than the previous version.
   */
  const INNER_WIDTH = 0.078;

  /*
   * ------------------------------------------------------------
   * OUTER EXTENSIONS
   * ------------------------------------------------------------
   */

  const OUTER_START =
    OUTER_RING_OUTER_RADIUS - 0.018;

  const OUTER_END = 1.105;

  const outerLength =
    OUTER_END - OUTER_START;

  const outerCenter =
    OUTER_START + outerLength / 2;

  const OUTER_WIDTH = 0.082;

  /*
   * ------------------------------------------------------------
   * EIGHT RADIAL DIRECTIONS
   * ------------------------------------------------------------
   */

  const SPOKE_COUNT = 8;

  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle =
      (i / SPOKE_COUNT) * Math.PI * 2;

    const innerBar = createMachinedRadialBar(
      innerLength,
      INNER_WIDTH,
      SPOKE_DEPTH,

      // Mildly rounded ends, not pill/capsule-shaped.
      0.014,

      0.009,
      0.011,

      angle,
      innerCenter,
    );

    parts.push(innerBar);

    const outerBar = createMachinedRadialBar(
      outerLength,
      OUTER_WIDTH,
      OUTER_SPOKE_DEPTH,

      0.015,

      0.010,
      0.012,

      angle,
      outerCenter,
    );

    parts.push(outerBar);
  }

  /*
   * ------------------------------------------------------------
   * MERGE TO ONE MESH
   * ------------------------------------------------------------
   */

  const merged =
    BufferGeometryUtils.mergeGeometries(
      parts,
      false,
    );

  if (!merged) {
    parts.forEach((part) => part.dispose());

    throw new Error(
      'Failed to merge Octacity 3D emblem geometry.',
    );
  }

  parts.forEach((part) => part.dispose());

  merged.center();

  const finalGeometry =
    BufferGeometryUtils.mergeVertices(
      merged,
      1e-5,
    );

  merged.dispose();

  finalGeometry.computeVertexNormals();
  finalGeometry.computeBoundingBox();
  finalGeometry.computeBoundingSphere();

  /*
   * ------------------------------------------------------------
   * MATERIAL
   * ------------------------------------------------------------
   *
   * Dark machined graphite.
   *
   * The model is thinner now, so reflections and bevel highlights
   * need to do more of the visual work.
   */

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x202024),

    metalness: 0.62,
    roughness: 0.22,

    clearcoat: 0.30,
    clearcoatRoughness: 0.14,

    envMapIntensity: 1.05,

    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(
    finalGeometry,
    material,
  );

  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return {
    mesh,
    material,
    geometry: finalGeometry,
  };
}