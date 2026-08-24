import { Component, onMount, onCleanup } from 'solid-js';
import { initOctacityScene, SceneContext } from '../three/createScene';

export const OctacityScene: Component = () => {
  let containerRef: HTMLDivElement | undefined;
  let sceneContext: SceneContext | undefined;

  onMount(() => {
    if (!containerRef) return;

    sceneContext = initOctacityScene(containerRef);

    const onPointerMove = (e: PointerEvent) => {
      sceneContext?.handlePointerMove(e);
    };

    const onPointerLeave = () => {
      sceneContext?.handlePointerLeave();
    };

    // Attach to window so pointer tracking continues smoothly across full screen
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('pointercancel', onPointerLeave, { passive: true });

    onCleanup(() => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointercancel', onPointerLeave);
      sceneContext?.dispose();
    });
  });

  return <div ref={containerRef} class="canvas-container" aria-hidden="true" />;
};
