import Phaser from 'phaser';
import { BALANCE_CONFIG } from '../data/balanceConfig';
import { getBiomeForFloor, getInfiniteModifierForFloor } from '../data/biomes';
import { getBossForFloor, isBossFloor } from '../data/bosses';
import { CLASSES, getClassEvolution } from '../data/classes';
import { ELITE_MODIFIER_LIST, ELITE_MODIFIERS, ENEMY_ARCHETYPES, ENEMY_LIST } from '../data/enemies';
import { computeActiveSynergies, getSkillEvolutionTier, SKILLS } from '../data/skills';
import { audioEngine } from '../systems/audioEngine';
import {
  calculateAttackDamage,
  COMBO_MIN_HITS,
  COMBO_WINDOW_SEC,
  computeComboMultiplier,
  computePlayerStats,
  createEmptyModifiers,
  createStarterWeapon,
  FloorWavePlan,
  generateDungeonLayout,
  generateEquipmentItem,
  generateLevelUpOptions,
  getEliteChance,
  getEnemyScaling,
  getEquipmentUpgradeCost,
  getFloorEnemyCount,
  getFloorWavePlan,
  RARITY_META,
  xpForLevel,
} from '../systems/balance';
import type {
  ActiveEventPayload,
  ActiveSkillSlotHUD,
  BossDef,
  CastMode,
  ClassId,
  ComputedPlayerStats,
  EliteModifierId,
  EnemyArchetypeId,
  EquipmentItem,
  EquipmentSlot,
  PermanentUpgrades,
  RunHUDSnapshot,
  RunSummarySnapshot,
  SaveData,
  SettingsData,
  SkillId,
  StatModifiers,
  SynergyId,
  UpgradeOption,
} from '../types';
import {
  AutoTargetResult,
  computeBasicAttackSpec,
  computeDashGeometrySpec,
  computeSkillGeometrySpec,
  DASH_DURATION_SEC,
  DASH_SPEED_MULT,
  evaluateSkillCast,
  findConeTargets,
  resolveCastMode,
  selectAutoAttackTarget,
  TargetableEnemy,
} from '../systems/targeting';
import { DungeonController, phaserBridge } from './PhaserBridge';
import { TargetingRenderer } from './TargetingRenderer';
import { generateAllGameTextures } from './TextureFactory';
import { computeCameraZoom } from './viewportCamera';

const HERO_BASE_SCALE = 0.62;

interface EnemyEntity {
  id: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  hpBarBorder: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarGhost: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  eliteMarker?: Phaser.GameObjects.Rectangle;
  auraRing?: Phaser.GameObjects.Arc;
  bossOuterRing?: Phaser.GameObjects.Arc;
  archetypeId: EnemyArchetypeId;
  bossDef: BossDef | null;
  eliteMod: EliteModifierId | null;
  baseScale: number;
  hp: number;
  ghostHp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  resistance: number;
  xpValue: number;
  goldValue: number;
  aiTimer: number;
  attackCooldown: number;
  windupTimer: number;
  windupMax: number;
  windupAction: string | null;
  windupTargetX: number;
  windupTargetY: number;
  hasAttackToken: boolean;
  flashTimer: number;
  freezeTimer: number;
  slowTimer: number;
  slowFactor: number;
  knockVx: number;
  knockVy: number;
  dying: boolean;
  deathTimer: number;
  recoveryTimer: number;
  bossPhase: number;
  strafeDir: number;
  summonCount: number;
}

interface PendingWaveSpawn {
  archetypeId: EnemyArchetypeId;
  x: number;
  y: number;
  eliteMod: EliteModifierId | null;
  extraMult: number;
  timer: number;
  maxTimer: number;
}

interface ProjectileEntity {
  sprite: Phaser.Physics.Arcade.Sprite;
  fromPlayer: boolean;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  pierceLeft: number;
  hitIds: Set<number>;
  explosiveRadius: number;
  color: number;
  appliesSlow?: boolean;
  bonusCrit?: number;
  spinSpeed?: number;
}

interface ShadowMinion {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  life: number;
  attackCd: number;
  damage: number;
  speed: number;
  critChance: number;
  explodesOnEnd: boolean;
}

interface GroundHazard {
  x: number;
  y: number;
  radius: number;
  delay: number;
  maxDelay: number;
  fromPlayer: boolean;
  damage: number;
  color: number;
  kind: 'meteor' | 'boss_aoe' | 'mage_circle' | 'black_hole' | 'fire_tornado' | 'banana_peel' | 'banana_rain';
  duration: number;
  tickTimer: number;
  triggered: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  slowFactor?: number;
  triggeredEnemies?: Set<number>;
}

interface PickupEntity {
  sprite: Phaser.GameObjects.Sprite;
  kind: 'xp' | 'gold' | 'crystal' | 'potion' | 'gear';
  value: number;
  gearItem?: EquipmentItem;
  x: number;
  y: number;
  life: number;
}

interface InteractableEntity {
  id: string;
  kind: 'chest' | 'altar' | 'merchant' | 'dimension_portal';
  sprite: Phaser.GameObjects.Sprite;
  label: string;
  x: number;
  y: number;
  used: boolean;
}

interface PooledParticle {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startScale: number;
  drag: number;
}

interface PooledDamageText {
  text: Phaser.GameObjects.Text;
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
}

export class DungeonScene extends Phaser.Scene implements DungeonController {
  private isActiveRun = false;
  private isPaused = false;
  private isEndingRun = false;

  // Player & Run State
  private classId: ClassId = 'warrior';
  private permanentUpgrades: PermanentUpgrades = {
    startingDamage: 0,
    startingHp: 0,
    luck: 0,
    xpGain: 0,
    goldGain: 0,
    resistance: 0,
    rareLootChance: 0,
  };
  private ascensionLevel = 0;
  private bestFloorRecord = 0;
  private settings: SettingsData = {
    masterVolume: 0.7,
    sfxVolume: 0.85,
    muted: false,
    graphicsQuality: 'high',
    screenShake: true,
    damageNumbers: true,
    mobileControls: 'auto',
    autoAttack: true,
    showAttackRange: true,
    defaultCastMode: 'quick_indicator',
    dashCastMode: 'quick_indicator',
    skillCastModes: {},
  };

  private level = 1;
  private xp = 0;
  private xpToNext = 48;
  private hp = 150;
  private shield = 0;
  private shieldRegenTimer = 0;
  private floor = 1;
  private gold = 0;
  private crystalsRun = 0;
  private kills = 0;
  private bossesKilled = 0;
  private elapsedSec = 0;
  private mods: StatModifiers = createEmptyModifiers();
  private skills: Partial<Record<SkillId, number>> = {};
  private activeSlotSkills: Array<SkillId | null> = [null, null, null, null];
  private skillCooldowns: Partial<Record<SkillId, number>> = {};
  private activeSynergies: SynergyId[] = [];
  private equipped: Partial<Record<EquipmentSlot, EquipmentItem>> = {};
  private inventory: EquipmentItem[] = [];
  private computedStats!: ComputedPlayerStats;

  // Buffs & Floor state
  private furyTimer = 0;
  private primateFuryTimer = 0;
  private swiftKillTimer = 0;
  private playerSlowTimer = 0;
  private invulnTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  private dashBufferTimer = 0;
  private attackCooldown = 0;
  private gaitDist = 0;
  private electricAuraTimer = 0;
  private regenTimer = 0;
  private lifeDrainTimer = 0;
  private fireTornadoTimer = 0;
  private orbitalAngle = 0;
  private orbitalSprites: Phaser.GameObjects.Sprite[] = [];
  private orbitalHitMap = new Map<number, number>();

  // Floor & Dungeon objects
  private roomWidth = 1280;
  private roomHeight = 960;
  private tileGroup?: Phaser.GameObjects.Group;
  private wallGroup?: Phaser.Physics.Arcade.StaticGroup;
  private propGroup?: Phaser.GameObjects.Group;
  private portalSprite?: Phaser.GameObjects.Sprite;
  private portalPos = { x: 640, y: 150 };
  private portalOpen = false;
  private portalTransitionLock = false;
  private pillarsLayout: Array<{ x: number; y: number; w: number; h: number }> = [];
  private floorModifierText: string | null = null;
  private floorRewardMult = 1;
  private cursedFloorMult = 1;
  private floorHasChaosSeal = false;
  private enemiesTotalOnFloor = 0;
  private floorWavePlan: FloorWavePlan = { waves: [], totalEnemies: 0 };
  private currentWaveIndex = 0;
  private pendingWaveSpawns: PendingWaveSpawn[] = [];
  private timedChallenge: { remainingSec: number; totalSec: number; rewarded: boolean } | null = null;
  private activeEventRef: InteractableEntity | null = null;
  private merchantStock: EquipmentItem[] = [];

  // Actors & Pools
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerFootRing?: Phaser.GameObjects.Arc;
  private playerShadowGlow?: Phaser.GameObjects.Sprite;
  private playerShieldRing?: Phaser.GameObjects.Arc;
  private telegraphGraphics!: Phaser.GameObjects.Graphics;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private enemies: EnemyEntity[] = [];
  private enemyIdCounter = 1;
  private activeAttackTokens = 0;
  private projectiles: ProjectileEntity[] = [];
  private minions: ShadowMinion[] = [];
  private hazards: GroundHazard[] = [];
  private pickups: PickupEntity[] = [];
  private interactables: InteractableEntity[] = [];
  private particlePool: PooledParticle[] = [];
  private particleCursor = 0;
  private damageTextPool: PooledDamageText[] = [];
  private damageTextCursor = 0;
  private brazierGlows: Array<{ img: Phaser.GameObjects.Image; phase: number; baseScale: number }> = [];
  private slashParity = false;
  private decalCount = 0;
  private lastDamagedAt = 0;
  private comboHits = 0;
  private comboTimer = 0;
  private footstepTimer = 0;

  // Juice, Timing & Input
  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private hudEmitTimer = 0;
  private ambientParticleTimer = 0;
  private noticeCounter = 1;
  private recentNotice: { text: string; tone: 'gold' | 'crimson' | 'violet' | 'emerald'; id: number } | null = null;
  private recentNoticeTimer = 0;
  private lastHudSnapshot: RunHUDSnapshot | null = null;
  private levelUpPendingQueue = 0;
  private levelUpOfferCounter = 1;
  private postModalClickSuppressTimer = 0;
  private keysHeld = new Set<string>();
  private mouseDown = false;
  private pointerScreenX = 0;
  private pointerScreenY = 0;
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private mobileAimX = 0;
  private mobileAimY = 0;
  private mobileFiring = false;
  private keyDownHandler?: (e: KeyboardEvent) => void;
  private keyUpHandler?: (e: KeyboardEvent) => void;
  private pointerMoveWindowHandler?: (e: PointerEvent) => void;

  // Dynamic Targeting, Auto-Attack & Cast Preview State
  private targetingRenderer?: TargetingRenderer;
  private autoTargetId: number | null = null;
  private lastAutoTarget: AutoTargetResult | null = null;
  private reticleRecoil = 0;
  private pointerInitialized = false;
  private pointerOverHud = false;
  private pendingCast: {
    kind: 'skill' | 'dash';
    slotIndex: number; // 0..3 for Q/E/R/F, -1 for Dash
    skillId: SkillId | null;
    mode: CastMode;
    keyCode: string;
  } | null = null;
  private cooldownPreview: {
    kind: 'skill' | 'dash';
    slotIndex: number;
    skillId: SkillId | null;
    timer: number;
  } | null = null;
  private forcedDashAngle: number | null = null;

  constructor() {
    super('DungeonScene');
  }

  public create() {
    generateAllGameTextures(this);

    this.cameras.main.setBackgroundColor('#0b0a0e');
    this.telegraphGraphics = this.add.graphics().setDepth(45);
    this.beamGraphics = this.add.graphics().setDepth(70);
    this.targetingRenderer = new TargetingRenderer(this);
    this.input.mouse?.disableContextMenu();

    // Default reticle position near upper-center until first pointer move
    this.pointerScreenX = this.scale.width * 0.5;
    this.pointerScreenY = this.scale.height * 0.36;

    // Pre-allocate zero-GC pools
    this.initPools();

    // Pointer tracking (supports Normal Cast confirm on LMB & cancel on RMB)
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isActiveRun || this.isPaused || this.postModalClickSuppressTimer > 0) return;
      const evTarget = ptr.event?.target;
      if (
        (evTarget instanceof Element &&
          (evTarget.closest('[data-hud-surface="true"]') || evTarget.closest('button'))) ||
        (evTarget && evTarget !== this.game.canvas)
      ) {
        return;
      }

      this.pointerScreenX = ptr.x;
      this.pointerScreenY = ptr.y;
      this.pointerInitialized = true;

      if (ptr.rightButtonDown()) {
        if (this.pendingCast) {
          this.cancelPendingCast();
        }
        return;
      }

      if (ptr.leftButtonDown()) {
        if (this.pendingCast && this.pendingCast.mode === 'normal') {
          const cast = this.pendingCast;
          this.pendingCast = null;
          this.cooldownPreview = null;
          if (cast.kind === 'dash') {
            this.executeDashTowardAim();
          } else {
            this.executeSkillSlot(cast.slotIndex);
          }
          return;
        }
        this.mouseDown = true;
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.pointerScreenX = ptr.x;
      this.pointerScreenY = ptr.y;
      this.pointerInitialized = true;
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.leftButtonDown()) {
        this.mouseDown = false;
      }
    });

    // Track pointer even while hovering over non-interactive HUD regions so reticle never freezes
    this.pointerMoveWindowHandler = (e: PointerEvent) => {
      const target = e.target;
      this.pointerOverHud = Boolean(
        target instanceof Element &&
          (target.closest('[data-hud-surface="true"]') || target.closest('button'))
      );
      const canvas = this.game.canvas;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.pointerScreenX = ((e.clientX - rect.left) / rect.width) * this.scale.width;
      this.pointerScreenY = ((e.clientY - rect.top) / rect.height) * this.scale.height;
      this.pointerInitialized = true;
    };
    window.addEventListener('pointermove', this.pointerMoveWindowHandler, { passive: true });

    // Global window key listeners (reliably work regardless of canvas focus)
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (!this.isActiveRun || this.isPaused) return;
      const code = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        this.keysHeld.add(code);
      }
      if (!e.repeat) {
        if (code === 'Space') {
          e.preventDefault();
          this.handleCastKeyDown('dash', -1, code);
        } else if (code === 'KeyQ') {
          this.handleCastKeyDown('skill', 0, code);
        } else if (code === 'KeyE') {
          this.handleCastKeyDown('skill', 1, code);
        } else if (code === 'KeyR') {
          this.handleCastKeyDown('skill', 2, code);
        } else if (code === 'KeyF') {
          this.handleCastKeyDown('skill', 3, code);
        } else if (code === 'KeyG') {
          this.triggerInteract();
        }
      }
    };
    this.keyUpHandler = (e: KeyboardEvent) => {
      const code = e.code;
      this.keysHeld.delete(code);
      if (!this.isActiveRun || this.isPaused) return;
      if (
        this.pendingCast &&
        this.pendingCast.mode === 'quick_indicator' &&
        this.pendingCast.keyCode === code
      ) {
        const cast = this.pendingCast;
        this.pendingCast = null;
        this.cooldownPreview = null;
        if (cast.kind === 'dash') {
          this.executeDashTowardAim();
        } else {
          this.executeSkillSlot(cast.slotIndex);
        }
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
      if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      if (this.pointerMoveWindowHandler) window.removeEventListener('pointermove', this.pointerMoveWindowHandler);
      this.targetingRenderer?.destroy();
      phaserBridge.unregisterController();
    });

    phaserBridge.registerController(this);
  }

  private handleScaleResize(gameSize: Phaser.Structs.Size) {
    if (!this.cameras?.main) return;
    const width = Math.max(320, Math.round(gameSize.width));
    const height = Math.max(240, Math.round(gameSize.height));
    this.cameras.main.setViewport(0, 0, width, height);
    if (this.isActiveRun) {
      this.syncCameraViewport(width, height);
    }
  }

  private syncCameraViewport(viewWidth?: number, viewHeight?: number) {
    const cam = this.cameras?.main;
    if (!cam) return;
    const w = Math.max(320, Math.round(viewWidth ?? this.scale.width));
    const h = Math.max(240, Math.round(viewHeight ?? this.scale.height));
    cam.setViewport(0, 0, w, h);
    cam.setBounds(0, 0, this.roomWidth, this.roomHeight);
    cam.setZoom(computeCameraZoom(w, h, this.roomWidth, this.roomHeight));
  }

  private initPools() {
    this.particlePool = [];
    for (let i = 0; i < 220; i++) {
      const sp = this.add.sprite(-9999, -9999, 'fx_spark').setDepth(75).setVisible(false);
      this.particlePool.push({
        sprite: sp,
        active: false,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0.3,
        startScale: 1,
        drag: 1,
      });
    }

    this.damageTextPool = [];
    for (let i = 0; i < 48; i++) {
      const txt = this.add
        .text(-9999, -9999, '', {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#09080c',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(90)
        .setVisible(false);
      this.damageTextPool.push({
        text: txt,
        active: false,
        vx: 0,
        vy: -48,
        life: 0,
        maxLife: 0.7,
        isCrit: false,
      });
    }
  }

  public applySettings(settings: SettingsData) {
    this.settings = { ...settings };
    audioEngine.applySettings(this.settings);
  }

  public clearHeldInputs() {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.mobileMoveX = 0;
    this.mobileMoveY = 0;
    this.mobileFiring = false;
    this.dashBufferTimer = 0;
    this.pendingCast = null;
    this.cooldownPreview = null;
    this.forcedDashAngle = null;
    this.autoTargetId = null;
    this.lastAutoTarget = null;
    this.pointerOverHud = false;
  }

  public hasPendingCast(): boolean {
    return this.pendingCast !== null;
  }

  public cancelPendingCast() {
    this.pendingCast = null;
    this.cooldownPreview = null;
    this.forcedDashAngle = null;
    this.emitHudSnapshot(false);
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.clearHeldInputs();
      this.targetingRenderer?.clear();
      if (this.player?.body) {
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
      for (const e of this.enemies) {
        if (e.sprite.body) (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }
  }

  public stopRun() {
    this.isActiveRun = false;
    this.isPaused = false;
    this.isEndingRun = false;
    this.clearHeldInputs();
    this.clearFloorEntities();
    if (this.player) {
      this.player.destroy();
    }
    this.playerFootRing?.destroy();
    this.playerShadowGlow?.destroy();
    this.playerShieldRing?.destroy();
    this.clearOrbitals();
    this.telegraphGraphics?.clear();
    this.beamGraphics?.clear();
    this.targetingRenderer?.clear();
    this.autoTargetId = null;
    this.lastAutoTarget = null;
    this.postModalClickSuppressTimer = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
  }

  public getCurrentHud(): RunHUDSnapshot | null {
    return this.lastHudSnapshot;
  }

  public startNewRun(classId: ClassId, save: SaveData) {
    this.stopRun();

    this.classId = classId;
    this.permanentUpgrades = { ...save.permanentUpgrades };
    this.ascensionLevel = save.ascensionLevel;
    this.bestFloorRecord = save.bestFloor;
    this.applySettings(save.settings);

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.floor = 1;
    this.gold = 25;
    this.crystalsRun = 0;
    this.kills = 0;
    this.bossesKilled = 0;
    this.elapsedSec = 0;
    this.mods = createEmptyModifiers();
    this.skills = {};
    this.activeSlotSkills = [null, null, null, null];
    this.skillCooldowns = {};
    this.activeSynergies = [];
    this.equipped = {};
    this.inventory = [];
    this.levelUpPendingQueue = 0;
    this.postModalClickSuppressTimer = 0;
    this.furyTimer = 0;
    this.primateFuryTimer = 0;
    this.swiftKillTimer = 0;
    this.playerSlowTimer = 0;
    this.invulnTimer = 0.6;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.attackCooldown = 0;
    this.hitstopTimer = 0;
    this.shakeTrauma = 0;
    this.lastDamagedAt = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.footstepTimer = 0;
    this.isPaused = false;
    this.isEndingRun = false;
    this.isActiveRun = true;

    // Starting class weapon (deterministic modest starter) + starting skills
    const cls = CLASSES[classId];
    this.equipped.weapon = createStarterWeapon(classId);

    for (const sk of cls.startingSkills) {
      this.grantSkillLevel(sk, 1, false);
    }

    this.recomputeStats(true);

    // Spawn supersampled 96x96 hero sprite scaled to crisp 0.62 display scale
    this.player = this.physics.add
      .sprite(640, 760, `hero_${classId}`)
      .setScale(HERO_BASE_SCALE)
      .setDepth(55)
      .setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const heroBodyR = Math.round(14.5 / HERO_BASE_SCALE);
    body.setCircle(heroBodyR, 48 - heroBodyR, 51 - heroBodyR);

    const accentHex = Phaser.Display.Color.HexStringToColor(cls.accentColor).color;

    // High-contrast ground reticle ring under hero so player is unmistakable in dense fights
    this.playerFootRing = this.add
      .circle(640, 760, 21, accentHex, 0.08)
      .setStrokeStyle(1.8, 0xf8e3a8, 0.52)
      .setDepth(43);

    this.playerShadowGlow = this.add
      .sprite(640, 760, 'fx_glow')
      .setDepth(42)
      .setScale(1.75)
      .setTint(accentHex)
      .setAlpha(0.24)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.playerShieldRing = this.add
      .circle(640, 760, 27, 0xeab308, 0.08)
      .setStrokeStyle(2, 0xfacc15, 0.78)
      .setDepth(58)
      .setVisible(false);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.loadFloor(1);
    this.pushNotice(`${cls.name} adentrou as Ruínas Abandonadas`, 'gold');
    this.emitHudSnapshot(true);
  }

  private grantSkillLevel(skillId: SkillId, targetLevel: number, checkSynergy = true) {
    this.skills[skillId] = targetLevel;
    const def = SKILLS[skillId];
    if (def.type === 'active' && !this.activeSlotSkills.includes(skillId)) {
      const emptyIdx = this.activeSlotSkills.findIndex((s) => s === null);
      if (emptyIdx !== -1) {
        this.activeSlotSkills[emptyIdx] = skillId;
      }
    }
    if (skillId === 'orbital_blades') {
      this.rebuildOrbitals();
    }
    if (skillId === 'divine_shield' && this.computedStats) {
      const sb = BALANCE_CONFIG.skills;
      const cap = Math.round(this.computedStats.maxHp * (sb.shieldBasePct + targetLevel * sb.shieldPerLevelPct));
      this.shield = Math.max(this.shield, cap);
    }
    if (checkSynergy) {
      const nextSyn = computeActiveSynergies(this.skills);
      for (const s of nextSyn) {
        if (!this.activeSynergies.includes(s)) {
          this.activeSynergies.push(s);
          phaserBridge.emitSynergy(s);
          audioEngine.playLevelUp('mythic');
          this.pushNotice(`SINERGIA SECRETA DESBLOQUEADA!`, 'violet');
        }
      }
    }
  }

  private recomputeStats(healFull = false) {
    const prevMax = this.computedStats?.maxHp ?? 100;
    this.computedStats = computePlayerStats({
      classId: this.classId,
      level: this.level,
      mods: this.mods,
      equipped: this.equipped,
      permanent: this.permanentUpgrades,
      ascensionLevel: this.ascensionLevel,
      activeSynergies: this.activeSynergies,
      skills: this.skills,
      furyActive: this.furyTimer > 0,
      primateFuryActive: this.primateFuryTimer > 0,
    });
    if (healFull) {
      this.hp = this.computedStats.maxHp;
      const shLv = this.skills.divine_shield ?? 0;
      if (shLv > 0) {
        const sb = BALANCE_CONFIG.skills;
        this.shield = Math.round(this.computedStats.maxHp * (sb.shieldBasePct + shLv * sb.shieldPerLevelPct));
      }
    } else if (this.computedStats.maxHp > prevMax) {
      this.hp = Math.min(this.computedStats.maxHp, this.hp + (this.computedStats.maxHp - prevMax));
    } else {
      this.hp = Math.min(this.computedStats.maxHp, this.hp);
    }
  }

  private clearFloorEntities() {
    this.tileGroup?.clear(true, true);
    this.wallGroup?.clear(true, true);
    this.propGroup?.clear(true, true);
    this.brazierGlows = [];
    this.decalCount = 0;
    this.portalSprite?.destroy();
    this.portalSprite = undefined;

    for (const e of this.enemies) {
      e.sprite.destroy();
      e.hpBarBorder.destroy();
      e.hpBarBg.destroy();
      e.hpBarGhost.destroy();
      e.hpBarFill.destroy();
      e.eliteMarker?.destroy();
      e.auraRing?.destroy();
      e.bossOuterRing?.destroy();
    }
    this.enemies = [];
    this.pendingWaveSpawns = [];
    this.activeAttackTokens = 0;

    for (const p of this.projectiles) {
      p.sprite.destroy();
    }
    this.projectiles = [];

    for (const m of this.minions) {
      m.sprite.destroy();
    }
    this.minions = [];

    for (const h of this.hazards) {
      h.sprite?.destroy();
    }
    this.hazards = [];

    for (const pk of this.pickups) {
      pk.sprite.destroy();
    }
    this.pickups = [];

    for (const it of this.interactables) {
      it.sprite.destroy();
    }
    this.interactables = [];
    this.activeEventRef = null;
    this.timedChallenge = null;
  }

  private loadFloor(floorNum: number) {
    this.clearFloorEntities();
    this.floor = floorNum;
    this.portalOpen = false;
    this.portalTransitionLock = false;
    this.floorModifierText = null;
    this.floorRewardMult = 1;
    this.cursedFloorMult = 1;
    this.floorHasChaosSeal = false;

    const biome = getBiomeForFloor(floorNum);
    const bossDef = getBossForFloor(floorNum);
    const isBoss = isBossFloor(floorNum);
    const infMod = getInfiniteModifierForFloor(floorNum);

    if (infMod) {
      this.floorModifierText = infMod.name;
      this.floorRewardMult = infMod.rewardMult;
      this.floorHasChaosSeal = infMod.id === 'chaos_seal';
    }

    this.pendingCast = null;
    this.cooldownPreview = null;
    this.autoTargetId = null;
    this.lastAutoTarget = null;

    this.floorWavePlan = getFloorWavePlan(floorNum, isBoss);
    this.currentWaveIndex = 0;
    this.pendingWaveSpawns = [];
    this.enemiesTotalOnFloor = this.floorWavePlan.totalEnemies;

    const initialWaveCount = isBoss ? 1 : (this.floorWavePlan.waves[0]?.count ?? getFloorEnemyCount(floorNum, false));
    const layout = generateDungeonLayout(floorNum, isBoss, initialWaveCount);
    this.roomWidth = layout.roomWidth;
    this.roomHeight = layout.roomHeight;
    this.portalPos = layout.portalPos;
    this.pillarsLayout = layout.pillars;

    this.physics.world.setBounds(
      layout.tileSize,
      layout.tileSize,
      layout.roomWidth - layout.tileSize * 2,
      layout.roomHeight - layout.tileSize * 2
    );
    this.syncCameraViewport();

    // Build tiled stone floor (3 handcrafted variations) & perimeter gothic walls
    this.tileGroup = this.add.group();
    this.wallGroup = this.physics.add.staticGroup();
    this.propGroup = this.add.group();

    const cols = Math.ceil(layout.roomWidth / layout.tileSize);
    const rows = Math.ceil(layout.roomHeight / layout.tileSize);
    const wallKey = `wall_${biome.index}`;
    const pillarKey = `pillar_${biome.index}`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = c * layout.tileSize + layout.tileSize / 2;
        const ty = r * layout.tileSize + layout.tileSize / 2;
        const isEdge = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
        if (isEdge) {
          const w = this.wallGroup.create(tx, ty, wallKey) as Phaser.Physics.Arcade.Sprite;
          w.setDepth(20).refreshBody();
        } else {
          const variant = (r * 7 + c * 13 + floorNum * 3) % 4;
          const fl = this.add.image(tx, ty, `floor_${biome.index}_${variant}`).setDepth(5);
          this.tileGroup.add(fl);
        }
      }
    }

    // Visual dungeon progression: biome-tinted central runic arena seal (adapts cleanly when a central pillar is present)
    const sealColor = isBoss
      ? 0xdc2626
      : Phaser.Display.Color.HexStringToColor(biome.accentGlow).color;
    const biomeDepthTier = Math.min(4, Math.floor((floorNum - 1) / 10));
    const hasCenterPillar = layout.pillars.some(
      (p) => Math.hypot(p.x - layout.roomWidth / 2, p.y - layout.roomHeight / 2) < 90
    );
    const portalDais = this.add
      .circle(layout.portalPos.x, layout.portalPos.y, 46, sealColor, 0.07)
      .setStrokeStyle(1.6, sealColor, 0.32)
      .setDepth(7);
    this.propGroup.add(portalDais);

    if (hasCenterPillar && !isBoss) {
      // Subtle etched stone pedestal halo tightly framing the central pillar
      const plinthHalo = this.add
        .circle(layout.roomWidth / 2, layout.roomHeight / 2, 54, sealColor, 0.04)
        .setStrokeStyle(1.4, sealColor, 0.22)
        .setDepth(7);
      this.propGroup.add(plinthHalo);
    } else {
      const centerSeal = this.add
        .circle(layout.roomWidth / 2, layout.roomHeight / 2, isBoss ? 156 : 118 + biomeDepthTier * 8, sealColor, isBoss ? 0.08 : 0.045)
        .setStrokeStyle(isBoss ? 2.5 : 2, sealColor, isBoss ? 0.42 : 0.24)
        .setDepth(7);
      const innerSeal = this.add
        .circle(layout.roomWidth / 2, layout.roomHeight / 2, isBoss ? 92 : 72, 0x000000, 0)
        .setStrokeStyle(1.6, sealColor, isBoss ? 0.34 : 0.18)
        .setDepth(7);
      this.propGroup.addMultiple([centerSeal, innerSeal]);
      if (isBoss || biomeDepthTier >= 1) {
        const outerHalo = this.add
          .circle(layout.roomWidth / 2, layout.roomHeight / 2, isBoss ? 210 : 176, 0x000000, 0)
          .setStrokeStyle(1.2, sealColor, isBoss ? 0.25 : 0.12)
          .setDepth(7);
        this.propGroup.add(outerHalo);
      }
    }

    // Internal sculpted gothic pillars (distinct architecture from perimeter walls)
    for (const p of layout.pillars) {
      const pillar = this.wallGroup.create(p.x, p.y, pillarKey) as Phaser.Physics.Arcade.Sprite;
      pillar.setDepth(25).refreshBody();
    }

    // Flickering Cast-Iron Braziers & living warm torchlight
    for (let bi = 0; bi < layout.braziers.length; bi++) {
      const b = layout.braziers[bi];
      const br = this.add.image(b.x, b.y, 'prop_brazier').setScale(0.64).setDepth(28);
      this.propGroup.add(br);
      if (this.settings.graphicsQuality !== 'low') {
        const glow = this.add
          .image(b.x, b.y - 2, 'fx_glow')
          .setDepth(29)
          .setScale(1.95)
          .setTint(biome.ambientTint)
          .setAlpha(0.3)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.propGroup.add(glow);
        this.brazierGlows.push({ img: glow, phase: bi * 1.45, baseScale: 1.95 });
      }
    }

    // Position player cleanly at safe open spawn
    this.player.setPosition(layout.playerSpawn.x, layout.playerSpawn.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.physics.add.collider(this.player, this.wallGroup);

    // Random floor event modifiers on non-boss floors
    if (!isBoss && floorNum >= 2) {
      const eventRoll = Math.random();
      if (eventRoll < 0.16) {
        this.cursedFloorMult = 1.24;
        this.floorModifierText = 'Sala Amaldiçoada (+100% EXP & Loot)';
        this.floorRewardMult *= 2.0;
        this.pushNotice('Sala Amaldiçoada! Inimigos mais fortes, recompensas dobradas.', 'crimson');
      } else if (eventRoll < 0.3) {
        this.timedChallenge = { remainingSec: 34, totalSec: 34, rewarded: false };
        this.pushNotice('Desafio Contra o Tempo: limpe o andar em 34s para um Baú Épico!', 'gold');
      }
    }

    // Spawn Boss OR Escalating Wave 1 (opening skirmish)
    if (isBoss && bossDef) {
      this.spawnBoss(bossDef, layout.enemySpawns[0].x, layout.enemySpawns[0].y);
      audioEngine.playBossTelegraph();
      this.shakeTrauma = Math.max(this.shakeTrauma, 0.62);
      this.pushNotice(
        `${bossDef.isMegaBoss ? 'MEGA-CHEFE' : 'CHEFE'} DO ANDAR ${floorNum}: ${bossDef.name.toUpperCase()}`,
        'crimson'
      );
    } else {
      this.triggerWaveSpawn(0, true, layout.enemySpawns);
      this.spawnRoomInteractables(floorNum, layout);
    }

    // Biome milestone banner every 10 floors (11, 21, 31...)
    if (floorNum > 1 && floorNum % 10 === 1) {
      this.pushNotice(`Novo Bioma: ${biome.name} — Perigo Elevado!`, 'violet');
    }

    // Sync progress record
    phaserBridge.emitQuickSave({ floor: floorNum, level: this.level, crystalsDelta: 0 });
    this.cameras.main.fadeIn(220, 11, 10, 14);
  }

  private pickWaveArchetype(floorNum: number, preferRanged: boolean): EnemyArchetypeId {
    const eligible = ENEMY_LIST.filter((e) => e.minFloor <= floorNum);
    const rangedIds = new Set<EnemyArchetypeId>(['archer', 'mage', 'summoner', 'healer']);
    const pool = eligible.filter((e) => (preferRanged ? rangedIds.has(e.id) : !rangedIds.has(e.id)));
    const source = pool.length > 0 ? pool : eligible;
    return source[Math.floor(Math.random() * source.length)].id;
  }

  private pickSafeWavePoint(existing: Array<{ x: number; y: number }>): { x: number; y: number } {
    const margin = 128;
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = margin + Math.random() * (this.roomWidth - margin * 2);
      const y = margin + Math.random() * (this.roomHeight - margin * 2);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 225) continue;
      const hitsPillar = this.pillarsLayout.some(
        (p) => Math.abs(x - p.x) < p.w * 0.9 && Math.abs(y - p.y) < p.h * 0.9
      );
      if (hitsPillar) continue;
      const tooClose = existing.some((pt) => Phaser.Math.Distance.Between(x, y, pt.x, pt.y) < 62);
      if (tooClose) continue;
      return { x: Math.round(x), y: Math.round(y) };
    }
    // Guaranteed fallback opposite player
    const fx = this.player.x > this.roomWidth / 2 ? margin + 80 : this.roomWidth - margin - 80;
    const fy = this.player.y > this.roomHeight / 2 ? margin + 80 : this.roomHeight - margin - 80;
    return { x: Math.round(fx), y: Math.round(fy) };
  }

  private triggerWaveSpawn(
    waveIdx: number,
    immediate: boolean,
    presetPoints?: Array<{ x: number; y: number }>
  ) {
    const wave = this.floorWavePlan.waves[waveIdx];
    if (!wave) return;

    const baseEliteChance = getEliteChance(this.floor, this.floorHasChaosSeal);
    const waveEliteChance = Math.min(BALANCE_CONFIG.enemies.eliteCap, baseEliteChance + wave.eliteChanceBonus);
    const rangedTarget = Math.max(1, Math.round(wave.count * wave.rangedRatio));
    const chosenPoints: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < wave.count; i++) {
      const pt = presetPoints?.[i] ?? this.pickSafeWavePoint(chosenPoints);
      chosenPoints.push(pt);
      const preferRanged = i < rangedTarget;
      const archId = this.pickWaveArchetype(this.floor, preferRanged);
      const isGuaranteedElite = i < wave.guaranteedElites;
      const isElite = isGuaranteedElite || (this.floor >= 2 && Math.random() < waveEliteChance);
      const eliteMod = isElite
        ? ELITE_MODIFIER_LIST[Math.floor(Math.random() * ELITE_MODIFIER_LIST.length)].id
        : null;

      if (immediate) {
        this.spawnEnemy(archId, pt.x, pt.y, eliteMod, this.cursedFloorMult);
      } else {
        const delay = BALANCE_CONFIG.enemies.waveTelegraphSec + i * 0.05;
        this.pendingWaveSpawns.push({
          archetypeId: archId,
          x: pt.x,
          y: pt.y,
          eliteMod,
          extraMult: this.cursedFloorMult,
          timer: delay,
          maxTimer: delay,
        });
      }
    }

    if (!immediate) {
      const isFinalWave = waveIdx === this.floorWavePlan.waves.length - 1;
      audioEngine.playBossTelegraph();
      this.pushNotice(
        `Onda ${waveIdx + 1}/${this.floorWavePlan.waves.length} — ${wave.label}!`,
        isFinalWave ? 'crimson' : 'gold'
      );
    }
  }

  private spawnRoomInteractables(
    floorNum: number,
    layout: { roomWidth: number; roomHeight: number; pillars: Array<{ x: number; y: number; w: number; h: number }> }
  ) {
    const roll = Math.random();
    const posA = { x: Math.round(layout.roomWidth * 0.18), y: Math.round(layout.roomHeight * 0.5) };
    const posB = { x: Math.round(layout.roomWidth * 0.82), y: Math.round(layout.roomHeight * 0.5) };

    if (roll < 0.34) {
      this.createInteractable('chest', posA.x, posA.y, 'Baú Secreto');
    } else if (roll < 0.62) {
      this.createInteractable('altar', posA.x, posA.y, 'Altar de Sangue');
    } else if (roll < 0.85) {
      this.createInteractable('merchant', posB.x, posB.y, 'Comerciante Misterioso');
    } else if (floorNum >= 3) {
      this.createInteractable('dimension_portal', posB.x, posB.y, 'Fenda Dimensional');
    }

    // Occasional Treasure Room bonus chest
    if (Math.random() < 0.18) {
      this.createInteractable('chest', posB.x, posB.y, 'Baú de Tesouro');
    }
  }

  private createInteractable(
    kind: InteractableEntity['kind'],
    x: number,
    y: number,
    label: string
  ) {
    const tex =
      kind === 'chest'
        ? 'prop_chest'
        : kind === 'altar'
          ? 'prop_altar'
          : kind === 'merchant'
            ? 'prop_merchant'
            : 'prop_portal';
    const scale =
      kind === 'chest'
        ? 0.62
        : kind === 'altar'
          ? 0.62
          : kind === 'merchant'
            ? 0.64
            : 0.56;
    const sprite = this.add.sprite(x, y, tex).setScale(scale).setDepth(35);
    if (kind === 'dimension_portal') sprite.setTint(0xf43f5e);
    const auraColor =
      kind === 'chest' ? 0xf59e0b : kind === 'altar' ? 0xdc2626 : kind === 'merchant' ? 0xeab308 : 0xe879f9;
    const aura = this.add
      .circle(x, y + 6, 30, auraColor, 0.08)
      .setStrokeStyle(1.5, auraColor, 0.45)
      .setDepth(34);
    this.propGroup?.add(aura);
    this.interactables.push({
      id: `inter_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      sprite,
      label,
      x,
      y,
      used: false,
    });
  }

  private spawnEnemy(
    archetypeId: EnemyArchetypeId,
    x: number,
    y: number,
    eliteMod: EliteModifierId | null,
    extraMult = 1
  ) {
    const def = ENEMY_ARCHETYPES[archetypeId];
    const scale = getEnemyScaling(this.floor, this.ascensionLevel);
    const eMod = eliteMod ? ELITE_MODIFIERS[eliteMod] : null;

    const maxHp = Math.round(def.baseHp * scale.hpScale * (eMod ? eMod.hpMult : 1) * extraMult);
    const damage = Math.round(def.baseDamage * scale.damageScale * (eMod ? eMod.damageMult : 1) * extraMult);
    const speed = Math.min(285, def.speed * scale.speedScale * (eMod ? eMod.speedMult : 1));
    const radius = eMod ? Math.round(def.radius * 1.18) : def.radius;
    const baseScale = eMod ? 0.74 : 0.6;

    const sprite = this.physics.add
      .sprite(x, y, `enemy_${archetypeId}`)
      .setScale(baseScale)
      .setDepth(50);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const bodyR = (radius * 0.85) / baseScale;
    body.setCircle(bodyR, sprite.width / 2 - bodyR, sprite.height / 2 - bodyR);
    sprite.setCollideWorldBounds(true);
    if (this.wallGroup) this.physics.add.collider(sprite, this.wallGroup);

    const barW = eMod ? 46 : 34;
    const barH = eMod ? 5 : 4;
    const barY = y - radius - 14;
    const borderCol = eMod ? 0xf59e0b : 0x262133;
    const fillCol = eMod ? 0xf59e0b : 0xdc2626;

    const hpBarBorder = this.add.rectangle(x, barY, barW + 2, barH + 2, borderCol, 0.95).setDepth(64);
    const hpBarBg = this.add.rectangle(x, barY, barW, barH, 0x09080c, 0.95).setDepth(65);
    const hpBarGhost = this.add
      .rectangle(x - barW / 2, barY, barW, barH, 0xfef08a, 0.78)
      .setOrigin(0, 0.5)
      .setDepth(66);
    const hpBarFill = this.add
      .rectangle(x - barW / 2, barY, barW, barH, fillCol, 1)
      .setOrigin(0, 0.5)
      .setDepth(67);

    let eliteMarker: Phaser.GameObjects.Rectangle | undefined;
    let auraRing: Phaser.GameObjects.Arc | undefined;
    if (eMod) {
      const col = Phaser.Display.Color.HexStringToColor(eMod.color).color;
      auraRing = this.add
        .circle(x, y, radius + 7, col, 0.14)
        .setStrokeStyle(2, col, 0.85)
        .setDepth(44);
      eliteMarker = this.add
        .rectangle(x - barW / 2 - 5, barY, 6, 6, col, 1)
        .setStrokeStyle(1, 0x09080c, 1)
        .setAngle(45)
        .setDepth(68);
    }

    this.enemies.push({
      id: this.enemyIdCounter++,
      sprite,
      hpBarBorder,
      hpBarBg,
      hpBarGhost,
      hpBarFill,
      eliteMarker,
      auraRing,
      archetypeId,
      bossDef: null,
      eliteMod,
      baseScale,
      hp: maxHp,
      ghostHp: maxHp,
      maxHp,
      damage,
      speed,
      radius,
      resistance: Math.min(0.62, scale.resistance + (archetypeId === 'golem' ? 0.24 : 0) + (eliteMod === 'armored' ? 0.18 : 0)),
      xpValue: Math.round(def.xpValue * scale.rewardScale * (eMod ? 2.4 : 1) * this.floorRewardMult),
      goldValue: Math.round(def.goldValue * scale.rewardScale * (eMod ? 2.8 : 1) * this.floorRewardMult),
      aiTimer: 0.35 + Math.random() * 0.7,
      attackCooldown: 0.65 + Math.random() * 0.85,
      windupTimer: 0,
      windupMax: 0.4,
      windupAction: null,
      windupTargetX: x,
      windupTargetY: y,
      hasAttackToken: false,
      flashTimer: 0,
      freezeTimer: 0,
      slowTimer: 0,
      slowFactor: 1,
      knockVx: 0,
      knockVy: 0,
      dying: false,
      deathTimer: 0,
      recoveryTimer: 0,
      bossPhase: 1,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      summonCount: 0,
    });
  }

  private spawnBoss(bossDef: BossDef, x: number, y: number) {
    const scale = getEnemyScaling(this.floor, this.ascensionLevel);
    const bc = BALANCE_CONFIG.bosses;
    const maxHp = Math.round(bc.baseHpAnchor * bossDef.hpMultiplier * scale.hpScale);
    const damage = Math.round(bc.baseDamageAnchor * bossDef.damageMultiplier * scale.damageScale);
    const baseScale = bossDef.isMegaBoss ? 0.78 : 0.72;

    const sprite = this.physics.add
      .sprite(x, y, `boss_${bossDef.id}`)
      .setScale(baseScale)
      .setDepth(52);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const bodyR = (bossDef.radius * 0.84) / baseScale;
    body.setCircle(bodyR, sprite.width / 2 - bodyR, sprite.height / 2 - bodyR);
    sprite.setCollideWorldBounds(true);
    if (this.wallGroup) this.physics.add.collider(sprite, this.wallGroup);

    const hpBarBorder = this.add.rectangle(x, y - bossDef.radius - 16, 74, 8, 0xd4a64a, 0.9).setDepth(64).setVisible(false);
    const hpBarBg = this.add.rectangle(x, y - bossDef.radius - 16, 72, 6, 0x09080c, 0.9).setDepth(65).setVisible(false);
    const hpBarGhost = this.add.rectangle(x - 36, y - bossDef.radius - 16, 72, 6, 0xfef08a, 0.8).setOrigin(0, 0.5).setDepth(66).setVisible(false);
    const hpBarFill = this.add.rectangle(x - 36, y - bossDef.radius - 16, 72, 6, 0xf59e0b, 1).setOrigin(0, 0.5).setDepth(67).setVisible(false);

    const col = Phaser.Display.Color.HexStringToColor(bossDef.accentColor).color;
    const auraRing = this.add
      .circle(x, y, bossDef.radius + 12, col, 0.16)
      .setStrokeStyle(2.6, col, 0.88)
      .setDepth(44);
    const bossOuterRing = this.add
      .circle(x, y, bossDef.radius + 24, 0x000000, 0)
      .setStrokeStyle(1.4, 0xf8e3a8, 0.45)
      .setDepth(43);

    this.enemies.push({
      id: this.enemyIdCounter++,
      sprite,
      hpBarBorder,
      hpBarBg,
      hpBarGhost,
      hpBarFill,
      auraRing,
      bossOuterRing,
      archetypeId: 'golem',
      bossDef,
      eliteMod: null,
      baseScale,
      hp: maxHp,
      ghostHp: maxHp,
      maxHp,
      damage,
      speed: bossDef.speed * Math.min(1.45, scale.speedScale),
      radius: bossDef.radius,
      resistance: Math.min(0.52, scale.resistance + bc.baseResistanceBonus),
      xpValue: Math.round(280 * scale.rewardScale * (bossDef.isMegaBoss ? 2.4 : 1)),
      goldValue: Math.round(180 * scale.rewardScale * (bossDef.isMegaBoss ? 2.5 : 1)),
      aiTimer: 0.8,
      attackCooldown: 1.25,
      windupTimer: 0,
      windupMax: 0.65,
      windupAction: null,
      windupTargetX: x,
      windupTargetY: y,
      hasAttackToken: false,
      flashTimer: 0,
      freezeTimer: 0,
      slowTimer: 0,
      slowFactor: 1,
      knockVx: 0,
      knockVy: 0,
      dying: false,
      deathTimer: 0,
      recoveryTimer: 0,
      bossPhase: 1,
      strafeDir: 1,
      summonCount: 0,
    });
  }

  public update(_time: number, delta: number) {
    if (!this.isActiveRun) return;
    const rawDt = Math.min(delta / 1000, 0.05);

    // Visual-only updates (camera shake, hit flashes) continue ticking even during hitstop
    this.updateCameraShake(rawDt);

    if (this.isPaused || this.isEndingRun) return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
      if (this.player?.body) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      for (const e of this.enemies) {
        if (e.sprite.body) (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
      return;
    }

    const dt = rawDt;
    this.elapsedSec += dt;

    if (this.recentNoticeTimer > 0) {
      this.recentNoticeTimer -= dt;
      if (this.recentNoticeTimer <= 0) this.recentNotice = null;
    }

    this.updatePlayer(dt);
    this.updatePassivesAndSynergies(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateMinions(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updatePools(dt);
    this.updateTimedChallengeAndPortal(dt);
    this.drawTelegraphsAndBeams();
    this.updateTargetingOverlay(dt);

    // Living torchlight flicker on dungeon braziers
    if (this.brazierGlows.length > 0) {
      const t = this.elapsedSec;
      for (const bg of this.brazierGlows) {
        const f = Math.sin(t * 7.2 + bg.phase) * 0.5 + Math.sin(t * 13.7 + bg.phase * 1.9) * 0.5;
        bg.img.setAlpha(0.27 + f * 0.065);
        bg.img.setScale(bg.baseScale + f * 0.12);
      }
    }

    // Ambient biome particles
    this.ambientParticleTimer -= dt;
    if (this.ambientParticleTimer <= 0 && this.settings.graphicsQuality !== 'low') {
      this.ambientParticleTimer = this.settings.graphicsQuality === 'high' ? 0.16 : 0.35;
      const biome = getBiomeForFloor(this.floor);
      const px = this.player.x + (Math.random() - 0.5) * 620;
      const py = this.player.y + (Math.random() - 0.5) * 420;
      this.spawnParticle(px, py, (Math.random() - 0.5) * 16, -24 - Math.random() * 18, biome.particleColor, 0.9, 0.55);
    }

    // Throttle HUD React updates to ~15Hz
    this.hudEmitTimer -= dt;
    if (this.hudEmitTimer <= 0) {
      this.hudEmitTimer = 0.068;
      this.emitHudSnapshot(false);
    }
  }

  private updateCameraShake(dt: number) {
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.6);
      if (this.settings.screenShake) {
        const mag = this.shakeTrauma * this.shakeTrauma * 14;
        this.cameras.main.setFollowOffset(
          (Math.random() * 2 - 1) * mag,
          (Math.random() * 2 - 1) * mag
        );
      } else {
        this.cameras.main.setFollowOffset(0, 0);
      }
    } else {
      this.cameras.main.setFollowOffset(0, 0);
    }
  }

  private updatePlayer(dt: number) {
    if (!this.player || !this.player.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Timers
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.postModalClickSuppressTimer > 0) {
      this.postModalClickSuppressTimer = Math.max(0, this.postModalClickSuppressTimer - dt);
    }
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.dashBufferTimer > 0) this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.swiftKillTimer > 0) this.swiftKillTimer = Math.max(0, this.swiftKillTimer - dt);
    if (this.playerSlowTimer > 0) this.playerSlowTimer = Math.max(0, this.playerSlowTimer - dt);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
      }
    }

    const prevFury = this.furyTimer > 0;
    if (this.furyTimer > 0) {
      this.furyTimer = Math.max(0, this.furyTimer - dt);
      if (prevFury && this.furyTimer <= 0) {
        this.recomputeStats(false);
      }
    }

    const prevPrimateFury = this.primateFuryTimer > 0;
    if (this.primateFuryTimer > 0) {
      this.primateFuryTimer = Math.max(0, this.primateFuryTimer - dt);
      if (Math.random() < 0.35 && this.settings.graphicsQuality !== 'low') {
        this.spawnParticle(
          this.player.x + (Math.random() - 0.5) * 26,
          this.player.y + (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 32,
          -34 - Math.random() * 28,
          0xfacc15,
          0.28,
          0.62
        );
      }
      if (prevPrimateFury && this.primateFuryTimer <= 0) {
        this.recomputeStats(false);
      }
    }

    // Skill cooldown ticks
    for (const key of Object.keys(this.skillCooldowns) as SkillId[]) {
      const rem = this.skillCooldowns[key] ?? 0;
      if (rem > 0) {
        this.skillCooldowns[key] = Math.max(0, rem - dt);
      }
    }

    // Movement vector (WASD / Arrows / Mobile Joystick)
    let mx = this.mobileMoveX;
    let my = this.mobileMoveY;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) mx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) mx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) my -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) my += 1;

    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx /= len;
      my /= len;
    }

    // Execute buffered Dash (Space)
    if (this.dashBufferTimer > 0 && this.dashCooldown <= 0 && this.dashTimer <= 0) {
      this.dashBufferTimer = 0;
      this.dashTimer = DASH_DURATION_SEC;
      this.dashCooldown = Math.max(
        0.65,
        BALANCE_CONFIG.player.dashCooldownSec * (1 - this.computedStats.cooldownReduction)
      );
      this.invulnTimer = Math.max(this.invulnTimer, BALANCE_CONFIG.player.dashInvulnSec);
      if (this.forcedDashAngle !== null) {
        this.dashDirX = Math.cos(this.forcedDashAngle);
        this.dashDirY = Math.sin(this.forcedDashAngle);
        this.forcedDashAngle = null;
      } else if (len > 0.01) {
        this.dashDirX = mx;
        this.dashDirY = my;
      } else {
        const aim = this.getAimAngle();
        this.dashDirX = Math.cos(aim);
        this.dashDirY = Math.sin(aim);
      }
      audioEngine.playDash();
      this.player.setScale(HERO_BASE_SCALE * 1.22, HERO_BASE_SCALE * 0.82);
      for (let i = 0; i < 8; i++) {
        this.spawnParticle(
          this.player.x,
          this.player.y,
          -this.dashDirX * (60 + Math.random() * 80) + (Math.random() - 0.5) * 50,
          -this.dashDirY * (60 + Math.random() * 80) + (Math.random() - 0.5) * 50,
          0xc084fc,
          0.26,
          0.9
        );
      }
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = this.computedStats.moveSpeed * DASH_SPEED_MULT;
      body.setVelocity(this.dashDirX * dashSpeed, this.dashDirY * dashSpeed);
      if (Math.random() < 0.65) {
        const ghost = this.add
          .sprite(this.player.x, this.player.y, `hero_${this.classId}`)
          .setScale(HERO_BASE_SCALE)
          .setFlipX(this.player.flipX)
          .setAlpha(0.36)
          .setTint(0xa855f7)
          .setDepth(53);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          scale: HERO_BASE_SCALE * 0.82,
          duration: 180,
          onComplete: () => ghost.destroy(),
        });
      }
    } else {
      const swiftMult = this.swiftKillTimer > 0 ? 1.15 : 1;
      const slowMult = this.playerSlowTimer > 0 ? 0.65 : 1;
      const speed = this.computedStats.moveSpeed * swiftMult * slowMult;
      body.setVelocity(mx * speed, my * speed);

      // Gait-synced squash & bob (scaled cleanly around HERO_BASE_SCALE)
      const frameDist = Math.hypot(body.velocity.x, body.velocity.y) * dt;
      this.gaitDist += frameDist;
      const bob = len > 0.01 ? Math.sin(this.gaitDist * 0.14) * 0.055 : 0;
      const targetScaleX = HERO_BASE_SCALE * (1 + bob);
      const targetScaleY = HERO_BASE_SCALE * (1 - bob);
      this.player.scaleX = Phaser.Math.Linear(this.player.scaleX, targetScaleX, Math.min(1, dt * 15));
      this.player.scaleY = Phaser.Math.Linear(this.player.scaleY, targetScaleY, Math.min(1, dt * 15));

      // Subtle grounded dust puffs when sprinting
      if (len > 0.2 && this.settings.graphicsQuality !== 'low') {
        this.footstepTimer -= dt;
        if (this.footstepTimer <= 0) {
          this.footstepTimer = 0.22;
          this.spawnParticle(
            this.player.x + (Math.random() - 0.5) * 10,
            this.player.y + 14,
            -mx * 24 + (Math.random() - 0.5) * 18,
            -my * 24 + (Math.random() - 0.5) * 18,
            0x94a3b8,
            0.28,
            0.48
          );
        }
      }
    }

    // Compute unified auto-attack target lock (prioritizes cursor direction, respects range & hysteresis)
    const cursorWorld = this.getCursorWorldPoint();
    const basicSpec = computeBasicAttackSpec(this.classId, this.computedStats, this.skills, this.furyTimer > 0);
    const targetables = this.getTargetableEnemies();
    const autoTarget = selectAutoAttackTarget(
      { x: this.player.x, y: this.player.y },
      cursorWorld,
      basicSpec,
      targetables,
      this.autoTargetId,
      this.settings.autoAttack,
      this.roomWidth,
      this.roomHeight,
      this.pillarsLayout
    );
    this.autoTargetId = autoTarget.targetId;
    this.lastAutoTarget = autoTarget;

    // Flip sprite horizontally toward cursor aim (or locked auto-target when auto-attacking)
    const cursorAngle = this.getAimAngle();
    const manualFiring = this.mouseDown || this.mobileFiring;
    const autoFiring =
      !manualFiring &&
      !this.pendingCast &&
      this.settings.autoAttack &&
      autoTarget.target !== null;
    const activeAimAngle = manualFiring ? cursorAngle : autoFiring ? autoTarget.aimAngle : cursorAngle;
    this.player.setFlipX(Math.cos(activeAimAngle) < 0);

    // Invulnerability blink & contrast aura sync
    this.player.setAlpha(this.invulnTimer > 0 ? 0.64 : 1);
    if (this.playerFootRing) {
      this.playerFootRing.setPosition(this.player.x, this.player.y + 12);
      const pulse = 1 + Math.sin(this.elapsedSec * 4.5) * 0.04;
      this.playerFootRing.setScale(pulse);
    }
    if (this.playerShadowGlow) {
      this.playerShadowGlow.setPosition(this.player.x, this.player.y);
      this.playerShadowGlow.setAlpha(this.furyTimer > 0 || this.primateFuryTimer > 0 ? 0.48 : 0.22);
    }
    if (this.playerShieldRing) {
      this.playerShieldRing.setPosition(this.player.x, this.player.y);
      this.playerShieldRing.setVisible(this.shield > 0);
    }

    // Basic Attack: manual LMB/Mobile aims straight at cursor; Auto-Attack fires at locked in-range target
    if ((manualFiring || autoFiring) && this.attackCooldown <= 0) {
      this.performBasicAttack(activeAimAngle, basicSpec);
    }
  }

  private getCursorWorldPoint(): { x: number; y: number } {
    if (Math.hypot(this.mobileAimX, this.mobileAimY) > 0.2 && this.player) {
      return {
        x: this.player.x + this.mobileAimX * 220,
        y: this.player.y + this.mobileAimY * 220,
      };
    }
    if (!this.pointerInitialized && this.player) {
      return { x: this.player.x, y: this.player.y - 160 };
    }
    const worldPt = this.cameras.main.getWorldPoint(this.pointerScreenX, this.pointerScreenY);
    if (!Number.isFinite(worldPt.x) || !Number.isFinite(worldPt.y)) {
      return this.player ? { x: this.player.x, y: this.player.y - 160 } : { x: 640, y: 480 };
    }
    return { x: worldPt.x, y: worldPt.y };
  }

  private getAimAngle(): number {
    if (Math.hypot(this.mobileAimX, this.mobileAimY) > 0.2) {
      return Math.atan2(this.mobileAimY, this.mobileAimX);
    }
    const worldPt = this.getCursorWorldPoint();
    return Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPt.x, worldPt.y);
  }

  private getTargetableEnemies(): TargetableEnemy[] {
    const out: TargetableEnemy[] = [];
    for (const e of this.enemies) {
      if (e.dying) continue;
      out.push({
        id: e.id,
        x: e.sprite.x,
        y: e.sprite.y,
        radius: e.radius,
        maxHp: e.maxHp,
        hp: e.hp,
        dying: e.dying,
        isBoss: Boolean(e.bossDef),
        isElite: Boolean(e.eliteMod),
        name: e.bossDef ? e.bossDef.name : ENEMY_ARCHETYPES[e.archetypeId].name,
      });
    }
    return out;
  }

  private handleCastKeyDown(kind: 'skill' | 'dash', slotIndex: number, keyCode: string) {
    if (!this.isActiveRun || this.isPaused || this.isEndingRun) return;

    if (kind === 'dash') {
      const mode = resolveCastMode(this.settings, 'dash', null);
      if (this.dashCooldown > 0.02) {
        this.cooldownPreview = { kind: 'dash', slotIndex: -1, skillId: null, timer: 0.65 };
        return;
      }
      if (mode === 'quick') {
        this.pendingCast = null;
        this.cooldownPreview = null;
        this.forcedDashAngle = null;
        this.dashBufferTimer = 0.14;
      } else {
        this.pendingCast = { kind: 'dash', slotIndex: -1, skillId: null, mode, keyCode };
        this.cooldownPreview = null;
      }
      return;
    }

    const skillId = this.activeSlotSkills[slotIndex];
    if (!skillId) return;
    const lv = this.skills[skillId] ?? 0;
    if (lv <= 0) return;

    const cdRem = this.skillCooldowns[skillId] ?? 0;
    if (cdRem > 0.02) {
      this.cooldownPreview = { kind: 'skill', slotIndex, skillId, timer: 0.65 };
      return;
    }

    const mode = resolveCastMode(this.settings, 'skill', skillId);
    if (mode === 'quick') {
      this.pendingCast = null;
      this.cooldownPreview = null;
      this.executeSkillSlot(slotIndex);
    } else {
      this.pendingCast = { kind: 'skill', slotIndex, skillId, mode, keyCode };
      this.cooldownPreview = null;
    }
  }

  private executeDashTowardAim() {
    if (this.dashCooldown > 0.02 || this.dashTimer > 0) return;
    this.forcedDashAngle = this.getAimAngle();
    this.dashBufferTimer = 0.14;
  }

  private performBasicAttack(
    angle: number,
    basicSpec = computeBasicAttackSpec(this.classId, this.computedStats, this.skills, this.furyTimer > 0)
  ) {
    const cls = CLASSES[this.classId];
    this.attackCooldown = 1 / this.computedStats.attackSpeed;
    this.reticleRecoil = 1;
    const projCount = basicSpec.projCount;

    // Subtle recoil squash relative to supersampled base scale
    this.player.setScale(HERO_BASE_SCALE * 1.12, HERO_BASE_SCALE * 0.9);

    if (basicSpec.style === 'melee_cleave') {
      audioEngine.playAttack('melee');
      this.slashParity = !this.slashParity;
      const range = basicSpec.range;
      const slashScale = range / 118;
      const swingDir = this.slashParity ? 1 : -1;
      const slash = this.add
        .sprite(this.player.x + Math.cos(angle) * 28, this.player.y + Math.sin(angle) * 28, 'fx_slash')
        .setRotation(angle - swingDir * 0.18)
        .setFlipY(this.slashParity)
        .setDepth(62)
        .setScale(slashScale * 0.88)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: slash,
        alpha: 0,
        rotation: angle + swingDir * 0.24,
        scale: slashScale * 1.18,
        duration: 145,
        ease: 'Cubic.Out',
        onComplete: () => slash.destroy(),
      });

      // Crisp metallic sparks sweeping off the blade tip
      if (this.settings.graphicsQuality !== 'low') {
        const tipX = this.player.x + Math.cos(angle) * (range * 0.68);
        const tipY = this.player.y + Math.sin(angle) * (range * 0.68);
        this.spawnHitSparks(tipX, tipY, angle + swingDir * 0.45, 0xfdba74, 3, 140);
      }

      // Hit enemies using exact unified cone geometry
      const coneHits = findConeTargets(
        { x: this.player.x, y: this.player.y },
        angle,
        basicSpec.range,
        basicSpec.halfAngle,
        basicSpec.closeRadius,
        this.getTargetableEnemies()
      );
      const hitIds = new Set(coneHits.map((h) => h.id));
      for (const e of this.enemies) {
        if (e.dying || !hitIds.has(e.id)) continue;
        this.damageEnemy(e, this.computedStats.damage, angle, true);
      }

      // Bonus shockwave if extraProjectiles > 1 or Demonic Fury Lv7
      if (basicSpec.bonusShockwave) {
        this.spawnPlayerProjectile(angle, 'proj_shadow_wave', 480, this.computedStats.damage * 0.72, 0.45, 2, 0, 0xf97316);
      }
      return;
    }

    const tex =
      basicSpec.style === 'twin_dagger'
        ? 'proj_dagger'
        : basicSpec.style === 'arcane_bolt'
          ? 'proj_arcane'
          : basicSpec.style === 'soul_orb'
            ? 'proj_soul'
            : basicSpec.style === 'banana_toss'
              ? 'proj_banana'
              : 'proj_arrow';

    audioEngine.playAttack(
      basicSpec.style === 'twin_dagger'
        ? 'dagger'
        : basicSpec.style === 'multi_arrow'
          ? 'bow'
          : basicSpec.style === 'banana_toss'
            ? 'banana'
            : 'arcane'
    );

    const speed = basicSpec.speed;
    const life = basicSpec.life;
    const spread = basicSpec.spread;
    const spinSpeed = basicSpec.style === 'banana_toss' ? 14 : 0;

    for (let i = 0; i < projCount; i++) {
      const offset = projCount === 1 ? 0 : -spread / 2 + (spread / (projCount - 1)) * i;
      const a = angle + offset;
      const dmgMult = projCount > 1 && cls.baseStats.projectiles > 1 ? 0.78 : 1.0;
      this.spawnPlayerProjectile(
        a,
        tex,
        speed,
        this.computedStats.damage * dmgMult,
        life,
        basicSpec.pierce,
        basicSpec.explosiveRadius,
        basicSpec.accentColor,
        0,
        spinSpeed
      );
    }

    // Slatt Passive: Instinto Primata — chance on every basic attack to hurl extra spinning banana(s)
    const instinctLv = this.skills.primate_instinct ?? 0;
    if (instinctLv > 0) {
      const procChance = Math.min(0.62, 0.24 + (instinctLv - 1) * 0.04);
      if (Math.random() < procChance) {
        const extraOffsets = instinctLv >= 4 ? [-0.14, 0.14] : [(Math.random() < 0.5 ? -1 : 1) * 0.09];
        const extraPierce = basicSpec.pierce + (instinctLv >= 7 ? 1 : 0);
        const extraCrit = instinctLv >= 7 ? 0.25 : 0;
        const extraDmg = this.computedStats.damage * (0.85 + Math.min(0.35, (instinctLv - 1) * 0.05));
        for (const off of extraOffsets) {
          this.spawnPlayerProjectile(
            angle + off,
            'proj_banana',
            Math.max(speed, 590),
            extraDmg,
            life,
            extraPierce,
            basicSpec.explosiveRadius,
            0xfacc15,
            extraCrit,
            16
          );
        }
        if (this.settings.graphicsQuality !== 'low') {
          this.spawnHitSparks(
            this.player.x + Math.cos(angle) * 18,
            this.player.y + Math.sin(angle) * 18,
            angle,
            0xfef08a,
            3,
            115
          );
        }
      }
    }
  }

  private spawnPlayerProjectile(
    angle: number,
    texture: string,
    speed: number,
    damage: number,
    life: number,
    pierceLeft: number,
    explosiveRadius: number,
    color: number,
    bonusCrit = 0,
    spinSpeed = 0
  ) {
    const sp = this.physics.add
      .sprite(this.player.x + Math.cos(angle) * 20, this.player.y + Math.sin(angle) * 20, texture)
      .setDepth(60)
      .setRotation(angle);
    this.projectiles.push({
      sprite: sp,
      fromPlayer: true,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      life,
      pierceLeft,
      hitIds: new Set<number>(),
      explosiveRadius,
      color,
      bonusCrit,
      spinSpeed,
    });
  }

  private spawnEnemyProjectile(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    texture = 'proj_enemy_bolt',
    appliesSlow = false
  ) {
    const sp = this.physics.add.sprite(x, y, texture).setDepth(60).setRotation(angle);
    this.projectiles.push({
      sprite: sp,
      fromPlayer: false,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      life: 2.6,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      explosiveRadius: 0,
      color: 0xf43f5e,
      appliesSlow,
    });
  }

  public castSkillSlot(slotIndex: number) {
    // Public HUD/touch button trigger: cancels any active preview and casts directly
    this.pendingCast = null;
    this.cooldownPreview = null;
    this.executeSkillSlot(slotIndex);
  }

  private executeSkillSlot(slotIndex: number) {
    if (!this.isActiveRun || this.isPaused || this.isEndingRun) return;
    const skillId = this.activeSlotSkills[slotIndex];
    if (!skillId) return;
    const lv = this.skills[skillId] ?? 0;
    if (lv <= 0) return;
    const cdRem = this.skillCooldowns[skillId] ?? 0;
    if (cdRem > 0.02) {
      this.cooldownPreview = { kind: 'skill', slotIndex, skillId, timer: 0.65 };
      return;
    }

    const def = SKILLS[skillId];
    const spec = computeSkillGeometrySpec(skillId, lv, this.computedStats, this.mods, this.activeSynergies);
    const cursorWorld = this.getCursorWorldPoint();
    const targetables = this.getTargetableEnemies();
    const evalCast = evaluateSkillCast(
      spec,
      { x: this.player.x, y: this.player.y },
      cursorWorld,
      targetables,
      this.roomWidth,
      this.roomHeight,
      this.pillarsLayout,
      0
    );

    // Never waste cooldown on directed/chain skills with no valid target in range
    if (!evalCast.valid && evalCast.invalidReason === 'no_target') {
      this.cooldownPreview = { kind: 'skill', slotIndex, skillId, timer: 0.55 };
      this.pushNotice(`${def.name}: nenhum alvo no alcance.`, 'crimson');
      return;
    }

    const cd = Math.max(0.6, def.cooldown * (1 - this.computedStats.cooldownReduction));
    this.skillCooldowns[skillId] = cd;
    this.reticleRecoil = 1;

    const aim = evalCast.aimAngle;
    const powerScale = def.basePower * (1 + (lv - 1) * BALANCE_CONFIG.skills.perLevelScaling);
    const baseDmg = this.computedStats.damage * powerScale;

    if (
      skillId === 'banana_bomb' ||
      skillId === 'banana_peel' ||
      skillId === 'primate_fury' ||
      skillId === 'banana_rain'
    ) {
      audioEngine.playSlattSkill(skillId);
    } else {
      audioEngine.playSkill(def.element);
    }

    switch (skillId) {
      case 'fireball': {
        const synBonus = this.activeSynergies.includes('fire_tornado') ? 1.25 : 1;
        for (const offset of spec.rayAngles) {
          this.spawnPlayerProjectile(
            aim + offset,
            'proj_fireball',
            spec.speed,
            baseDmg * synBonus,
            spec.life,
            spec.pierce,
            spec.explosiveRadius,
            spec.color
          );
        }
        break;
      }
      case 'shadow_slash': {
        for (const offset of spec.rayAngles) {
          this.spawnPlayerProjectile(
            aim + offset,
            'proj_shadow_wave',
            spec.speed,
            baseDmg,
            spec.life,
            spec.pierce,
            0,
            spec.color,
            lv >= 7 ? 0.5 : 0
          );
        }
        if (spec.secondaryAuraRadius > 0) {
          this.triggerRadialAoE(this.player.x, this.player.y, spec.secondaryAuraRadius, baseDmg * 0.55, 0xe11d48, 0.25);
        }
        break;
      }
      case 'meteor_shower': {
        // Strikes inside the exact previewed circular impact zone (prioritizing enemies inside zone)
        const zoneX = evalCast.targetPoint.x;
        const zoneY = evalCast.targetPoint.y;
        const inZone = this.enemies.filter(
          (e) => !e.dying && Phaser.Math.Distance.Between(zoneX, zoneY, e.sprite.x, e.sprite.y) <= spec.radius + e.radius
        );
        for (let i = 0; i < spec.count; i++) {
          let tx: number;
          let ty: number;
          if (inZone.length > 0 && i < inZone.length * 2) {
            const target = inZone[i % inZone.length];
            tx = target.sprite.x + (Math.random() - 0.5) * 28;
            ty = target.sprite.y + (Math.random() - 0.5) * 28;
          } else {
            const ang = (Math.PI * 2 * i) / Math.max(1, spec.count) + Math.random() * 0.6;
            const dist = Math.random() * Math.max(24, spec.radius - spec.subRadius * 0.45);
            tx = zoneX + Math.cos(ang) * dist;
            ty = zoneY + Math.sin(ang) * dist;
          }
          this.hazards.push({
            x: tx,
            y: ty,
            radius: spec.subRadius,
            delay: 0.42 + i * 0.1,
            maxDelay: 0.42 + i * 0.1,
            fromPlayer: true,
            damage: baseDmg,
            color: spec.color,
            kind: 'meteor',
            duration: 0,
            tickTimer: 0,
            triggered: false,
          });
        }
        break;
      }
      case 'chain_lightning': {
        const glacialSyn = this.activeSynergies.includes('glacial_storm');
        let curX = this.player.x;
        let curY = this.player.y;
        for (const node of evalCast.chainPath) {
          const target = this.enemies.find((e) => e.id === node.id && !e.dying);
          if (!target) continue;
          this.drawLightningArc(curX, curY, target.sprite.x, target.sprite.y, spec.color);
          const dmg = target.freezeTimer > 0 && glacialSyn ? baseDmg * 1.4 : baseDmg;
          this.damageEnemy(
            target,
            dmg,
            Phaser.Math.Angle.Between(curX, curY, target.sprite.x, target.sprite.y),
            false
          );
          if (glacialSyn) {
            target.freezeTimer = Math.max(target.freezeTimer, 1.8);
          }
          curX = target.sprite.x;
          curY = target.sprite.y;
        }
        break;
      }
      case 'shadow_summon': {
        const legionSyn = this.activeSynergies.includes('assassin_legion');
        const cap = 10;
        for (let i = 0; i < spec.count && this.minions.length < cap; i++) {
          const ang = (Math.PI * 2 * i) / spec.count;
          const mx = this.player.x + Math.cos(ang) * spec.subRadius;
          const my = this.player.y + Math.sin(ang) * spec.subRadius;
          const sp = this.add.sprite(mx, my, 'minion_shadow').setDepth(52);
          if (legionSyn) sp.setTint(0xc084fc);
          this.minions.push({
            sprite: sp,
            x: mx,
            y: my,
            life: 14,
            attackCd: 0.2,
            damage: baseDmg * (legionSyn ? 1.5 : 1),
            speed: (lv >= 4 ? 260 : 210) * (legionSyn ? 1.35 : 1),
            critChance: this.computedStats.critChance + (legionSyn ? 0.45 : 0),
            explodesOnEnd: lv >= 7,
          });
        }
        break;
      }
      case 'arcane_blast': {
        this.triggerRadialAoE(this.player.x, this.player.y, spec.radius, baseDmg, spec.color, 0);
        if (lv >= 7) {
          for (const p of this.projectiles) {
            if (!p.fromPlayer && Phaser.Math.Distance.Between(this.player.x, this.player.y, p.sprite.x, p.sprite.y) <= spec.radius) {
              p.life = 0;
            }
          }
        }
        this.shakeTrauma = Math.max(this.shakeTrauma, 0.35);
        break;
      }
      case 'time_freeze': {
        const freezeDur = lv >= 4 ? 3.2 : 2.3;
        this.triggerRadialAoE(this.player.x, this.player.y, spec.radius, baseDmg, spec.color, 0);
        for (const e of this.enemies) {
          if (e.dying) continue;
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y) <= spec.radius + e.radius) {
            e.freezeTimer = Math.max(e.freezeTimer, e.bossDef ? freezeDur * 0.45 : freezeDur);
          }
        }
        break;
      }
      case 'black_hole': {
        this.hazards.push({
          x: evalCast.targetPoint.x,
          y: evalCast.targetPoint.y,
          radius: spec.radius,
          delay: 0,
          maxDelay: 0.1,
          fromPlayer: true,
          damage: baseDmg,
          color: spec.color,
          kind: 'black_hole',
          duration: lv >= 4 ? 4.0 : 3.2,
          tickTimer: 0.25,
          triggered: true,
        });
        break;
      }
      case 'celestial_bolt': {
        for (const dtNode of evalCast.directedTargets) {
          const target = this.enemies.find((e) => e.id === dtNode.id && !e.dying);
          if (!target) continue;
          this.drawLightningArc(target.sprite.x, target.sprite.y - 260, target.sprite.x, target.sprite.y, spec.color);
          this.triggerRadialAoE(
            target.sprite.x,
            target.sprite.y,
            spec.radius,
            baseDmg * (lv >= 4 && target.bossDef ? 1.35 : 1),
            spec.color,
            0
          );
        }
        break;
      }
      case 'demonic_fury': {
        this.furyTimer = lv >= 4 ? 6.5 : 5.0;
        this.recomputeStats(false);
        this.shakeTrauma = Math.max(this.shakeTrauma, 0.3);
        this.spawnBurst(this.player.x, this.player.y, spec.color, 18, 160);
        this.pushNotice('FÚRIA DEMONÍACA ATIVADA!', 'crimson');
        break;
      }
      case 'banana_bomb': {
        for (const offset of spec.rayAngles) {
          this.spawnPlayerProjectile(
            aim + offset,
            'proj_banana_bomb',
            spec.speed,
            baseDmg,
            spec.life,
            spec.pierce,
            spec.explosiveRadius,
            spec.color,
            lv >= 7 ? 0.35 : 0,
            16
          );
        }
        break;
      }
      case 'banana_peel': {
        const zoneX = evalCast.targetPoint.x;
        const zoneY = evalCast.targetPoint.y;
        const peelDuration = lv >= 4 ? 11.0 : 8.5;
        const slowFactor = lv >= 7 ? 0.35 : 0.48;
        const scatterRadius = Math.max(22, spec.radius * 0.62);

        for (let i = 0; i < spec.count; i++) {
          const ang = (Math.PI * 2 * i) / Math.max(1, spec.count) + Math.random() * 0.45;
          const dist = i === 0 ? Math.min(18, scatterRadius * 0.3) : scatterRadius * (0.45 + Math.random() * 0.55);
          const px = Phaser.Math.Clamp(zoneX + Math.cos(ang) * dist, 82, this.roomWidth - 82);
          const py = Phaser.Math.Clamp(zoneY + Math.sin(ang) * dist, 82, this.roomHeight - 82);

          const peelSprite = this.add
            .sprite(px, py - 14, 'fx_banana_peel')
            .setDepth(16)
            .setScale(0.25)
            .setRotation((Math.random() - 0.5) * 0.5);
          this.tweens.add({
            targets: peelSprite,
            y: py,
            scale: 0.95,
            duration: 180 + i * 35,
            ease: 'Back.Out',
          });

          this.hazards.push({
            x: px,
            y: py,
            radius: spec.subRadius,
            delay: 0,
            maxDelay: 0.1,
            fromPlayer: true,
            damage: baseDmg,
            color: spec.color,
            kind: 'banana_peel',
            duration: peelDuration,
            tickTimer: 0.1,
            triggered: true,
            sprite: peelSprite,
            slowFactor,
            triggeredEnemies: new Set<number>(),
          });
        }
        break;
      }
      case 'primate_fury': {
        this.primateFuryTimer = lv >= 7 ? 8.0 : lv >= 4 ? 6.5 : 5.0;
        this.recomputeStats(false);
        this.shakeTrauma = Math.max(this.shakeTrauma, 0.28);
        this.spawnBurst(this.player.x, this.player.y, 0xfacc15, 22, 175);
        this.pushNotice('FÚRIA PRIMATA ATIVADA!', 'gold');
        break;
      }
      case 'banana_rain': {
        const zoneX = evalCast.targetPoint.x;
        const zoneY = evalCast.targetPoint.y;
        const inZone = this.enemies.filter(
          (e) => !e.dying && Phaser.Math.Distance.Between(zoneX, zoneY, e.sprite.x, e.sprite.y) <= spec.radius + e.radius
        );
        for (let i = 0; i < spec.count; i++) {
          let tx: number;
          let ty: number;
          if (inZone.length > 0 && i < inZone.length * 2) {
            const target = inZone[i % inZone.length];
            tx = target.sprite.x + (Math.random() - 0.5) * 30;
            ty = target.sprite.y + (Math.random() - 0.5) * 30;
          } else {
            const ang = (Math.PI * 2 * i) / Math.max(1, spec.count) + Math.random() * 0.55;
            const dist = Math.random() * Math.max(24, spec.radius - spec.subRadius * 0.45);
            tx = zoneX + Math.cos(ang) * dist;
            ty = zoneY + Math.sin(ang) * dist;
          }
          tx = Phaser.Math.Clamp(tx, 76, this.roomWidth - 76);
          ty = Phaser.Math.Clamp(ty, 76, this.roomHeight - 76);
          const delay = 0.34 + i * 0.085;

          const fallingSprite = this.add
            .sprite(tx, ty - 240, 'proj_banana_bomb')
            .setDepth(68)
            .setScale(1.08)
            .setAlpha(0.95);
          this.tweens.add({
            targets: fallingSprite,
            y: ty,
            rotation: Math.PI * 3.5,
            duration: Math.max(120, Math.round(delay * 1000)),
            ease: 'Quad.In',
            onComplete: () => {
              if (fallingSprite.active) fallingSprite.destroy();
            },
          });

          this.hazards.push({
            x: tx,
            y: ty,
            radius: spec.subRadius,
            delay,
            maxDelay: delay,
            fromPlayer: true,
            damage: baseDmg,
            color: spec.color,
            kind: 'banana_rain',
            duration: 0,
            tickTimer: 0,
            triggered: false,
            sprite: fallingSprite,
          });
        }
        break;
      }
    }
  }

  private updateTargetingOverlay(dt: number) {
    if (!this.targetingRenderer || !this.player || !this.isActiveRun || this.isPaused) {
      this.targetingRenderer?.clear();
      return;
    }

    if (this.reticleRecoil > 0) {
      this.reticleRecoil = Math.max(0, this.reticleRecoil - dt * 7.5);
    }

    if (this.cooldownPreview) {
      this.cooldownPreview.timer -= dt;
      if (this.cooldownPreview.timer <= 0) {
        this.cooldownPreview = null;
      }
    }

    const origin = { x: this.player.x, y: this.player.y };
    const cursorWorld = this.getCursorWorldPoint();
    const targetables = this.getTargetableEnemies();
    const basicSpec = computeBasicAttackSpec(this.classId, this.computedStats, this.skills, this.furyTimer > 0);
    const autoTarget =
      this.lastAutoTarget ??
      selectAutoAttackTarget(
        origin,
        cursorWorld,
        basicSpec,
        targetables,
        this.autoTargetId,
        this.settings.autoAttack,
        this.roomWidth,
        this.roomHeight,
        this.pillarsLayout
      );

    // Evaluate active pending cast (or brief cooldown preview) using exact unified geometry
    let activeCast = null;
    const previewSource = this.pendingCast ?? this.cooldownPreview;
    if (previewSource) {
      if (previewSource.kind === 'dash') {
        const dashSpec = computeDashGeometrySpec(this.computedStats);
        activeCast = evaluateSkillCast(
          dashSpec,
          origin,
          cursorWorld,
          targetables,
          this.roomWidth,
          this.roomHeight,
          this.pillarsLayout,
          this.dashCooldown
        );
      } else if (previewSource.skillId) {
        const lv = this.skills[previewSource.skillId] ?? 0;
        if (lv > 0) {
          const skillSpec = computeSkillGeometrySpec(
            previewSource.skillId,
            lv,
            this.computedStats,
            this.mods,
            this.activeSynergies
          );
          activeCast = evaluateSkillCast(
            skillSpec,
            origin,
            cursorWorld,
            targetables,
            this.roomWidth,
            this.roomHeight,
            this.pillarsLayout,
            this.skillCooldowns[previewSource.skillId] ?? 0
          );
        }
      }
    }

    // Subtle passive aura outlines (electric aura / orbital blades)
    const passiveAuras: Array<{ radius: number; color: number }> = [];
    const eaLv = this.skills.electric_aura ?? 0;
    if (eaLv > 0) passiveAuras.push({ radius: eaLv >= 4 ? 140 : 104, color: 0x38bdf8 });
    const orbLv = this.skills.orbital_blades ?? 0;
    if (orbLv > 0) passiveAuras.push({ radius: orbLv >= 4 ? 86 : 68, color: 0xcbd5e1 });

    const isTouchOnly =
      this.settings.mobileControls === 'on' ||
      (this.settings.mobileControls === 'auto' &&
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
        !this.pointerInitialized);

    this.targetingRenderer.render({
      elapsedSec: this.elapsedSec,
      playerPos: origin,
      cursorScreen: { x: this.pointerScreenX, y: this.pointerScreenY },
      cursorWorld,
      cameraZoom: this.cameras.main.zoom || 1,
      showReticle: !isTouchOnly && !this.pointerOverHud,
      showAttackRange: this.settings.showAttackRange,
      autoAttackEnabled: this.settings.autoAttack,
      basicSpec,
      autoTarget,
      activeCast,
      enemies: targetables,
      pillars: this.pillarsLayout,
      passiveAuras,
      recoilKick: this.reticleRecoil,
    });
  }

  private updatePassivesAndSynergies(dt: number) {
    // 1. Orbital Blades
    const orbLv = this.skills.orbital_blades ?? 0;
    if (orbLv > 0) {
      const desiredCount = orbLv >= 7 ? 6 : orbLv >= 4 ? 4 : 2;
      if (this.orbitalSprites.length !== desiredCount) {
        this.rebuildOrbitals();
      }
      const rotSpeed = 3.2 + orbLv * 0.25;
      const radius = orbLv >= 4 ? 86 : 68;
      this.orbitalAngle += dt * rotSpeed;
      const now = this.elapsedSec;
      const dmg =
        this.computedStats.damage *
        SKILLS.orbital_blades.basePower *
        (1 + (orbLv - 1) * BALANCE_CONFIG.skills.perLevelScaling);

      for (let i = 0; i < this.orbitalSprites.length; i++) {
        const ang = this.orbitalAngle + (Math.PI * 2 * i) / this.orbitalSprites.length;
        const ox = this.player.x + Math.cos(ang) * radius;
        const oy = this.player.y + Math.sin(ang) * radius;
        const sp = this.orbitalSprites[i];
        sp.setPosition(ox, oy).setRotation(ang + Math.PI / 2);

        for (const e of this.enemies) {
          if (e.dying) continue;
          const lastHit = this.orbitalHitMap.get(e.id) ?? 0;
          if (now - lastHit < 0.36) continue;
          if (Phaser.Math.Distance.Between(ox, oy, e.sprite.x, e.sprite.y) <= e.radius + 16) {
            this.orbitalHitMap.set(e.id, now);
            this.damageEnemy(e, dmg, ang, false, orbLv >= 7 ? 0.25 : 0);
          }
        }
      }
    }

    // 2. Electric Aura
    const auraLv = this.skills.electric_aura ?? 0;
    if (auraLv > 0) {
      this.electricAuraTimer -= dt;
      if (this.electricAuraTimer <= 0) {
        this.electricAuraTimer = SKILLS.electric_aura.cooldown;
        const r = auraLv >= 4 ? 140 : 104;
        const dmg =
          this.computedStats.damage *
          SKILLS.electric_aura.basePower *
          (1 + (auraLv - 1) * BALANCE_CONFIG.skills.perLevelScaling);
        let hitAny = false;
        for (const e of this.enemies) {
          if (e.dying) continue;
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y) <= r + e.radius) {
            hitAny = true;
            this.damageEnemy(e, dmg, Phaser.Math.Angle.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y), false);
            if (auraLv >= 4) e.freezeTimer = Math.max(e.freezeTimer, 0.32);
          }
        }
        if (hitAny) {
          const ring = this.add.circle(this.player.x, this.player.y, r, 0x38bdf8, 0.06).setStrokeStyle(2, 0x38bdf8, 0.65).setDepth(46);
          this.tweens.add({ targets: ring, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
        }
      }
    }

    // 3. Regeneration (toned down so dodging & positioning always matter)
    const regLv = this.skills.regeneration ?? 0;
    if (regLv > 0) {
      this.regenTimer -= dt;
      if (this.regenTimer <= 0) {
        this.regenTimer = 1.0;
        const skb = BALANCE_CONFIG.skills;
        let pct = (skb.regenBasePct + (regLv - 1) * skb.regenPerLevelPct) * this.computedStats.maxHp;
        if (regLv >= 4 && this.hp < this.computedStats.maxHp * 0.4) pct *= 1.65;
        if (this.hp < this.computedStats.maxHp) {
          const healAmt = Math.max(1, Math.round(pct));
          this.hp = Math.min(this.computedStats.maxHp, this.hp + healAmt);
          this.spawnDamageText(this.player.x, this.player.y - 24, `+${healAmt}`, '#4ade80', false);
        }
      }
    }

    // 4. Divine Shield recharge
    const shLv = this.skills.divine_shield ?? 0;
    if (shLv > 0) {
      const skb = BALANCE_CONFIG.skills;
      const cap = Math.round(this.computedStats.maxHp * (skb.shieldBasePct + shLv * skb.shieldPerLevelPct));
      if (this.shield < cap) {
        this.shieldRegenTimer += dt;
        const interval = Math.max(4.5, SKILLS.divine_shield.cooldown * (1 - this.computedStats.cooldownReduction));
        if (this.shieldRegenTimer >= interval) {
          this.shieldRegenTimer = 0;
          this.shield = cap;
          this.spawnBurst(this.player.x, this.player.y, 0xfacc15, 10, 90);
        }
      }
    }

    // 5. Life Drain
    const ldLv = this.skills.life_drain ?? 0;
    if (ldLv > 0) {
      this.lifeDrainTimer -= dt;
      if (this.lifeDrainTimer <= 0) {
        this.lifeDrainTimer = SKILLS.life_drain.cooldown;
        const maxTargets = ldLv >= 7 ? 5 : ldLv >= 4 ? 3 : 2;
        const dmg =
          this.computedStats.damage *
          SKILLS.life_drain.basePower *
          (1 + (ldLv - 1) * BALANCE_CONFIG.skills.perLevelScaling);
        let drained = 0;
        for (const e of this.enemies) {
          if (e.dying || drained >= maxTargets) continue;
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y) <= 200) {
            drained++;
            this.drawLightningArc(e.sprite.x, e.sprite.y, this.player.x, this.player.y, 0xe11d48);
            const dealt = this.damageEnemy(e, dmg, 0, false);
            const heal = Math.max(1, Math.round(dealt * BALANCE_CONFIG.skills.lifeDrainHealRatio));
            if (ldLv >= 7 && this.hp >= this.computedStats.maxHp) {
              this.shield = Math.min(this.computedStats.maxHp * 0.45, this.shield + heal);
            } else {
              this.hp = Math.min(this.computedStats.maxHp, this.hp + heal);
            }
          }
        }
      }
    }

    // 6. Secret Synergy: Fire Tornado (periodic flaming vortex)
    if (this.activeSynergies.includes('fire_tornado')) {
      this.fireTornadoTimer -= dt;
      if (this.fireTornadoTimer <= 0) {
        this.fireTornadoTimer = 4.0;
        const target = this.enemies.find((e) => !e.dying);
        const tx = target ? target.sprite.x : this.player.x + 120;
        const ty = target ? target.sprite.y : this.player.y;
        this.hazards.push({
          x: tx,
          y: ty,
          radius: 90,
          delay: 0,
          maxDelay: 0.1,
          fromPlayer: true,
          damage: this.computedStats.damage * 1.15,
          color: 0xfb923c,
          kind: 'fire_tornado',
          duration: 2.8,
          tickTimer: 0.28,
          triggered: true,
        });
      }
    }
  }

  private clearOrbitals() {
    for (const s of this.orbitalSprites) s.destroy();
    this.orbitalSprites = [];
  }

  private rebuildOrbitals() {
    this.clearOrbitals();
    if (!this.player) return;
    const lv = this.skills.orbital_blades ?? 0;
    if (lv <= 0) return;
    const count = lv >= 7 ? 6 : lv >= 4 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const sp = this.add.sprite(this.player.x, this.player.y, 'proj_orbital').setDepth(59);
      this.orbitalSprites.push(sp);
    }
  }

  private updateEnemies(dt: number) {
    const pBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    const pVx = pBody?.velocity.x ?? 0;
    const pVy = pBody?.velocity.y ?? 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dying) {
        e.deathTimer -= dt;
        e.sprite.setAlpha(Math.max(0, e.deathTimer / 0.28));
        e.sprite.setScale(e.sprite.scaleX * (1 - dt * 1.9));
        e.sprite.x += e.knockVx * dt;
        e.sprite.y += e.knockVy * dt;
        if (e.deathTimer <= 0) {
          e.sprite.destroy();
          e.hpBarBorder.destroy();
          e.hpBarBg.destroy();
          e.hpBarGhost.destroy();
          e.hpBarFill.destroy();
          e.eliteMarker?.destroy();
          e.auraRing?.destroy();
          e.bossOuterRing?.destroy();
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const body = e.sprite.body as Phaser.Physics.Arcade.Body;
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        if (e.flashTimer <= 0) e.sprite.clearTint();
      }

      // Smoothly recover scale toward baseScale with subtle living march bob
      const marchBob = Math.sin(this.elapsedSec * 7.5 + e.id * 1.7) * 0.032;
      const tgtSx = e.baseScale * (1 + marchBob);
      const tgtSy = e.baseScale * (1 - marchBob);
      e.sprite.scaleX = Phaser.Math.Linear(e.sprite.scaleX, tgtSx, Math.min(1, dt * 14));
      e.sprite.scaleY = Phaser.Math.Linear(e.sprite.scaleY, tgtSy, Math.min(1, dt * 14));

      // Frozen state (Time Freeze / Glacial Storm)
      if (e.freezeTimer > 0) {
        e.freezeTimer -= dt;
        if (e.flashTimer <= 0) {
          e.sprite.clearTint();
          e.sprite.setTint(0x38bdf8);
        }
        body.setVelocity(e.knockVx, e.knockVy);
        e.knockVx *= Math.pow(0.05, dt);
        e.knockVy *= Math.pow(0.05, dt);
        this.syncEnemyDecor(e, dt);
        if (e.freezeTimer <= 0 && e.flashTimer <= 0) e.sprite.clearTint();
        continue;
      }

      const dist = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y);
      const angToPlayer = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y);
      e.sprite.setFlipX(Math.cos(angToPlayer) < 0);

      // Decay knockback impulse
      e.knockVx *= Math.pow(0.01, dt);
      e.knockVy *= Math.pow(0.01, dt);

      if (e.attackCooldown > 0) e.attackCooldown -= dt;
      e.aiTimer -= dt;

      if (e.slowTimer > 0) {
        e.slowTimer = Math.max(0, e.slowTimer - dt);
        if (e.flashTimer <= 0) {
          e.sprite.setTint(0xfde047);
        }
        if (e.slowTimer <= 0) {
          e.slowFactor = 1;
          if (e.flashTimer <= 0) e.sprite.clearTint();
        }
      }

      const berserkMult = e.eliteMod === 'berserker' && e.hp < e.maxHp * 0.5 ? 1.42 : 1;
      const slowMult = e.slowTimer > 0 ? e.slowFactor : 1;
      const moveSpeed = e.speed * berserkMult * slowMult;

      // Post-charge boss recovery punish window (skids & pants briefly so dodging feels rewarding)
      if (e.recoveryTimer > 0) {
        e.recoveryTimer -= dt;
        body.setVelocity(e.knockVx * 0.65, e.knockVy * 0.65);
        e.sprite.setScale(e.baseScale * 1.07, e.baseScale * 0.92);
        if (Math.random() < 0.3 && this.settings.graphicsQuality !== 'low') {
          this.spawnParticle(
            e.sprite.x + (Math.random() - 0.5) * 26,
            e.sprite.y + e.radius * 0.55,
            (Math.random() - 0.5) * 35,
            -18 - Math.random() * 20,
            0x94a3b8,
            0.32,
            0.55
          );
        }
        this.syncEnemyDecor(e, dt);
        continue;
      }

      // Active telegraphed windup resolution with anticipation crouch & ember charge-up
      if (e.windupTimer > 0) {
        e.windupTimer -= dt;
        const prog = 1 - Math.max(0, e.windupTimer / Math.max(0.05, e.windupMax));
        const crouchX = e.baseScale * (1 + prog * 0.14);
        const crouchY = e.baseScale * (1 - prog * 0.12);
        e.sprite.setScale(crouchX, crouchY);
        if (e.flashTimer <= 0 && prog > 0.55) {
          const blink = Math.floor(this.elapsedSec * 22) % 2 === 0;
          if (blink) e.sprite.setTint(e.bossDef ? 0xfef08a : 0xfca5a5);
          else e.sprite.clearTint();
        }
        body.setVelocity(e.knockVx * 0.2, e.knockVy * 0.2);
        if (e.windupTimer <= 0) {
          if (e.flashTimer <= 0) e.sprite.clearTint();
          // Visible strike follow-through pop
          e.sprite.setScale(e.baseScale * 1.2, e.baseScale * 0.84);
          this.executeEnemyWindupAction(e);
          if (e.hasAttackToken) {
            e.hasAttackToken = false;
            this.activeAttackTokens = Math.max(0, this.activeAttackTokens - 1);
          }
        }
        this.syncEnemyDecor(e, dt);
        continue;
      }

      // Boss multi-phase AI
      if (e.bossDef) {
        this.updateBossAI(e, dt, dist, angToPlayer, moveSpeed);
        this.syncEnemyDecor(e, dt);
        continue;
      }

      // Distinct Archetype AI Policies (tighter pursuit & varied combat roles)
      const arch = ENEMY_ARCHETYPES[e.archetypeId];
      let vx = 0;
      let vy = 0;

      switch (arch.behavior) {
        case 'flanker': {
          // Goblin: relentless angled flank pursuit + quick dagger slash
          if (e.aiTimer <= 0) {
            e.strafeDir *= -1;
            e.aiTimer = 0.85 + Math.random() * 0.65;
          }
          const flankAng = angToPlayer + (dist < 135 ? 0.36 * e.strafeDir : 0.2 * e.strafeDir);
          vx = Math.cos(flankAng) * moveSpeed;
          vy = Math.sin(flankAng) * moveSpeed;
          if (dist <= e.radius + 27 && e.attackCooldown <= 0) {
            this.damagePlayer(e.damage, e);
            e.knockVx += Math.cos(angToPlayer) * 110;
            e.knockVy += Math.sin(angToPlayer) * 110;
            e.attackCooldown = 0.78;
          }
          break;
        }
        case 'melee_lunge': {
          // Skeleton: disciplined march + brisk telegraphed lunge cleave
          vx = Math.cos(angToPlayer) * moveSpeed;
          vy = Math.sin(angToPlayer) * moveSpeed;
          if (dist < 90 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'melee_lunge';
            e.windupTimer = 0.32;
            e.windupMax = 0.32;
            e.windupTargetX = this.player.x;
            e.windupTargetY = this.player.y;
          }
          break;
        }
        case 'kiter_ranged': {
          // Archer: maintains firing lane, kites when pressured, slight lead on moving target
          if (e.aiTimer <= 0) {
            e.strafeDir *= -1;
            e.aiTimer = 1.4 + Math.random() * 0.8;
          }
          if (dist < 175) {
            vx = -Math.cos(angToPlayer) * moveSpeed * 0.96;
            vy = -Math.sin(angToPlayer) * moveSpeed * 0.96;
          } else if (dist > 325) {
            vx = Math.cos(angToPlayer) * moveSpeed * 1.05;
            vy = Math.sin(angToPlayer) * moveSpeed * 1.05;
          } else {
            vx = Math.cos(angToPlayer + (Math.PI / 2) * e.strafeDir) * moveSpeed * 0.72;
            vy = Math.sin(angToPlayer + (Math.PI / 2) * e.strafeDir) * moveSpeed * 0.72;
          }
          if (dist < 410 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'archer_shot';
            e.windupTimer = 0.4;
            e.windupMax = 0.4;
            e.windupTargetX = this.player.x + pVx * 0.22;
            e.windupTargetY = this.player.y + pVy * 0.22;
          }
          break;
        }
        case 'artillery_mage': {
          // Mage: zones mid-range, drops arcane blast circle + 3-bolt fan
          if (dist < 195) {
            vx = -Math.cos(angToPlayer) * moveSpeed * 0.88;
            vy = -Math.sin(angToPlayer) * moveSpeed * 0.88;
          } else if (dist > 350) {
            vx = Math.cos(angToPlayer) * moveSpeed * 0.95;
            vy = Math.sin(angToPlayer) * moveSpeed * 0.95;
          }
          if (dist < 440 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'mage_cast';
            e.windupTimer = 0.48;
            e.windupMax = 0.48;
            e.windupTargetX = this.player.x + pVx * 0.16;
            e.windupTargetY = this.player.y + pVy * 0.16;
          }
          break;
        }
        case 'bomber': {
          // Bomber: aggressive rush with urgent fuse detonation
          vx = Math.cos(angToPlayer) * moveSpeed * 1.05;
          vy = Math.sin(angToPlayer) * moveSpeed * 1.05;
          if (dist < 82) {
            e.windupAction = 'bomber_detonate';
            e.windupTimer = 0.45;
            e.windupMax = 0.45;
            e.windupTargetX = e.sprite.x;
            e.windupTargetY = e.sprite.y;
          }
          break;
        }
        case 'heavy_stomp': {
          // Golem: relentless advance + wide crushing shockwave stomp
          vx = Math.cos(angToPlayer) * moveSpeed;
          vy = Math.sin(angToPlayer) * moveSpeed;
          if (dist < 118 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'golem_stomp';
            e.windupTimer = 0.55;
            e.windupMax = 0.55;
            e.windupTargetX = e.sprite.x;
            e.windupTargetY = e.sprite.y;
          }
          break;
        }
        case 'teleporter': {
          // Shadow Assassin: flanks then blinks behind hero for a lethal strike
          vx = Math.cos(angToPlayer) * moveSpeed * 0.92;
          vy = Math.sin(angToPlayer) * moveSpeed * 0.92;
          if (e.attackCooldown <= 0 && dist < 460 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'assassin_blink';
            e.windupTimer = 0.38;
            e.windupMax = 0.38;
            const behindAng = angToPlayer + Math.PI;
            e.windupTargetX = Phaser.Math.Clamp(this.player.x + Math.cos(behindAng) * 54, 96, this.roomWidth - 96);
            e.windupTargetY = Phaser.Math.Clamp(this.player.y + Math.sin(behindAng) * 54, 96, this.roomHeight - 96);
          }
          break;
        }
        case 'healer': {
          // Healer: mends wounded allies; fires defensive venom bolt if no ally needs healing
          const wounded = this.enemies.find((al) => !al.dying && al.id !== e.id && al.hp < al.maxHp * 0.88);
          if (wounded) {
            const angAl = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, wounded.sprite.x, wounded.sprite.y);
            const dAl = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, wounded.sprite.x, wounded.sprite.y);
            if (dAl > 115) {
              vx = Math.cos(angAl) * moveSpeed;
              vy = Math.sin(angAl) * moveSpeed;
            }
            if (e.attackCooldown <= 0) {
              e.attackCooldown = 2.9;
              const healAmt = Math.round(wounded.maxHp * 0.18);
              wounded.hp = Math.min(wounded.maxHp, wounded.hp + healAmt);
              this.drawLightningArc(e.sprite.x, e.sprite.y, wounded.sprite.x, wounded.sprite.y, 0x34d399);
              this.spawnDamageText(wounded.sprite.x, wounded.sprite.y - 20, `+${healAmt}`, '#34d399', false);
            }
          } else {
            if (dist < 220) {
              vx = -Math.cos(angToPlayer) * moveSpeed;
              vy = -Math.sin(angToPlayer) * moveSpeed;
            } else if (dist > 340) {
              vx = Math.cos(angToPlayer) * moveSpeed * 0.8;
              vy = Math.sin(angToPlayer) * moveSpeed * 0.8;
            }
            if (dist < 380 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
              e.attackCooldown = 2.2;
              this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, angToPlayer, 310, e.damage * 0.85, 'proj_enemy_bolt');
              if (e.hasAttackToken) {
                e.hasAttackToken = false;
                this.activeAttackTokens = Math.max(0, this.activeAttackTokens - 1);
              }
            }
          }
          break;
        }
        case 'summoner': {
          // Summoner: kites, raises minions, and harasses with void bolts between summons
          if (dist < 235) {
            vx = -Math.cos(angToPlayer) * moveSpeed;
            vy = -Math.sin(angToPlayer) * moveSpeed;
          }
          if (e.attackCooldown <= 0 && e.summonCount < 4 && this.enemies.length < 30) {
            e.attackCooldown = 4.6;
            e.summonCount++;
            const sx = Phaser.Math.Clamp(e.sprite.x + (Math.random() - 0.5) * 90, 96, this.roomWidth - 96);
            const sy = Phaser.Math.Clamp(e.sprite.y + (Math.random() - 0.5) * 90, 96, this.roomHeight - 96);
            this.spawnEnemy(e.summonCount % 2 === 0 ? 'skeleton' : 'goblin', sx, sy, null, 0.78);
            this.spawnBurst(sx, sy, 0xe879f9, 12, 100);
          } else if (e.aiTimer <= 0 && dist < 390) {
            e.aiTimer = 2.3;
            this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, angToPlayer, 300, e.damage * 0.85, 'proj_enemy_bolt');
          }
          break;
        }
        case 'charger': {
          // Stalker: prowls forward then locks fast lethal charge
          vx = Math.cos(angToPlayer) * moveSpeed * 0.8;
          vy = Math.sin(angToPlayer) * moveSpeed * 0.8;
          if (dist < 340 && e.attackCooldown <= 0 && this.tryClaimAttackToken(e)) {
            e.windupAction = 'stalker_charge';
            e.windupTimer = 0.46;
            e.windupMax = 0.46;
            e.windupTargetX = this.player.x + pVx * 0.14;
            e.windupTargetY = this.player.y + pVy * 0.14;
          }
          break;
        }
      }

      body.setVelocity(vx + e.knockVx, vy + e.knockVy);
      this.syncEnemyDecor(e, dt);
    }
  }

  private getMaxAttackTokens(): number {
    const ec = BALANCE_CONFIG.enemies;
    return this.floor >= ec.midFloorThreshold ? ec.midFloorAttackTokens : ec.baseAttackTokens;
  }

  private tryClaimAttackToken(e: EnemyEntity): boolean {
    if (this.activeAttackTokens >= this.getMaxAttackTokens()) return false;
    this.activeAttackTokens++;
    e.hasAttackToken = true;
    return true;
  }

  private updateBossAI(e: EnemyEntity, _dt: number, dist: number, angToPlayer: number, moveSpeed: number) {
    const boss = e.bossDef!;
    const bc = BALANCE_CONFIG.bosses;
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;

    // Check Boss Phase transitions
    const hpPct = e.hp / e.maxHp;
    const maxPhases = boss.isMegaBoss ? 3 : 2;
    const desiredPhase =
      maxPhases === 3 ? (hpPct <= 0.35 ? 3 : hpPct <= 0.7 ? 2 : 1) : hpPct <= 0.5 ? 2 : 1;

    if (desiredPhase > e.bossPhase) {
      e.bossPhase = desiredPhase;
      this.hitstopTimer = 0.075;
      this.shakeTrauma = 0.72;
      audioEngine.playBossTelegraph();
      this.spawnBurst(e.sprite.x, e.sprite.y, 0xf59e0b, 32, 260);
      this.spawnGroundScorch(e.sprite.x, e.sprite.y, 1.85);
      const phaseRing = this.add
        .circle(e.sprite.x, e.sprite.y, e.radius * 0.7, 0xf59e0b, 0.25)
        .setStrokeStyle(4, 0xfef08a, 0.95)
        .setDepth(64);
      this.tweens.add({
        targets: phaseRing,
        scale: 4.5,
        alpha: 0,
        duration: 360,
        ease: 'Cubic.Out',
        onComplete: () => phaseRing.destroy(),
      });
      this.pushNotice(`${boss.name} enfureceu — FASE ${e.bossPhase}!`, 'crimson');
      e.attackCooldown = 0.65;
      // Defensive shockwave nova on phase shift
      const burstOrbs = 8 + e.bossPhase * 2;
      for (let k = 0; k < burstOrbs; k++) {
        const a = (Math.PI * 2 * k) / burstOrbs;
        this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, a, 275, e.damage * 0.82, 'proj_boss_orb');
      }
    }

    const phaseMult =
      e.bossPhase >= 3 ? 1 + bc.phase3SpeedBoost : e.bossPhase === 2 ? 1 + bc.phase2SpeedBoost : 1;
    body.setVelocity(
      Math.cos(angToPlayer) * moveSpeed * phaseMult + e.knockVx * 0.2,
      Math.sin(angToPlayer) * moveSpeed * phaseMult + e.knockVy * 0.2
    );

    if (dist <= e.radius + 25 && e.aiTimer <= 0) {
      this.damagePlayer(e.damage * 0.9, e);
      e.aiTimer = 0.72;
    }

    if (e.attackCooldown <= 0) {
      const pattern = boss.patterns[Math.floor(Math.random() * boss.patterns.length)];
      e.windupAction = `boss_${pattern}`;
      const wTime = Math.max(0.42, 0.72 - (e.bossPhase - 1) * 0.11);
      e.windupTimer = wTime;
      e.windupMax = wTime;
      e.windupTargetX = this.player.x;
      e.windupTargetY = this.player.y;
      audioEngine.playBossTelegraph();
    }
  }

  private executeEnemyWindupAction(e: EnemyEntity) {
    const action = e.windupAction;
    e.windupAction = null;
    const ang = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, e.windupTargetX, e.windupTargetY);
    const cdStep = BALANCE_CONFIG.bosses.phaseCooldownStep;

    switch (action) {
      case 'melee_lunge': {
        e.knockVx = Math.cos(ang) * 310;
        e.knockVy = Math.sin(ang) * 310;
        e.attackCooldown = 1.18;
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) < 96) {
          this.damagePlayer(e.damage * 1.25, e);
        }
        break;
      }
      case 'archer_shot': {
        e.attackCooldown = 1.55;
        this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang, 430, e.damage, 'proj_enemy_bolt');
        break;
      }
      case 'mage_cast': {
        e.attackCooldown = 2.15;
        this.hazards.push({
          x: e.windupTargetX,
          y: e.windupTargetY,
          radius: 66,
          delay: 0.58,
          maxDelay: 0.58,
          fromPlayer: false,
          damage: e.damage * 1.32,
          color: 0xc084fc,
          kind: 'mage_circle',
          duration: 0,
          tickTimer: 0,
          triggered: false,
        });
        for (let k = -1; k <= 1; k++) {
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang + k * 0.24, 320, e.damage * 0.82);
        }
        break;
      }
      case 'bomber_detonate': {
        this.spawnBurst(e.sprite.x, e.sprite.y, 0xf97316, 22, 190);
        audioEngine.playSkill('fire');
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) <= 98) {
          this.damagePlayer(e.damage * 1.45, e);
        }
        this.killEnemy(e, false);
        break;
      }
      case 'golem_stomp': {
        e.attackCooldown = 2.15;
        this.shakeTrauma = Math.max(this.shakeTrauma, 0.38);
        this.spawnBurst(e.sprite.x, e.sprite.y, 0x94a3b8, 18, 165);
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) <= 126) {
          this.damagePlayer(e.damage * 1.4, e);
        }
        break;
      }
      case 'assassin_blink': {
        e.attackCooldown = 2.45;
        this.spawnBurst(e.sprite.x, e.sprite.y, 0x6366f1, 10, 100);
        e.sprite.setPosition(e.windupTargetX, e.windupTargetY);
        this.spawnBurst(e.sprite.x, e.sprite.y, 0xa855f7, 14, 130);
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) <= 82) {
          this.damagePlayer(e.damage * 1.25, e);
        }
        break;
      }
      case 'stalker_charge': {
        e.attackCooldown = 2.05;
        e.knockVx = Math.cos(ang) * 560;
        e.knockVy = Math.sin(ang) * 560;
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) <= 132) {
          this.damagePlayer(e.damage * 1.32, e);
        }
        break;
      }
      case 'boss_charge_dash': {
        e.attackCooldown = Math.max(1.1, 2.15 - (e.bossPhase - 1) * cdStep);
        e.knockVx = Math.cos(ang) * 660;
        e.knockVy = Math.sin(ang) * 660;
        e.recoveryTimer = BALANCE_CONFIG.bosses.chargeRecoverySec;
        this.shakeTrauma = Math.max(this.shakeTrauma, 0.4);
        this.spawnHitSparks(e.sprite.x, e.sprite.y, ang + Math.PI, 0xf59e0b, 8, 220);
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) <= e.radius + 98) {
          this.damagePlayer(e.damage * 1.28, e);
        }
        if (e.bossPhase >= 2) {
          // Leave shockwave orbs along flank on enraged charge
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang + 0.55, 305, e.damage * 0.78, 'proj_boss_orb');
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang - 0.55, 305, e.damage * 0.78, 'proj_boss_orb');
        }
        break;
      }
      case 'boss_cone_slam': {
        e.attackCooldown = Math.max(1.15, 2.15 - (e.bossPhase - 1) * cdStep);
        const count = 5 + e.bossPhase * 2;
        for (let k = 0; k < count; k++) {
          const spread = -0.68 + (1.36 / (count - 1)) * k;
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang + spread, 370, e.damage, 'proj_boss_orb');
        }
        break;
      }
      case 'boss_ring_nova': {
        e.attackCooldown = Math.max(1.3, 2.35 - (e.bossPhase - 1) * cdStep);
        const projectiles = 12 + e.bossPhase * 4;
        for (let k = 0; k < projectiles; k++) {
          const a = (Math.PI * 2 * k) / projectiles;
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, a, 305, e.damage * 0.95, 'proj_boss_orb');
        }
        if (e.bossPhase >= 2) {
          const bx = e.sprite.x;
          const by = e.sprite.y;
          const bdmg = e.damage * 0.88;
          this.time.delayedCall(260, () => {
            if (!this.isActiveRun || this.isEndingRun || e.dying) return;
            for (let k = 0; k < projectiles; k++) {
              const a = (Math.PI * 2 * (k + 0.5)) / projectiles;
              this.spawnEnemyProjectile(bx, by, a, 275, bdmg, 'proj_boss_orb');
            }
          });
        }
        break;
      }
      case 'boss_spiral_barrage': {
        e.attackCooldown = Math.max(1.1, 2.05 - (e.bossPhase - 1) * cdStep);
        const arms = 7 + e.bossPhase * 3;
        const offset = this.elapsedSec * 2.2;
        for (let k = 0; k < arms; k++) {
          const a = offset + (Math.PI * 2 * k) / arms;
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, a, 330, e.damage * 0.92, 'proj_boss_orb');
        }
        break;
      }
      case 'boss_meteor_rain': {
        e.attackCooldown = Math.max(1.55, 2.75 - (e.bossPhase - 1) * cdStep);
        const zones = 4 + e.bossPhase * 2;
        for (let k = 0; k < zones; k++) {
          const tx = k === 0 ? this.player.x : this.player.x + (Math.random() - 0.5) * 350;
          const ty = k === 0 ? this.player.y : this.player.y + (Math.random() - 0.5) * 350;
          this.hazards.push({
            x: Phaser.Math.Clamp(tx, 96, this.roomWidth - 96),
            y: Phaser.Math.Clamp(ty, 96, this.roomHeight - 96),
            radius: 78,
            delay: 0.72,
            maxDelay: 0.72,
            fromPlayer: false,
            damage: e.damage * 1.42,
            color: 0xef4444,
            kind: 'boss_aoe',
            duration: 0,
            tickTimer: 0,
            triggered: false,
          });
        }
        break;
      }
      case 'boss_frost_lance': {
        e.attackCooldown = Math.max(1.25, 2.15 - (e.bossPhase - 1) * cdStep);
        const lances = 5 + e.bossPhase * 2;
        for (let k = 0; k < lances; k++) {
          const spread = -0.54 + (1.08 / (lances - 1)) * k;
          this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, ang + spread, 450, e.damage * 1.05, 'proj_boss_orb', true);
        }
        break;
      }
      case 'boss_void_pull': {
        e.attackCooldown = Math.max(1.65, 2.9 - (e.bossPhase - 1) * cdStep);
        const pullAng = Phaser.Math.Angle.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
        this.player.x = Phaser.Math.Clamp(this.player.x + Math.cos(pullAng) * 105, 80, this.roomWidth - 80);
        this.player.y = Phaser.Math.Clamp(this.player.y + Math.sin(pullAng) * 105, 80, this.roomHeight - 80);
        this.hazards.push({
          x: e.sprite.x,
          y: e.sprite.y,
          radius: 152,
          delay: 0.66,
          maxDelay: 0.66,
          fromPlayer: false,
          damage: e.damage * 1.4,
          color: 0xc026d3,
          kind: 'boss_aoe',
          duration: 0,
          tickTimer: 0,
          triggered: false,
        });
        break;
      }
      case 'boss_summon_minions': {
        e.attackCooldown = Math.max(2.3, 3.8 - (e.bossPhase - 1) * cdStep);
        const adds = Math.min(BALANCE_CONFIG.bosses.maxBossAdds, 1 + e.bossPhase);
        if (this.enemies.length < 12) {
          for (let k = 0; k < adds; k++) {
            const a = (Math.PI * 2 * k) / adds;
            const sx = Phaser.Math.Clamp(e.sprite.x + Math.cos(a) * 95, 96, this.roomWidth - 96);
            const sy = Phaser.Math.Clamp(e.sprite.y + Math.sin(a) * 95, 96, this.roomHeight - 96);
            const kind: EnemyArchetypeId = k % 3 === 0 ? 'archer' : k % 2 === 0 ? 'goblin' : 'skeleton';
            this.spawnEnemy(kind, sx, sy, null, 0.74);
            this.spawnBurst(sx, sy, 0xa855f7, 12, 110);
          }
        }
        break;
      }
    }
  }

  private syncEnemyDecor(e: EnemyEntity, dt = 0.016) {
    const x = e.sprite.x;
    const y = e.sprite.y;
    const barW = e.eliteMod ? 46 : 34;
    const barY = y - e.radius - 14;
    const hpRatio = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));

    // Trailing damage ghost bar smoothly catches up to real HP
    if (e.ghostHp > e.hp) {
      e.ghostHp = Math.max(e.hp, e.ghostHp - e.maxHp * dt * 1.45);
    } else {
      e.ghostHp = e.hp;
    }
    const ghostRatio = Math.max(hpRatio, Math.min(1, e.ghostHp / Math.max(1, e.maxHp)));

    e.hpBarBorder.setPosition(x, barY);
    e.hpBarBg.setPosition(x, barY);
    e.hpBarGhost.setPosition(x - barW / 2, barY);
    e.hpBarGhost.width = ghostRatio * barW;
    e.hpBarFill.setPosition(x - barW / 2, barY);
    e.hpBarFill.width = hpRatio * barW;
    e.eliteMarker?.setPosition(x - barW / 2 - 5, barY);
    e.auraRing?.setPosition(x, y + 6);
    if (e.bossOuterRing) {
      e.bossOuterRing.setPosition(x, y + 6);
      const pulse = 1 + Math.sin(this.elapsedSec * 3.5) * 0.05;
      e.bossOuterRing.setScale(pulse);
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (p.spinSpeed) {
        p.sprite.rotation += p.spinSpeed * dt;
      }

      // Subtle lightweight projectile trails on magic/heavy orbs
      if (this.settings.graphicsQuality !== 'low') {
        const key = p.sprite.texture.key;
        if (
          (key === 'proj_fireball' ||
            key === 'proj_shadow_wave' ||
            key === 'proj_boss_orb' ||
            key === 'proj_arcane' ||
            key === 'proj_banana' ||
            key === 'proj_banana_bomb') &&
          Math.random() < (this.settings.graphicsQuality === 'high' ? 0.55 : 0.28)
        ) {
          this.spawnParticle(
            p.sprite.x + (Math.random() - 0.5) * 6,
            p.sprite.y + (Math.random() - 0.5) * 6,
            -p.vx * 0.12 + (Math.random() - 0.5) * 24,
            -p.vy * 0.12 + (Math.random() - 0.5) * 24,
            p.color,
            0.2,
            0.65
          );
        }
      }

      let destroy = p.life <= 0;
      let hitSolid = false;
      if (
        p.sprite.x < 56 ||
        p.sprite.x > this.roomWidth - 56 ||
        p.sprite.y < 56 ||
        p.sprite.y > this.roomHeight - 56
      ) {
        destroy = true;
        hitSolid = true;
      }

      if (!destroy) {
        for (const pil of this.pillarsLayout) {
          if (Math.abs(p.sprite.x - pil.x) < pil.w * 0.5 && Math.abs(p.sprite.y - pil.y) < pil.h * 0.5) {
            destroy = true;
            hitSolid = true;
            break;
          }
        }
      }

      if (!destroy && p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.dying || p.hitIds.has(e.id)) continue;
          if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, e.sprite.x, e.sprite.y) <= e.radius + 14) {
            p.hitIds.add(e.id);
            const ang = Math.atan2(p.vy, p.vx);
            if (p.explosiveRadius > 0) {
              this.triggerRadialAoE(p.sprite.x, p.sprite.y, p.explosiveRadius, p.damage, p.color, 0);
            } else {
              this.damageEnemy(e, p.damage, ang, false, p.bonusCrit ?? 0);
            }
            if (p.pierceLeft > 0) {
              p.pierceLeft--;
            } else {
              destroy = true;
              break;
            }
          }
        }
      } else if (!destroy && !p.fromPlayer) {
        if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.player.x, this.player.y) <= 22) {
          this.damagePlayer(p.damage, null, p.appliesSlow);
          destroy = true;
        }
      }

      if (destroy) {
        if (p.explosiveRadius > 0 && (p.life <= 0 || hitSolid)) {
          this.spawnBurst(p.sprite.x, p.sprite.y, p.color, 10, 120);
        } else if (hitSolid && this.settings.graphicsQuality !== 'low') {
          this.spawnHitSparks(p.sprite.x, p.sprite.y, Math.atan2(-p.vy, -p.vx), p.color, 3, 110);
        }
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateMinions(dt: number) {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.life -= dt;
      if (m.attackCd > 0) m.attackCd -= dt;

      if (m.life <= 0) {
        if (m.explodesOnEnd) {
          this.triggerRadialAoE(m.x, m.y, 85, m.damage * 1.8, 0x818cf8, 0);
        }
        m.sprite.destroy();
        this.minions.splice(i, 1);
        continue;
      }

      let target: EnemyEntity | null = null;
      let bestD = 9999;
      for (const e of this.enemies) {
        if (e.dying) continue;
        const d = Phaser.Math.Distance.Between(m.x, m.y, e.sprite.x, e.sprite.y);
        if (d < bestD) {
          bestD = d;
          target = e;
        }
      }

      if (target) {
        const ang = Phaser.Math.Angle.Between(m.x, m.y, target.sprite.x, target.sprite.y);
        if (bestD > target.radius + 18) {
          m.x += Math.cos(ang) * m.speed * dt;
          m.y += Math.sin(ang) * m.speed * dt;
        } else if (m.attackCd <= 0) {
          m.attackCd = 0.65;
          this.damageEnemy(target, m.damage, ang, false, m.critChance - this.computedStats.critChance);
        }
      } else {
        const angP = Phaser.Math.Angle.Between(m.x, m.y, this.player.x, this.player.y);
        if (Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) > 72) {
          m.x += Math.cos(angP) * m.speed * 0.8 * dt;
          m.y += Math.sin(angP) * m.speed * 0.8 * dt;
        }
      }
      m.sprite.setPosition(m.x, m.y);
    }
  }

  private updateHazards(dt: number) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (!h.triggered) {
        h.delay -= dt;
        if (h.delay <= 0) {
          h.triggered = true;
          if (h.fromPlayer) {
            if (h.kind === 'banana_rain') {
              h.sprite?.destroy();
              h.sprite = undefined;
              audioEngine.playSlattSkill('banana_bomb');
            }
            this.triggerRadialAoE(h.x, h.y, h.radius, h.damage, h.color, 0);
            this.shakeTrauma = Math.max(this.shakeTrauma, h.kind === 'banana_rain' ? 0.18 : 0.25);
          } else {
            this.spawnBurst(h.x, h.y, h.color, 18, 160);
            if (Phaser.Math.Distance.Between(h.x, h.y, this.player.x, this.player.y) <= h.radius + 14) {
              this.damagePlayer(h.damage, null);
            }
          }
          if (h.duration <= 0) {
            h.sprite?.destroy();
            this.hazards.splice(i, 1);
          }
        }
      } else {
        // Ongoing hazard (Black Hole / Fire Tornado / Banana Peel)
        h.duration -= dt;
        h.tickTimer -= dt;

        if (h.kind === 'black_hole') {
          for (const e of this.enemies) {
            if (e.dying) continue;
            const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, h.x, h.y);
            if (d < h.radius * 1.45 && d > 12) {
              const pull = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, h.x, h.y);
              const str = e.bossDef ? 95 : 240;
              e.sprite.x += Math.cos(pull) * str * dt;
              e.sprite.y += Math.sin(pull) * str * dt;
            }
          }
        } else if (h.kind === 'fire_tornado') {
          const target = this.enemies.find((e) => !e.dying);
          if (target) {
            const ang = Phaser.Math.Angle.Between(h.x, h.y, target.sprite.x, target.sprite.y);
            h.x += Math.cos(ang) * 145 * dt;
            h.y += Math.sin(ang) * 145 * dt;
          }
        } else if (h.kind === 'banana_peel') {
          if (h.sprite && h.duration < 1.2) {
            h.sprite.setAlpha(Math.max(0.25, h.duration / 1.2));
          }
        }

        if (h.tickTimer <= 0) {
          h.tickTimer = h.kind === 'banana_peel' ? 0.26 : 0.28;
          for (const e of this.enemies) {
            if (e.dying) continue;
            if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, h.x, h.y) <= h.radius + e.radius) {
              if (h.kind === 'banana_peel') {
                const factor = e.bossDef ? Math.max(0.62, h.slowFactor ?? 0.48) : (h.slowFactor ?? 0.48);
                e.slowTimer = Math.max(e.slowTimer, 1.45);
                e.slowFactor = Math.min(e.slowFactor, factor);
                const firstSlip = !h.triggeredEnemies?.has(e.id);
                if (firstSlip) {
                  h.triggeredEnemies?.add(e.id);
                  this.damageEnemy(e, h.damage * 0.55, 0, false);
                  this.spawnBurst(e.sprite.x, e.sprite.y + 8, 0xfde047, 7, 95);
                  audioEngine.playSlattSkill('peel_slip');
                } else {
                  this.damageEnemy(e, h.damage * 0.2, 0, false);
                }
              } else {
                this.damageEnemy(e, h.damage * 0.42, 0, false);
              }
            }
          }
        }

        if (h.duration <= 0) {
          // Black Hole implosion + Supernova Secret Synergy!
          if (h.kind === 'black_hole') {
            const isSupernova = this.activeSynergies.includes('supernova');
            const bhLv = this.skills.black_hole ?? 1;
            if (isSupernova || bhLv >= 4) {
              this.triggerRadialAoE(
                h.x,
                h.y,
                isSupernova ? h.radius * 1.65 : h.radius * 1.2,
                h.damage * (isSupernova ? 3.2 : 1.7),
                isSupernova ? 0xf59e0b : 0xc084fc,
                0
              );
              this.shakeTrauma = Math.max(this.shakeTrauma, isSupernova ? 0.55 : 0.35);
            }
          }
          h.sprite?.destroy();
          this.hazards.splice(i, 1);
        }
      }
    }
  }

  private triggerRadialAoE(
    x: number,
    y: number,
    radius: number,
    damage: number,
    color: number,
    bonusLifesteal: number
  ) {
    const ring = this.add.circle(x, y, radius * 0.25, color, 0.22).setStrokeStyle(3, color, 0.9).setDepth(63);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 240,
      onComplete: () => ring.destroy(),
    });
    this.spawnBurst(x, y, color, 16, 175);

    for (const e of this.enemies) {
      if (e.dying) continue;
      if (Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) <= radius + e.radius) {
        const ang = Phaser.Math.Angle.Between(x, y, e.sprite.x, e.sprite.y);
        const dealt = this.damageEnemy(e, damage, ang, false);
        if (bonusLifesteal > 0 && dealt > 0) {
          this.hp = Math.min(this.computedStats.maxHp, this.hp + Math.max(1, Math.round(dealt * bonusLifesteal)));
        }
      }
    }
  }

  private damageEnemy(
    e: EnemyEntity,
    rawDmg: number,
    hitAngle: number,
    isHeavy: boolean,
    bonusCritChance = 0
  ): number {
    if (e.dying) return 0;

    let dmgInput = rawDmg;
    // Freeze vulnerability (Time Freeze Lv4+)
    if (e.freezeTimer > 0 && (this.skills.time_freeze ?? 0) >= 4) {
      dmgInput *= 1.35;
    }

    // Special equipment effects
    for (const item of Object.values(this.equipped)) {
      if (!item?.specialEffect) continue;
      if (item.specialEffect.id === 'execute' && e.hp < e.maxHp * 0.35) {
        dmgInput *= 1 + item.specialEffect.value;
      } else if (item.specialEffect.id === 'boss_bane' && e.bossDef) {
        dmgInput *= 1 + item.specialEffect.value;
      }
    }

    const res = calculateAttackDamage(
      dmgInput,
      this.computedStats,
      Boolean(e.bossDef),
      e.resistance,
      bonusCritChance
    );

    e.hp -= res.damage;
    this.comboHits += 1;
    this.comboTimer = COMBO_WINDOW_SEC;
    e.flashTimer = res.isCrit ? 0.09 : 0.068;
    // Crisp pure white / incandescent gold solid silhouette flash (Hades / Dead Cells impact read)
    e.sprite.setTint(res.isCrit ? 0xfef08a : 0xffffff).setTintMode(Phaser.TintModes.FILL);
    e.sprite.setScale(e.baseScale * (res.isCrit ? 1.24 : 1.16), e.baseScale * (res.isCrit ? 0.8 : 0.86));

    // Directional knockback (reduced for bosses/golems)
    const kbResist = e.bossDef ? 0.1 : e.archetypeId === 'golem' ? 0.22 : 1;
    const kbForce = (isHeavy ? 210 : 118) * kbResist * (res.isCrit ? 1.25 : 1);
    e.knockVx += Math.cos(hitAngle) * kbForce;
    e.knockVy += Math.sin(hitAngle) * kbForce;

    // Lifesteal
    if (this.computedStats.lifeSteal > 0) {
      const heal = Math.round(res.damage * this.computedStats.lifeSteal);
      if (heal > 0) this.hp = Math.min(this.computedStats.maxHp, this.hp + heal);
    }

    // Mana surge crit CDR equipment effect
    if (res.isCrit) {
      for (const item of Object.values(this.equipped)) {
        if (item?.specialEffect?.id === 'mana_surge') {
          for (const k of Object.keys(this.skillCooldowns) as SkillId[]) {
            this.skillCooldowns[k] = Math.max(0, (this.skillCooldowns[k] ?? 0) - item.specialEffect.value);
          }
        }
      }
    }

    audioEngine.playHit(res.isCrit);
    this.spawnDamageText(
      e.sprite.x + (Math.random() - 0.5) * 18,
      e.sprite.y - e.radius - 12,
      res.isCrit ? `${res.damage}!` : `${res.damage}`,
      res.isCrit ? '#facc15' : '#f8fafc',
      res.isCrit
    );

    // Directional kinetic hit sparks along strike trajectory + radial ember pop
    this.spawnHitSparks(
      e.sprite.x,
      e.sprite.y,
      hitAngle,
      res.isCrit ? 0xfacc15 : isHeavy ? 0xfdba74 : 0xf8fafc,
      res.isCrit ? 9 : isHeavy ? 6 : 4,
      res.isCrit ? 260 : 185
    );
    this.spawnBurst(e.sprite.x, e.sprite.y, res.isCrit ? 0xfef08a : 0xf1f5f9, res.isCrit ? 6 : 3, res.isCrit ? 155 : 105);

    // Unmistakable 4-point star flare on critical strikes + crisp shock ring on heavy/crit hits
    if (res.isCrit) {
      const star = this.add
        .sprite(e.sprite.x, e.sprite.y, 'fx_crit_star')
        .setDepth(76)
        .setScale(0.45)
        .setRotation(Math.random() * Math.PI)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: star,
        scale: 1.38,
        alpha: 0,
        duration: 165,
        ease: 'Cubic.Out',
        onComplete: () => star.destroy(),
      });
    }

    if (res.isCrit || isHeavy) {
      const ring = this.add
        .circle(e.sprite.x, e.sprite.y, res.isCrit ? 13 : 9, res.isCrit ? 0xfacc15 : 0xffffff, 0.18)
        .setStrokeStyle(res.isCrit ? 2.5 : 1.6, res.isCrit ? 0xfef08a : 0xe2e8f0, 0.88)
        .setDepth(64);
      this.tweens.add({
        targets: ring,
        scale: res.isCrit ? 2.8 : 2.0,
        alpha: 0,
        duration: 150,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      });
    }

    if (res.isCrit) {
      this.hitstopTimer = Math.max(this.hitstopTimer, isHeavy ? 0.042 : 0.026);
      this.shakeTrauma = Math.max(this.shakeTrauma, isHeavy ? 0.28 : 0.16);
    } else if (isHeavy) {
      this.shakeTrauma = Math.max(this.shakeTrauma, 0.11);
    }

    if (e.hp <= 0) {
      this.killEnemy(e, true);
    }

    return res.damage;
  }

  private killEnemy(e: EnemyEntity, grantRewards: boolean) {
    if (e.dying) return;
    e.dying = true;
    e.deathTimer = 0.28;
    if (e.hasAttackToken) {
      e.hasAttackToken = false;
      this.activeAttackTokens = Math.max(0, this.activeAttackTokens - 1);
    }
    if (e.sprite.body) (e.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    e.hpBarBorder.setVisible(false);
    e.hpBarBg.setVisible(false);
    e.hpBarGhost.setVisible(false);
    e.hpBarFill.setVisible(false);
    e.eliteMarker?.setVisible(false);
    e.auraRing?.setVisible(false);
    e.bossOuterRing?.setVisible(false);

    // Fiery Elite death burst
    if (e.eliteMod === 'fiery') {
      this.hazards.push({
        x: e.sprite.x,
        y: e.sprite.y,
        radius: 78,
        delay: 0.45,
        maxDelay: 0.45,
        fromPlayer: false,
        damage: e.damage * 1.18,
        color: 0xf97316,
        kind: 'boss_aoe',
        duration: 0,
        tickTimer: 0,
        triggered: false,
      });
    }

    const isBoss = Boolean(e.bossDef);
    const isElite = Boolean(e.eliteMod);
    audioEngine.playEnemyDeath(isBoss);
    const burstColor = isBoss ? 0xf59e0b : isElite ? 0xf97316 : 0xdc2626;
    this.spawnBurst(e.sprite.x, e.sprite.y, burstColor, isBoss ? 34 : isElite ? 22 : 14, isBoss ? 255 : 165);
    this.spawnHitSparks(e.sprite.x, e.sprite.y, Math.atan2(e.knockVy, e.knockVx), burstColor, isBoss ? 14 : 7, isBoss ? 280 : 195);
    this.spawnGroundScorch(e.sprite.x, e.sprite.y, isBoss ? 1.8 : isElite ? 1.15 : 0.85);

    const deathRing = this.add
      .circle(e.sprite.x, e.sprite.y, isBoss ? 24 : 12, burstColor, 0.2)
      .setStrokeStyle(isBoss ? 3.5 : 2, isBoss ? 0xfef08a : burstColor, 0.9)
      .setDepth(64);
    this.tweens.add({
      targets: deathRing,
      scale: isBoss ? 4.2 : isElite ? 2.9 : 2.3,
      alpha: 0,
      duration: isBoss ? 340 : 210,
      ease: 'Cubic.Out',
      onComplete: () => deathRing.destroy(),
    });

    this.hitstopTimer = Math.max(this.hitstopTimer, isBoss ? 0.085 : isElite ? 0.045 : 0.032);
    this.shakeTrauma = Math.max(this.shakeTrauma, isBoss ? 0.68 : isElite ? 0.32 : 0.2);

    if (!grantRewards) return;

    this.kills++;
    if (isBoss) this.bossesKilled++;
    phaserBridge.emitKill(isBoss ? e.bossDef!.id : e.archetypeId, isBoss);

    // Swift-on-kill equipment effect
    for (const item of Object.values(this.equipped)) {
      if (item?.specialEffect?.id === 'swift_kill') {
        this.swiftKillTimer = 2.0;
      }
    }

    // Spawn Pickups (XP, Gold, Crystals, Potions, Equipment)
    const x = e.sprite.x;
    const y = e.sprite.y;
    this.spawnPickup('xp', x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, e.xpValue);
    this.spawnPickup('gold', x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 26, e.goldValue);

    const crystalChance = isBoss ? 1.0 : e.eliteMod ? 0.78 : 0.12;
    if (Math.random() < crystalChance) {
      const crystalAmt = isBoss
        ? Math.round((18 + this.floor * 1.5) * (e.bossDef!.isMegaBoss ? 2.4 : 1) * (1 + this.ascensionLevel * 0.4))
        : e.eliteMod
          ? Math.round(3 + this.floor * 0.25)
          : 1;
      this.spawnPickup('crystal', x, y - 14, crystalAmt);
    }

    if (Math.random() < (isBoss ? 1.0 : BALANCE_CONFIG.player.potionDropChance)) {
      this.spawnPickup(
        'potion',
        x + 16,
        y + 10,
        Math.round(this.computedStats.maxHp * BALANCE_CONFIG.player.potionHealPct)
      );
    }

    const gearChance =
      (isBoss ? 1.0 : e.eliteMod ? 0.45 : 0.08) * (1 + this.permanentUpgrades.rareLootChance * 0.07);
    if (Math.random() < gearChance) {
      const item = generateEquipmentItem({
        floor: this.floor,
        luck: this.computedStats.luck + this.permanentUpgrades.rareLootChance * 8,
        minRarity: isBoss ? (e.bossDef!.isMegaBoss ? 'epic' : 'rare') : e.eliteMod ? 'uncommon' : undefined,
      });
      this.spawnPickup('gear', x - 14, y + 14, 1, item);
      if (isBoss && e.bossDef!.isMegaBoss) {
        const bonusItem = generateEquipmentItem({
          floor: this.floor + 5,
          luck: this.computedStats.luck + 40,
          minRarity: 'legendary',
        });
        this.spawnPickup('gear', x + 22, y - 10, 1, bonusItem);
      }
    }
  }

  private damagePlayer(rawDmg: number, attacker: EnemyEntity | null, appliesSlow = false) {
    if (this.isPaused || this.invulnTimer > 0 || this.isEndingRun) return;

    // Dodge roll
    if (Math.random() < this.computedStats.dodge) {
      this.spawnDamageText(this.player.x, this.player.y - 26, 'ESQUIVA', '#94a3b8', false);
      this.invulnTimer = 0.22;
      return;
    }

    const reduced = Math.max(1, Math.round(rawDmg * (1 - this.computedStats.damageReduction)));
    this.invulnTimer = BALANCE_CONFIG.player.hitInvulnSec;
    this.lastDamagedAt = Date.now();

    if (appliesSlow || attacker?.eliteMod === 'frost') {
      this.playerSlowTimer = 2.0;
    }

    // Vampiric elite heals on hit
    if (attacker && !attacker.dying && attacker.eliteMod === 'vampiric') {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(reduced * 1.4));
    }

    // Thorns equipment reflection
    if (attacker && !attacker.dying) {
      for (const item of Object.values(this.equipped)) {
        if (item?.specialEffect?.id === 'thorns') {
          this.damageEnemy(attacker, reduced * item.specialEffect.value, 0, false);
        }
      }
    }

    let remaining = reduced;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
      if (this.shield <= 0 && (this.skills.divine_shield ?? 0) >= 4) {
        this.triggerRadialAoE(this.player.x, this.player.y, 130, this.computedStats.damage * 1.65, 0xfacc15, 0);
        if ((this.skills.divine_shield ?? 0) >= 7) {
          this.invulnTimer = 1.1;
        }
      }
    }

    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
      this.spawnDamageText(this.player.x, this.player.y - 30, `-${remaining}`, '#f43f5e', true);
    }

    // Tactile player hit feedback: burst, crimson shock ring, trauma, brief tint
    audioEngine.playPlayerHurt();
    this.shakeTrauma = Math.max(this.shakeTrauma, 0.46);
    this.spawnBurst(this.player.x, this.player.y, 0xf43f5e, 10, 145);
    const hurtRing = this.add
      .circle(this.player.x, this.player.y, 16, 0xdc2626, 0.24)
      .setStrokeStyle(2.5, 0xf43f5e, 0.9)
      .setDepth(64);
    this.tweens.add({
      targets: hurtRing,
      scale: 2.5,
      alpha: 0,
      duration: 180,
      onComplete: () => hurtRing.destroy(),
    });
    this.player.setTint(0xf43f5e);
    this.time.delayedCall(90, () => {
      if (this.player?.active) this.player.clearTint();
    });

    if (this.hp <= 0) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath() {
    this.isEndingRun = true;
    this.clearHeldInputs();
    audioEngine.playDefeat();
    this.hitstopTimer = 0.08;
    this.shakeTrauma = 0.7;
    this.spawnBurst(this.player.x, this.player.y, 0xdc2626, 28, 190);

    const activeBoss = this.enemies.find((e) => !e.dying && e.bossDef);
    const biome = getBiomeForFloor(this.floor);
    const evo = getClassEvolution(this.classId, this.level);

    const summary: RunSummarySnapshot = {
      classId: this.classId,
      evolutionTitle: evo ? evo.title : CLASSES[this.classId].name,
      floor: this.floor,
      biomeName: biome.name,
      level: this.level,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      durationSec: Math.round(this.elapsedSec),
      crystalsEarned: this.crystalsRun,
      goldCollected: this.gold,
      isNewFloorRecord: this.floor > this.bestFloorRecord,
      activeSynergies: [...this.activeSynergies],
      bossRemainingPct: activeBoss ? Math.max(1, Math.round((activeBoss.hp / activeBoss.maxHp) * 100)) : null,
    };

    // Brief 0.45s dramatic final beat before presenting Death Modal
    this.time.delayedCall(450, () => {
      this.isActiveRun = false;
      phaserBridge.emitRunEnded(summary);
    });
  }

  private spawnPickup(
    kind: PickupEntity['kind'],
    x: number,
    y: number,
    value: number,
    gearItem?: EquipmentItem
  ) {
    const tex =
      kind === 'xp'
        ? 'pick_xp'
        : kind === 'gold'
          ? 'pick_gold'
          : kind === 'crystal'
            ? 'pick_crystal'
            : kind === 'potion'
              ? 'pick_potion'
              : 'pick_gear';
    const sp = this.add
      .sprite(x, y, tex)
      .setScale(kind === 'gear' ? 0.72 : 0.66)
      .setDepth(48);
    if (kind === 'gear' && gearItem) {
      sp.setTint(Phaser.Display.Color.HexStringToColor(RARITY_META[gearItem.rarity].color).color);
    }
    this.pickups.push({
      sprite: sp,
      kind,
      value,
      gearItem,
      x,
      y,
      life: 45,
    });
  }

  private updatePickups(dt: number) {
    const magnetRange = 175;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      if (pk.life <= 0) {
        pk.sprite.destroy();
        this.pickups.splice(i, 1);
        continue;
      }

      const d = Phaser.Math.Distance.Between(pk.x, pk.y, this.player.x, this.player.y);
      if (d < magnetRange) {
        const ang = Phaser.Math.Angle.Between(pk.x, pk.y, this.player.x, this.player.y);
        const speed = 340 + (magnetRange - d) * 2.4;
        pk.x += Math.cos(ang) * speed * dt;
        pk.y += Math.sin(ang) * speed * dt;
        pk.sprite.setPosition(pk.x, pk.y);
      }

      if (d < 26) {
        this.collectPickup(pk);
        pk.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  private collectPickup(pk: PickupEntity) {
    switch (pk.kind) {
      case 'xp': {
        audioEngine.playPickup('xp');
        this.grantXp(Math.round(pk.value * this.computedStats.xpMultiplier));
        break;
      }
      case 'gold': {
        audioEngine.playPickup('gold');
        const g = Math.round(pk.value * this.computedStats.goldMultiplier);
        this.gold += g;
        break;
      }
      case 'crystal': {
        audioEngine.playPickup('crystal');
        this.crystalsRun += pk.value;
        phaserBridge.emitQuickSave({ floor: this.floor, level: this.level, crystalsDelta: pk.value });
        this.spawnDamageText(this.player.x, this.player.y - 30, `+${pk.value} Cristal`, '#c084fc', false);
        break;
      }
      case 'potion': {
        audioEngine.playPickup('xp');
        this.hp = Math.min(this.computedStats.maxHp, this.hp + pk.value);
        this.spawnDamageText(this.player.x, this.player.y - 26, `+${pk.value} HP`, '#4ade80', false);
        break;
      }
      case 'gear': {
        if (pk.gearItem) {
          audioEngine.playPickup('gear');
          if (this.inventory.length < 32) {
            this.inventory.push(pk.gearItem);
            this.pushNotice(`Item obtido: ${pk.gearItem.name} (${RARITY_META[pk.gearItem.rarity].label})`, 'gold');
          } else {
            this.gold += pk.gearItem.sellValue;
            this.pushNotice(`Inventário cheio: vendido por ${pk.gearItem.sellValue} Ouro`, 'gold');
          }
        }
        break;
      }
    }
  }

  private grantXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);

      const prevEvo = getClassEvolution(this.classId, this.level - 1);
      const nextEvo = getClassEvolution(this.classId, this.level);
      if (nextEvo && nextEvo !== prevEvo) {
        this.pushNotice(`EVOLUÇÃO DE CLASSE: ${nextEvo.title.toUpperCase()}!`, 'gold');
        this.spawnBurst(this.player.x, this.player.y, 0xfacc15, 28, 210);
      }

      this.recomputeStats(false);
      this.hp = Math.min(
        this.computedStats.maxHp,
        this.hp + Math.round(this.computedStats.maxHp * BALANCE_CONFIG.player.levelUpHealPct)
      );
      this.levelUpPendingQueue++;
      phaserBridge.emitQuickSave({ floor: this.floor, level: this.level, crystalsDelta: 0 });
    }

    if (this.levelUpPendingQueue > 0 && !this.isPaused) {
      this.openNextLevelUpChoice();
    }
  }

  private openNextLevelUpChoice() {
    const pointerWasDown = this.mouseDown || Boolean(this.input.activePointer?.isDown);
    this.levelUpPendingQueue = Math.max(0, this.levelUpPendingQueue - 1);
    const choiceLevel = Math.max(2, this.level - this.levelUpPendingQueue);
    const options = generateLevelUpOptions({
      luck: this.computedStats.luck,
      currentSkills: this.skills,
      playerLevel: choiceLevel,
      classId: this.classId,
    });
    const highest = options.reduce((acc, o) => {
      const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
      return rank.indexOf(o.rarity) > rank.indexOf(acc) ? o.rarity : acc;
    }, options[0].rarity);

    this.setPaused(true);
    audioEngine.playLevelUp(highest);
    this.emitHudSnapshot(true);
    phaserBridge.emitLevelUp({
      offerId: this.levelUpOfferCounter++,
      level: choiceLevel,
      pendingCount: this.levelUpPendingQueue,
      options,
      pointerWasDown,
    });
  }

  public selectUpgrade(option: UpgradeOption): { hasMorePending: boolean } {
    if (option.kind === 'skill' && option.skillId && option.nextSkillLevel) {
      this.grantSkillLevel(option.skillId, option.nextSkillLevel, true);
    } else if (option.kind === 'stat' && option.statDelta) {
      for (const [k, v] of Object.entries(option.statDelta) as Array<[keyof StatModifiers, number]>) {
        if (typeof v === 'number') {
          this.mods[k] = (this.mods[k] ?? 0) + v;
        }
      }
      if (option.statDelta.maxHpPct) {
        this.hp = Math.min(this.computedStats.maxHp, this.hp + Math.round(this.computedStats.maxHp * 0.14));
      }
    } else if (option.kind === 'multiplier' && option.multDelta) {
      this.mods[option.multDelta.field] = Number(
        (this.mods[option.multDelta.field] * option.multDelta.factor).toFixed(2)
      );
    }

    this.recomputeStats(false);
    this.emitHudSnapshot(true);
    return { hasMorePending: this.levelUpPendingQueue > 0 };
  }

  public openNextPendingLevelUp() {
    if (this.levelUpPendingQueue > 0) {
      this.openNextLevelUpChoice();
    } else {
      this.resumeAfterLevelUp();
    }
  }

  public resumeAfterLevelUp() {
    if (!this.isActiveRun || this.isEndingRun) return;
    this.clearHeldInputs();
    this.invulnTimer = Math.max(this.invulnTimer, 0.85);
    this.postModalClickSuppressTimer = 0.24;
    if (this.player) {
      this.spawnBurst(this.player.x, this.player.y, 0xd4a64a, 14, 145);
    }
    this.setPaused(false);
    this.emitHudSnapshot(true);
  }

  public debugGrantXp(amount: number) {
    if (!this.isActiveRun || this.isEndingRun) return;
    this.grantXp(amount);
  }

  private updateTimedChallengeAndPortal(dt: number) {
    // 1. Materialize telegraphed reinforcement wave spawns
    for (let i = this.pendingWaveSpawns.length - 1; i >= 0; i--) {
      const sp = this.pendingWaveSpawns[i];
      sp.timer -= dt;
      if (sp.timer <= 0) {
        this.spawnEnemy(sp.archetypeId, sp.x, sp.y, sp.eliteMod, sp.extraMult);
        this.spawnBurst(sp.x, sp.y, sp.eliteMod ? 0xf59e0b : 0xf43f5e, 10, 115);
        this.pendingWaveSpawns.splice(i, 1);
      }
    }

    const aliveEnemies = this.enemies.filter((e) => !e.dying).length;
    const hasMoreWaves = this.currentWaveIndex < this.floorWavePlan.waves.length - 1;

    // 2. Escalate to next wave when current wave is nearly cleared (smooth rising intensity)
    if (hasMoreWaves && this.pendingWaveSpawns.length === 0 && aliveEnemies <= 1) {
      this.currentWaveIndex++;
      this.triggerWaveSpawn(this.currentWaveIndex, false);
    }

    const floorCleared =
      aliveEnemies === 0 &&
      this.pendingWaveSpawns.length === 0 &&
      this.currentWaveIndex >= this.floorWavePlan.waves.length - 1;

    if (this.timedChallenge && !this.timedChallenge.rewarded) {
      this.timedChallenge.remainingSec = Math.max(0, this.timedChallenge.remainingSec - dt);
      if (floorCleared && this.timedChallenge.remainingSec > 0) {
        this.timedChallenge.rewarded = true;
        const reward = generateEquipmentItem({
          floor: this.floor + 2,
          luck: this.computedStats.luck + 40,
          minRarity: 'epic',
        });
        this.spawnPickup('gear', this.player.x, this.player.y - 44, 1, reward);
        this.spawnPickup('crystal', this.player.x + 24, this.player.y - 36, 12 + this.floor);
        this.pushNotice('Desafio Contra o Tempo concluído! Recompensa Épica recebida.', 'emerald');
      } else if (this.timedChallenge.remainingSec <= 0) {
        this.timedChallenge = null;
      }
    }

    if (floorCleared && !this.portalOpen) {
      this.portalOpen = true;
      this.portalSprite = this.add.sprite(this.portalPos.x, this.portalPos.y, 'prop_portal').setScale(0.72).setDepth(38);
      audioEngine.playPortalOpen();

      // Floor clear XP & crystal bonus
      const clearXp = Math.round(
        (BALANCE_CONFIG.xp.floorClearBase + this.floor * BALANCE_CONFIG.xp.floorClearPerFloor) *
          this.computedStats.xpMultiplier
      );
      this.grantXp(clearXp);
      const clearCrystals = Math.max(2, Math.round((2 + Math.floor(this.floor / 3)) * (1 + this.ascensionLevel * 0.4)));
      this.crystalsRun += clearCrystals;
      phaserBridge.emitQuickSave({ floor: this.floor, level: this.level, crystalsDelta: clearCrystals });
      this.pushNotice(`Andar ${this.floor} conquistado! Entre no Portal ao norte.`, 'emerald');
    }

    if (this.portalOpen && this.portalSprite && !this.portalTransitionLock) {
      this.portalSprite.rotation += dt * 1.4;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portalPos.x, this.portalPos.y);
      if (d < 42) {
        this.portalTransitionLock = true;
        audioEngine.playPortalOpen();
        this.loadFloor(this.floor + 1);
      }
    }
  }

  public triggerInteract() {
    if (!this.isActiveRun || this.isPaused || this.isEndingRun) return;
    const near = this.findNearestInteractable();
    if (!near) return;

    this.activeEventRef = near;
    if (near.kind === 'chest') {
      near.used = true;
      near.sprite.setAlpha(0.35);
      const item = generateEquipmentItem({
        floor: this.floor + 1,
        luck: this.computedStats.luck + 25,
        minRarity: 'uncommon',
      });
      const goldBonus = Math.round((45 + this.floor * 14) * this.computedStats.goldMultiplier);
      this.gold += goldBonus;
      this.spawnPickup('gear', near.x, near.y + 20, 1, item);
      this.spawnPickup('crystal', near.x + 22, near.y + 10, 4 + Math.floor(this.floor / 4));
      audioEngine.playPickup('gear');
      this.pushNotice(`Baú aberto! +${goldBonus} Ouro e ${item.name}`, 'gold');
      return;
    }

    let payload: ActiveEventPayload;
    if (near.kind === 'altar') {
      payload = {
        id: near.id,
        kind: 'altar',
        title: 'Altar de Sangue Ancestral',
        description: 'Uma voz ressoa das runas carmesim oferecendo poder proibido em troca de sacrifício.',
        choices: [
          {
            id: 'altar_power',
            label: 'Pacto da Lâmina Carmesim',
            detail: 'Multiplica seu dano em troca de vitalidade máxima.',
            rewardText: '+100% Dano',
            riskText: '-30% Vida Máxima',
          },
          {
            id: 'altar_crit',
            label: 'Olho do Eclipse',
            detail: 'Eleva enormemente seu crítico e velocidade de ataque.',
            rewardText: '+25% Chance Crítica · +30% Vel. Ataque',
            riskText: 'Perde 35% da Vida Atual',
          },
          {
            id: 'altar_heal',
            label: 'Bênção Serena',
            detail: 'Recusa o pacto sombrio e restaura suas forças.',
            rewardText: 'Restaura 65% da Vida Máxima',
          },
        ],
      };
    } else if (near.kind === 'merchant') {
      this.merchantStock = [
        generateEquipmentItem({ floor: this.floor + 2, luck: this.computedStats.luck + 35, minRarity: 'rare' }),
        generateEquipmentItem({ floor: this.floor + 3, luck: this.computedStats.luck + 60, minRarity: 'epic' }),
      ];
      const price1 = Math.round(70 + this.floor * 18);
      const price2 = Math.round(140 + this.floor * 32);
      const priceHeal = Math.round(35 + this.floor * 8);
      payload = {
        id: near.id,
        kind: 'merchant',
        title: 'Comerciante Misterioso',
        description: `O viajante encapuzado revela relíquias raras. Seu ouro atual: ${this.gold}.`,
        choices: [
          {
            id: 'merch_item_0',
            label: `Comprar ${this.merchantStock[0].name}`,
            detail: `${RARITY_META[this.merchantStock[0].rarity].label} · Equipamento de andar ${this.floor + 2}`,
            costGold: price1,
            disabled: this.gold < price1,
          },
          {
            id: 'merch_item_1',
            label: `Comprar ${this.merchantStock[1].name}`,
            detail: `${RARITY_META[this.merchantStock[1].rarity].label} · Relíquia superior`,
            costGold: price2,
            disabled: this.gold < price2,
          },
          {
            id: 'merch_heal',
            label: 'Elixir de Restauração Completa',
            detail: 'Restaura 100% da Vida e concede +15 Sorte nesta expedição.',
            costGold: priceHeal,
            disabled: this.gold < priceHeal,
          },
          {
            id: 'close',
            label: 'Partir sem comprar',
            detail: 'Retorna imediatamente à exploração.',
          },
        ],
      };
    } else {
      payload = {
        id: near.id,
        kind: 'dimension_portal',
        title: 'Fenda Dimensional Instável',
        description: 'Ativar a fenda invoca uma onda de Elites furiosos em troca de cristais e um item Épico garantido.',
        choices: [
          {
            id: 'rift_accept',
            label: 'Romper o Selo Dimensional',
            detail: 'Invoca 3 inimigos de Elite imediatamente.',
            rewardText: 'Cristais 3x + Equipamento Épico',
            riskText: 'Emboscada de Elites',
          },
          {
            id: 'close',
            label: 'Ignorar a Fenda',
            detail: 'Mantém o selo intacto.',
          },
        ],
      };
    }

    this.setPaused(true);
    phaserBridge.emitEvent(payload);
  }

  public resolveEventChoice(choiceId: string) {
    const ref = this.activeEventRef;
    this.activeEventRef = null;

    if (choiceId !== 'close' && ref && !ref.used) {
      if (choiceId === 'altar_power') {
        ref.used = true;
        ref.sprite.setAlpha(0.35);
        this.mods.damagePct += 1.0;
        this.mods.maxHpPct -= 0.3;
        this.recomputeStats(false);
        this.pushNotice('Pacto selado: +100% Dano, -30% Vida Máxima!', 'crimson');
      } else if (choiceId === 'altar_crit') {
        ref.used = true;
        ref.sprite.setAlpha(0.35);
        this.mods.critChance += 0.25;
        this.mods.attackSpeedPct += 0.3;
        this.hp = Math.max(10, Math.round(this.hp * 0.65));
        this.recomputeStats(false);
        this.pushNotice('Olho do Eclipse concedido!', 'violet');
      } else if (choiceId === 'altar_heal') {
        ref.used = true;
        ref.sprite.setAlpha(0.35);
        this.hp = Math.min(this.computedStats.maxHp, this.hp + Math.round(this.computedStats.maxHp * 0.65));
        this.pushNotice('Vitalidade restaurada pelo Altar.', 'emerald');
      } else if (choiceId === 'merch_item_0' || choiceId === 'merch_item_1') {
        const idx = choiceId === 'merch_item_0' ? 0 : 1;
        const cost = idx === 0 ? Math.round(70 + this.floor * 18) : Math.round(140 + this.floor * 32);
        const item = this.merchantStock[idx];
        if (item && this.gold >= cost) {
          this.gold -= cost;
          this.inventory.push(item);
          ref.used = true;
          ref.sprite.setAlpha(0.35);
          audioEngine.playPickup('gear');
          this.pushNotice(`Adquirido: ${item.name}`, 'gold');
        }
      } else if (choiceId === 'merch_heal') {
        const cost = Math.round(35 + this.floor * 8);
        if (this.gold >= cost) {
          this.gold -= cost;
          this.hp = this.computedStats.maxHp;
          this.mods.luck += 15;
          this.recomputeStats(false);
          ref.used = true;
          ref.sprite.setAlpha(0.35);
          this.pushNotice('Vida restaurada e +15 Sorte!', 'emerald');
        }
      } else if (choiceId === 'rift_accept') {
        ref.used = true;
        ref.sprite.setAlpha(0.3);
        const eligible = ENEMY_LIST.filter((e) => e.minFloor <= this.floor + 2);
        for (let k = 0; k < 3; k++) {
          const arch = eligible[Math.floor(Math.random() * eligible.length)];
          const mod = ELITE_MODIFIER_LIST[Math.floor(Math.random() * ELITE_MODIFIER_LIST.length)].id;
          const sx = Phaser.Math.Clamp(ref.x + (Math.random() - 0.5) * 160, 96, this.roomWidth - 96);
          const sy = Phaser.Math.Clamp(ref.y + (Math.random() - 0.5) * 160, 96, this.roomHeight - 96);
          this.spawnEnemy(arch.id, sx, sy, mod, 1.15);
        }
        const epicReward = generateEquipmentItem({
          floor: this.floor + 2,
          luck: this.computedStats.luck + 45,
          minRarity: 'epic',
        });
        this.spawnPickup('gear', ref.x, ref.y + 24, 1, epicReward);
        this.spawnPickup('crystal', ref.x - 20, ref.y, 15 + this.floor * 2);
        this.portalOpen = false;
        this.portalSprite?.destroy();
        this.portalSprite = undefined;
        this.pushNotice('Fenda aberta! Derrote a emboscada de Elites!', 'violet');
      }
    }

    this.setPaused(false);
    this.emitHudSnapshot(true);
  }

  private findNearestInteractable(): InteractableEntity | null {
    let best: InteractableEntity | null = null;
    let bestD = 88;
    for (const it of this.interactables) {
      if (it.used) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  // Equipment & Skill Slot Management API (called by React Inventory / Skill Tree modals)
  public equipItem(itemId: string) {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const item = this.inventory[idx];
    if (this.level < item.requiredLevel) {
      this.pushNotice(`Requer Nível ${item.requiredLevel} para equipar`, 'crimson');
      return;
    }
    const prev = this.equipped[item.slot];
    this.inventory.splice(idx, 1);
    if (prev) this.inventory.push(prev);
    this.equipped[item.slot] = item;
    audioEngine.playUiClick();
    this.recomputeStats(false);
    this.emitHudSnapshot(true);
  }

  public unequipSlot(slot: EquipmentSlot) {
    const prev = this.equipped[slot];
    if (!prev) return;
    delete this.equipped[slot];
    this.inventory.push(prev);
    audioEngine.playUiClick();
    this.recomputeStats(false);
    this.emitHudSnapshot(true);
  }

  public upgradeItem(itemId: string): boolean {
    let target = this.inventory.find((i) => i.id === itemId);
    if (!target) {
      target = Object.values(this.equipped).find((i) => i?.id === itemId);
    }
    if (!target || target.upgradeLevel >= 15) return false;
    const cost = getEquipmentUpgradeCost(target);
    if (this.gold < cost) return false;

    this.gold -= cost;
    target.upgradeLevel++;
    target.sellValue = Math.round(target.sellValue * 1.18);
    audioEngine.playPickup('crystal');
    this.recomputeStats(false);
    this.emitHudSnapshot(true);
    return true;
  }

  public sellItem(itemId: string) {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const [removed] = this.inventory.splice(idx, 1);
    this.gold += removed.sellValue;
    audioEngine.playPickup('gold');
    this.emitHudSnapshot(true);
  }

  public discardItem(itemId: string) {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    this.inventory.splice(idx, 1);
    audioEngine.playUiClick();
    this.emitHudSnapshot(true);
  }

  public assignSkillToSlot(skillId: SkillId, slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 3) return;
    if (SKILLS[skillId].type !== 'active' || (this.skills[skillId] ?? 0) <= 0) return;
    // Swap if already assigned elsewhere
    const existing = this.activeSlotSkills.indexOf(skillId);
    if (existing !== -1) {
      this.activeSlotSkills[existing] = this.activeSlotSkills[slotIndex];
    }
    this.activeSlotSkills[slotIndex] = skillId;
    audioEngine.playUiClick();
    this.emitHudSnapshot(true);
  }

  public triggerDash() {
    if (!this.isActiveRun || this.isPaused) return;
    this.pendingCast = null;
    this.cooldownPreview = null;
    this.forcedDashAngle = null;
    this.dashBufferTimer = 0.14;
  }

  public setMobileInput(moveX: number, moveY: number, aimX: number, aimY: number, firing: boolean) {
    this.mobileMoveX = moveX;
    this.mobileMoveY = moveY;
    this.mobileAimX = aimX;
    this.mobileAimY = aimY;
    this.mobileFiring = firing;
  }

  // Visual Telegraphs, Beams, Pooled Particles & Damage Texts
  private drawTelegraphsAndBeams() {
    this.telegraphGraphics.clear();
    const g = this.telegraphGraphics;

    // Reinforcement wave summoning circles (clear 0.8s warning before ambush enemies appear)
    for (const sp of this.pendingWaveSpawns) {
      const prog = 1 - Math.max(0, sp.timer / Math.max(0.05, sp.maxTimer));
      const col = sp.eliteMod ? 0xf59e0b : 0xf43f5e;
      const r = sp.eliteMod ? 30 : 23;
      g.fillStyle(col, 0.14 + prog * 0.24);
      g.lineStyle(2.2, col, 0.9);
      g.fillCircle(sp.x, sp.y, r * prog);
      g.strokeCircle(sp.x, sp.y, r);
      g.lineStyle(1.2, 0xfef08a, 0.65);
      g.strokeCircle(sp.x, sp.y, r * (1.25 - prog * 0.35));
    }

    // Enemy & Boss attack windup telegraphs (distinct readable patterns)
    for (const e of this.enemies) {
      if (e.dying || e.windupTimer <= 0 || !e.windupAction) continue;
      const prog = 1 - Math.max(0, e.windupTimer / Math.max(0.05, e.windupMax));
      if (e.windupAction === 'archer_shot' || e.windupAction === 'stalker_charge' || e.windupAction === 'boss_charge_dash') {
        const ang = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, e.windupTargetX, e.windupTargetY);
        if (e.bossDef) {
          // Wide crimson charge corridor for Bosses
          const laneLen = 360;
          const endX = e.sprite.x + Math.cos(ang) * laneLen;
          const endY = e.sprite.y + Math.sin(ang) * laneLen;
          g.lineStyle(e.radius * 1.3, 0xdc2626, 0.12 + prog * 0.16);
          g.lineBetween(e.sprite.x, e.sprite.y, endX, endY);
          g.lineStyle(4, 0xfef08a, 0.85);
          g.lineBetween(e.sprite.x, e.sprite.y, endX, endY);
        } else {
          g.lineStyle(2.4, 0xf43f5e, 0.65 + prog * 0.3);
          g.lineBetween(e.sprite.x, e.sprite.y, e.windupTargetX, e.windupTargetY);
        }
      } else if (e.windupAction === 'bomber_detonate' || e.windupAction === 'golem_stomp') {
        const r = e.windupAction === 'bomber_detonate' ? 98 : 126;
        g.fillStyle(0xef4444, 0.12 + prog * 0.24);
        g.lineStyle(2.5, 0xf97316, 0.92);
        g.fillCircle(e.sprite.x, e.sprite.y, r * prog);
        g.strokeCircle(e.sprite.x, e.sprite.y, r);
      } else if (e.windupAction === 'assassin_blink') {
        g.fillStyle(0xa855f7, 0.15 + prog * 0.2);
        g.lineStyle(2.2, 0xc084fc, 0.92);
        g.fillCircle(e.windupTargetX, e.windupTargetY, 28 * prog);
        g.strokeCircle(e.windupTargetX, e.windupTargetY, 28);
      } else if (e.windupAction === 'boss_cone_slam' || e.windupAction === 'boss_frost_lance') {
        const ang = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, e.windupTargetX, e.windupTargetY);
        const coneCol = e.windupAction === 'boss_frost_lance' ? 0x38bdf8 : 0xf97316;
        const coneR = 240;
        const halfSpread = 0.6;
        g.fillStyle(coneCol, 0.12 + prog * 0.18);
        g.lineStyle(2.5, coneCol, 0.9);
        g.beginPath();
        g.moveTo(e.sprite.x, e.sprite.y);
        g.arc(e.sprite.x, e.sprite.y, coneR * (0.45 + prog * 0.55), ang - halfSpread, ang + halfSpread, false);
        g.closePath();
        g.fillPath();
        g.strokePath();
      } else if (e.bossDef) {
        // Boss Ring Nova / Spiral / Meteor / Void Pull pulsing warning halo
        const warnR = e.radius + 32 + prog * 20;
        g.fillStyle(0xdc2626, 0.1 + prog * 0.18);
        g.lineStyle(3, 0xf59e0b, 0.9);
        g.fillCircle(e.sprite.x, e.sprite.y, warnR * prog);
        g.strokeCircle(e.sprite.x, e.sprite.y, warnR);
      } else {
        // Melee lunge telegraph arc
        g.lineStyle(2.2, 0xf97316, 0.85);
        g.strokeCircle(e.sprite.x, e.sprite.y, e.radius + 14);
      }
    }

    // Ground hazards (meteors, mage circles, boss AoEs, black holes, fire tornadoes)
    for (const h of this.hazards) {
      if (!h.triggered) {
        const prog = 1 - Math.max(0, h.delay / Math.max(0.01, h.maxDelay));
        g.fillStyle(h.color, 0.14 + prog * 0.22);
        g.lineStyle(2.4, h.color, 0.94);
        g.fillCircle(h.x, h.y, h.radius * prog);
        g.strokeCircle(h.x, h.y, h.radius);
      } else if (h.kind === 'black_hole') {
        g.fillStyle(0x09080c, 0.72);
        g.lineStyle(3, 0xa855f7, 0.9);
        g.fillCircle(h.x, h.y, 26);
        g.strokeCircle(h.x, h.y, h.radius);
        g.lineStyle(1.5, 0xe879f9, 0.55);
        g.strokeCircle(h.x, h.y, h.radius * (0.45 + (Math.sin(this.elapsedSec * 9) * 0.1 + 0.1)));
      } else if (h.kind === 'fire_tornado') {
        g.fillStyle(0xf97316, 0.22);
        g.lineStyle(3, 0xfacc15, 0.88);
        g.fillCircle(h.x, h.y, h.radius * 0.75);
        g.strokeCircle(h.x, h.y, h.radius);
      } else if (h.kind === 'banana_peel') {
        const pulseAlpha = h.duration < 1.2 ? Math.max(0.12, h.duration * 0.25) : 0.32;
        g.fillStyle(0xfde047, 0.08);
        g.lineStyle(1.4, 0xfde047, pulseAlpha);
        g.fillCircle(h.x, h.y, h.radius);
        g.strokeCircle(h.x, h.y, h.radius);
      }
    }
  }

  private drawLightningArc(x1: number, y1: number, x2: number, y2: number, color: number) {
    const g = this.add.graphics().setDepth(72);
    g.lineStyle(3, color, 0.95);
    g.beginPath();
    g.moveTo(x1, y1);
    const segs = 5;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const mx = Phaser.Math.Linear(x1, x2, t) + (Math.random() - 0.5) * 26;
      const my = Phaser.Math.Linear(y1, y2, t) + (Math.random() - 0.5) * 26;
      g.lineTo(mx, my);
    }
    g.lineTo(x2, y2);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    life: number,
    scale: number,
    texture: 'fx_spark' | 'fx_spark_streak' = 'fx_spark',
    drag = 0.25
  ) {
    if (this.particlePool.length === 0) return;
    const p = this.particlePool[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particlePool.length;
    p.active = true;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.startScale = scale;
    p.drag = drag;
    p.sprite
      .setTexture(texture)
      .setPosition(x, y)
      .setRotation(texture === 'fx_spark_streak' ? Math.atan2(vy, vx) : 0)
      .setTint(color)
      .setAlpha(1)
      .setScale(scale)
      .setVisible(true);
  }

  private spawnHitSparks(x: number, y: number, baseAngle: number, color: number, count: number, speed: number) {
    const cap =
      this.settings.graphicsQuality === 'low'
        ? Math.ceil(count * 0.4)
        : this.settings.graphicsQuality === 'medium'
          ? Math.ceil(count * 0.7)
          : count;
    for (let i = 0; i < cap; i++) {
      const spread = (Math.random() - 0.5) * 1.15;
      const a = baseAngle + spread;
      const s = speed * (0.55 + Math.random() * 0.65);
      this.spawnParticle(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        color,
        0.16 + Math.random() * 0.12,
        0.72 + Math.random() * 0.5,
        'fx_spark_streak',
        0.04
      );
    }
  }

  private spawnGroundScorch(x: number, y: number, scale = 1) {
    if (this.settings.graphicsQuality === 'low' || this.decalCount >= 18) return;
    this.decalCount++;
    const mark = this.add
      .image(x, y + 6, 'fx_scorch')
      .setDepth(8)
      .setScale(scale)
      .setRotation(Math.random() * Math.PI * 2)
      .setAlpha(0.55);
    this.propGroup?.add(mark);
    this.tweens.add({
      targets: mark,
      alpha: 0,
      delay: 2400,
      duration: 1400,
      onComplete: () => {
        this.decalCount = Math.max(0, this.decalCount - 1);
        if (mark.active) mark.destroy();
      },
    });
  }

  private spawnBurst(x: number, y: number, color: number, count: number, speed: number) {
    const cap = this.settings.graphicsQuality === 'low' ? Math.ceil(count * 0.4) : this.settings.graphicsQuality === 'medium' ? Math.ceil(count * 0.7) : count;
    for (let i = 0; i < cap; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.75);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, 0.24 + Math.random() * 0.2, 0.65 + Math.random() * 0.55);
    }
  }

  private spawnDamageText(x: number, y: number, label: string, color: string, isCrit: boolean) {
    if (!this.settings.damageNumbers || this.damageTextPool.length === 0) return;
    const item = this.damageTextPool[this.damageTextCursor];
    this.damageTextCursor = (this.damageTextCursor + 1) % this.damageTextPool.length;
    item.active = true;
    item.life = isCrit ? 0.88 : 0.62;
    item.maxLife = item.life;
    item.vx = (Math.random() - 0.5) * (isCrit ? 52 : 34);
    item.vy = isCrit ? -86 : -56;
    item.isCrit = isCrit;
    item.text
      .setPosition(x, y)
      .setText(label)
      .setColor(color)
      .setFontSize(isCrit ? '21px' : '14px')
      .setScale(isCrit ? 1.45 : 1.18)
      .setAlpha(1)
      .setVisible(true);
  }

  private updatePools(dt: number) {
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.setVisible(false);
        continue;
      }
      const damp = Math.pow(p.drag, dt);
      p.vx *= damp;
      p.vy *= damp;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      const ratio = p.life / p.maxLife;
      p.sprite.setAlpha(ratio);
      p.sprite.setScale(p.startScale * (0.35 + ratio * 0.65));
    }

    for (const t of this.damageTextPool) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.text.setVisible(false);
        continue;
      }
      t.text.x += t.vx * dt;
      t.text.y += t.vy * dt;
      t.vy += (t.isCrit ? 78 : 48) * dt;
      t.vx *= Math.pow(0.18, dt);
      const elapsedRatio = 1 - t.life / t.maxLife;
      const targetScale = elapsedRatio < 0.2 ? Phaser.Math.Linear(t.isCrit ? 1.45 : 1.18, 1.0, elapsedRatio / 0.2) : 1.0;
      t.text.setScale(targetScale);
      t.text.setAlpha(Math.min(1, (t.life / t.maxLife) * 1.45));
    }
  }

  private pushNotice(text: string, tone: 'gold' | 'crimson' | 'violet' | 'emerald') {
    this.recentNotice = { text, tone, id: this.noticeCounter++ };
    this.recentNoticeTimer = 3.2;
  }

  private emitHudSnapshot(force: boolean) {
    if (!this.player) return;
    const biome = getBiomeForFloor(this.floor);
    const evo = getClassEvolution(this.classId, this.level);
    const keys: Array<'Q' | 'E' | 'R' | 'F'> = ['Q', 'E', 'R', 'F'];

    const activeSlots: ActiveSkillSlotHUD[] = keys.map((k, idx) => {
      const sid = this.activeSlotSkills[idx];
      if (!sid) {
        return { key: k, skillId: null, name: 'Vazio', level: 0, cooldownRemaining: 0, cooldownTotal: 1, color: '#475569' };
      }
      const def = SKILLS[sid];
      const lv = this.skills[sid] ?? 1;
      const tier = getSkillEvolutionTier(sid, lv);
      return {
        key: k,
        skillId: sid,
        name: tier.name,
        level: lv,
        cooldownRemaining: this.skillCooldowns[sid] ?? 0,
        cooldownTotal: Math.max(0.6, def.cooldown * (1 - this.computedStats.cooldownReduction)),
        color: def.color,
      };
    });

    const activeMultipliers: Array<{ label: string; value: string }> = [];
    if (this.mods.damageMult > 1) activeMultipliers.push({ label: 'Dano', value: `×${this.mods.damageMult}` });
    if (this.mods.attackSpeedMult > 1) activeMultipliers.push({ label: 'Vel.Atk', value: `×${this.mods.attackSpeedMult}` });
    if (this.mods.xpMult > 1) activeMultipliers.push({ label: 'EXP', value: `×${this.mods.xpMult}` });
    if (this.mods.goldMult > 1) activeMultipliers.push({ label: 'Ouro', value: `×${this.mods.goldMult}` });
    if (this.mods.bossDamageMult > 1) activeMultipliers.push({ label: 'Chefes', value: `×${this.mods.bossDamageMult}` });

    const activeBuffs: Array<{ label: string; remainingSec: number; color: string }> = [];
    if (this.furyTimer > 0) activeBuffs.push({ label: 'Fúria Demoníaca', remainingSec: this.furyTimer, color: '#dc2626' });
    if (this.primateFuryTimer > 0) activeBuffs.push({ label: 'Fúria Primata', remainingSec: this.primateFuryTimer, color: '#f59e0b' });
    if (this.swiftKillTimer > 0) activeBuffs.push({ label: 'Ímpeto', remainingSec: this.swiftKillTimer, color: '#38bdf8' });
    if (this.playerSlowTimer > 0) activeBuffs.push({ label: 'Congelado', remainingSec: this.playerSlowTimer, color: '#22d3ee' });

    const livingEnemies = this.enemies.filter((e) => !e.dying);
    const futureWaveCount = this.floorWavePlan.waves
      .slice(this.currentWaveIndex + 1)
      .reduce((sum, w) => sum + w.count, 0);
    const totalRemaining = livingEnemies.length + this.pendingWaveSpawns.length + futureWaveCount;
    const activeBoss = livingEnemies.find((e) => e.bossDef);
    const nearInter = this.findNearestInteractable();

    const snap: RunHUDSnapshot = {
      classId: this.classId,
      evolutionTitle: evo ? evo.title : CLASSES[this.classId].name,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: Math.round(this.hp),
      maxHp: this.computedStats.maxHp,
      shield: Math.round(this.shield),
      floor: this.floor,
      biomeName: biome.name,
      floorModifier: this.floorModifierText,
      enemiesRemaining: totalRemaining,
      enemiesTotal: Math.max(totalRemaining, this.enemiesTotalOnFloor),
      waveIndex: Math.min(this.currentWaveIndex + 1, Math.max(1, this.floorWavePlan.waves.length)),
      waveTotal: Math.max(1, this.floorWavePlan.waves.length),
      lastDamagedAt: this.lastDamagedAt,
      portalOpen: this.portalOpen,
      gold: this.gold,
      crystalsRun: this.crystalsRun,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      elapsedSec: Math.floor(this.elapsedSec),
      dashCooldown: this.dashCooldown,
      dashCooldownMax: Math.max(
        0.65,
        BALANCE_CONFIG.player.dashCooldownSec * (1 - this.computedStats.cooldownReduction)
      ),
      activeSlots,
      skills: { ...(this.skills as Record<SkillId, number>) },
      activeSynergies: [...this.activeSynergies],
      activeMultipliers,
      activeBuffs,
      boss: activeBoss
        ? {
            name: activeBoss.bossDef!.name,
            title: activeBoss.bossDef!.title,
            hp: Math.max(0, Math.round(activeBoss.hp)),
            maxHp: activeBoss.maxHp,
            phase: activeBoss.bossPhase,
            maxPhases: activeBoss.bossDef!.isMegaBoss ? 3 : 2,
            isMegaBoss: activeBoss.bossDef!.isMegaBoss,
          }
        : null,
      timedChallenge:
        this.timedChallenge && !this.timedChallenge.rewarded
          ? { remainingSec: this.timedChallenge.remainingSec, totalSec: this.timedChallenge.totalSec }
          : null,
      nearbyPrompt: nearInter ? `[G] Interagir · ${nearInter.label}` : null,
      computedStats: { ...this.computedStats },
      equipped: { ...this.equipped },
      inventory: [...this.inventory],
      minimap: {
        roomWidth: this.roomWidth,
        roomHeight: this.roomHeight,
        player: { x: this.player.x, y: this.player.y },
        enemies: livingEnemies.map((e) => ({
          x: e.sprite.x,
          y: e.sprite.y,
          isElite: Boolean(e.eliteMod),
          isBoss: Boolean(e.bossDef),
        })),
        portal: this.portalOpen ? { x: this.portalPos.x, y: this.portalPos.y, active: true } : null,
        interactables: this.interactables
          .filter((it) => !it.used)
          .map((it) => ({ x: it.x, y: it.y, kind: it.kind })),
        pillars: this.pillarsLayout,
      },
      recentNotice: this.recentNotice,
      combo:
        this.comboHits >= COMBO_MIN_HITS && this.comboTimer > 0
          ? {
              hits: this.comboHits,
              multiplier: computeComboMultiplier(this.comboHits),
              remainingSec: this.comboTimer,
              maxWindowSec: COMBO_WINDOW_SEC,
            }
          : null,
      activeCastSlot: this.pendingCast ? this.pendingCast.slotIndex : null,
      autoAttackEnabled: this.settings.autoAttack,
    };

    this.lastHudSnapshot = snap;
    if (force || this.isActiveRun) {
      phaserBridge.emitHud(snap);
    }
  }
}
