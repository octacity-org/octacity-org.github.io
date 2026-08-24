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
 * Creates a procedural monochrome studio softbox reflection map.
 * Simulates a high-end photography studio environment:
 * - Neutral dark-gray studio backdrop
 * - Tall sharp white panel (lateral highlights)
 * - Wide upper softbox panel (top facet sheen)
 * - Thin hard rim strip (glancing edge glints)
 */
function createStudioEnvMap(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Neutral dark-gray studio backdrop (visible only to reflections, keeping front dark & rich)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0.0, '#38383c');
  bgGrad.addColorStop(0.45, '#1e1e22');
  bgGrad.addColorStop(1.0, '#101014');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // 1. Tall Sharp White Studio Panel (lateral edge catches)
  const leftGrad = ctx.createLinearGradient(130, 0, 230, 0);
  leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
  leftGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(130, 30, 100, 450);

  // 2. Wide Upper Softbox Panel (overhead edge & bevel sheen)
  const topGrad = ctx.createLinearGradient(0, 15, 0, 130);
  topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  topGrad.addColorStop(0.4, 'rgba(230, 230, 240, 0.6)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(220, 15, 584, 115);

  // 3. Thin Hard Rim Strip (opposite crisp glancing specular line)
  const rightGrad = ctx.createLinearGradient(830, 0, 890, 0);
  rightGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
  rightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.90)');
  rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(830, 50, 60, 380);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const renderTarget = pmremGenerator.fromEquirectangular(texture);

  texture.dispose();
  pmremGenerator.dispose();

  return renderTarget;
}

export function initOctacityScene(container: HTMLElement): SceneContext {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // 1. Scene: Background remains pure black
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

  // 3. Renderer
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
  renderer.toneMappingExposure = 1.0;

  container.appendChild(renderer.domElement);

  // 4. Studio Reflection Environment Map
  const envTarget = createStudioEnvMap(renderer);
  scene.environment = envTarget.texture;

  // 5. Minimal Ambient Fill (Preserves shadow depth while avoiding complete blackouts)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.025);
  scene.add(ambientLight);

  // 6. Fixed Product-Photography Four-Light Studio Rig
  // (a) Narrow Left Key Softbox Strip: carves left edge profile & front curvature
  const keyLight = new THREE.RectAreaLight(0xffffff, 6.0, 1.2, 6.0);
  keyLight.position.set(-4.5, 1.5 + LOGO_CENTER_Y, 4.5);
  keyLight.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(keyLight);

  // (b) Narrow Right Rim Strip: sharp white edge catch on bevels and extrusion sidewalls
  const rimLight = new THREE.RectAreaLight(0xffffff, 8.0, 0.5, 5.0);
  rimLight.position.set(4.5, 1.0 + LOGO_CENTER_Y, 2.5);
  rimLight.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(rimLight);

  // (c) Thin Top Strip: crisp upper bevel highlight across outer ring and spokes
  const topStrip = new THREE.RectAreaLight(0xffffff, 7.0, 4.5, 0.35);
  topStrip.position.set(0, 4.0 + LOGO_CENTER_Y, 3.0);
  topStrip.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(topStrip);

  // (d) Low Front Fill: gentle base illumination for hub & lower spokes without flattening
  const fillLight = new THREE.RectAreaLight(0xffffff, 1.0, 4.0, 4.0);
  fillLight.position.set(0, -1.5 + LOGO_CENTER_Y, 5.0);
  fillLight.lookAt(0, LOGO_CENTER_Y, 0);
  scene.add(fillLight);

  // 7. 3D Logo Emblem (positioned slightly higher in viewport)
  const { mesh, material, geometry } = createLogo();
  mesh.position.y = LOGO_CENTER_Y;
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

  // 9. Interaction Handlers
  const handlePointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointerController.setTargetPointer(x, y, true);
  };

  const handlePointerLeave = () => {
    pointerController.setTargetPointer(0, 0, false);
  };

  // 10. Three-Quarter Rest Pose (Stronger default angle exposing sidewall depth & edge catches)
  const REST_PITCH = THREE.MathUtils.degToRad(-7.0); // ~-7°
  const REST_YAW = THREE.MathUtils.degToRad(13.0);   // ~+13°
  const REST_ROLL = THREE.MathUtils.degToRad(0.8);

  const MAX_YAW = THREE.MathUtils.degToRad(18.0);
  const MAX_PITCH = THREE.MathUtils.degToRad(13.0);

  // 11. Animation Loop: Logo rotates through the fixed studio lighting field
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

      // Subtle idle breathing motion when inactive
      const idleAmount = (1.0 - active);
      const idlePitch = Math.sin(time * 0.5) * THREE.MathUtils.degToRad(0.8) * idleAmount;
      const idleYaw = Math.cos(time * 0.4) * THREE.MathUtils.degToRad(1.0) * idleAmount;

      // Interactive 3D Turning through the fixed studio lighting field
      const targetYaw = REST_YAW + smoothed.x * MAX_YAW + idleYaw;
      const targetPitch = REST_PITCH - smoothed.y * MAX_PITCH + idlePitch;
      const targetRoll = REST_ROLL - smoothed.x * THREE.MathUtils.degToRad(2.5);

      mesh.rotation.y = targetYaw;
      mesh.rotation.x = targetPitch;
      mesh.rotation.z = targetRoll;
    } else {
      mesh.rotation.set(REST_PITCH, REST_YAW, REST_ROLL);
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
