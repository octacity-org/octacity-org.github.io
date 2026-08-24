import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createPointerController } from './deformation';
import { createLogo } from './createLogo';

// Initialize RectAreaLight support for standard & physical materials
RectAreaLightUniformsLib.init();

export interface SceneContext {
  container: HTMLElement;
  handlePointerMove: (e: PointerEvent) => void;
  handlePointerLeave: () => void;
  dispose: () => void;
}

/**
 * Creates an HDR reflection studio environment using a dedicated 3D reflection scene
 * populated with high-emissivity softbox panels, captured with CubeCamera + PMREMGenerator.
 *
 * This delivers physically plausible, elongated softbox reflections on the metallic emblem.
 */
function createStudioEnvMap(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const reflectionScene = new THREE.Scene();
  // Brighter studio backdrop (visible only to reflections, keeping energy high without flattening)
  reflectionScene.background = new THREE.Color(0x303036);

  const disposables: { dispose: () => void }[] = [];

  // Helper to add emissive HDR reflection cards
  const addReflectionCard = (
    w: number,
    h: number,
    colorRgb: [number, number, number],
    pos: [number, number, number],
    lookAtPos: [number, number, number] = [0, 0, 0]
  ) => {
    const geom = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorRgb[0], colorRgb[1], colorRgb[2]),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(lookAtPos[0], lookAtPos[1], lookAtPos[2]);
    reflectionScene.add(mesh);
    disposables.push(geom, mat);
  };

  // 1. Tall Left Softbox: Elongated vertical panel creating sleek lateral silver gradients
  addReflectionCard(1.4, 7.5, [4.8, 4.8, 5.2], [-3.8, 1.2, 3.2]);

  // 2. Thin Right Rim Card: Narrow strip generating razor-sharp specular edge catches
  addReflectionCard(0.32, 6.5, [6.8, 6.8, 7.4], [3.8, 0.8, 2.2]);

  // 3. Wide Top Strip: Overhead card producing clean highlights across upper ring, hub, and spokes
  addReflectionCard(5.8, 0.45, [5.4, 5.4, 5.8], [0.0, 4.2, 2.6]);

  // 4. Weak Lower/Front Card: Gentle fill preventing lower surfaces from disappearing
  addReflectionCard(4.5, 3.2, [0.75, 0.75, 0.85], [0.0, -3.6, 3.8]);

  // Capture the HDR reflection studio using CubeCamera + HalfFloat cube render target
  const cubeTarget = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });

  const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeTarget);
  cubeCamera.position.set(0, 0, 0);
  cubeCamera.update(renderer, reflectionScene);

  // Generate PMREM filtered environment map for MeshPhysicalMaterial
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();
  const envTarget = pmremGenerator.fromCubemap(cubeTarget.texture);

  // Cleanup temporary resources
  disposables.forEach((d) => d.dispose());
  cubeTarget.dispose();
  pmremGenerator.dispose();

  return envTarget;
}

export function initOctacityScene(container: HTMLElement): SceneContext {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // 1. Scene: Background seen by camera remains pure black
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Height offset for logo positioning: placed slightly higher for balanced vertical hierarchy
  const LOGO_CENTER_Y = 0.28;

  // 2. Camera
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
  const updateCameraPosition = () => {
    const aspect = camera.aspect;
    if (aspect < 1.0) {
      camera.position.set(0, 0.0, 5.8 / Math.max(aspect, 0.55));
    } else {
      camera.position.set(0, 0.0, 5.5);
    }
    camera.lookAt(0, 0.0, 0);
  };
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  updateCameraPosition();

  // 3. Renderer (Physically correct rendering with ACESFilmic tone mapping)
  const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true,
    alpha: false,
    stencil: false,
    depth: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  container.appendChild(renderer.domElement);

  // 4. HDR Studio Reflection Environment
  const envTarget = createStudioEnvMap(renderer);
  scene.environment = envTarget.texture;

  // 5. Minimal Ambient Fill (Preserves shadow depth without total blackouts)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
  scene.add(ambientLight);

  // 6. Direct Studio Form Lights (Balanced physical values)
  // (a) Left Key Softbox
  const keyLight = new THREE.RectAreaLight(0xffffff, 5.0, 1.2, 6.0);
  keyLight.position.set(-4.8, 1.6 + LOGO_CENTER_Y, 4.8);
  keyLight.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(keyLight);

  // (b) Right Rim Strip
  const rimLight = new THREE.RectAreaLight(0xffffff, 6.5, 0.45, 5.2);
  rimLight.position.set(4.8, 1.0 + LOGO_CENTER_Y, 2.8);
  rimLight.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(rimLight);

  // (c) Top Strip
  const topStrip = new THREE.RectAreaLight(0xffffff, 4.5, 4.8, 0.35);
  topStrip.position.set(0, 4.2 + LOGO_CENTER_Y, 3.2);
  topStrip.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(topStrip);

  // (d) Front Fill
  const frontFill = new THREE.RectAreaLight(0xffffff, 1.4, 4.0, 4.0);
  frontFill.position.set(0, -1.2 + LOGO_CENTER_Y, 5.0);
  frontFill.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(frontFill);

  // 7. 3D Logo Emblem (obtained from frozen createLogo.ts, positioned slightly higher)
  const { mesh, material, geometry } = createLogo();
  mesh.position.y = LOGO_CENTER_Y;

  // Runtime material tuning for correct metallic PBR energy and response
  material.color.set(0x55555b);
  material.metalness = 0.88;
  material.roughness = 0.20;
  material.clearcoat = 0.12;
  material.clearcoatRoughness = 0.10;
  material.envMapIntensity = 1.8;
  material.needsUpdate = true;

  scene.add(mesh);

  // 8. Pointer Controller
  const pointerController = createPointerController();

  // Reduced motion preference
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReducedMotion = mediaQuery.matches;
  const handleMotionChange = (e: MediaQueryListEvent) => {
    isReducedMotion = e.matches;
  };
  mediaQuery.addEventListener('change', handleMotionChange);

  // 9. Interaction Handlers (Displacement calculated relative to projected logo center)
  const projectedLogoCenter = new THREE.Vector3();

  const handlePointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();

    // Pointer in standard viewport NDC
    const pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    // Project the actual 3D logo center into screen/NDC space
    projectedLogoCenter.copy(mesh.position);
    projectedLogoCenter.project(camera);

    // Displacement relative to logo center (0,0 when pointer is directly over logo)
    const relativeX = pointerX - projectedLogoCenter.x;
    const relativeY = pointerY - projectedLogoCenter.y;

    const sensitivity = 1.35;
    const x = THREE.MathUtils.clamp(relativeX * sensitivity, -1, 1);
    const y = THREE.MathUtils.clamp(relativeY * sensitivity, -1, 1);

    pointerController.setTargetPointer(x, y, true);
  };

  const handlePointerLeave = () => {
    pointerController.setTargetPointer(0, 0, false);
  };

  // 10. Rest Pose & Rotation Limits
  const REST_PITCH = 0;
  const REST_YAW = 0;
  const REST_ROLL = 0;

  const MAX_YAW = THREE.MathUtils.degToRad(18);
  const MAX_PITCH = THREE.MathUtils.degToRad(13);

  // 11. Animation Loop: Logo rotates to face the cursor directly
  let animationFrameId: number;
  let lastTime = performance.now();
  let isVisible = document.visibilityState === 'visible';

  const handleVisibilityChange = () => {
    isVisible = document.visibilityState === 'visible';
    if (isVisible) {
      lastTime = performance.now();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const animate = (currentTime: number) => {
    animationFrameId = requestAnimationFrame(animate);

    if (!isVisible) return;

    const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    pointerController.update(delta, isReducedMotion);
    const smoothed = pointerController.getSmoothedPointer();
    const active = pointerController.getSmoothedActive();

    if (!isReducedMotion) {
      const time = currentTime * 0.001;

      // Extremely subtle idle breathing when inactive
      const idleAmount = (1.0 - active);
      const idlePitch = Math.sin(time * 0.5) * THREE.MathUtils.degToRad(0.35) * idleAmount;
      const idleYaw = Math.cos(time * 0.4) * THREE.MathUtils.degToRad(0.45) * idleAmount;

      // Natural cursor-facing turning (faces viewer square when cursor is over center)
      const targetYaw = smoothed.x * MAX_YAW + idleYaw;
      const targetPitch = -smoothed.y * MAX_PITCH + idlePitch;
      const targetRoll = 0;

      mesh.rotation.y = targetYaw;
      mesh.rotation.x = targetPitch;
      mesh.rotation.z = targetRoll;
    } else {
      mesh.rotation.set(0, 0, 0);
    }

    renderer.render(scene, camera);
  };

  animationFrameId = requestAnimationFrame(animate);

  // 12. Resize Handling
  const handleResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateCameraPosition();

    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  // 13. Teardown
  const dispose = () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    mediaQuery.removeEventListener('change', handleMotionChange);

    geometry.dispose();
    material.dispose();
    envTarget.dispose();
    renderer.dispose();

    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    container,
    handlePointerMove,
    handlePointerLeave,
    dispose,
  };
}
