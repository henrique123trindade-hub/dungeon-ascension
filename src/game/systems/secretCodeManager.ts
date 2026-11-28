import {
  findSecretCodeDef,
  matchesSecretCodeEntry,
  normalizeSecretCode,
  type SecretCodeDef,
} from '../data/secretCodes';
import type { SaveData } from '../types';

export type RedeemCodeStatus = 'empty' | 'invalid' | 'already_redeemed' | 'success' | 'rate_limited';

export interface RedeemCodeResult {
  status: RedeemCodeStatus;
  message: string;
  save: SaveData;
  codeDef?: SecretCodeDef;
}

/**
 * Applies a validated SecretCodeDef to a SaveData object with strict duplicate protection.
 * Used both after server-side validation (`/api/codes/redeem`) and in offline/unit-test paths.
 */
export function applyValidatedSecretCode(
  save: SaveData,
  def: SecretCodeDef,
  storedKeyOverride?: string
): RedeemCodeResult {
  const alreadyRedeemed =
    save.redeemedCodes.some((entry) => matchesSecretCodeEntry(entry, def)) ||
    (def.reward.type === 'unlock_class' && save.unlockedSecretClasses.includes(def.reward.classId));

  if (alreadyRedeemed) {
    return {
      status: 'already_redeemed',
      message: 'Este código já foi resgatado nesta conta.',
      save,
      codeDef: def,
    };
  }

  const storedKey = normalizeSecretCode(storedKeyOverride || def.code || def.id);
  let nextSave: SaveData = {
    ...save,
    redeemedCodes: Array.from(new Set([...save.redeemedCodes, storedKey])),
  };

  if (def.reward.type === 'unlock_class') {
    nextSave = {
      ...nextSave,
      unlockedSecretClasses: Array.from(new Set([...nextSave.unlockedSecretClasses, def.reward.classId])),
    };
  } else if (def.reward.type === 'crystals') {
    nextSave = {
      ...nextSave,
      crystals: nextSave.crystals + def.reward.amount,
      totalCrystalsEarned: nextSave.totalCrystalsEarned + def.reward.amount,
    };
  }

  return {
    status: 'success',
    message: `Código resgatado com sucesso! ${def.subtitle}: ${def.title}.`,
    save: nextSave,
    codeDef: def,
  };
}

/**
 * Pure, deterministic redemption handler with duplicate protection and centralized reward application.
 */
export function redeemSecretCode(save: SaveData, rawInput: string): RedeemCodeResult {
  const normalized = normalizeSecretCode(rawInput);
  if (!normalized) {
    return {
      status: 'empty',
      message: 'Digite um código secreto para resgatar.',
      save,
    };
  }

  const def = findSecretCodeDef(normalized);
  if (!def) {
    return {
      status: 'invalid',
      message: 'Código inválido. Verifique a grafia e tente novamente.',
      save,
    };
  }

  return applyValidatedSecretCode(save, def, normalized);
}
