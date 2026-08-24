import * as THREE from 'three';

export interface PointerController {
  setTargetPointer: (ndcX: number, ndcY: number, inside: boolean) => void;
  update: (delta: number, isReducedMotion: boolean) => void;
  getSmoothedPointer: () => THREE.Vector2;
  getSmoothedActive: () => number;
}

export function createPointerController(): PointerController {
  const targetPointer = new THREE.Vector2(0, 0);
  const smoothedPointer = new THREE.Vector2(0, 0);
  let targetActive = 0.0;
  let smoothedActive = 0.0;

  const setTargetPointer = (ndcX: number, ndcY: number, inside: boolean) => {
    if (inside) {
      targetPointer.set(ndcX, ndcY);
      targetActive = 1.0;
    } else {
      targetPointer.set(0, 0);
      targetActive = 0.0;
    }
  };

  const update = (delta: number, isReducedMotion: boolean) => {
    if (isReducedMotion) {
      smoothedPointer.set(0, 0);
      smoothedActive = 0;
      return;
    }

    // Smooth inertial damping for weighted, premium turning feel
    const damping = 1.0 - Math.pow(0.0008, delta);
    smoothedPointer.lerp(targetPointer, Math.min(damping, 0.12));
    smoothedActive += (targetActive - smoothedActive) * Math.min(damping * 1.5, 0.15);
  };

  return {
    setTargetPointer,
    update,
    getSmoothedPointer: () => smoothedPointer,
    getSmoothedActive: () => smoothedActive,
  };
}
