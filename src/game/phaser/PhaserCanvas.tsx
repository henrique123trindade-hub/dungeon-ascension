import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { DungeonScene } from './DungeonScene';
import { phaserBridge } from './PhaserBridge';

interface PhaserCanvasProps {
  onReady?: () => void;
}

/**
 * Isolated Phaser 3 WebGL + Arcade Physics mount container.
 * Mounts exactly once so React HUD state updates never recreate or tear down the WebGL game loop.
 */
export function PhaserCanvas({ onReady }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getViewportSize = () => {
      const rect = el.getBoundingClientRect();
      return {
        w: Math.max(320, Math.round(rect.width || window.innerWidth)),
        h: Math.max(240, Math.round(rect.height || window.innerHeight)),
      };
    };

    const initial = getViewportSize();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: el,
      width: initial.w,
      height: initial.h,
      backgroundColor: '#0b0a0e',
      pixelArt: false,
      antialias: true,
      powerPreference: 'high-performance',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      scene: [DungeonScene],
    };

    const game = new Phaser.Game(config);

    const syncCanvasSize = () => {
      const { w, h } = getViewportSize();
      if (game.scale.width !== w || game.scale.height !== h) {
        game.scale.resize(w, h);
      }
      const canvas = game.canvas;
      if (canvas) {
        canvas.style.margin = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
      }
    };

    const initialRaf = window.requestAnimationFrame(syncCanvasSize);

    // Wait briefly for scene registration then signal ready
    const readyCheck = window.setInterval(() => {
      if (phaserBridge.getController()) {
        window.clearInterval(readyCheck);
        syncCanvasSize();
        onReadyRef.current?.();
      }
    }, 40);

    // Release held inputs cleanly on blur / tab hide without auto-opening pause modal
    const handleBlur = () => {
      phaserBridge.getController()?.clearHeldInputs();
    };
    const handleVisibility = () => {
      if (document.hidden) {
        phaserBridge.getController()?.clearHeldInputs();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', syncCanvasSize);
    document.addEventListener('visibilitychange', handleVisibility);

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    resizeObserver.observe(el);

    return () => {
      window.cancelAnimationFrame(initialRaf);
      window.clearInterval(readyCheck);
      resizeObserver.disconnect();
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', syncCanvasSize);
      document.removeEventListener('visibilitychange', handleVisibility);
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="phaser-canvas-container"
      className="fixed inset-0 w-full h-full bg-[#0b0a0e] overflow-hidden [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full"
    />
  );
}
