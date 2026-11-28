import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AscensionArchiveModal } from './components/AscensionArchiveModal';
import { AuthModal, type AuthModalStep } from './components/AuthModal';
import { ChapterTransitionOverlay } from './components/ChapterTransitionOverlay';
import { CharacterOverlay } from './components/CharacterOverlay';
import { CinematicSequence } from './components/CinematicSequence';
import { ClassSelectModal } from './components/ClassSelectModal';
import { CodexModal } from './components/CodexModal';
import { EventModal } from './components/EventModal';
import { GameHUD } from './components/GameHUD';
import { LevelUpModal } from './components/LevelUpModal';
import { ProfileModal } from './components/ProfileModal';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { SanctuaryModal } from './components/SanctuaryModal';
import { GameOverModal, PauseModal, SettingsModal } from './components/SystemModals';
import { TitleScreen } from './components/TitleScreen';
import { ACHIEVEMENTS } from './game/data/achievements';
import { getChapterForFloor, type CinematicDef, type TowerWhisperDef } from './game/data/lore';
import { phaserBridge, type LevelUpOfferPayload } from './game/phaser/PhaserBridge';
import { PhaserCanvas } from './game/phaser/PhaserCanvas';
import {
  hasMeaningfulLocalProgress,
  mergeLocalAndCloudSave,
  reconcileSameAccountSave,
} from './game/systems/accountLogic';
import { audioEngine } from './game/systems/audioEngine';
import {
  createInitialAccountDocs,
  loadAccountBundle,
  loadCachedAccountSave,
  markAccountLocalMigrated,
  persistCachedAccountSave,
  recordCloudRun,
  redeemSecretCodeSecure,
  resetCloudAccountProgress,
  signOutAccount,
  syncCloudSave,
  updatePlayerProfile,
} from './game/systems/cloudSaveService';
import {
  createDefaultSave,
  loadSaveData,
  performAscension,
  persistSaveData,
  purchasePermanentUpgrade,
  syncAchievements,
} from './game/systems/saveManager';
import {
  evaluateTowerWhisper,
  pickMemoryFragmentForEvent,
  shouldShowChapterTransition,
} from './game/systems/narrativeManager';
import type { RedeemCodeResult } from './game/systems/secretCodeManager';
import type {
  ActiveEventPayload,
  ActiveModalType,
  AvatarId,
  ClassId,
  GameStateMode,
  NarrativeOverlayPayload,
  PermanentUpgrades,
  PlayerAccountMeta,
  PlayerProfileData,
  RunHUDSnapshot,
  RunRecord,
  RunSummarySnapshot,
  SaveData,
  SettingsData,
  SynergyId,
  UpgradeOption,
} from './game/types';
import { auth } from './lib/firebase';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameStateMode>('title');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [characterTab, setCharacterTab] = useState<'inventory' | 'skills' | 'stats'>('inventory');
  const [hud, setHud] = useState<RunHUDSnapshot | null>(null);
  const [levelUpOffer, setLevelUpOffer] = useState<LevelUpOfferPayload | null>(null);
  const [activeEvent, setActiveEvent] = useState<ActiveEventPayload | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummarySnapshot | null>(null);
  const [phaserReady, setPhaserReady] = useState(false);

  // Account & Cloud Save state
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [accountMeta, setAccountMeta] = useState<PlayerAccountMeta | null>(null);
  const [authModalStep, setAuthModalStep] = useState<AuthModalStep>('login');
  const [pendingCloudSaveForMigration, setPendingCloudSaveForMigration] = useState<SaveData | null>(null);
  const [guestSaveSnapshot, setGuestSaveSnapshot] = useState<SaveData>(() => loadSaveData());

  // Narrative, Cinematics & Environmental Storytelling state
  const [activeCinematic, setActiveCinematic] = useState<CinematicDef['id'] | null>(null);
  const [cinematicReturnContext, setCinematicReturnContext] = useState<'startRun' | 'archive' | 'resumePlay' | null>(null);
  const [chapterTransition, setChapterTransition] = useState<{
    chapterIndex: number;
    floor: number;
    isFirstDiscovery: boolean;
  } | null>(null);
  const [narrativeOverlay, setNarrativeOverlay] = useState<NarrativeOverlayPayload | null>(null);

  const saveRef = useRef(save);
  saveRef.current = save;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;
  const activeCinematicRef = useRef(activeCinematic);
  activeCinematicRef.current = activeCinematic;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const firebaseUserRef = useRef(firebaseUser);
  firebaseUserRef.current = firebaseUser;

  const pendingCloudSyncTimerRef = useRef<number | null>(null);
  const pendingCloudSyncDirtyRef = useRef(false);
  const globalPointerDownRef = useRef(false);
  const globalHeldKeysRef = useRef<Set<string>>(new Set());
  const pendingStartClassRef = useRef<ClassId | undefined>(undefined);
  const narrativeOverlayCounterRef = useRef(1);
  const narrativeOverlayTimerRef = useRef<number | null>(null);
  const delayedWhisperTimerRef = useRef<number | null>(null);

  // Track primary pointer & Digit1-3 state continuously so level-up modal knows if combat input was already held
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) globalPointerDownRef.current = true;
    };
    const onPointerUp = () => {
      globalPointerDownRef.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        globalHeldKeysRef.current.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      globalHeldKeysRef.current.delete(e.code);
    };
    const onBlur = () => {
      globalPointerDownRef.current = false;
      globalHeldKeysRef.current.clear();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Flush versioned cloud save immediately when needed (never per frame or per attack!)
  const flushCloudSaveNow = useCallback(async (overrideSave?: SaveData) => {
    if (pendingCloudSyncTimerRef.current !== null) {
      window.clearTimeout(pendingCloudSyncTimerRef.current);
      pendingCloudSyncTimerRef.current = null;
    }
    const user = firebaseUserRef.current;
    const prof = profileRef.current;
    if (!user || !user.emailVerified || !prof) return;

    pendingCloudSyncDirtyRef.current = false;
    const targetSave = overrideSave ?? saveRef.current;
    try {
      await syncCloudSave(user.uid, targetSave);
    } catch {
      // Keep dirty flag so next milestone or reconnect flushes safely without interrupting play
      pendingCloudSyncDirtyRef.current = true;
    }
  }, []);

  const scheduleCloudSave = useCallback(
    (delayMs: number, immediate = false) => {
      const user = firebaseUserRef.current;
      const prof = profileRef.current;
      if (!user || !user.emailVerified || !prof) return;

      pendingCloudSyncDirtyRef.current = true;
      if (immediate) {
        void flushCloudSaveNow();
        return;
      }
      if (pendingCloudSyncTimerRef.current !== null) {
        window.clearTimeout(pendingCloudSyncTimerRef.current);
      }
      pendingCloudSyncTimerRef.current = window.setTimeout(() => {
        pendingCloudSyncTimerRef.current = null;
        void flushCloudSaveNow();
      }, delayMs);
    },
    [flushCloudSaveNow]
  );

  // Flush any pending cloud sync on pagehide / reconnect so players do not lose recent progress
  useEffect(() => {
    const onPageHide = () => {
      if (pendingCloudSyncDirtyRef.current) {
        void flushCloudSaveNow();
      }
    };
    const onOnline = () => {
      if (pendingCloudSyncDirtyRef.current) {
        void flushCloudSaveNow();
      }
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }, [flushCloudSaveNow]);

  /**
   * Central state updater for SaveData.
   * syncMode controls cloud write cadence:
   * - 'none': local cache only (e.g. per-kill counter during combat, synced at floor/run end)
   * - 'debounced': debounced cloud sync (e.g. settings slider or floor milestone)
   * - 'immediate': immediate cloud sync (e.g. run end, permanent upgrade, ascension, achievement, code)
   */
  const updateSave = useCallback(
    (
      updater: (prev: SaveData) => SaveData,
      syncMode: 'none' | 'debounced' | 'immediate' = 'none'
    ) => {
      const prev = saveRef.current;
      const computed = syncAchievements(updater(prev)).save;
      const next: SaveData =
        syncMode === 'none'
          ? computed
          : { ...computed, saveVersion: Math.max(prev.saveVersion, computed.saveVersion) + 1 };

      saveRef.current = next;
      setSave(next);

      const user = firebaseUserRef.current;
      const prof = profileRef.current;
      if (user && prof) {
        persistCachedAccountSave(user.uid, next);
        if (syncMode === 'immediate') {
          void flushCloudSaveNow(next);
        } else if (syncMode === 'debounced') {
          scheduleCloudSave(1800, false);
        }
      } else {
        persistSaveData(next);
        setGuestSaveSnapshot(next);
      }
    },
    [flushCloudSaveNow, scheduleCloudSave]
  );

  // Hydrate authenticated user bundle (profile, account meta, cloud save, onboarding / migration prompts)
  const hydrateAuthenticatedUser = useCallback(async (user: User) => {
    setFirebaseUser(user);

    if (!user.emailVerified) {
      setProfile(null);
      setAccountMeta(null);
      setAuthModalStep('verifyEmail');
      setActiveModal('auth');
      setAuthLoading(false);
      return;
    }

    try {
      const bundle = await loadAccountBundle(user);
      const currentGuestSave = loadSaveData();
      setGuestSaveSnapshot(currentGuestSave);

      if (!bundle) {
        // First login (Google or newly verified email/password): prompt for unique username
        setProfile(null);
        setAccountMeta(null);
        setPendingCloudSaveForMigration(null);
        setAuthModalStep('chooseUsername');
        setActiveModal('auth');
        setAuthLoading(false);
        return;
      }

      setProfile(bundle.profile);
      setAccountMeta(bundle.account);

      // Reconcile cloud save with same-UID offline cache (prevents overwriting newer progress)
      const cachedSameUid = loadCachedAccountSave(user.uid);
      let activeCloudSave = bundle.save;
      if (cachedSameUid) {
        const reconciled = reconcileSameAccountSave(cachedSameUid, bundle.save);
        activeCloudSave = reconciled.resolved;
        if (reconciled.shouldPushToCloud) {
          void syncCloudSave(user.uid, activeCloudSave).catch(() => {});
        }
      }

      // Check one-time local guest progress migration offer
      if (!bundle.account.localMigrated && hasMeaningfulLocalProgress(currentGuestSave)) {
        setSave(activeCloudSave);
        setPendingCloudSaveForMigration(activeCloudSave);
        setAuthModalStep('migrateLocal');
        setActiveModal('auth');
        setAuthLoading(false);
        return;
      }

      setSave(activeCloudSave);
      setPendingCloudSaveForMigration(null);
      if (activeModalRef.current === 'auth') {
        setActiveModal(null);
      }
    } catch {
      // Fallback to cached save for this UID if offline
      const cached = loadCachedAccountSave(user.uid);
      if (cached) {
        setSave(cached);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Listen to Firebase Auth persistence across reloads
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        setAccountMeta(null);
        setPendingCloudSaveForMigration(null);
        const guest = loadSaveData();
        setGuestSaveSnapshot(guest);
        setSave(guest);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      void hydrateAuthenticatedUser(user);
    });
    return () => unsub();
  }, [hydrateAuthenticatedUser]);

  const handleCompleteUsernameSetup = useCallback(
    async (chosenUsername: string, avatarId: AvatarId) => {
      const user = firebaseUserRef.current;
      if (!user) return;

      const currentGuestSave = loadSaveData();
      const shouldOfferMigration = hasMeaningfulLocalProgress(currentGuestSave);

      const created = await createInitialAccountDocs({
        user,
        username: chosenUsername,
        avatarId,
        initialSave: createDefaultSave(),
        markLocalMigrated: !shouldOfferMigration,
      });

      setProfile(created.profile);
      setAccountMeta(created.account);

      if (shouldOfferMigration) {
        setGuestSaveSnapshot(currentGuestSave);
        setPendingCloudSaveForMigration(created.save);
        setSave(created.save);
        setAuthModalStep('migrateLocal');
        setActiveModal('auth');
      } else {
        setSave(created.save);
        setActiveModal(null);
      }
    },
    []
  );

  const handleConfirmLocalMigration = useCallback(async (importLocal: boolean) => {
    const user = firebaseUserRef.current;
    if (!user) return;

    const cloudBase = pendingCloudSaveForMigration ?? saveRef.current;
    const localGuest = loadSaveData();

    if (importLocal) {
      const merged = mergeLocalAndCloudSave(localGuest, cloudBase);
      await syncCloudSave(user.uid, merged);
      await markAccountLocalMigrated(user.uid);
      setSave(merged);
      setAccountMeta((prev) => (prev ? { ...prev, localMigrated: true } : prev));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              bestFloor: merged.bestFloor,
              bestLevel: merged.bestLevel,
              totalKills: merged.totalKills,
              totalBossKills: merged.totalBossKills,
              totalRuns: merged.totalRuns,
              totalPlayTimeSec: merged.totalPlayTimeSec,
              ascensionLevel: merged.ascensionLevel,
              achievementsCount: merged.unlockedAchievements.length,
            }
          : prev
      );
    } else {
      await markAccountLocalMigrated(user.uid);
      setSave(cloudBase);
      setAccountMeta((prev) => (prev ? { ...prev, localMigrated: true } : prev));
    }

    setPendingCloudSaveForMigration(null);
    setActiveModal(null);
  }, [pendingCloudSaveForMigration]);

  const handleVerifyEmailRefresh = useCallback(async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    await user.getIdToken(true);
    if (user.emailVerified) {
      await hydrateAuthenticatedUser(user);
      return true;
    }
    return false;
  }, [hydrateAuthenticatedUser]);

  const handleSignOut = useCallback(async () => {
    if (pendingCloudSyncDirtyRef.current) {
      await flushCloudSaveNow();
    }
    await signOutAccount();
    setActiveModal(null);
  }, [flushCloudSaveNow]);

  const handleUpdateProfile = useCallback(
    async (patch: {
      username: string;
      avatarId: AvatarId;
      equippedTitle: string;
      favoriteClass: ClassId;
      publicProfile: boolean;
    }) => {
      const cur = profileRef.current;
      if (!cur) return;
      const updated = await updatePlayerProfile(cur, patch);
      setProfile(updated);
    },
    []
  );

  // Mirror game state & custom gameplay reticle visibility to document.body.dataset
  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.reticle =
      gameState === 'playing' && activeModal === null && activeCinematic === null ? 'true' : 'false';
  }, [gameState, activeModal, activeCinematic]);

  // Expose internal bridge reference for automated QA checks without adding any visible debug UI
  useEffect(() => {
    (window as unknown as { __dungeonBridge?: typeof phaserBridge }).__dungeonBridge = phaserBridge;
    return () => {
      if (narrativeOverlayTimerRef.current !== null) {
        window.clearTimeout(narrativeOverlayTimerRef.current);
      }
      if (delayedWhisperTimerRef.current !== null) {
        window.clearTimeout(delayedWhisperTimerRef.current);
      }
    };
  }, []);

  const showNarrativeOverlay = useCallback(
    (payload: Omit<NarrativeOverlayPayload, 'id'>, durationMs = 4400) => {
      if (narrativeOverlayTimerRef.current !== null) {
        window.clearTimeout(narrativeOverlayTimerRef.current);
      }
      const id = narrativeOverlayCounterRef.current++;
      setNarrativeOverlay({ ...payload, id });
      narrativeOverlayTimerRef.current = window.setTimeout(() => {
        narrativeOverlayTimerRef.current = null;
        setNarrativeOverlay((cur) => (cur?.id === id ? null : cur));
      }, durationMs);
    },
    []
  );

  const tryTriggerWhisper = useCallback(
    (triggerId: TowerWhisperDef['id'], delayMs = 0) => {
      const whisper = evaluateTowerWhisper(saveRef.current.narrative.triggeredWhispers, triggerId);
      if (!whisper) return;

      updateSave(
        (prev) =>
          prev.narrative.triggeredWhispers.includes(whisper.id)
            ? prev
            : {
                ...prev,
                narrative: {
                  ...prev.narrative,
                  triggeredWhispers: [...prev.narrative.triggeredWhispers, whisper.id],
                },
              },
        'debounced'
      );

      const fire = () => {
        audioEngine.playTowerWhisper();
        showNarrativeOverlay(
          {
            kind: 'tower_whisper',
            speaker: whisper.title,
            text: whisper.message,
            accentColor: '#c084fc',
          },
          5200
        );
      };

      if (delayMs > 0) {
        if (delayedWhisperTimerRef.current !== null) {
          window.clearTimeout(delayedWhisperTimerRef.current);
        }
        delayedWhisperTimerRef.current = window.setTimeout(() => {
          delayedWhisperTimerRef.current = null;
          fire();
        }, delayMs);
      } else {
        fire();
      }
    },
    [showNarrativeOverlay, updateSave]
  );

  // Apply audio & Phaser settings on mount and change
  useEffect(() => {
    audioEngine.applySettings(save.settings);
    phaserBridge.getController()?.applySettings(save.settings);
  }, [save.settings, phaserReady]);

  // Register Phaser -> React event callbacks
  useEffect(() => {
    phaserBridge.setCallbacks({
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onLevelUpOffer: (payload) => {
        setLevelUpOffer(payload);
        setActiveModal('levelUp');
      },
      onEventTrigger: (payload) => {
        setActiveEvent(payload);
        setActiveModal('event');
      },
      onSynergyUnlocked: (synergyId: SynergyId) => {
        updateSave(
          (prev) =>
            prev.discoveredSynergies.includes(synergyId)
              ? prev
              : { ...prev, discoveredSynergies: [...prev.discoveredSynergies, synergyId] },
          'debounced'
        );
      },
      onEnemyKilled: (id, isBoss) => {
        // Never write to cloud per kill; only update local state and flush on floor milestone / run end
        updateSave(
          (prev) => ({
            ...prev,
            totalKills: prev.totalKills + 1,
            totalBossKills: prev.totalBossKills + (isBoss ? 1 : 0),
            bestiaryKills: {
              ...prev.bestiaryKills,
              [id]: (prev.bestiaryKills[id] ?? 0) + 1,
            },
          }),
          'none'
        );
      },
      onQuickSaveProgress: (delta) => {
        // Triggered on floor clear / meaningful milestone — debounced cloud save
        updateSave(
          (prev) => ({
            ...prev,
            crystals: prev.crystals + delta.crystalsDelta,
            totalCrystalsEarned: prev.totalCrystalsEarned + delta.crystalsDelta,
            bestFloor: Math.max(prev.bestFloor, delta.floor),
            bestLevel: Math.max(prev.bestLevel, delta.level),
          }),
          'debounced'
        );
      },
      onFloorEntered: (floor, prevFloor) => {
        const chapter = getChapterForFloor(floor);
        const curNarrative = saveRef.current.narrative;
        const transition = shouldShowChapterTransition({
          floor,
          previousFloor: prevFloor,
          discoveredChapters: curNarrative.discoveredChapters,
          skipRepeatedTransitions: Boolean(saveRef.current.settings.skipRepeatedTransitions),
        });

        const needsUpdate =
          !curNarrative.discoveredChapters.includes(chapter.index) ||
          !curNarrative.reachedBiomes.includes(chapter.index) ||
          (floor > 100 && !curNarrative.infiniteAscensionUnlocked);

        if (needsUpdate) {
          updateSave(
            (prev) => ({
              ...prev,
              narrative: {
                ...prev.narrative,
                discoveredChapters: prev.narrative.discoveredChapters.includes(chapter.index)
                  ? prev.narrative.discoveredChapters
                  : [...prev.narrative.discoveredChapters, chapter.index].sort((a, b) => a - b),
                reachedBiomes: prev.narrative.reachedBiomes.includes(chapter.index)
                  ? prev.narrative.reachedBiomes
                  : [...prev.narrative.reachedBiomes, chapter.index].sort((a, b) => a - b),
                infiniteAscensionUnlocked: prev.narrative.infiniteAscensionUnlocked || floor > 100,
              },
            }),
            'debounced'
          );
        }

        if (transition.show) {
          setChapterTransition({
            chapterIndex: transition.chapterIndex,
            floor,
            isFirstDiscovery: transition.isFirstDiscovery,
          });
          audioEngine.playChapterTransition(chapter.index);
        }

        if (floor === 1) {
          tryTriggerWhisper('first_run', 3100);
        } else if (floor >= 150) {
          tryTriggerWhisper('floor_150', 1200);
        } else if (floor >= 100) {
          tryTriggerWhisper('floor_100', 1200);
        } else if (floor >= 50) {
          tryTriggerWhisper('floor_50', 1200);
        }
      },
      onBossDialogue: (payload) => {
        if (!saveRef.current.narrative.discoveredBosses.includes(payload.bossId)) {
          updateSave(
            (prev) => ({
              ...prev,
              narrative: {
                ...prev.narrative,
                discoveredBosses: prev.narrative.discoveredBosses.includes(payload.bossId)
                  ? prev.narrative.discoveredBosses
                  : [...prev.narrative.discoveredBosses, payload.bossId],
              },
            }),
            'debounced'
          );
        }
        showNarrativeOverlay(
          {
            kind: 'boss_dialogue',
            speaker: payload.bossName,
            text: payload.text,
            accentColor: payload.accentColor,
          },
          4400
        );
      },
      onBossDefeatedNarrative: (bossId, floor) => {
        const chapter = getChapterForFloor(floor);
        const alreadyUnlockedInfinite = saveRef.current.narrative.infiniteAscensionUnlocked;
        const triggerFloor100Cinematic =
          (bossId === 'dungeon_god' || floor === 100) && !alreadyUnlockedInfinite;

        updateSave(
          (prev) => {
            const n = prev.narrative;
            return {
              ...prev,
              narrative: {
                ...n,
                discoveredBosses: n.discoveredBosses.includes(bossId)
                  ? n.discoveredBosses
                  : [...n.discoveredBosses, bossId],
                defeatedBosses: n.defeatedBosses.includes(bossId)
                  ? n.defeatedBosses
                  : [...n.defeatedBosses, bossId],
                unlockedRevelations: n.unlockedRevelations.includes(chapter.index)
                  ? n.unlockedRevelations
                  : [...n.unlockedRevelations, chapter.index].sort((a, b) => a - b),
                infiniteAscensionUnlocked: n.infiniteAscensionUnlocked || triggerFloor100Cinematic,
                unlockedCinematics:
                  triggerFloor100Cinematic && !n.unlockedCinematics.includes('floor100_ascension')
                    ? [...n.unlockedCinematics, 'floor100_ascension']
                    : n.unlockedCinematics,
              },
            };
          },
          triggerFloor100Cinematic ? 'immediate' : 'debounced'
        );

        tryTriggerWhisper('first_boss', 2600);

        if (triggerFloor100Cinematic) {
          phaserBridge.getController()?.setPaused(true);
          setChapterTransition(null);
          setCinematicReturnContext('resumePlay');
          setActiveCinematic('floor100_ascension');
        }
      },
      onMemoryFragmentSource: (source, floor, bossId) => {
        const frag = pickMemoryFragmentForEvent({
          collectedIds: saveRef.current.narrative.collectedFragments,
          source,
          floor,
          bossId,
        });
        if (!frag) return;
        updateSave(
          (prev) => ({
            ...prev,
            narrative: {
              ...prev.narrative,
              collectedFragments: prev.narrative.collectedFragments.includes(frag.id)
                ? prev.narrative.collectedFragments
                : [...prev.narrative.collectedFragments, frag.id],
            },
          }),
          'debounced'
        );
        audioEngine.playMemoryFragment();
        showNarrativeOverlay(
          {
            kind: 'fragment',
            speaker: frag.title,
            text: frag.excerpt,
            accentColor: '#d4a64a',
          },
          5200
        );
      },
      onMythicPicked: () => {
        tryTriggerWhisper('first_mythic', 450);
      },
      onRunEnded: (summary) => {
        setRunSummary(summary);
        setActiveModal(null);
        setLevelUpOffer(null);
        setActiveEvent(null);
        setChapterTransition(null);
        document.body.dataset.state = 'gameover';
        setGameState('gameover');

        const record: RunRecord = {
          id: `run_${Date.now().toString(36)}`,
          date: new Date().toISOString(),
          classId: summary.classId,
          floor: summary.floor,
          level: summary.level,
          kills: summary.kills,
          bossesKilled: summary.bossesKilled,
          durationSec: summary.durationSec,
          crystalsEarned: summary.crystalsEarned,
          ascensionLevel: saveRef.current.ascensionLevel,
        };

        updateSave(
          (prev) => ({
            ...prev,
            totalRuns: prev.totalRuns + 1,
            totalPlayTimeSec: prev.totalPlayTimeSec + Math.max(0, Math.floor(summary.durationSec)),
            bestFloor: Math.max(prev.bestFloor, summary.floor),
            bestLevel: Math.max(prev.bestLevel, summary.level),
            records: [record, ...prev.records]
              .sort((a, b) => b.floor - a.floor || b.level - a.level)
              .slice(0, 20),
          }),
          'immediate'
        );

        tryTriggerWhisper('first_death', 350);

        // Append immutable expedition entry for authenticated players
        const user = firebaseUserRef.current;
        if (user && user.emailVerified && profileRef.current) {
          void recordCloudRun(user.uid, record).catch(() => {});
        }
      },
    });
    return () => phaserBridge.setCallbacks(null);
  }, [showNarrativeOverlay, tryTriggerWhisper, updateSave]);

  const launchRunNow = useCallback(
    (overrideClass?: ClassId) => {
      const cls = overrideClass ?? saveRef.current.selectedClass;
      if (overrideClass && overrideClass !== saveRef.current.selectedClass) {
        updateSave((prev) => ({ ...prev, selectedClass: overrideClass }), 'debounced');
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      audioEngine.playUiClick();
      setActiveModal(null);
      setLevelUpOffer(null);
      setActiveEvent(null);
      setRunSummary(null);
      setNarrativeOverlay(null);
      setChapterTransition(null);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      phaserBridge.getController()?.startNewRun(cls, saveRef.current);
    },
    [updateSave]
  );

  const startRun = useCallback(
    (overrideClass?: ClassId) => {
      const isAutostart = new URLSearchParams(window.location.search).get('autostart') === '1';
      if (!saveRef.current.narrative.introSeen && !isAutostart) {
        pendingStartClassRef.current = overrideClass;
        audioEngine.playUiClick();
        setActiveModal(null);
        setCinematicReturnContext('startRun');
        setActiveCinematic('intro');
        return;
      }
      launchRunNow(overrideClass);
    },
    [launchRunNow]
  );

  const handleCinematicComplete = useCallback(() => {
    const cid = activeCinematic;
    const ctx = cinematicReturnContext;
    setActiveCinematic(null);
    setCinematicReturnContext(null);

    if (cid === 'intro') {
      updateSave(
        (prev) => ({
          ...prev,
          narrative: {
            ...prev.narrative,
            introSeen: true,
            unlockedCinematics: prev.narrative.unlockedCinematics.includes('intro')
              ? prev.narrative.unlockedCinematics
              : [...prev.narrative.unlockedCinematics, 'intro'],
          },
        }),
        'debounced'
      );
    } else if (cid === 'floor100_ascension') {
      updateSave(
        (prev) => ({
          ...prev,
          narrative: {
            ...prev.narrative,
            infiniteAscensionUnlocked: true,
            unlockedCinematics: prev.narrative.unlockedCinematics.includes('floor100_ascension')
              ? prev.narrative.unlockedCinematics
              : [...prev.narrative.unlockedCinematics, 'floor100_ascension'],
          },
        }),
        'immediate'
      );
    }

    if (ctx === 'startRun') {
      const chosen = pendingStartClassRef.current;
      pendingStartClassRef.current = undefined;
      launchRunNow(chosen);
    } else if (ctx === 'resumePlay') {
      phaserBridge.getController()?.setPaused(false);
    }
  }, [activeCinematic, cinematicReturnContext, launchRunNow, updateSave]);

  // Support ?autostart=1 query param for instant testing & jump-in
  const autostartTriggered = useRef(false);
  useEffect(() => {
    if (!phaserReady || autostartTriggered.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      autostartTriggered.current = true;
      startRun();
    }
  }, [phaserReady, startRun]);

  const openPause = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (activeModalRef.current === 'levelUp' || activeModalRef.current === 'event') return;
    setActiveModal(null);
    phaserBridge.getController()?.setPaused(true);
    document.body.dataset.state = 'paused';
    setGameState('paused');
  }, []);

  const resumePlaying = useCallback(() => {
    setActiveModal(null);
    document.body.dataset.state = 'playing';
    setGameState('playing');
    phaserBridge.getController()?.setPaused(false);
  }, []);

  const returnToTitle = useCallback(() => {
    phaserBridge.getController()?.stopRun();
    setHud(null);
    setActiveModal(null);
    setLevelUpOffer(null);
    setActiveEvent(null);
    setRunSummary(null);
    setChapterTransition(null);
    setNarrativeOverlay(null);
    document.body.dataset.state = 'title';
    setGameState('title');
    if (pendingCloudSyncDirtyRef.current) {
      void flushCloudSaveNow();
    }
  }, [flushCloudSaveNow]);

  const openCharacterTab = useCallback((tab: 'inventory' | 'skills' | 'stats') => {
    if (gameStateRef.current !== 'playing') return;
    if (activeModalRef.current === 'levelUp' || activeModalRef.current === 'event') return;
    setCharacterTab(tab);
    setActiveModal('character');
    phaserBridge.getController()?.setPaused(true);
  }, []);

  const toggleMute = useCallback(() => {
    updateSave(
      (prev) => ({
        ...prev,
        settings: { ...prev.settings, muted: !prev.settings.muted },
      }),
      'debounced'
    );
  }, [updateSave]);

  // Global keyboard shortcuts during play / pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (activeCinematicRef.current !== null) return;
      const st = gameStateRef.current;
      const modal = activeModalRef.current;

      const target = e.target;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (e.code === 'KeyM' && st === 'playing' && !modal && !isTextInput) {
        toggleMute();
        return;
      }

      if (e.code === 'Escape' || (e.code === 'KeyP' && !isTextInput)) {
        if (st === 'playing') {
          if (e.code === 'Escape' && !modal && phaserBridge.getController()?.hasPendingCast()) {
            phaserBridge.getController()?.cancelPendingCast();
            return;
          }
          if (modal === 'character') {
            resumePlaying();
          } else if (modal === 'settings') {
            setActiveModal(null);
          } else if (!modal) {
            openPause();
          }
        } else if (st === 'paused') {
          if (modal === 'settings') {
            setActiveModal(null);
          } else {
            resumePlaying();
          }
        } else if (st === 'title' && modal) {
          // Do not dismiss mandatory onboarding steps via Escape
          if (
            modal === 'auth' &&
            (authModalStep === 'chooseUsername' || authModalStep === 'migrateLocal')
          ) {
            return;
          }
          setActiveModal(null);
        }
        return;
      }

      if (st === 'playing' && modal !== 'levelUp' && modal !== 'event') {
        if (e.code === 'KeyI') {
          if (modal === 'character' && characterTab === 'inventory') resumePlaying();
          else openCharacterTab('inventory');
        } else if (e.code === 'KeyK') {
          if (modal === 'character' && characterTab === 'skills') resumePlaying();
          else openCharacterTab('skills');
        } else if (e.code === 'KeyC') {
          if (modal === 'character' && characterTab === 'stats') resumePlaying();
          else openCharacterTab('stats');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authModalStep, characterTab, openCharacterTab, openPause, resumePlaying, toggleMute]);

  const handleCommitUpgrade = useCallback((option: UpgradeOption): { hasMorePending: boolean } => {
    const result = phaserBridge.getController()?.selectUpgrade(option);
    return result ?? { hasMorePending: false };
  }, []);

  const handleLevelUpTransitionComplete = useCallback((hasMorePending: boolean) => {
    const ctrl = phaserBridge.getController();
    if (hasMorePending) {
      ctrl?.openNextPendingLevelUp();
    } else {
      setLevelUpOffer(null);
      setActiveModal(null);
      ctrl?.resumeAfterLevelUp();
    }
  }, []);

  const handleResolveEvent = useCallback((choiceId: string) => {
    audioEngine.playUiClick();
    setActiveEvent(null);
    setActiveModal(null);
    phaserBridge.getController()?.resolveEventChoice(choiceId);
  }, []);

  const handleBuyPermanent = useCallback(
    (key: keyof PermanentUpgrades) => {
      const next = purchasePermanentUpgrade(saveRef.current, key);
      if (next) {
        audioEngine.playPickup('crystal');
        updateSave(() => next, 'immediate');
      }
    },
    [updateSave]
  );

  const handleAscend = useCallback(() => {
    const next = performAscension(saveRef.current);
    if (next) {
      audioEngine.playLevelUp('mythic');
      updateSave(() => next, 'immediate');
    }
  }, [updateSave]);

  const handleClaimAchievement = useCallback(
    (achievementId: string) => {
      const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!def) return;
      updateSave(
        (prev) => {
          if (prev.claimedAchievements.includes(achievementId)) return prev;
          if (!def.check(prev).done) return prev;
          audioEngine.playPickup('crystal');
          return {
            ...prev,
            crystals: prev.crystals + def.rewardCrystals,
            totalCrystalsEarned: prev.totalCrystalsEarned + def.rewardCrystals,
            claimedAchievements: [...prev.claimedAchievements, achievementId],
          };
        },
        'immediate'
      );
    },
    [updateSave]
  );

  const handleUpdateSettings = useCallback(
    (nextSettings: SettingsData) => {
      updateSave((prev) => ({ ...prev, settings: nextSettings }), 'debounced');
    },
    [updateSave]
  );

  const handleResetSave = useCallback(() => {
    const user = firebaseUserRef.current;
    const prof = profileRef.current;
    if (user && user.emailVerified && prof) {
      void resetCloudAccountProgress(user.uid, saveRef.current)
        .then((fresh) => {
          setSave(fresh);
          setActiveModal(null);
        })
        .catch(() => {
          setActiveModal(null);
        });
      return;
    }

    const fresh = createDefaultSave();
    persistSaveData(fresh);
    setGuestSaveSnapshot(fresh);
    setSave(fresh);
    setActiveModal(null);
  }, []);

  const handleRedeemCode = useCallback(
    async (rawCode: string): Promise<RedeemCodeResult> => {
      const user = firebaseUserRef.current;
      const uid = user && user.emailVerified && profileRef.current ? user.uid : null;
      const result = await redeemSecretCodeSecure({
        rawCode,
        save: saveRef.current,
        uid,
      });

      if (result.status === 'success') {
        audioEngine.playSecretUnlock(result.codeDef?.theme);
        const reward = result.codeDef?.reward;
        updateSave(
          (prev) => ({
            ...prev,
            redeemedCodes: Array.from(new Set([...prev.redeemedCodes, ...result.save.redeemedCodes])),
            unlockedSecretClasses: Array.from(
              new Set([...prev.unlockedSecretClasses, ...result.save.unlockedSecretClasses])
            ),
            crystals:
              reward?.type === 'crystals' ? prev.crystals + reward.amount : prev.crystals,
            totalCrystalsEarned:
              reward?.type === 'crystals'
                ? prev.totalCrystalsEarned + reward.amount
                : prev.totalCrystalsEarned,
          }),
          'immediate'
        );
      } else {
        audioEngine.playUiClick();
      }
      return result;
    },
    [updateSave]
  );

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalStep(mode);
    setActiveModal('auth');
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0a0e]">
      {/* Isolated Phaser 3 WebGL + Arcade Physics Engine */}
      <PhaserCanvas onReady={() => setPhaserReady(true)} />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          save={save}
          profile={profile}
          authLoading={authLoading}
          onStartRun={() => startRun()}
          onOpenClassSelect={() => setActiveModal('classSelect')}
          onOpenSanctuary={() => setActiveModal('sanctuary')}
          onOpenCodex={() => setActiveModal('codex')}
          onOpenArchive={() => setActiveModal('archive')}
          onOpenProfile={() => setActiveModal('profile')}
          onOpenAuth={() => openAuthModal('login')}
          onOpenRedeemCode={() => setActiveModal('redeemCode')}
          onOpenSettings={() => setActiveModal('settings')}
          hasModalOpen={activeModal !== null || activeCinematic !== null}
        />
      )}

      {/* Active Gameplay HUD */}
      {(gameState === 'playing' || gameState === 'paused') && hud && (
        <GameHUD
          hud={hud}
          settings={save.settings}
          narrativeOverlay={narrativeOverlay}
          onOpenCharacterTab={openCharacterTab}
          onToggleMute={toggleMute}
          onOpenPause={openPause}
        />
      )}

      {/* Non-blocking Atmospheric Chapter Transition Overlay */}
      {gameState === 'playing' && chapterTransition && !activeCinematic && (
        <ChapterTransitionOverlay
          chapterIndex={chapterTransition.chapterIndex}
          floor={chapterTransition.floor}
          isFirstDiscovery={chapterTransition.isFirstDiscovery}
          onDismiss={() => setChapterTransition(null)}
        />
      )}

      {/* Class Selection Modal */}
      {activeModal === 'classSelect' && (
        <ClassSelectModal
          selectedClass={save.selectedClass}
          unlockedSecretClasses={save.unlockedSecretClasses}
          onSelectClass={(id) => updateSave((prev) => ({ ...prev, selectedClass: id }), 'debounced')}
          onStartWithClass={(id) => startRun(id)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Player Profile Modal */}
      {activeModal === 'profile' && (
        <ProfileModal
          save={save}
          profile={profile}
          account={accountMeta}
          onUpdateProfile={handleUpdateProfile}
          onOpenAuth={(mode) => openAuthModal(mode)}
          onSignOut={handleSignOut}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Authentication, Onboarding & Local Migration Modal */}
      {activeModal === 'auth' && (
        <AuthModal
          initialStep={authModalStep}
          firebaseUser={firebaseUser}
          localSave={guestSaveSnapshot}
          cloudSavePreview={pendingCloudSaveForMigration}
          onCompleteUsernameSetup={handleCompleteUsernameSetup}
          onConfirmLocalMigration={handleConfirmLocalMigration}
          onVerifyEmailRefresh={handleVerifyEmailRefresh}
          onSignOut={handleSignOut}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Redeem Secret Code Modal */}
      {activeModal === 'redeemCode' && (
        <RedeemCodeModal
          redeemedCodes={save.redeemedCodes}
          onRedeem={handleRedeemCode}
          onPlayClass={(classId) => startRun(classId)}
          onOpenClasses={(selectClassId) => {
            if (selectClassId) {
              updateSave((prev) => ({ ...prev, selectedClass: selectClassId }), 'debounced');
            }
            setActiveModal('classSelect');
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Sanctuary (Permanent Crystal Upgrades & Ascension Rebirth) */}
      {activeModal === 'sanctuary' && (
        <SanctuaryModal
          save={save}
          onBuyUpgrade={handleBuyPermanent}
          onAscend={handleAscend}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Codex (Bestiary, Achievements, Run Records) */}
      {activeModal === 'codex' && (
        <CodexModal
          save={save}
          onClaimAchievement={handleClaimAchievement}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Arquivo da Ascensão (Lore Grimoire, Chapters, 20 Memory Fragments, Guardians, Cinematics) */}
      {activeModal === 'archive' && (
        <AscensionArchiveModal
          save={save}
          onReplayCinematic={(cid) => {
            setCinematicReturnContext('archive');
            setActiveCinematic(cid);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Level-Up 3-Choice Modal */}
      {activeModal === 'levelUp' && levelUpOffer && (
        <LevelUpModal
          offer={levelUpOffer}
          luck={hud?.computedStats.luck ?? 0}
          initialPointerHeld={globalPointerDownRef.current}
          initialHeldKeys={Array.from(globalHeldKeysRef.current)}
          onCommitChoice={handleCommitUpgrade}
          onTransitionComplete={handleLevelUpTransitionComplete}
        />
      )}

      {/* Character Overlay (Inventory, Skills/Synergies, Attributes) */}
      {activeModal === 'character' && hud && (
        <CharacterOverlay hud={hud} initialTab={characterTab} onClose={resumePlaying} />
      )}

      {/* Random Dungeon Event Modal */}
      {activeModal === 'event' && activeEvent && (
        <EventModal event={activeEvent} onSelectChoice={handleResolveEvent} />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && activeModal !== 'settings' && hud && (
        <PauseModal
          floor={hud.floor}
          biomeName={hud.biomeName}
          level={hud.level}
          kills={hud.kills}
          onResume={resumePlaying}
          onRestart={() => startRun()}
          onOpenSettings={() => setActiveModal('settings')}
          onReturnTitle={returnToTitle}
        />
      )}

      {/* Game Over Modal */}
      {gameState === 'gameover' && activeModal !== 'sanctuary' && runSummary && (
        <GameOverModal
          summary={runSummary}
          bestFloor={save.bestFloor}
          onRetry={() => startRun()}
          onOpenSanctuary={() => setActiveModal('sanctuary')}
          onReturnTitle={returnToTitle}
        />
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
        <SettingsModal
          settings={save.settings}
          unlockedSecretClasses={save.unlockedSecretClasses}
          isCloudAccount={Boolean(profile)}
          onUpdate={handleUpdateSettings}
          onResetSave={handleResetSave}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Interactive Dark-Fantasy Cinematics (Intro & Floor 100 Ascension) */}
      {activeCinematic && (
        <CinematicSequence
          cinematicId={activeCinematic}
          onComplete={handleCinematicComplete}
        />
      )}
    </div>
  );
}
