import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { ACHIEVEMENTS } from '../game/data/achievements';
import { CLASSES, getVisibleClasses } from '../game/data/classes';
import {
  computeFavoriteClass,
  formatPlayTime,
  getTitleLabel,
  getUnlockedTitles,
  PLAYER_AVATARS,
  PLAYER_TITLES,
  validateUsername,
} from '../game/systems/accountLogic';
import {
  checkUsernameAvailable,
  sendPasswordRecoveryEmail,
  translateAuthError,
} from '../game/systems/cloudSaveService';
import type {
  AvatarId,
  ClassId,
  PlayerAccountMeta,
  PlayerProfileData,
  SaveData,
} from '../game/types';
import { ClassIcon } from './Icons';
import { PlayerAvatarBadge } from './PlayerAvatarBadge';

interface ProfileModalProps {
  save: SaveData;
  profile: PlayerProfileData | null;
  account: PlayerAccountMeta | null;
  onUpdateProfile: (patch: {
    username: string;
    avatarId: AvatarId;
    equippedTitle: string;
    favoriteClass: ClassId;
    publicProfile: boolean;
  }) => Promise<void>;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

type ProfileTab = 'overview' | 'customize' | 'account';

function formatCreationDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function ProfileModal({
  save,
  profile,
  account,
  onUpdateProfile,
  onOpenAuth,
  onSignOut,
  onClose,
}: ProfileModalProps) {
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [editUsername, setEditUsername] = useState(profile?.username ?? '');
  const [editAvatar, setEditAvatar] = useState<AvatarId>(profile?.avatarId ?? 'crest_emblem');
  const [editTitle, setEditTitle] = useState(profile?.equippedTitle ?? 'novato_masmorra');
  const [editFavClass, setEditFavClass] = useState<ClassId>(
    profile?.favoriteClass ?? computeFavoriteClass(save)
  );
  const [editPublic, setEditPublic] = useState<boolean>(profile?.publicProfile ?? true);

  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameHint, setUsernameHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!profile) return;
    setEditUsername(profile.username);
    setEditAvatar(profile.avatarId);
    setEditTitle(profile.equippedTitle);
    setEditFavClass(profile.favoriteClass);
    setEditPublic(profile.publicProfile);
  }, [profile]);

  useEffect(() => {
    if (!profile || tab !== 'customize') return;
    const trimmed = editUsername.trim();
    if (trimmed.toLowerCase() === profile.usernameLower) {
      setUsernameStatus('idle');
      setUsernameHint('');
      return;
    }
    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setUsernameStatus('invalid');
      setUsernameHint(validation.error || 'Nome de usuário inválido.');
      return;
    }

    let cancelled = false;
    setUsernameStatus('checking');
    setUsernameHint('Verificando disponibilidade...');
    const timer = window.setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(validation.username, profile.uid);
        if (cancelled) return;
        if (available) {
          setUsernameStatus('available');
          setUsernameHint('Nome de usuário disponível.');
        } else {
          setUsernameStatus('taken');
          setUsernameHint('Este nome de usuário já está em uso.');
        }
      } catch {
        if (!cancelled) {
          setUsernameStatus('idle');
          setUsernameHint('');
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editUsername, profile, tab]);

  const favoriteClassId = profile?.favoriteClass ?? computeFavoriteClass(save);
  const favoriteClass = CLASSES[favoriteClassId] ?? CLASSES.warrior;
  const unlockedTitles = getUnlockedTitles(save);
  const unlockedTitleIds = new Set(unlockedTitles.map((t) => t.id));
  const visibleClasses = getVisibleClasses(save.unlockedSecretClasses);
  const availableAvatars = PLAYER_AVATARS.filter(
    (a) => !a.secretClassId || save.unlockedSecretClasses.includes(a.secretClassId)
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setFeedback(null);

    const parsed = validateUsername(editUsername);
    if (!parsed.valid) {
      setFeedback({ kind: 'error', text: parsed.error || 'Nome de usuário inválido.' });
      return;
    }
    if (usernameStatus === 'taken') {
      setFeedback({ kind: 'error', text: 'Este nome de usuário já está em uso.' });
      return;
    }

    setSaving(true);
    try {
      await onUpdateProfile({
        username: parsed.username,
        avatarId: editAvatar,
        equippedTitle: unlockedTitleIds.has(editTitle) ? editTitle : 'novato_masmorra',
        favoriteClass: editFavClass,
        publicProfile: editPublic,
      });
      setFeedback({ kind: 'success', text: 'Perfil atualizado e salvo na nuvem.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: translateAuthError(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!account?.email) return;
    setFeedback(null);
    setSaving(true);
    try {
      await sendPasswordRecoveryEmail(account.email);
      setFeedback({
        kind: 'success',
        text: `Enviamos um e-mail de redefinição de senha para ${account.email}.`,
      });
    } catch (err) {
      setFeedback({ kind: 'error', text: translateAuthError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Perfil do Jogador"
        data-testid="profile-modal"
        className="dark-panel animate-modal-enter w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a64a]/25 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <PlayerAvatarBadge
              avatarId={profile?.avatarId ?? 'crest_emblem'}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#f3e3be] tracking-wider truncate">
                {profile ? profile.username : 'Modo Visitante'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9c9487]">
                <span className="text-[#d4a64a]">
                  {profile ? getTitleLabel(profile.equippedTitle) : 'Progresso Local'}
                </span>
                {profile && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Desde {formatCreationDate(profile.createdAtIso)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perfil"
            className="px-3 py-1.5 text-xs text-[#b8afa1] hover:text-white border border-white/15 hover:border-white/35 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>

        {/* Authenticated Tabs */}
        {profile && (
          <div className="grid grid-cols-3 border-b border-white/10 bg-[#110f17] shrink-0">
            {(
              [
                ['overview', 'Visão Geral'],
                ['customize', 'Personalizar'],
                ['account', 'Conta'],
              ] as Array<[ProfileTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                data-testid={`profile-tab-${key}`}
                onClick={() => {
                  setTab(key);
                  setFeedback(null);
                }}
                className={`py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  tab === key
                    ? 'text-[#f8e3a8] bg-[#1a1624] border-b-2 border-[#d4a64a]'
                    : 'text-[#9c9487] hover:text-[#e8e3d9]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
          {feedback && (
            <div
              role="status"
              className={`flex items-start gap-2.5 px-3.5 py-2.5 border text-xs leading-relaxed ${
                feedback.kind === 'success'
                  ? 'bg-[#162217] border-[#22c55e]/50 text-[#bbf7d0]'
                  : 'bg-[#241216] border-[#ef4444]/55 text-[#fecaca]'
              }`}
            >
              {feedback.kind === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* GUEST BANNER */}
          {!profile && (
            <div className="p-4 bg-[#161321] border border-[#d4a64a]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-display font-bold text-[#f8e3a8]">
                  <Cloud className="w-4 h-4 text-[#d4a64a]" />
                  <span>Salve seu progresso na nuvem</span>
                </div>
                <p className="text-xs text-[#b8afa1] leading-relaxed">
                  Você está jogando como visitante. Crie uma conta ou entre com o Google para
                  personalizar seu nome, brasão, título e acessar seu progresso em qualquer
                  dispositivo.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="profile-guest-login"
                  onClick={() => onOpenAuth('login')}
                  className="px-4 py-2.5 bg-[#b83232] hover:bg-[#cf3a3a] text-white font-display font-bold text-xs tracking-wider uppercase border border-[#e3b55c]/50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar / Criar Conta</span>
                </button>
              </div>
            </div>
          )}

          {/* OVERVIEW TAB (also shown to guests) */}
          {(!profile || tab === 'overview') && (
            <div className="space-y-5">
              {/* Career Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard label="Melhor Andar" value={save.bestFloor > 0 ? `${save.bestFloor}` : '—'} />
                <StatCard label="Inimigos Derrotados" value={save.totalKills.toLocaleString('pt-BR')} />
                <StatCard label="Chefes Derrotados" value={save.totalBossKills.toLocaleString('pt-BR')} />
                <StatCard label="Partidas Jogadas" value={save.totalRuns.toLocaleString('pt-BR')} />
                <StatCard label="Tempo de Jogo" value={formatPlayTime(save.totalPlayTimeSec)} />
                <StatCard
                  label="Conquistas"
                  value={`${save.unlockedAchievements.length} / ${ACHIEVEMENTS.length}`}
                />
                <StatCard label="Ascensão" value={`${save.ascensionLevel}`} />
                <div className="p-3 bg-[#121018] border border-white/10">
                  <div className="text-[11px] text-[#9c9487]">Classe Favorita</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#f8e3a8]">
                    <span style={{ color: favoriteClass.accentColor }}>
                      <ClassIcon classId={favoriteClass.id} className="w-4 h-4" />
                    </span>
                    <span className="truncate">{favoriteClass.name}</span>
                  </div>
                </div>
              </div>

              {/* Unlocked Secret Classes (only visible if unlocked) */}
              {save.unlockedSecretClasses.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#b8afa1] mb-2">
                    Classes Secretas Desbloqueadas
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {save.unlockedSecretClasses.map((clsId) => {
                      const cls = CLASSES[clsId];
                      if (!cls) return null;
                      return (
                        <div
                          key={clsId}
                          className="px-3 py-1.5 bg-[#15121d] border border-[#d4a64a]/35 flex items-center gap-2 text-xs text-[#f3e3be]"
                        >
                          <span style={{ color: cls.accentColor }}>
                            <ClassIcon classId={cls.id} className="w-4 h-4" />
                          </span>
                          <span>{cls.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Best Runs Summary */}
              <div className="pt-3 border-t border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#b8afa1] mb-2">
                  Melhores Expedições
                </div>
                {save.records.length === 0 ? (
                  <p className="text-xs text-[#7d756b]">
                    Nenhuma expedição concluída ainda. Entre na masmorra para registrar seus recordes.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {save.records.slice(0, 4).map((rec) => {
                      const cls = CLASSES[rec.classId] ?? CLASSES.warrior;
                      return (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between px-3 py-2 bg-[#121018] border border-white/10 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span style={{ color: cls.accentColor }}>
                              <ClassIcon classId={cls.id} className="w-4 h-4" />
                            </span>
                            <span className="font-medium text-[#f4efe6] truncate">{cls.name}</span>
                            <span className="text-[#7d756b]" aria-hidden="true">·</span>
                            <span className="font-mono-num text-[#f8e3a8]">Andar {rec.floor}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono-num text-[#9c9487] shrink-0">
                            <span>Nv. {rec.level}</span>
                            <span>{rec.kills} abates</span>
                            <span>{formatPlayTime(rec.durationSec)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CUSTOMIZE TAB */}
          {profile && tab === 'customize' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label htmlFor="profile-edit-username" className="block text-xs text-[#c7bfb2] mb-1">
                  Nome de usuário
                </label>
                <input
                  id="profile-edit-username"
                  data-testid="profile-username-input"
                  type="text"
                  maxLength={20}
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8]"
                />
                {usernameHint && (
                  <p
                    className={`mt-1 text-[11px] ${
                      usernameStatus === 'available'
                        ? 'text-[#4ade80]'
                        : usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'text-[#f87171]'
                          : 'text-[#9c9487]'
                    }`}
                  >
                    {usernameHint}
                  </p>
                )}
              </div>

              <div>
                <div className="text-xs text-[#c7bfb2] mb-2">Brasão / Avatar</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {availableAvatars.map((opt) => {
                    const active = editAvatar === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditAvatar(opt.id)}
                        className={`p-2 flex flex-col items-center gap-1.5 border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#211b2c] border-[#d4a64a] text-[#f8e3a8]'
                            : 'bg-[#121018] border-white/10 text-[#9c9487] hover:border-white/25'
                        }`}
                      >
                        <PlayerAvatarBadge avatarId={opt.id} size="sm" />
                        <span className="text-[11px] truncate w-full text-center">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs text-[#c7bfb2] mb-2">
                  Título Equipado ({unlockedTitles.length} / {PLAYER_TITLES.length} desbloqueados)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLAYER_TITLES.map((title) => {
                    const unlocked = unlockedTitleIds.has(title.id);
                    const selected = editTitle === title.id;
                    return (
                      <button
                        key={title.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && setEditTitle(title.id)}
                        className={`p-2.5 text-left border transition-colors ${
                          !unlocked
                            ? 'bg-[#0e0c14] border-white/5 text-[#665f56] cursor-not-allowed'
                            : selected
                              ? 'bg-[#211b2c] border-[#d4a64a] text-[#f8e3a8] cursor-pointer'
                              : 'bg-[#121018] border-white/10 text-[#d6cfc2] hover:border-white/30 cursor-pointer'
                        }`}
                      >
                        <div className="text-xs font-semibold">{title.label}</div>
                        <div className="text-[11px] text-[#8d8579] mt-0.5">{title.requirement}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-fav-class" className="block text-xs text-[#c7bfb2] mb-1">
                    Classe Favorita em Destaque
                  </label>
                  <select
                    id="profile-fav-class"
                    value={editFavClass}
                    onChange={(e) => setEditFavClass(e.target.value as ClassId)}
                    className="w-full px-3 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8]"
                  >
                    {visibleClasses.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#121018]">
                        {c.name} — {c.archetype}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#121018] border border-white/10">
                    <div>
                      <div className="text-xs text-[#d6cfc2]">Perfil Público</div>
                      <div className="text-[11px] text-[#8d8579]">
                        Visível para rankings futuros
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editPublic}
                      onClick={() => setEditPublic((prev) => !prev)}
                      className={`px-2.5 py-1 text-xs font-mono-num border cursor-pointer ${
                        editPublic
                          ? 'bg-[#213325] text-[#4ade80] border-[#4ade80]/50'
                          : 'bg-[#0e0c14] text-[#9c9487] border-white/15'
                      }`}
                    >
                      {editPublic ? 'SIM' : 'NÃO'}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                data-testid="profile-save-btn"
                disabled={saving || usernameStatus === 'checking' || usernameStatus === 'taken'}
                className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-50 text-white font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Salvar Alterações</span>
              </button>
            </form>
          )}

          {/* ACCOUNT & SECURITY TAB */}
          {profile && account && tab === 'account' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#121018] border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9c9487]">E-mail da conta</span>
                  <span className="text-[#f4efe6] font-mono-num truncate">{account.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9c9487]">Verificação</span>
                  <span className="inline-flex items-center gap-1 text-[#4ade80]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>E-mail verificado</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9c9487]">Método de acesso</span>
                  <span className="text-[#f8e3a8]">
                    {account.authProvider === 'google' ? 'Conta Google (OAuth)' : 'E-mail e senha própria'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9c9487]">Conta criada em</span>
                  <span className="text-[#e8e3d9]">{formatCreationDate(account.createdAtIso)}</span>
                </div>
              </div>

              {account.authProvider === 'password' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSendPasswordReset()}
                  className="w-full py-2.5 px-4 bg-[#181522] hover:bg-[#231f30] disabled:opacity-60 text-[#f3e3be] text-xs font-medium border border-[#d4a64a]/35 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4 text-[#d4a64a]" />
                  <span>Enviar e-mail para alterar senha</span>
                </button>
              ) : (
                <p className="text-xs text-[#9c9487] leading-relaxed">
                  Sua autenticação é gerenciada com segurança diretamente pelo Google. O jogo nunca
                  solicita nem armazena a senha da sua conta Google.
                </p>
              )}

              <div className="pt-3 border-t border-white/10">
                <button
                  type="button"
                  data-testid="profile-signout-btn"
                  onClick={() => void onSignOut()}
                  className="w-full py-2.5 px-4 bg-[#241216] hover:bg-[#34181e] text-[#fca5a5] text-xs font-semibold uppercase tracking-wider border border-[#ef4444]/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Encerrar Sessão</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-[#121018] border border-white/10">
      <div className="text-[11px] text-[#9c9487]">{label}</div>
      <div className="font-mono-num text-base font-bold text-[#f8e3a8] mt-0.5 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function AccountMenuTrigger({
  profile,
  loading,
  onOpenProfile,
  onOpenAuth,
}: {
  profile: PlayerProfileData | null;
  loading: boolean;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}) {
  if (loading) {
    return (
      <span className="px-2.5 py-1.5 text-xs text-[#9c9487] inline-flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Conta</span>
      </span>
    );
  }

  if (profile) {
    return (
      <button
        type="button"
        data-testid="topbar-account-btn"
        onClick={onOpenProfile}
        aria-label={`Perfil de ${profile.username}`}
        className="flex items-center gap-2 px-2.5 py-1 bg-[#14111c]/85 hover:bg-[#201b2c] border border-[#d4a64a]/35 hover:border-[#d4a64a]/70 text-xs text-[#f3e3be] transition-colors cursor-pointer whitespace-nowrap"
      >
        <PlayerAvatarBadge avatarId={profile.avatarId} size="sm" className="w-5 h-5" />
        <span className="max-w-[120px] truncate font-medium">{profile.username}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="topbar-login-btn"
      onClick={onOpenAuth}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15121d]/85 hover:bg-[#211c2d] border border-[#d4a64a]/40 hover:border-[#d4a64a]/75 text-xs font-medium text-[#f3e3be] transition-colors cursor-pointer whitespace-nowrap"
    >
      <UserIcon className="w-3.5 h-3.5 text-[#d4a64a]" />
      <span>Entrar</span>
    </button>
  );
}
