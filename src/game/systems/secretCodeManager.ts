import { findSecretCodeDef, normalizeSecretCode, type SecretCodeDef } from '../data/secretCodes';
import type { SaveData } from '../types';

export type RedeemCodeStatus = 'empty' | 'invalid' | 'already_redeemed' | 'success';

export interface RedeemCodeResult {
  status: RedeemCodeStatus;
  message: string;
  save: SaveData;
  codeDef?: SecretCodeDef;
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

  const alreadyRedeemed =
    save.redeemedCodes.includes(def.code) ||
    (def.reward.type === 'unlock_class' && save.unlockedSecretClasses.includes(def.reward.classId));

  if (alreadyRedeemed) {
    return {
      status: 'already_redeemed',
      message: 'Este código já foi resgatado nesta conta.',
      save,
      codeDef: def,
    };
  }

  let nextSave: SaveData = {
    ...save,
    redeemedCodes: Array.from(new Set([...save.redeemedCodes, def.code])),
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
