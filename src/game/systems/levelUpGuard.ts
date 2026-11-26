import type { UpgradeOption } from '../types';

export const LEVEL_UP_LOCK_MS = 800;
export const LEVEL_UP_RESUME_TRANSITION_MS = 300;
export const LEVEL_UP_NEXT_OFFER_DELAY_MS = 190;

export interface LevelUpGuardState {
  openedAtMs: number;
  lockDurationMs: number;
  /** True while any primary pointer button is currently held down. */
  pointerHeld: boolean;
  /** True if pointer was held at open or pressed during lock; requires a full release before unlocking. */
  requirePointerRelease: boolean;
  /** Option ID whose fresh pointerdown started strictly AFTER unlock. */
  armedOptionId: string | null;
  /** Pointer ID associated with the armed press so stray/multi pointers cannot misfire. */
  armedPointerId: number | null;
  /** Keys ('Digit1'|'Digit2'|'Digit3') that were already held before unlock and must be released first. */
  heldBlockedKeys: ReadonlyArray<string>;
  /** Set once a valid selection has been committed for this offer. */
  chosenOptionId: string | null;
}

export function createLevelUpGuard(
  openedAtMs: number,
  initialPointerHeld: boolean,
  initialHeldKeys: string[] = [],
  lockDurationMs: number = LEVEL_UP_LOCK_MS
): LevelUpGuardState {
  const blocked = initialHeldKeys.filter((k) => k === 'Digit1' || k === 'Digit2' || k === 'Digit3');
  return {
    openedAtMs,
    lockDurationMs,
    pointerHeld: initialPointerHeld,
    requirePointerRelease: initialPointerHeld,
    armedOptionId: null,
    armedPointerId: null,
    heldBlockedKeys: blocked,
    chosenOptionId: null,
  };
}

export function getLevelUpLockRemainingMs(state: LevelUpGuardState, nowMs: number): number {
  return Math.max(0, state.openedAtMs + state.lockDurationMs - nowMs);
}

export function isLevelUpTimerReady(state: LevelUpGuardState, nowMs: number): boolean {
  return getLevelUpLockRemainingMs(state, nowMs) <= 0;
}

/**
 * Selection is unlocked ONLY when:
 * 1. No choice has been committed yet.
 * 2. At least `lockDurationMs` (800ms) have elapsed since the offer opened.
 * 3. Any mouse button held before or pressed during the lock has been fully released.
 */
export function isLevelUpUnlocked(state: LevelUpGuardState, nowMs: number): boolean {
  if (state.chosenOptionId !== null) return false;
  if (!isLevelUpTimerReady(state, nowMs)) return false;
  if (state.requirePointerRelease || state.pointerHeld) return false;
  return true;
}

/**
 * Global pointerdown (anywhere on window) while the modal is open.
 * If it happens while locked, it re-arms `requirePointerRelease` so spam-clicks
 * or presses started during the lock can never carry across the unlock boundary.
 */
export function onGuardGlobalPointerDown(state: LevelUpGuardState, nowMs: number): LevelUpGuardState {
  if (state.chosenOptionId !== null) return state;
  const locked = !isLevelUpTimerReady(state, nowMs) || state.requirePointerRelease;
  return {
    ...state,
    pointerHeld: true,
    requirePointerRelease: locked ? true : state.requirePointerRelease,
    armedOptionId: locked ? null : state.armedOptionId,
    armedPointerId: locked ? null : state.armedPointerId,
  };
}

/**
 * Global pointerup / pointercancel / window blur.
 * Satisfies the release requirement once the button is up.
 */
export function onGuardGlobalPointerUp(state: LevelUpGuardState): LevelUpGuardState {
  return {
    ...state,
    pointerHeld: false,
    requirePointerRelease: false,
    armedOptionId: null,
    armedPointerId: null,
  };
}

/**
 * Pointermove observation: if OS reports `buttons > 0` while we thought pointer wasn't held
 * (e.g., button held before modal mounted in an iframe), enforce release before unlocking.
 */
export function onGuardPointerButtonsObserved(
  state: LevelUpGuardState,
  buttonsMask: number,
  nowMs: number
): LevelUpGuardState {
  if (state.chosenOptionId !== null) return state;
  const isDown = (buttonsMask & 1) !== 0;
  if (isDown && !state.pointerHeld) {
    const locked = !isLevelUpTimerReady(state, nowMs) || state.requirePointerRelease;
    return {
      ...state,
      pointerHeld: true,
      requirePointerRelease: locked ? true : state.requirePointerRelease,
      armedOptionId: null,
      armedPointerId: null,
    };
  }
  if (!isDown && (state.pointerHeld || state.requirePointerRelease)) {
    return {
      ...state,
      pointerHeld: false,
      requirePointerRelease: false,
    };
  }
  return state;
}

/**
 * Pointerdown specifically on a Power-Up card.
 * Only arms selection if the modal is ALREADY fully unlocked right at pointerdown time.
 */
export function onGuardCardPointerDown(
  state: LevelUpGuardState,
  optionId: string,
  pointerId: number,
  nowMs: number
): LevelUpGuardState {
  const isLocked =
    state.chosenOptionId !== null || !isLevelUpTimerReady(state, nowMs) || state.requirePointerRelease;
  if (isLocked) {
    return {
      ...state,
      pointerHeld: true,
      requirePointerRelease: true,
      armedOptionId: null,
      armedPointerId: null,
    };
  }
  return {
    ...state,
    pointerHeld: true,
    armedOptionId: optionId,
    armedPointerId: pointerId,
  };
}

/**
 * Pointerup / click completion on a Power-Up card.
 * Commits immediately in a single intentional click ONLY if `pointerdown` armed this exact card after unlock.
 */
export function onGuardCardPointerUp(
  state: LevelUpGuardState,
  optionId: string,
  pointerId: number,
  nowMs: number
): { next: LevelUpGuardState; accepted: boolean } {
  const canCommit =
    state.chosenOptionId === null &&
    isLevelUpTimerReady(state, nowMs) &&
    !state.requirePointerRelease &&
    state.armedOptionId === optionId &&
    (state.armedPointerId === null || state.armedPointerId === pointerId);

  if (!canCommit) {
    return {
      accepted: false,
      next: {
        ...state,
        pointerHeld: false,
        requirePointerRelease: false,
        armedOptionId: null,
        armedPointerId: null,
      },
    };
  }

  return {
    accepted: true,
    next: {
      ...state,
      pointerHeld: false,
      requirePointerRelease: false,
      armedOptionId: null,
      armedPointerId: null,
      chosenOptionId: optionId,
    },
  };
}

export function onGuardKeyDown(
  state: LevelUpGuardState,
  code: string,
  isRepeat: boolean,
  options: ReadonlyArray<UpgradeOption>,
  nowMs: number
): { next: LevelUpGuardState; chosenOption: UpgradeOption | null } {
  const slotIdx = code === 'Digit1' ? 0 : code === 'Digit2' ? 1 : code === 'Digit3' ? 2 : -1;
  if (slotIdx === -1) return { next: state, chosenOption: null };

  if (state.chosenOptionId !== null) {
    return { next: state, chosenOption: null };
  }

  // If pressed before unlock, record key so holding it across 800ms never auto-triggers
  if (!isLevelUpUnlocked(state, nowMs)) {
    const held = state.heldBlockedKeys.includes(code)
      ? state.heldBlockedKeys
      : [...state.heldBlockedKeys, code];
    return { next: { ...state, heldBlockedKeys: held }, chosenOption: null };
  }

  if (isRepeat || state.heldBlockedKeys.includes(code)) {
    return { next: state, chosenOption: null };
  }

  const target = options[slotIdx];
  if (!target) return { next: state, chosenOption: null };

  return {
    chosenOption: target,
    next: {
      ...state,
      armedOptionId: null,
      armedPointerId: null,
      chosenOptionId: target.id,
    },
  };
}

export function onGuardKeyUp(state: LevelUpGuardState, code: string): LevelUpGuardState {
  if (!state.heldBlockedKeys.includes(code)) return state;
  return {
    ...state,
    heldBlockedKeys: state.heldBlockedKeys.filter((k) => k !== code),
  };
}

/**
 * Extracts crisp structured benefit highlights for hover emphasis on Power-Up cards.
 */
export function extractUpgradeHighlights(option: UpgradeOption): string[] {
  const tags: string[] = [];

  if (option.kind === 'multiplier' && option.multDelta) {
    const labels: Record<typeof option.multDelta.field, string> = {
      damageMult: 'Dano Total',
      attackSpeedMult: 'Vel. Ataque',
      xpMult: 'Experiência',
      goldMult: 'Ouro',
      bossDamageMult: 'Dano vs Chefes',
    };
    tags.push(`${labels[option.multDelta.field]} ×${option.multDelta.factor}`);
    tags.push('Multiplicador da Expedição');
  } else if (option.kind === 'skill') {
    if (option.evolvedName) {
      tags.push(`Evolução: ${option.evolvedName}`);
    }
    if (option.nextSkillLevel) {
      tags.push(`Nível ${option.nextSkillLevel}`);
    }
    if (option.synergyHint) {
      tags.push(option.synergyHint);
    }
  } else if (option.statDelta) {
    const d = option.statDelta;
    if (d.damagePct) tags.push(`+${Math.round(d.damagePct * 100)}% Dano`);
    if (d.attackSpeedPct) tags.push(`+${Math.round(d.attackSpeedPct * 100)}% Vel. Ataque`);
    if (d.critChance) tags.push(`+${Math.round(d.critChance * 100)}% Crítico`);
    if (d.critDamage) tags.push(`+${Math.round(d.critDamage * 100)}% Dano Crítico`);
    if (d.moveSpeedPct) tags.push(`+${Math.round(d.moveSpeedPct * 100)}% Velocidade`);
    if (d.maxHpPct) tags.push(`+${Math.round(d.maxHpPct * 100)}% Vida Máxima`);
    if (d.lifeSteal) tags.push(`+${Math.round(d.lifeSteal * 100)}% Roubo de Vida`);
    if (d.dodge) tags.push(`+${Math.round(d.dodge * 100)}% Esquiva`);
    if (d.xpGainPct) tags.push(`+${Math.round(d.xpGainPct * 100)}% EXP`);
    if (d.rangePct) tags.push(`+${Math.round(d.rangePct * 100)}% Alcance`);
    if (d.cooldownReduction) tags.push(`-${Math.round(d.cooldownReduction * 100)}% Recarga`);
    if (d.luck) tags.push(`+${Math.round(d.luck)} Sorte`);
    if (d.extraProjectiles) tags.push(`+${d.extraProjectiles} Projétil`);
    if (d.piercing) tags.push(`+${d.piercing} Perfuração`);
  }

  return tags;
}
