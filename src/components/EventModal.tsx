import type { ActiveEventPayload } from '../game/types';
import { GoldCoinIcon } from './Icons';

interface EventModalProps {
  event: ActiveEventPayload;
  onSelectChoice: (choiceId: string) => void;
}

export function EventModal({ event, onSelectChoice }: EventModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="dark-panel animate-modal-enter w-full max-w-xl p-6"
      >
        <div className="text-xs font-mono-num uppercase tracking-widest text-[#d4a64a]">
          Evento da Masmorra
        </div>
        <h2 className="font-display text-2xl font-bold text-[#faf5eb] mt-1">{event.title}</h2>
        <p className="text-sm text-[#c7bfb2] mt-2 leading-relaxed">{event.description}</p>

        <div className="mt-5 flex flex-col gap-2.5">
          {event.choices.map((ch) => (
            <button
              key={ch.id}
              type="button"
              disabled={ch.disabled}
              onClick={() => onSelectChoice(ch.id)}
              className="w-full text-left p-4 bg-[#14111b] hover:bg-[#1f1a2b] disabled:opacity-40 disabled:cursor-not-allowed border border-[#d4a64a]/30 hover:border-[#d4a64a]/75 transition-colors cursor-pointer"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display font-bold text-sm text-[#f8e3a8]">{ch.label}</span>
                {ch.costGold !== undefined && (
                  <span className="inline-flex items-center gap-1 font-mono-num text-xs text-[#facc15] shrink-0">
                    <GoldCoinIcon className="w-3.5 h-3.5" />
                    {ch.costGold} Ouro
                  </span>
                )}
              </div>
              <p className="text-xs text-[#b8afa1] mt-1">{ch.detail}</p>
              {(ch.rewardText || ch.riskText) && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono-num">
                  {ch.rewardText && <span className="text-[#4ade80]">{ch.rewardText}</span>}
                  {ch.riskText && <span className="text-[#f87171]">{ch.riskText}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
