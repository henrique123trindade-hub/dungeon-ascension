import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from '../../lib/firebase';
import { findSecretCodeDefById, matchesSecretCodeEntry, SECRET_CODES, type SecretCodeDef } from '../data/secretCodes';
import type {
  AuthProviderType,
  AvatarId,
  ClassId,
  PlayerAccountMeta,
  PlayerProfileData,
  RunRecord,
  SaveData,
} from '../types';
import {
  computeFavoriteClass,
  createResetSavePreservingSecrets,
  validateUsername,
} from './accountLogic';
import { createDefaultSave, validateAndMigrateSave } from './saveManager';
import { mergeNarrativeProgress } from './narrativeManager';
import { applyValidatedSecretCode, redeemSecretCode, type RedeemCodeResult } from './secretCodeManager';

const ACCOUNT_CACHE_PREFIX = 'dungeon_ascension_account_save_v1_';

export interface LoadedAccountBundle {
  profile: PlayerProfileData;
  account: PlayerAccountMeta;
  save: SaveData;
  redeemedCodeIds: string[];
}

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function getAuthProviderFromUser(user: User): AuthProviderType {
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  return hasGoogle ? 'google' : 'password';
}

export function translateAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const msg = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este endereço de e-mail já está cadastrado. Tente entrar ou recuperar sua senha.';
    case 'auth/invalid-email':
      return 'Endereço de e-mail inválido.';
    case 'auth/weak-password':
      return 'A senha escolhida é muito fraca. Use pelo menos 8 caracteres com letras e números.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'O login com Google foi cancelado antes da conclusão.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta cadastrada com este e-mail usando outro método de login.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet no momento. Verifique sua rede e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login por e-mail e senha ainda não foi ativado no console do Firebase deste projeto. Use "Entrar com Google" ou ative o provedor E-mail/Senha no Firebase Console.';
    case 'auth/requires-recent-login':
      return 'Por segurança, entre novamente na sua conta para concluir esta ação.';
    default:
      if (msg.includes('USERNAME_TAKEN')) {
        return 'Este nome de usuário já está em uso. Escolha outro nome.';
      }
      if (msg.includes('MISSING_OR_INSUFFICIENT_PERMISSIONS') || msg.includes('Missing or insufficient permissions')) {
        return 'Permissão negada ao salvar na nuvem. Verifique se seu e-mail está confirmado.';
      }
      return 'Não foi possível concluir a operação agora. Tente novamente em instantes.';
  }
}

export function loadCachedAccountSave(uid: string): SaveData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${ACCOUNT_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    return validateAndMigrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistCachedAccountSave(uid: string, save: SaveData): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`${ACCOUNT_CACHE_PREFIX}${uid}`, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors
  }
}

function buildSaveDocPayload(uid: string, saveInput: SaveData) {
  const s = validateAndMigrateSave(saveInput);
  return {
    uid,
    saveVersion: Math.max(1, Math.floor(s.saveVersion)),
    schemaVersion: 1,
    crystals: Math.min(10000000, Math.max(0, Math.floor(s.crystals))),
    totalCrystalsEarned: Math.min(50000000, Math.max(0, Math.floor(s.totalCrystalsEarned))),
    ascensionLevel: Math.min(1000, Math.max(0, Math.floor(s.ascensionLevel))),
    selectedClass: s.selectedClass,
    permanentUpgrades: {
      startingDamage: Math.min(25, Math.max(0, Math.floor(s.permanentUpgrades.startingDamage))),
      startingHp: Math.min(25, Math.max(0, Math.floor(s.permanentUpgrades.startingHp))),
      luck: Math.min(20, Math.max(0, Math.floor(s.permanentUpgrades.luck))),
      xpGain: Math.min(20, Math.max(0, Math.floor(s.permanentUpgrades.xpGain))),
      goldGain: Math.min(20, Math.max(0, Math.floor(s.permanentUpgrades.goldGain))),
      resistance: Math.min(20, Math.max(0, Math.floor(s.permanentUpgrades.resistance))),
      rareLootChance: Math.min(15, Math.max(0, Math.floor(s.permanentUpgrades.rareLootChance))),
    },
    bestFloor: Math.min(9999, Math.max(0, Math.floor(s.bestFloor))),
    bestLevel: Math.min(9999, Math.max(1, Math.floor(s.bestLevel))),
    totalKills: Math.min(100000000, Math.max(0, Math.floor(s.totalKills))),
    totalBossKills: Math.min(10000000, Math.max(0, Math.floor(s.totalBossKills))),
    totalRuns: Math.min(1000000, Math.max(0, Math.floor(s.totalRuns))),
    totalPlayTimeSec: Math.min(1000000000, Math.max(0, Math.floor(s.totalPlayTimeSec))),
    bestiaryKills: s.bestiaryKills,
    discoveredSynergies: s.discoveredSynergies.slice(0, 16),
    unlockedAchievements: s.unlockedAchievements.slice(0, 64),
    claimedAchievements: s.claimedAchievements.slice(0, 64),
    redeemedCodes: s.redeemedCodes.slice(0, 64),
    unlockedSecretClasses: s.unlockedSecretClasses.slice(0, 16),
    records: s.records.slice(0, 20),
    settings: {
      masterVolume: Math.min(1, Math.max(0, Number(s.settings.masterVolume))),
      sfxVolume: Math.min(1, Math.max(0, Number(s.settings.sfxVolume))),
      muted: Boolean(s.settings.muted),
      graphicsQuality: s.settings.graphicsQuality,
      screenShake: Boolean(s.settings.screenShake),
      damageNumbers: Boolean(s.settings.damageNumbers),
      mobileControls: s.settings.mobileControls,
      autoAttack: Boolean(s.settings.autoAttack),
      showAttackRange: Boolean(s.settings.showAttackRange),
      defaultCastMode: s.settings.defaultCastMode,
      dashCastMode: s.settings.dashCastMode,
      skillCastModes: s.settings.skillCastModes ?? {},
      skipRepeatedTransitions: Boolean(s.settings.skipRepeatedTransitions),
    },
    narrative: {
      introSeen: Boolean(s.narrative.introSeen),
      discoveredChapters: s.narrative.discoveredChapters.slice(0, 10),
      reachedBiomes: s.narrative.reachedBiomes.slice(0, 10),
      collectedFragments: s.narrative.collectedFragments.slice(0, 32),
      discoveredBosses: s.narrative.discoveredBosses.slice(0, 16),
      defeatedBosses: s.narrative.defeatedBosses.slice(0, 16),
      unlockedCinematics: s.narrative.unlockedCinematics.slice(0, 8),
      unlockedRevelations: s.narrative.unlockedRevelations.slice(0, 10),
      triggeredWhispers: s.narrative.triggeredWhispers.slice(0, 16),
      infiniteAscensionUnlocked: Boolean(s.narrative.infiniteAscensionUnlocked),
    },
    updatedAt: serverTimestamp(),
  };
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  return result.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return result.user;
}

export async function registerWithEmailPassword(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const check = validateUsername(username);
  if (!check.valid) {
    throw new Error(check.error || 'Nome de usuário inválido.');
  }
  const available = await checkUsernameAvailable(check.username);
  if (!available) {
    throw new Error('USERNAME_TAKEN');
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  await updateProfile(cred.user, { displayName: check.username });
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function checkUsernameAvailable(rawUsername: string, currentUid?: string): Promise<boolean> {
  const parsed = validateUsername(rawUsername);
  if (!parsed.valid) return false;
  const path = `usernames/${parsed.usernameLower}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', parsed.usernameLower));
    if (!snap.exists()) return true;
    const data = snap.data();
    return Boolean(currentUid && data?.uid === currentUid);
  } catch (error) {
    // Allow form to stay responsive on transient offline checks
    if (error instanceof Error && error.message.includes('offline')) {
      return true;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function loadAccountBundle(user: User): Promise<LoadedAccountBundle | null> {
  const uid = user.uid;
  const profilePath = `players/${uid}`;
  const accountPath = `players/${uid}/private/account`;
  const savePath = `players/${uid}/private/save`;
  const redemptionsPath = `players/${uid}/redemptions`;

  try {
    const [profileSnap, accountSnap, saveSnap] = await Promise.all([
      getDoc(doc(db, 'players', uid)),
      getDoc(doc(db, 'players', uid, 'private', 'account')),
      getDoc(doc(db, 'players', uid, 'private', 'save')),
    ]);

    if (!profileSnap.exists() || !accountSnap.exists() || !saveSnap.exists()) {
      return null;
    }

    let redeemedCodeIds: string[] = [];
    try {
      const redemptionsQ = query(collection(db, 'players', uid, 'redemptions'), where('uid', '==', uid));
      const redemptionsSnap = await getDocs(redemptionsQ);
      redeemedCodeIds = redemptionsSnap.docs.map((d) => d.id);
    } catch {
      // Non-fatal if empty/unindexed
    }

    const p = profileSnap.data();
    const a = accountSnap.data();
    const sRaw = saveSnap.data();

    // Reconcile immutable redemptions ledger with cloud save
    const combinedRedeemed = Array.from(
      new Set([...(Array.isArray(sRaw.redeemedCodes) ? sRaw.redeemedCodes : []), ...redeemedCodeIds])
    );
    const save = validateAndMigrateSave({
      ...sRaw,
      redeemedCodes: combinedRedeemed,
    });

    const profile: PlayerProfileData = {
      uid,
      username: String(p.username ?? ''),
      usernameLower: String(p.usernameLower ?? ''),
      avatarId: (p.avatarId as AvatarId) ?? 'crest_emblem',
      equippedTitle: String(p.equippedTitle ?? 'novato_masmorra'),
      favoriteClass: (p.favoriteClass as ClassId) ?? save.selectedClass,
      publicProfile: typeof p.publicProfile === 'boolean' ? p.publicProfile : true,
      bestFloor: Number(p.bestFloor ?? save.bestFloor),
      bestLevel: Number(p.bestLevel ?? save.bestLevel),
      totalKills: Number(p.totalKills ?? save.totalKills),
      totalBossKills: Number(p.totalBossKills ?? save.totalBossKills),
      totalRuns: Number(p.totalRuns ?? save.totalRuns),
      totalPlayTimeSec: Number(p.totalPlayTimeSec ?? save.totalPlayTimeSec),
      ascensionLevel: Number(p.ascensionLevel ?? save.ascensionLevel),
      achievementsCount: Number(p.achievementsCount ?? save.unlockedAchievements.length),
      createdAtIso: tsToIso(p.createdAt),
      updatedAtIso: tsToIso(p.updatedAt),
      lastLoginAtIso: tsToIso(p.lastLoginAt),
    };

    const account: PlayerAccountMeta = {
      uid,
      email: String(a.email ?? user.email ?? ''),
      emailVerified: Boolean(user.emailVerified),
      authProvider: a.authProvider === 'google' ? 'google' : 'password',
      role: 'player',
      localMigrated: Boolean(a.localMigrated),
      createdAtIso: tsToIso(a.createdAt),
      lastLoginAtIso: tsToIso(a.lastLoginAt),
    };

    // Touch lastLoginAt quietly when email is verified
    if (user.emailVerified) {
      void Promise.all([
        updateDoc(doc(db, 'players', uid, 'private', 'account'), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'players', uid), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ]).catch(() => {
        // Non-critical login timestamp touch
      });
    }

    persistCachedAccountSave(uid, save);
    return { profile, account, save, redeemedCodeIds };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${profilePath} | ${accountPath} | ${savePath} | ${redemptionsPath}`);
  }
}

export async function createInitialAccountDocs(params: {
  user: User;
  username: string;
  avatarId: AvatarId;
  initialSave?: SaveData;
  markLocalMigrated?: boolean;
}): Promise<LoadedAccountBundle> {
  const { user, avatarId } = params;
  const uid = user.uid;
  const parsed = validateUsername(params.username);
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Nome de usuário inválido.');
  }

  const baseSave = validateAndMigrateSave(params.initialSave ?? createDefaultSave());
  const favoriteClass = computeFavoriteClass(baseSave);
  const authProvider = getAuthProviderFromUser(user);
  const email = (user.email || `${uid}@dungeonascension.local`).trim().toLowerCase().slice(0, 160);

  const usernameRef = doc(db, 'usernames', parsed.usernameLower);
  const profileRef = doc(db, 'players', uid);
  const accountRef = doc(db, 'players', uid, 'private', 'account');
  const saveRef = doc(db, 'players', uid, 'private', 'save');

  try {
    await runTransaction(db, async (tx) => {
      const existingUsername = await tx.get(usernameRef);
      if (existingUsername.exists() && existingUsername.data()?.uid !== uid) {
        throw new Error('USERNAME_TAKEN');
      }

      if (!existingUsername.exists()) {
        tx.set(usernameRef, {
          uid,
          username: parsed.username,
          createdAt: serverTimestamp(),
        });
      }

      tx.set(profileRef, {
        uid,
        username: parsed.username,
        usernameLower: parsed.usernameLower,
        avatarId,
        equippedTitle: 'novato_masmorra',
        favoriteClass,
        publicProfile: true,
        bestFloor: baseSave.bestFloor,
        bestLevel: baseSave.bestLevel,
        totalKills: baseSave.totalKills,
        totalBossKills: baseSave.totalBossKills,
        totalRuns: baseSave.totalRuns,
        totalPlayTimeSec: baseSave.totalPlayTimeSec,
        ascensionLevel: baseSave.ascensionLevel,
        achievementsCount: baseSave.unlockedAchievements.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      tx.set(accountRef, {
        uid,
        email,
        authProvider,
        role: 'player',
        localMigrated: Boolean(params.markLocalMigrated),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      tx.set(saveRef, buildSaveDocPayload(uid, baseSave));
    });

    // Also record any already-redeemed secret codes from migrated local save into the immutable ledger
    for (const stored of baseSave.redeemedCodes) {
      const def = SECRET_CODES.find((c) => matchesSecretCodeEntry(stored, c));
      if (def) {
        await recordCloudRedemption(
          uid,
          def.id,
          def.reward.type,
          def.reward.type === 'unlock_class' ? def.reward.classId : String(def.reward.amount)
        ).catch(() => {});
      }
    }

    const nowIso = new Date().toISOString();
    persistCachedAccountSave(uid, baseSave);

    return {
      profile: {
        uid,
        username: parsed.username,
        usernameLower: parsed.usernameLower,
        avatarId,
        equippedTitle: 'novato_masmorra',
        favoriteClass,
        publicProfile: true,
        bestFloor: baseSave.bestFloor,
        bestLevel: baseSave.bestLevel,
        totalKills: baseSave.totalKills,
        totalBossKills: baseSave.totalBossKills,
        totalRuns: baseSave.totalRuns,
        totalPlayTimeSec: baseSave.totalPlayTimeSec,
        ascensionLevel: baseSave.ascensionLevel,
        achievementsCount: baseSave.unlockedAchievements.length,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        lastLoginAtIso: nowIso,
      },
      account: {
        uid,
        email,
        emailVerified: Boolean(user.emailVerified),
        authProvider,
        role: 'player',
        localMigrated: Boolean(params.markLocalMigrated),
        createdAtIso: nowIso,
        lastLoginAtIso: nowIso,
      },
      save: baseSave,
      redeemedCodeIds: [],
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `players/${uid}`);
  }
}

export async function updatePlayerProfile(
  currentProfile: PlayerProfileData,
  patch: {
    username?: string;
    avatarId?: AvatarId;
    equippedTitle?: string;
    favoriteClass?: ClassId;
    publicProfile?: boolean;
  }
): Promise<PlayerProfileData> {
  const uid = currentProfile.uid;
  const nextUsernameRaw = patch.username ?? currentProfile.username;
  const parsed = validateUsername(nextUsernameRaw);
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Nome de usuário inválido.');
  }

  const nextAvatar = patch.avatarId ?? currentProfile.avatarId;
  const nextTitle = patch.equippedTitle ?? currentProfile.equippedTitle;
  const nextFav = patch.favoriteClass ?? currentProfile.favoriteClass;
  const nextPublic = patch.publicProfile ?? currentProfile.publicProfile;
  const usernameChanged = parsed.usernameLower !== currentProfile.usernameLower;

  const profileRef = doc(db, 'players', uid);

  try {
    if (usernameChanged) {
      const oldUsernameRef = doc(db, 'usernames', currentProfile.usernameLower);
      const newUsernameRef = doc(db, 'usernames', parsed.usernameLower);

      await runTransaction(db, async (tx) => {
        const targetSnap = await tx.get(newUsernameRef);
        if (targetSnap.exists() && targetSnap.data()?.uid !== uid) {
          throw new Error('USERNAME_TAKEN');
        }

        if (!targetSnap.exists()) {
          tx.set(newUsernameRef, {
            uid,
            username: parsed.username,
            createdAt: serverTimestamp(),
          });
        }
        tx.delete(oldUsernameRef);
        tx.update(profileRef, {
          username: parsed.username,
          usernameLower: parsed.usernameLower,
          avatarId: nextAvatar,
          equippedTitle: nextTitle,
          favoriteClass: nextFav,
          publicProfile: nextPublic,
          updatedAt: serverTimestamp(),
        });
      });
    } else {
      await updateDoc(profileRef, {
        username: parsed.username,
        usernameLower: parsed.usernameLower,
        avatarId: nextAvatar,
        equippedTitle: nextTitle,
        favoriteClass: nextFav,
        publicProfile: nextPublic,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      ...currentProfile,
      username: parsed.username,
      usernameLower: parsed.usernameLower,
      avatarId: nextAvatar,
      equippedTitle: nextTitle,
      favoriteClass: nextFav,
      publicProfile: nextPublic,
      updatedAtIso: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `players/${uid}`);
  }
}

const cloudSyncQueues = new Map<string, Promise<void>>();

function enqueueUidSync<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const prev = cloudSyncQueues.get(uid) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  const tail = next.then(
    () => {
      if (cloudSyncQueues.get(uid) === tail) {
        cloudSyncQueues.delete(uid);
      }
    },
    () => {
      if (cloudSyncQueues.get(uid) === tail) {
        cloudSyncQueues.delete(uid);
      }
    }
  );
  cloudSyncQueues.set(uid, tail);
  return next;
}

export async function syncCloudSave(
  uid: string,
  saveInput: SaveData,
  options?: { isReset?: boolean }
): Promise<SaveData> {
  return enqueueUidSync(uid, async () => {
    const sanitized = validateAndMigrateSave(saveInput);
    const saveRef = doc(db, 'players', uid, 'private', 'save');
    const profileRef = doc(db, 'players', uid);

    try {
      let committedSave = sanitized;

      await runTransaction(db, async (tx) => {
        const [saveSnap, profileSnap] = await Promise.all([tx.get(saveRef), tx.get(profileRef)]);
        if (!saveSnap.exists() || !profileSnap.exists()) {
          return;
        }

        const remoteSave = validateAndMigrateSave(saveSnap.data());
        const remoteProfile = profileSnap.data();

        if (options?.isReset) {
          const nextVersion = Math.max(remoteSave.saveVersion, sanitized.saveVersion) + 1;
          const resetSave: SaveData = {
            ...sanitized,
            saveVersion: nextVersion,
            redeemedCodes: [...remoteSave.redeemedCodes],
            unlockedSecretClasses: [...remoteSave.unlockedSecretClasses],
            narrative: mergeNarrativeProgress(remoteSave.narrative, sanitized.narrative),
          };
          const payload = buildSaveDocPayload(uid, resetSave);

          tx.update(saveRef, {
            saveVersion: payload.saveVersion,
            crystals: payload.crystals,
            totalCrystalsEarned: payload.totalCrystalsEarned,
            ascensionLevel: payload.ascensionLevel,
            selectedClass: payload.selectedClass,
            permanentUpgrades: payload.permanentUpgrades,
            bestFloor: payload.bestFloor,
            bestLevel: payload.bestLevel,
            totalKills: payload.totalKills,
            totalBossKills: payload.totalBossKills,
            totalRuns: payload.totalRuns,
            totalPlayTimeSec: payload.totalPlayTimeSec,
            bestiaryKills: payload.bestiaryKills,
            discoveredSynergies: payload.discoveredSynergies,
            unlockedAchievements: payload.unlockedAchievements,
            claimedAchievements: payload.claimedAchievements,
            records: payload.records,
            updatedAt: serverTimestamp(),
          });

          tx.update(profileRef, {
            bestFloor: 0,
            bestLevel: 1,
            totalKills: 0,
            totalBossKills: 0,
            totalRuns: 0,
            totalPlayTimeSec: 0,
            ascensionLevel: 0,
            achievementsCount: 0,
            updatedAt: serverTimestamp(),
          });

          committedSave = resetSave;
          return;
        }

        // Preserve every existing remote secret code / secret class and enforce monotonic career counters
        const mergedRedeemed = Array.from(
          new Set([...remoteSave.redeemedCodes, ...sanitized.redeemedCodes])
        ).slice(0, 64);
        const mergedSecretClasses = Array.from(
          new Set([...remoteSave.unlockedSecretClasses, ...sanitized.unlockedSecretClasses])
        ).slice(0, 16);

        const reconciledSave = validateAndMigrateSave({
          ...sanitized,
          saveVersion: Math.max(remoteSave.saveVersion, sanitized.saveVersion) + 1,
          totalCrystalsEarned: Math.max(remoteSave.totalCrystalsEarned, sanitized.totalCrystalsEarned),
          ascensionLevel: Math.max(remoteSave.ascensionLevel, sanitized.ascensionLevel),
          bestFloor: Math.max(remoteSave.bestFloor, sanitized.bestFloor),
          bestLevel: Math.max(remoteSave.bestLevel, sanitized.bestLevel),
          totalKills: Math.max(remoteSave.totalKills, sanitized.totalKills),
          totalBossKills: Math.max(remoteSave.totalBossKills, sanitized.totalBossKills),
          totalRuns: Math.max(remoteSave.totalRuns, sanitized.totalRuns),
          totalPlayTimeSec: Math.max(remoteSave.totalPlayTimeSec, sanitized.totalPlayTimeSec),
          discoveredSynergies: Array.from(
            new Set([...remoteSave.discoveredSynergies, ...sanitized.discoveredSynergies])
          ).slice(0, 16),
          unlockedAchievements: Array.from(
            new Set([...remoteSave.unlockedAchievements, ...sanitized.unlockedAchievements])
          ).slice(0, 64),
          claimedAchievements: Array.from(
            new Set([...remoteSave.claimedAchievements, ...sanitized.claimedAchievements])
          ).slice(0, 64),
          redeemedCodes: mergedRedeemed,
          unlockedSecretClasses: mergedSecretClasses,
          narrative: mergeNarrativeProgress(remoteSave.narrative, sanitized.narrative),
        });

        const payload = buildSaveDocPayload(uid, reconciledSave);

        tx.update(saveRef, {
          saveVersion: payload.saveVersion,
          crystals: payload.crystals,
          totalCrystalsEarned: payload.totalCrystalsEarned,
          ascensionLevel: payload.ascensionLevel,
          selectedClass: payload.selectedClass,
          permanentUpgrades: payload.permanentUpgrades,
          bestFloor: payload.bestFloor,
          bestLevel: payload.bestLevel,
          totalKills: payload.totalKills,
          totalBossKills: payload.totalBossKills,
          totalRuns: payload.totalRuns,
          totalPlayTimeSec: payload.totalPlayTimeSec,
          bestiaryKills: payload.bestiaryKills,
          discoveredSynergies: payload.discoveredSynergies,
          unlockedAchievements: payload.unlockedAchievements,
          claimedAchievements: payload.claimedAchievements,
          redeemedCodes: payload.redeemedCodes,
          unlockedSecretClasses: payload.unlockedSecretClasses,
          records: payload.records,
          settings: payload.settings,
          narrative: payload.narrative,
          updatedAt: serverTimestamp(),
        });

        const nextProfileBestFloor = Math.max(Number(remoteProfile?.bestFloor ?? 0), payload.bestFloor);
        const nextProfileBestLevel = Math.max(Number(remoteProfile?.bestLevel ?? 1), payload.bestLevel);
        const nextProfileTotalKills = Math.max(Number(remoteProfile?.totalKills ?? 0), payload.totalKills);
        const nextProfileTotalBossKills = Math.max(Number(remoteProfile?.totalBossKills ?? 0), payload.totalBossKills);
        const nextProfileTotalRuns = Math.max(Number(remoteProfile?.totalRuns ?? 0), payload.totalRuns);
        const nextProfilePlayTime = Math.max(Number(remoteProfile?.totalPlayTimeSec ?? 0), payload.totalPlayTimeSec);
        const nextProfileAscension = Math.max(Number(remoteProfile?.ascensionLevel ?? 0), payload.ascensionLevel);

        tx.update(profileRef, {
          bestFloor: nextProfileBestFloor,
          bestLevel: nextProfileBestLevel,
          totalKills: nextProfileTotalKills,
          totalBossKills: nextProfileTotalBossKills,
          totalRuns: nextProfileTotalRuns,
          totalPlayTimeSec: nextProfilePlayTime,
          ascensionLevel: nextProfileAscension,
          achievementsCount: payload.unlockedAchievements.length,
          favoriteClass: computeFavoriteClass(reconciledSave),
          updatedAt: serverTimestamp(),
        });

        committedSave = reconciledSave;
      });

      persistCachedAccountSave(uid, committedSave);
      return committedSave;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `players/${uid}/private/save`);
    }
  });
}

export async function resetCloudAccountProgress(uid: string, currentSave: SaveData): Promise<SaveData> {
  const fresh = createResetSavePreservingSecrets(currentSave);
  return syncCloudSave(uid, fresh, { isReset: true });
}

export async function markAccountLocalMigrated(uid: string): Promise<void> {
  const path = `players/${uid}/private/account`;
  try {
    await updateDoc(doc(db, 'players', uid, 'private', 'account'), {
      localMigrated: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordCloudRun(uid: string, record: RunRecord): Promise<void> {
  const safeId = record.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || `run_${Date.now()}`;
  const path = `players/${uid}/runs/${safeId}`;
  try {
    await setDoc(doc(db, 'players', uid, 'runs', safeId), {
      uid,
      classId: record.classId,
      floor: Math.max(1, Math.min(9999, Math.floor(record.floor))),
      level: Math.max(1, Math.min(9999, Math.floor(record.level))),
      kills: Math.max(0, Math.min(1000000, Math.floor(record.kills))),
      bossesKilled: Math.max(0, Math.min(10000, Math.floor(record.bossesKilled))),
      durationSec: Math.max(0, Math.min(86400, Math.floor(record.durationSec))),
      crystalsEarned: Math.max(0, Math.min(1000000, Math.floor(record.crystalsEarned))),
      ascensionLevel: Math.max(0, Math.min(1000, Math.floor(record.ascensionLevel))),
      seasonId: 'season_1',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordCloudRedemption(
  uid: string,
  codeId: string,
  rewardType: 'unlock_class' | 'crystals',
  rewardValue: string
): Promise<'created' | 'already_exists'> {
  const safeId = codeId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const ref = doc(db, 'players', uid, 'redemptions', safeId);
  const path = `players/${uid}/redemptions/${safeId}`;
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      return 'already_exists';
    }
    await setDoc(ref, {
      uid,
      codeId: safeId,
      rewardType,
      rewardValue: rewardValue.slice(0, 64),
      redeemedAt: serverTimestamp(),
    });
    return 'created';
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Primary server-side secret code validation flow (`/api/codes/redeem`)
 * backed by immutable Firestore redemptions ledger for logged-in accounts.
 */
export async function redeemSecretCodeSecure(params: {
  rawCode: string;
  save: SaveData;
  uid: string | null;
}): Promise<RedeemCodeResult> {
  const trimmed = params.rawCode.trim();
  if (!trimmed) {
    return {
      status: 'empty',
      message: 'Digite um código secreto para resgatar.',
      save: params.save,
    };
  }

  let validatedDef: SecretCodeDef | undefined;

  try {
    const response = await fetch('/api/codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'DungeonAscension',
      },
      body: JSON.stringify({ code: trimmed }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          status?: string;
          message?: string;
          codeId?: string;
          rewardDef?: Omit<SecretCodeDef, 'code' | 'codeDigest'>;
        }
      | null;

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        message: data?.message || 'Muitas tentativas. Aguarde alguns segundos.',
        save: params.save,
      };
    }

    if (!response.ok || !data?.ok || !data.rewardDef) {
      return {
        status: data?.status === 'empty' ? 'empty' : 'invalid',
        message: data?.message || 'Código inválido. Verifique a grafia e tente novamente.',
        save: params.save,
      };
    }

    const catalogMatch = findSecretCodeDefById(data.rewardDef.id);
    validatedDef = {
      id: data.rewardDef.id,
      code: trimmed.toLowerCase(),
      codeDigest: catalogMatch?.codeDigest ?? '',
      title: data.rewardDef.title,
      subtitle: data.rewardDef.subtitle,
      description: data.rewardDef.description,
      theme: data.rewardDef.theme,
      reward: data.rewardDef.reward,
    };
  } catch {
    // Offline fallback using deterministic client digest (never embeds plaintext codes)
    const offlineResult = redeemSecretCode(params.save, trimmed);
    if (offlineResult.status !== 'success' || !offlineResult.codeDef) {
      return offlineResult;
    }
    validatedDef = offlineResult.codeDef;
  }

  // Apply to save state with duplicate guard (store opaque codeId in redeemedCodes for cleaner privacy)
  const applied = applyValidatedSecretCode(params.save, validatedDef, validatedDef.id);
  if (applied.status !== 'success') {
    return applied;
  }

  // If authenticated, persist immutable redemption doc in Firestore to block cross-device replay
  if (params.uid) {
    const rewardVal =
      validatedDef.reward.type === 'unlock_class'
        ? validatedDef.reward.classId
        : String(validatedDef.reward.amount);
    try {
      const ledgerState = await recordCloudRedemption(
        params.uid,
        validatedDef.id,
        validatedDef.reward.type,
        rewardVal
      );
      if (ledgerState === 'already_exists') {
        return {
          status: 'already_redeemed',
          message: 'Este código já foi resgatado nesta conta.',
          save: params.save,
          codeDef: validatedDef,
        };
      }
    } catch {
      // Save remains locally updated and will sync cleanly when connection resumes
    }
  }

  return {
    ...applied,
    save: {
      ...applied.save,
      saveVersion: applied.save.saveVersion + 1,
    },
  };
}
