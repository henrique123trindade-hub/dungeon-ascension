import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterOverlay } from './components/CharacterOverlay';
import { ClassSelectModal } from './components/ClassSelectModal';
import { CodexModal } from './components/CodexModal';
import { EventModal } from './components/EventModal';
import { GameHUD } from './components/GameHUD';
import { LevelUpModal } from './components/LevelUpModal';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { SanctuaryModal } from './components/SanctuaryModal';
import { GameOverModal, PauseModal, SettingsModal } from './components/SystemModals';
import { TitleScreen } from './components/TitleScreen';
import { ACHIEVEMENTS } from './game/data/achievements';
import { phaserBridge, type LevelUpOfferPayload } from './game/phaser/PhaserBridge';
import { PhaserCanvas } from './game/phaser/PhaserCanvas';
import { audioEngine } from './game/systems/audioEngine';
import {
  createDefaultSave,
  loadSaveData,
  performAscension,
  persistSaveData,
  purchasePermanentUpgrade,
  syncAchievements,
} from './game/systems/saveManager';
import { redeemSecretCode, type RedeemCodeResult } from './game/systems/secretCodeManager';
import type {
  ActiveEventPayload,
  ActiveModalType,
  ClassId,
  GameStateMode,
  PermanentUpgrades,
  RunHUDSnapshot,
  RunRecord,
  RunSummarySnapshot,
  SaveData,
  SettingsData,
  SynergyId,
  UpgradeOption,
} from './game/types';

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

  const saveRef = useRef(save);
  saveRef.current = save;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;
  const globalPointerDownRef = useRef(false);
  const globalHeldKeysRef = useRef<Set<string>>(new Set());

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

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = syncAchievements(updater(prev)).save;
      persistSaveData(next);
      return next;
    });
  }, []);

  // Mirror game state & custom gameplay reticle visibility to document.body.dataset
  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.reticle = gameState === 'playing' && activeModal === null ? 'true' : 'false';
  }, [gameState, activeModal]);

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
        updateSave((prev) =>
          prev.discoveredSynergies.includes(synergyId)
            ? prev
            : { ...prev, discoveredSynergies: [...prev.discoveredSynergies, synergyId] }
        );
      },
      onEnemyKilled: (id, isBoss) => {
        updateSave((prev) => ({
          ...prev,
          totalKills: prev.totalKills + 1,
          totalBossKills: prev.totalBossKills + (isBoss ? 1 : 0),
          bestiaryKills: {
            ...prev.bestiaryKills,
            [id]: (prev.bestiaryKills[id] ?? 0) + 1,
          },
        }));
      },
      onQuickSaveProgress: (delta) => {
        updateSave((prev) => ({
          ...prev,
          crystals: prev.crystals + delta.crystalsDelta,
          totalCrystalsEarned: prev.totalCrystalsEarned + delta.crystalsDelta,
          bestFloor: Math.max(prev.bestFloor, delta.floor),
          bestLevel: Math.max(prev.bestLevel, delta.level),
        }));
      },
      onRunEnded: (summary) => {
        setRunSummary(summary);
        setActiveModal(null);
        setLevelUpOffer(null);
        setActiveEvent(null);
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

        updateSave((prev) => ({
          ...prev,
          totalRuns: prev.totalRuns + 1,
          bestFloor: Math.max(prev.bestFloor, summary.floor),
          bestLevel: Math.max(prev.bestLevel, summary.level),
          records: [record, ...prev.records]
            .sort((a, b) => b.floor - a.floor || b.level - a.level)
            .slice(0, 20),
        }));
      },
    });
    return () => phaserBridge.setCallbacks(null);
  }, [updateSave]);

  const startRun = useCallback((overrideClass?: ClassId) => {
    const cls = overrideClass ?? saveRef.current.selectedClass;
    if (overrideClass && overrideClass !== saveRef.current.selectedClass) {
      updateSave((prev) => ({ ...prev, selectedClass: overrideClass }));
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    audioEngine.playUiClick();
    setActiveModal(null);
    setLevelUpOffer(null);
    setActiveEvent(null);
    setRunSummary(null);
    document.body.dataset.state = 'playing';
    setGameState('playing');
    phaserBridge.getController()?.startNewRun(cls, saveRef.current);
  }, [updateSave]);

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
    document.body.dataset.state = 'title';
    setGameState('title');
  }, []);

  const openCharacterTab = useCallback((tab: 'inventory' | 'skills' | 'stats') => {
    if (gameStateRef.current !== 'playing') return;
    if (activeModalRef.current === 'levelUp' || activeModalRef.current === 'event') return;
    setCharacterTab(tab);
    setActiveModal('character');
    phaserBridge.getController()?.setPaused(true);
  }, []);

  const toggleMute = useCallback(() => {
    updateSave((prev) => ({
      ...prev,
      settings: { ...prev.settings, muted: !prev.settings.muted },
    }));
  }, [updateSave]);

  // Global keyboard shortcuts during play / pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
  }, [characterTab, openCharacterTab, openPause, resumePlaying, toggleMute]);

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
        updateSave(() => next);
      }
    },
    [updateSave]
  );

  const handleAscend = useCallback(() => {
    const next = performAscension(saveRef.current);
    if (next) {
      audioEngine.playLevelUp('mythic');
      updateSave(() => next);
    }
  }, [updateSave]);

  const handleClaimAchievement = useCallback(
    (achievementId: string) => {
      const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!def) return;
      updateSave((prev) => {
        if (prev.claimedAchievements.includes(achievementId)) return prev;
        if (!def.check(prev).done) return prev;
        audioEngine.playPickup('crystal');
        return {
          ...prev,
          crystals: prev.crystals + def.rewardCrystals,
          totalCrystalsEarned: prev.totalCrystalsEarned + def.rewardCrystals,
          claimedAchievements: [...prev.claimedAchievements, achievementId],
        };
      });
    },
    [updateSave]
  );

  const handleUpdateSettings = useCallback(
    (nextSettings: SettingsData) => {
      updateSave((prev) => ({ ...prev, settings: nextSettings }));
    },
    [updateSave]
  );

  const handleResetSave = useCallback(() => {
    const fresh = createDefaultSave();
    persistSaveData(fresh);
    setSave(fresh);
    setActiveModal(null);
  }, []);

  const handleRedeemCode = useCallback(
    (rawCode: string): RedeemCodeResult => {
      const result = redeemSecretCode(saveRef.current, rawCode);
      if (result.status === 'success') {
        audioEngine.playSecretUnlock(result.codeDef?.theme);
        updateSave(() => result.save);
      } else {
        audioEngine.playUiClick();
      }
      return result;
    },
    [updateSave]
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0a0e]">
      {/* Isolated Phaser 3 WebGL + Arcade Physics Engine */}
      <PhaserCanvas onReady={() => setPhaserReady(true)} />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          save={save}
          onStartRun={() => startRun()}
          onOpenClassSelect={() => setActiveModal('classSelect')}
          onOpenSanctuary={() => setActiveModal('sanctuary')}
          onOpenCodex={() => setActiveModal('codex')}
          onOpenRedeemCode={() => setActiveModal('redeemCode')}
          onOpenSettings={() => setActiveModal('settings')}
          hasModalOpen={activeModal !== null}
        />
      )}

      {/* Active Gameplay HUD */}
      {(gameState === 'playing' || gameState === 'paused') && hud && (
        <GameHUD
          hud={hud}
          settings={save.settings}
          onOpenCharacterTab={openCharacterTab}
          onToggleMute={toggleMute}
          onOpenPause={openPause}
        />
      )}

      {/* Class Selection Modal */}
      {activeModal === 'classSelect' && (
        <ClassSelectModal
          selectedClass={save.selectedClass}
          unlockedSecretClasses={save.unlockedSecretClasses}
          onSelectClass={(id) => updateSave((prev) => ({ ...prev, selectedClass: id }))}
          onStartWithClass={(id) => startRun(id)}
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
              updateSave((prev) => ({ ...prev, selectedClass: selectClassId }));
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
          onUpdate={handleUpdateSettings}
          onResetSave={handleResetSave}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
