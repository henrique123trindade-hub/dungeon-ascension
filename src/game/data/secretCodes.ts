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
  /** Stored lowercase trimmed key for case-insensitive matching */
  code: string;
  title: string;
  subtitle: string;
  description: string;
  theme: SecretUnlockTheme;
  reward: SecretCodeReward;
}

/**
 * Centralized registry of redeemable secret codes.
 * Add new codes and reward payloads here to expand the system cleanly.
 */
export const SECRET_CODES: ReadonlyArray<SecretCodeDef> = [
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

export function normalizeSecretCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export function findSecretCodeDef(raw: string): SecretCodeDef | undefined {
  const normalized = normalizeSecretCode(raw);
  if (!normalized) return undefined;
  return SECRET_CODES.find((entry) => entry.code === normalized);
}
