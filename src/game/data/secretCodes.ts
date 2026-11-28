import type { ClassId } from '../types';

export type SecretCodeReward =
  | {
      type: 'unlock_class';
      classId: ClassId;
    }
  | {
      type: 'crystals';
      amount: number;
    };

export type SecretUnlockTheme = 'gold' | 'tricolor' | 'colorado';

export interface SecretCodeDef {
  id: string;
  /** Populated dynamically upon verified redemption; never hardcoded in client bundle */
  code: string;
  /** Deterministic salted digest used for offline/test matching without storing plaintext codes */
  codeDigest: string;
  title: string;
  subtitle: string;
  description: string;
  theme: SecretUnlockTheme;
  reward: SecretCodeReward;
}

/**
 * Computes a deterministic 64-bit salted digest (two independent 32-bit FNV-1a lanes)
 * for case-insensitive secret code matching without exposing plaintext codes in public frontend bundles.
 */
export function computeSecretCodeDigest(normalizedCode: string): string {
  const saltedA = `da_sec_v2::${normalizedCode}::vault`;
  const saltedB = `ascension::${normalizedCode.split('').reverse().join('')}::key`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < saltedA.length; i++) {
    h1 ^= saltedA.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  let h2 = 0x9e3779b1;
  for (let i = 0; i < saltedB.length; i++) {
    h2 ^= saltedB.charCodeAt(i);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function normalizeSecretCode(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Centralized metadata registry of redeemable secret rewards.
 * Plaintext secret code strings are validated on the server (`/api/codes/redeem`)
 * and never embedded in client source code.
 */
export const SECRET_CODES: ReadonlyArray<SecretCodeDef> = [
  {
    id: 'secret_slatt_monkeyslatt',
    code: '',
    codeDigest: '8e8855c2f77e01b4',
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
    code: '',
    codeDigest: '8c7f64f4fd8e964a',
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
    code: '',
    codeDigest: '9ce63db1460d82d1',
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

export function findSecretCodeDefById(id: string): SecretCodeDef | undefined {
  return SECRET_CODES.find((entry) => entry.id === id);
}

export function findSecretCodeDef(raw: string): SecretCodeDef | undefined {
  const normalized = normalizeSecretCode(raw);
  if (!normalized) return undefined;
  const byId = SECRET_CODES.find((entry) => entry.id === normalized);
  if (byId) return byId;
  const digest = computeSecretCodeDigest(normalized);
  const matched = SECRET_CODES.find((entry) => entry.codeDigest === digest);
  if (!matched) return undefined;
  return { ...matched, code: normalized };
}

export function matchesSecretCodeEntry(storedKey: string, def: SecretCodeDef): boolean {
  const normalized = normalizeSecretCode(storedKey);
  if (!normalized) return false;
  if (normalized === def.id) return true;
  return computeSecretCodeDigest(normalized) === def.codeDigest;
}
