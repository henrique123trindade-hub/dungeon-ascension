import React, { useEffect } from 'react';
import { CHAPTERS } from '../game/data/lore';

interface ChapterTransitionOverlayProps {
  chapterIndex: number;
  floor: number;
  isFirstDiscovery: boolean;
  onDismiss: () => void;
}

export const ChapterTransitionOverlay: React.FC<ChapterTransitionOverlayProps> = ({
  chapterIndex,
  floor,
  isFirstDiscovery,
  onDismiss,
}) => {
  const chapter = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, chapterIndex))];

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, isFirstDiscovery ? 4200 : 3000);
    return () => window.clearTimeout(timer);
  }, [chapterIndex, floor, isFirstDiscovery, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="chapter-transition-banner"
      onClick={onDismiss}
      className="fixed inset-x-0 top-14 sm:top-16 z-30 flex justify-center px-4 pointer-events-auto cursor-pointer"
    >
      <div
        className="max-w-xl w-full bg-[#09080f]/92 border-y border-x border-[#c6a664]/35 px-7 py-5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.85)] backdrop-blur-sm"
        style={{
          borderTopColor: chapter.accentColor,
          borderBottomColor: `${chapter.accentColor}55`,
        }}
      >
        <div className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.28em]">
          <span style={{ color: chapter.accentColor }} className="font-semibold">
            {chapter.roman}
          </span>
          <span className="text-[#6e647a]">·</span>
          <span className="text-[#c5b9a5]">Andar {floor}</span>
          {isFirstDiscovery && (
            <>
              <span className="text-[#6e647a]">·</span>
              <span className="text-[#f3d185]">Nova Região Descoberta</span>
            </>
          )}
        </div>

        <h2 className="font-display text-2xl sm:text-3xl tracking-[0.12em] uppercase text-[#f6eedb] mt-1.5">
          {chapter.region}
        </h2>

        <p className="text-xs uppercase tracking-[0.2em] text-[#b4a790] mt-0.5">{chapter.title}</p>

        <div
          className="w-28 h-px mx-auto my-3"
          style={{ background: `linear-gradient(90deg, transparent, ${chapter.accentColor}, transparent)` }}
        />

        <p className="text-xs sm:text-sm italic text-[#ddd3c2] leading-relaxed">
          “{chapter.transitionQuote}”
        </p>

        <p className="text-[11px] text-[#a59bb3] mt-2.5">
          <span className="uppercase tracking-[0.14em] text-[#e6c987] font-medium">
            {chapter.mechanicName}:
          </span>{' '}
          {chapter.mechanicDescription}
        </p>
      </div>
    </div>
  );
};
