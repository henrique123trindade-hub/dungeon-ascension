import { useState } from 'react';
import { CLASSES } from '../game/data/classes';
import type { AvatarId, ClassId } from '../game/types';
import { ClassIcon } from './Icons';

interface PlayerAvatarBadgeProps {
  avatarId: AvatarId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
};

const ICON_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
};

export function PlayerAvatarBadge({
  avatarId,
  size = 'md',
  className = '',
}: PlayerAvatarBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (avatarId === 'crest_emblem') {
    return (
      <div
        className={`${SIZE_CLASSES[size]} shrink-0 flex items-center justify-center bg-[#14101c] border border-[#d4a64a]/55 overflow-hidden ${className}`}
      >
        {!imgFailed ? (
          <img
            src="/assets/aistudio/Emblema_da_Masmorra_com_Espada_e_Cristal_8fabb493.png"
            alt="Emblema da Masmorra"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <ClassIcon classId="warrior" className={`${ICON_SIZES[size]} text-[#d4a64a]`} />
        )}
      </div>
    );
  }

  const cls = CLASSES[avatarId as ClassId] ?? CLASSES.warrior;

  return (
    <div
      className={`${SIZE_CLASSES[size]} shrink-0 flex items-center justify-center bg-[#14111c] border ${className}`}
      style={{
        borderColor: `${cls.accentColor}88`,
        color: cls.accentColor,
      }}
    >
      <ClassIcon classId={cls.id} className={ICON_SIZES[size]} />
    </div>
  );
}
