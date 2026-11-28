import crypto from 'node:crypto';
import type { SecretCodeReward, SecretUnlockTheme } from '../game/data/secretCodes';

export interface ServerSecretCodeEntry {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  theme: SecretUnlockTheme;
  reward: SecretCodeReward;
}

/**
 * Server-only canonical secret code registry.
 * Never imported by client-side bundles so secret codes stay off public frontend code.
 */
const SERVER_SECRET_CODES: ReadonlyArray<ServerSecretCodeEntry> = [
  {
    id: 'secret_slatt_monkeyslatt',
    code: 'monkeyslatt',
    title: 'Slatt',
    subtitle: 'Classe Secreta Desbloqueada',
    description:
      'O primata lendário das masmorras desperta permanentemente na seleção de classes, equipado com bananas explosivas, cascas traiçoeiras, Fúria Primata, Chuva de Bananas e Instinto Primata.',
    theme: 'gold',
    reward: {
      type: 'unlock_class',
      classId: 'slatt',
    },
  },
  {
    id: 'secret_farid_1903',
    code: 'farid1903',
    title: 'Farid',
    subtitle: 'Classe Secreta Tricolor Desbloqueada',
    description:
      'O lendário guerreiro tricolor entra permanentemente na seleção de classes! Com óculos azuis, barba branca e energia imortal, domina o campo com Chute Tricolor perfurante, escudo Imortal, Avalanche Tricolor e Glória Imortal.',
    theme: 'tricolor',
    reward: {
      type: 'unlock_class',
      classId: 'farid',
    },
  },
  {
    id: 'secret_baldasso_1909',
    code: 'baldasso1909',
    title: 'Baldasso',
    subtitle: 'Classe Secreta Colorada Desbloqueada',
    description:
      'A fúria incandescente do Beira-Rio desperta permanentemente na seleção de classes! Carregado de sangue colorado, destrói hordas com Chute Colorado explosivo, Muralha Colorada, Fúria do Beira-Rio e Inferno Colorado.',
    theme: 'colorado',
    reward: {
      type: 'unlock_class',
      classId: 'baldasso',
    },
  },
];

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = crypto.createHash('sha256').update(a).digest();
  const bufB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

export function validateSecretCodeOnServer(rawInput: string): ServerSecretCodeEntry | null {
  if (typeof rawInput !== 'string') return null;
  const normalized = rawInput.trim().toLowerCase();
  if (!normalized || normalized.length > 48) return null;

  let matched: ServerSecretCodeEntry | null = null;
  for (const entry of SERVER_SECRET_CODES) {
    if (constantTimeEquals(normalized, entry.code)) {
      matched = entry;
    }
  }
  return matched;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 20, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string, nowMs = Date.now()): RateLimitDecision {
    const cutoff = nowMs - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSec };
    }
    recent.push(nowMs);
    this.hits.set(key, recent);

    // Opportunistic pruning to keep memory bounded
    if (this.hits.size > 2000) {
      for (const [k, timestamps] of this.hits.entries()) {
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
          this.hits.delete(k);
        }
      }
    }

    return { allowed: true, retryAfterSec: 0 };
  }
}
