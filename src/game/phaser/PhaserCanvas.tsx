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

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: el,
      width: el.clientWidth || window.innerWidth,
      height: el.clientHeight || window.innerHeight,
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
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [DungeonScene],
    };

    const game = new Phaser.Game(config);

    // Wait briefly for scene registration then signal ready
    const readyCheck = window.setInterval(() => {
      if (phaserBridge.getController()) {
        window.clearInterval(readyCheck);
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
    document.addEventListener('visibilitychange', handleVisibility);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(320, Math.floor(entry.contentRect.width));
      const h = Math.max(240, Math.floor(entry.contentRect.height));
      game.scale.resize(w, h);
    });
    resizeObserver.observe(el);

    return () => {
      window.clearInterval(readyCheck);
      resizeObserver.disconnect();
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="phaser-canvas-container"
      className="fixed inset-0 w-full h-full bg-[#0b0a0e] overflow-hidden"
    />
  );
}
