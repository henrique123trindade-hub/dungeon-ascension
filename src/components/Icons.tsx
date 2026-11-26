import type { ClassId, EquipmentSlot, SkillId } from '../game/types';

export function DungeonTitleCrest() {
  return (
    <svg
      viewBox="0 0 460 154"
      className="w-full max-w-[440px] h-auto select-none"
      role="img"
      aria-label="Dungeon Ascension"
    >
      <defs>
        <linearGradient id="goldLeaf" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8e3a8" />
          <stop offset="52%" stopColor="#d4a64a" />
          <stop offset="100%" stopColor="#8c6222" />
        </linearGradient>
        <linearGradient id="crimsonSteel" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6b1d1d" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#6b1d1d" />
        </linearGradient>
      </defs>

      {/* Ornamental top sword & crown crest */}
      <g transform="translate(230, 26)">
        <path
          d="M-96 0 L-22 0 L-12 -8 L0 -18 L12 -8 L22 0 L96 0"
          fill="none"
          stroke="#d4a64a"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        <polygon points="0,-16 6,-6 0,6 -6,-6" fill="#dc2626" stroke="#f8e3a8" strokeWidth="1.2" />
        <polygon points="-24,0 -18,-4 -12,0 -18,4" fill="#d4a64a" />
        <polygon points="24,0 18,-4 12,0 18,4" fill="#d4a64a" />
      </g>

      {/* Primary Display Title */}
      <text
        x="230"
        y="84"
        textAnchor="middle"
        fill="url(#goldLeaf)"
        stroke="#09080c"
        strokeWidth="5"
        paintOrder="stroke fill"
        style={{
          fontFamily: "'Cinzel', Georgia, serif",
          fontSize: '46px',
          fontWeight: 800,
          letterSpacing: '0.14em',
        }}
      >
        DUNGEON
      </text>

      {/* Hairline crimson divider */}
      <rect x="64" y="96" width="332" height="2" fill="url(#crimsonSteel)" />

      {/* Subtitle Ascension */}
      <text
        x="230"
        y="132"
        textAnchor="middle"
        fill="#e8e3d9"
        stroke="#09080c"
        strokeWidth="4"
        paintOrder="stroke fill"
        style={{
          fontFamily: "'Cinzel', Georgia, serif",
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '0.32em',
        }}
      >
        ASCENSION
      </text>
    </svg>
  );
}

export function ClassIcon({ classId, className = 'w-6 h-6' }: { classId: ClassId; className?: string }) {
  switch (classId) {
    case 'warrior':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18.5 3.5L13 9m0 0l-5.5 5.5m5.5-5.5l2.5 2.5m-8 3L5 17l2 2 2.5-2.5m-2-2l2 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 3l2 2-6 6-2-2 6-6z" fill="currentColor" fillOpacity="0.22" />
          <path d="M4 20l2-2" strokeLinecap="round" />
        </svg>
      );
    case 'assassin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 19L19 5M14 5h5v5M5 5l14 14M5 14v5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'mage':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="15" cy="7" r="3.5" fill="currentColor" fillOpacity="0.25" />
          <path d="M12.5 9.5L4.5 19.5" strokeLinecap="round" />
          <path d="M15 2v1.5M20 7h-1.5M18.5 3.5l-1 1" strokeLinecap="round" />
        </svg>
      );
    case 'necromancer':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3a7 7 0 00-7 7c0 2.5 1.3 4.7 3.2 5.9V19h7.6v-3.1A7 7 0 0012 3z" fill="currentColor" fillOpacity="0.18" />
          <circle cx="9.5" cy="10.5" r="1.2" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="1.2" fill="currentColor" />
          <path d="M10 19v2m4-2v2" strokeLinecap="round" />
        </svg>
      );
    case 'archer':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 18C4.5 13 6.5 7 12 4.5" strokeLinecap="round" />
          <path d="M6 18c5 1.5 11-.5 13.5-6" strokeLinecap="round" />
          <path d="M5 19L19 5M14 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'slatt':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          {/* Stylized monkey crest with bandana & ears */}
          <circle cx="5.5" cy="11" r="2.2" fill="currentColor" fillOpacity="0.2" />
          <circle cx="18.5" cy="11" r="2.2" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="12.5" r="6.2" fill="currentColor" fillOpacity="0.22" />
          <path d="M6.5 9.2h11" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="9.8" cy="12" r="0.9" fill="currentColor" />
          <circle cx="14.2" cy="12" r="0.9" fill="currentColor" />
          <path d="M9.6 15.2c1.2.9 3.6.9 4.8 0" strokeLinecap="round" />
        </svg>
      );
  }
}

export function SkillIcon({ skillId, className = 'w-5 h-5' }: { skillId: SkillId; className?: string }) {
  switch (skillId) {
    case 'fireball':
    case 'meteor_shower':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3c2.8 3.2 5 5.6 5 9.2a5 5 0 11-10 0c0-1.9.9-3.8 2.2-5.4.2 1.6 1 2.7 2 3.2C11.4 7.5 11.7 5.2 12 3z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case 'chain_lightning':
    case 'electric_aura':
    case 'celestial_bolt':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 2L4.5 13.5H11L10 22l9.5-11.5H13L13 2z" fill="currentColor" fillOpacity="0.24" strokeLinejoin="round" />
        </svg>
      );
    case 'shadow_slash':
    case 'orbital_blades':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 18C6 10 12 5 20 4c-2 7-7 13-16 14z" fill="currentColor" fillOpacity="0.24" strokeLinejoin="round" />
        </svg>
      );
    case 'divine_shield':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" fill="currentColor" fillOpacity="0.24" />
        </svg>
      );
    case 'regeneration':
    case 'life_drain':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case 'time_freeze':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" strokeLinecap="round" />
        </svg>
      );
    case 'black_hole':
    case 'arcane_blast':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <circle cx="12" cy="12" r="8.5" strokeDasharray="4 3" />
        </svg>
      );
    case 'shadow_summon':
    case 'demonic_fury':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l6 7-2 10H8L6 10l6-7z" fill="currentColor" fillOpacity="0.24" />
          <path d="M9.5 11.5h1.5m2 0h1.5" strokeLinecap="round" />
        </svg>
      );
    case 'banana_bomb':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 17c4 2 10 0 12-7-3 3-7 4-11 2-1.5-.7-2 3.5-1 5z" fill="currentColor" fillOpacity="0.28" strokeLinejoin="round" />
          <path d="M17.5 6.5L20 4m-3.5.5l.8-2.2M20 7.5l2-.6" strokeLinecap="round" />
        </svg>
      );
    case 'banana_peel':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 6c-3 2-6 6-8 10 3 0 6-1 8-4 2 3 5 4 8 4-2-4-5-8-8-10z" fill="currentColor" fillOpacity="0.26" strokeLinejoin="round" />
          <path d="M12 10v8M6 19.5h12" strokeLinecap="round" />
        </svg>
      );
    case 'primate_fury':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 3L6 13h5l-1 8 8-11h-5l0-7z" fill="currentColor" fillOpacity="0.26" strokeLinejoin="round" />
          <path d="M4 8l2 1m14 5l-2-1" strokeLinecap="round" />
        </svg>
      );
    case 'banana_rain':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 10c2 1 5 0 6-4-1.6 1.5-3.8 2.2-6 1.2z" fill="currentColor" fillOpacity="0.28" strokeLinejoin="round" />
          <path d="M12 15c2.2 1 5.2 0 6.2-4-1.6 1.5-3.8 2.2-6.2 1.2z" fill="currentColor" fillOpacity="0.28" strokeLinejoin="round" />
          <path d="M6 19c2 1 4.8 0 5.8-3.6-1.5 1.4-3.6 2-5.8 1z" fill="currentColor" fillOpacity="0.28" strokeLinejoin="round" />
        </svg>
      );
    case 'primate_instinct':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 15c3.5 1.8 8.5 0 10.5-6-2.5 2.4-6 3.2-9.5 1.5" fill="currentColor" fillOpacity="0.22" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 19c3.5 1.8 8.5 0 10.5-6-2.5 2.4-6 3.2-9.5 1.5" fill="currentColor" fillOpacity="0.26" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function EquipmentSlotIcon({ slot, className = 'w-5 h-5' }: { slot: EquipmentSlot; className?: string }) {
  switch (slot) {
    case 'weapon':
      return <ClassIcon classId="warrior" className={className} />;
    case 'armor':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 4l6 2 6-2 2 5-3 2v9H7v-9L4 9l2-5z" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round" />
        </svg>
      );
    case 'helmet':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 14a7 7 0 0114 0v5h-4v-3H9v3H5v-5z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 'boots':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4h5v9l5 2v4H6v-3l1-12z" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round" />
        </svg>
      );
    case 'ring':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="14" r="6" />
          <polygon points="12,4 15,7 12,9 9,7" fill="currentColor" />
        </svg>
      );
    case 'amulet':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4c0 4 2.2 6.5 5 6.5S17 8 17 4" />
          <polygon points="12,10.5 16,15.5 12,20.5 8,15.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case 'artifact':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="12,2 20,8 17,20 7,20 4,8" fill="currentColor" fillOpacity="0.22" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      );
  }
}

export function CrystalIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="12,2 19,10 15,22 9,22 5,10" fill="currentColor" fillOpacity="0.3" strokeLinejoin="round" />
      <path d="M12 2v20" strokeOpacity="0.55" />
    </svg>
  );
}

export function GoldCoinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.25" />
      <circle cx="12" cy="12" r="4.5" strokeOpacity="0.6" />
    </svg>
  );
}

export function SecretKeyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="12" r="4" fill="currentColor" fillOpacity="0.22" />
      <path d="M12 12h9m-3 0v3m-3-3v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
