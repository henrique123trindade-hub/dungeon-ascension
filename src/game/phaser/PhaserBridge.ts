import type {
  ActiveEventPayload,
  ClassId,
  EquipmentItem,
  EquipmentSlot,
  RunHUDSnapshot,
  RunSummarySnapshot,
  SaveData,
  SettingsData,
  SkillId,
  SynergyId,
  UpgradeOption,
} from '../types';

export interface LevelUpOfferPayload {
  offerId: number;
  level: number;
  pendingCount: number;
  options: UpgradeOption[];
  pointerWasDown: boolean;
}

export interface BossDialogueEventPayload {
  bossId: string;
  bossName: string;
  stage: 'intro' | 'midPhase' | 'defeat';
  text: string;
  accentColor: string;
}

export interface BridgeCallbacks {
  onHudUpdate: (hud: RunHUDSnapshot) => void;
  onLevelUpOffer: (payload: LevelUpOfferPayload) => void;
  onEventTrigger: (payload: ActiveEventPayload) => void;
  onSynergyUnlocked: (synergyId: SynergyId) => void;
  onEnemyKilled: (archetypeOrBossId: string, isBoss: boolean) => void;
  onRunEnded: (summary: RunSummarySnapshot) => void;
  onQuickSaveProgress: (delta: {
    floor: number;
    level: number;
    crystalsDelta: number;
  }) => void;
  onFloorEntered?: (floor: number, previousFloor: number) => void;
  onBossDialogue?: (payload: BossDialogueEventPayload) => void;
  onBossDefeatedNarrative?: (bossId: string, floor: number) => void;
  onMemoryFragmentSource?: (
    source: 'boss' | 'chest' | 'altar' | 'event' | 'secret_room' | 'exploration',
    floor: number,
    bossId?: string
  ) => void;
  onMythicPicked?: () => void;
}

export interface DungeonController {
  startNewRun: (classId: ClassId, save: SaveData) => void;
  setPaused: (paused: boolean) => void;
  selectUpgrade: (option: UpgradeOption) => { hasMorePending: boolean };
  openNextPendingLevelUp: () => void;
  resumeAfterLevelUp: () => void;
  resolveEventChoice: (choiceId: string) => void;
  equipItem: (itemId: string) => void;
  unequipSlot: (slot: EquipmentSlot) => void;
  upgradeItem: (itemId: string) => boolean;
  sellItem: (itemId: string) => void;
  discardItem: (itemId: string) => void;
  assignSkillToSlot: (skillId: SkillId, slotIndex: number) => void;
  castSkillSlot: (slotIndex: number) => void;
  triggerDash: () => void;
  triggerInteract: () => void;
  setMobileInput: (moveX: number, moveY: number, aimX: number, aimY: number, firing: boolean) => void;
  applySettings: (settings: SettingsData) => void;
  clearHeldInputs: () => void;
  hasPendingCast: () => boolean;
  cancelPendingCast: () => void;
  stopRun: () => void;
  getCurrentHud: () => RunHUDSnapshot | null;
  debugGrantXp?: (amount: number) => void;
  debugJumpToFloor?: (floor: number) => void;
}

class PhaserBridge {
  private controller: DungeonController | null = null;
  private callbacks: BridgeCallbacks | null = null;

  public registerController(ctrl: DungeonController) {
    this.controller = ctrl;
  }

  public unregisterController() {
    this.controller = null;
  }

  public setCallbacks(cb: BridgeCallbacks | null) {
    this.callbacks = cb;
  }

  public getController(): DungeonController | null {
    return this.controller;
  }

  public emitHud(hud: RunHUDSnapshot) {
    this.callbacks?.onHudUpdate(hud);
  }

  public emitLevelUp(payload: LevelUpOfferPayload) {
    this.callbacks?.onLevelUpOffer(payload);
  }

  public emitEvent(payload: ActiveEventPayload) {
    this.callbacks?.onEventTrigger(payload);
  }

  public emitSynergy(id: SynergyId) {
    this.callbacks?.onSynergyUnlocked(id);
  }

  public emitKill(id: string, isBoss: boolean) {
    this.callbacks?.onEnemyKilled(id, isBoss);
  }

  public emitRunEnded(summary: RunSummarySnapshot) {
    this.callbacks?.onRunEnded(summary);
  }

  public emitQuickSave(delta: { floor: number; level: number; crystalsDelta: number }) {
    this.callbacks?.onQuickSaveProgress(delta);
  }

  public emitFloorEntered(floor: number, previousFloor: number) {
    this.callbacks?.onFloorEntered?.(floor, previousFloor);
  }

  public emitBossDialogue(payload: BossDialogueEventPayload) {
    this.callbacks?.onBossDialogue?.(payload);
  }

  public emitBossDefeatedNarrative(bossId: string, floor: number) {
    this.callbacks?.onBossDefeatedNarrative?.(bossId, floor);
  }

  public emitMemoryFragmentSource(
    source: 'boss' | 'chest' | 'altar' | 'event' | 'secret_room' | 'exploration',
    floor: number,
    bossId?: string
  ) {
    this.callbacks?.onMemoryFragmentSource?.(source, floor, bossId);
  }

  public emitMythicPicked() {
    this.callbacks?.onMythicPicked?.();
  }
}

export const phaserBridge = new PhaserBridge();
