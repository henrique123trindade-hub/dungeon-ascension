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

export interface BridgeCallbacks {
  onHudUpdate: (hud: RunHUDSnapshot) => void;
  onLevelUpOffer: (options: UpgradeOption[], newLevel: number) => void;
  onEventTrigger: (payload: ActiveEventPayload) => void;
  onSynergyUnlocked: (synergyId: SynergyId) => void;
  onEnemyKilled: (archetypeOrBossId: string, isBoss: boolean) => void;
  onRunEnded: (summary: RunSummarySnapshot) => void;
  onQuickSaveProgress: (delta: {
    floor: number;
    level: number;
    crystalsDelta: number;
  }) => void;
}

export interface DungeonController {
  startNewRun: (classId: ClassId, save: SaveData) => void;
  setPaused: (paused: boolean) => void;
  selectUpgrade: (option: UpgradeOption) => void;
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
  stopRun: () => void;
  getCurrentHud: () => RunHUDSnapshot | null;
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

  public emitLevelUp(options: UpgradeOption[], newLevel: number) {
    this.callbacks?.onLevelUpOffer(options, newLevel);
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
}

export const phaserBridge = new PhaserBridge();
