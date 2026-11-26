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

export interface SecretCodeDef {
  id: string;
  /** Stored lowercase trimmed key for case-insensitive matching */
  code: string;
  title: string;
  subtitle: string;
  description: string;
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
    reward: {
      type: 'unlock_class',
      classId: 'slatt',
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
