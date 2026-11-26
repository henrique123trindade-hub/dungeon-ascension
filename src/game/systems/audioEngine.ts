import type { Rarity, SettingsData } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.7;
  private sfxVolume = 0.85;
  private muted = false;

  public applySettings(settings: SettingsData) {
    this.masterVolume = settings.masterVolume;
    this.sfxVolume = settings.sfxVolume;
    this.muted = settings.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0 || this.sfxVolume <= 0) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private gainLevel(base: number): number {
    return Math.min(0.45, base * this.masterVolume * this.sfxVolume);
  }

  private pitchJitter(freq: number, pct = 0.08): number {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  private playTone(opts: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    delay?: number;
  }) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(24, opts.freqStart), now);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.freqEnd), now + opts.duration);
    }
    const peak = this.gainLevel(opts.gain);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + opts.duration + 0.02);
  }

  public playAttack(style: 'melee' | 'dagger' | 'arcane' | 'bow' | 'banana') {
    if (style === 'melee') {
      this.playTone({
        type: 'sawtooth',
        freqStart: this.pitchJitter(190),
        freqEnd: 70,
        duration: 0.11,
        gain: 0.14,
      });
    } else if (style === 'dagger') {
      this.playTone({
        type: 'triangle',
        freqStart: this.pitchJitter(680),
        freqEnd: 260,
        duration: 0.075,
        gain: 0.12,
      });
    } else if (style === 'bow') {
      this.playTone({
        type: 'triangle',
        freqStart: this.pitchJitter(420),
        freqEnd: 165,
        duration: 0.09,
        gain: 0.12,
      });
    } else if (style === 'banana') {
      // Crisp spinning boomerang-like banana toss whoosh
      this.playTone({
        type: 'sine',
        freqStart: this.pitchJitter(340),
        freqEnd: 610,
        duration: 0.065,
        gain: 0.11,
      });
      this.playTone({
        type: 'triangle',
        freqStart: this.pitchJitter(590),
        freqEnd: 290,
        duration: 0.08,
        gain: 0.09,
        delay: 0.03,
      });
    } else {
      this.playTone({
        type: 'sine',
        freqStart: this.pitchJitter(520),
        freqEnd: 290,
        duration: 0.11,
        gain: 0.13,
      });
    }
  }

  public playHit(isCrit: boolean) {
    if (isCrit) {
      this.playTone({
        type: 'sawtooth',
        freqStart: this.pitchJitter(540),
        freqEnd: 180,
        duration: 0.14,
        gain: 0.18,
      });
      this.playTone({
        type: 'triangle',
        freqStart: this.pitchJitter(980),
        freqEnd: 1320,
        duration: 0.12,
        gain: 0.14,
        delay: 0.02,
      });
    } else {
      this.playTone({
        type: 'square',
        freqStart: this.pitchJitter(170),
        freqEnd: 75,
        duration: 0.07,
        gain: 0.1,
      });
    }
  }

  public playEnemyDeath(isBoss = false) {
    if (isBoss) {
      this.playTone({ type: 'sawtooth', freqStart: 140, freqEnd: 38, duration: 0.55, gain: 0.28 });
      this.playTone({ type: 'triangle', freqStart: 320, freqEnd: 640, duration: 0.4, gain: 0.2, delay: 0.15 });
      this.playTone({ type: 'sine', freqStart: 480, freqEnd: 960, duration: 0.45, gain: 0.18, delay: 0.3 });
    } else {
      this.playTone({
        type: 'sawtooth',
        freqStart: this.pitchJitter(240),
        freqEnd: 62,
        duration: 0.14,
        gain: 0.14,
      });
    }
  }

  public playDash() {
    this.playTone({
      type: 'sine',
      freqStart: this.pitchJitter(310),
      freqEnd: 120,
      duration: 0.12,
      gain: 0.14,
    });
  }

  public playSkill(element: string) {
    switch (element) {
      case 'fire':
        this.playTone({ type: 'sawtooth', freqStart: 220, freqEnd: 58, duration: 0.24, gain: 0.2 });
        break;
      case 'lightning':
        this.playTone({ type: 'square', freqStart: 920, freqEnd: 240, duration: 0.16, gain: 0.16 });
        this.playTone({ type: 'square', freqStart: 1280, freqEnd: 380, duration: 0.12, gain: 0.12, delay: 0.04 });
        break;
      case 'ice':
        this.playTone({ type: 'sine', freqStart: 1120, freqEnd: 620, duration: 0.28, gain: 0.16 });
        break;
      case 'gravity':
        this.playTone({ type: 'sine', freqStart: 95, freqEnd: 46, duration: 0.35, gain: 0.22 });
        break;
      case 'primate':
        this.playTone({ type: 'triangle', freqStart: 320, freqEnd: 560, duration: 0.12, gain: 0.15 });
        this.playTone({ type: 'sine', freqStart: 560, freqEnd: 260, duration: 0.14, gain: 0.13, delay: 0.07 });
        break;
      default:
        this.playTone({ type: 'triangle', freqStart: 460, freqEnd: 180, duration: 0.2, gain: 0.17 });
        break;
    }
  }

  public playSlattSkill(kind: 'banana_bomb' | 'banana_peel' | 'primate_fury' | 'banana_rain' | 'peel_slip') {
    if (kind === 'banana_bomb') {
      this.playTone({ type: 'sine', freqStart: 360, freqEnd: 720, duration: 0.1, gain: 0.14 });
      this.playTone({ type: 'sawtooth', freqStart: 220, freqEnd: 68, duration: 0.22, gain: 0.18, delay: 0.06 });
    } else if (kind === 'banana_peel') {
      this.playTone({ type: 'triangle', freqStart: 520, freqEnd: 300, duration: 0.09, gain: 0.12 });
      this.playTone({ type: 'sine', freqStart: 640, freqEnd: 420, duration: 0.08, gain: 0.1, delay: 0.06 });
    } else if (kind === 'peel_slip') {
      this.playTone({ type: 'sine', freqStart: 660, freqEnd: 240, duration: 0.12, gain: 0.11 });
    } else if (kind === 'primate_fury') {
      // Energetic primal battle-cry triad
      this.playTone({ type: 'sawtooth', freqStart: 260, freqEnd: 440, duration: 0.14, gain: 0.16 });
      this.playTone({ type: 'triangle', freqStart: 440, freqEnd: 660, duration: 0.16, gain: 0.16, delay: 0.09 });
      this.playTone({ type: 'triangle', freqStart: 587, freqEnd: 880, duration: 0.2, gain: 0.15, delay: 0.18 });
    } else {
      // Banana rain whistle + barrage
      this.playTone({ type: 'sine', freqStart: 880, freqEnd: 320, duration: 0.22, gain: 0.14 });
      this.playTone({ type: 'triangle', freqStart: 620, freqEnd: 240, duration: 0.2, gain: 0.12, delay: 0.1 });
    }
  }

  public playSecretUnlock() {
    const notes = [330, 440, 554, 659, 880, 1108];
    this.playTone({ type: 'sine', freqStart: 165, freqEnd: 220, duration: 0.65, gain: 0.14 });
    notes.forEach((n, idx) => {
      this.playTone({
        type: idx >= 3 ? 'triangle' : 'sine',
        freqStart: n,
        freqEnd: n * 1.02,
        duration: 0.34,
        gain: 0.15,
        delay: idx * 0.07,
      });
    });
  }

  public playPlayerHurt() {
    this.playTone({ type: 'sawtooth', freqStart: 155, freqEnd: 52, duration: 0.18, gain: 0.22 });
  }

  public playPickup(kind: 'xp' | 'gold' | 'crystal' | 'gear') {
    if (kind === 'xp') {
      this.playTone({ type: 'sine', freqStart: this.pitchJitter(640), freqEnd: 880, duration: 0.07, gain: 0.07 });
    } else if (kind === 'gold') {
      this.playTone({ type: 'triangle', freqStart: this.pitchJitter(980), freqEnd: 1360, duration: 0.09, gain: 0.1 });
    } else if (kind === 'crystal') {
      this.playTone({ type: 'sine', freqStart: 740, freqEnd: 1180, duration: 0.15, gain: 0.14 });
      this.playTone({ type: 'sine', freqStart: 1180, freqEnd: 1560, duration: 0.14, gain: 0.11, delay: 0.06 });
    } else {
      this.playTone({ type: 'triangle', freqStart: 520, freqEnd: 780, duration: 0.14, gain: 0.15 });
      this.playTone({ type: 'triangle', freqStart: 780, freqEnd: 1040, duration: 0.18, gain: 0.13, delay: 0.08 });
    }
  }

  public playLevelUp(highestRarity: Rarity) {
    const notes =
      highestRarity === 'mythic'
        ? [440, 554, 659, 880, 1108, 1318]
        : highestRarity === 'legendary'
          ? [392, 494, 587, 784, 988]
          : [330, 440, 554, 659];
    // Warm resonant foundation chord
    this.playTone({
      type: 'sine',
      freqStart: 165,
      freqEnd: 220,
      duration: 0.42,
      gain: 0.12,
    });
    notes.forEach((n, idx) => {
      this.playTone({
        type: highestRarity === 'mythic' || highestRarity === 'legendary' ? 'triangle' : 'sine',
        freqStart: n,
        duration: 0.26,
        gain: 0.15,
        delay: idx * 0.06,
      });
    });
  }

  public playUpgradeSelect(rarity: Rarity) {
    const base =
      rarity === 'mythic'
        ? 659
        : rarity === 'legendary'
          ? 587
          : rarity === 'epic'
            ? 523
            : rarity === 'rare'
              ? 494
              : 440;
    this.playTone({
      type: 'triangle',
      freqStart: base,
      freqEnd: base * 1.25,
      duration: 0.13,
      gain: 0.14,
    });
    this.playTone({
      type: 'sine',
      freqStart: base * 1.5,
      freqEnd: base * 2,
      duration: 0.18,
      gain: rarity === 'mythic' || rarity === 'legendary' ? 0.16 : 0.11,
      delay: 0.045,
    });
  }

  public playPortalOpen() {
    this.playTone({ type: 'sine', freqStart: 220, freqEnd: 520, duration: 0.35, gain: 0.18 });
    this.playTone({ type: 'triangle', freqStart: 330, freqEnd: 660, duration: 0.32, gain: 0.14, delay: 0.1 });
  }

  public playBossTelegraph() {
    this.playTone({ type: 'sawtooth', freqStart: 120, freqEnd: 310, duration: 0.28, gain: 0.16 });
  }

  public playDefeat() {
    [293, 261, 220, 164].forEach((n, idx) => {
      this.playTone({ type: 'sawtooth', freqStart: n, freqEnd: n * 0.92, duration: 0.26, gain: 0.16, delay: idx * 0.12 });
    });
  }

  public playUiClick() {
    this.playTone({ type: 'triangle', freqStart: 420, freqEnd: 320, duration: 0.05, gain: 0.08 });
  }
}

export const audioEngine = new AudioEngine();
