import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  evaluatePasswordStrength,
  PLAYER_AVATARS,
  suggestUsernameFromEmailOrName,
  validateEmail,
  validateUsername,
} from '../game/systems/accountLogic';
import {
  checkUsernameAvailable,
  registerWithEmailPassword,
  resendVerificationEmail,
  sendPasswordRecoveryEmail,
  signInWithEmailPassword,
  signInWithGooglePopup,
  translateAuthError,
} from '../game/systems/cloudSaveService';
import type { AvatarId, SaveData } from '../game/types';
import { PlayerAvatarBadge } from './PlayerAvatarBadge';

export type AuthModalStep =
  | 'login'
  | 'register'
  | 'forgot'
  | 'verifyEmail'
  | 'chooseUsername'
  | 'migrateLocal';

interface AuthModalProps {
  initialStep: AuthModalStep;
  firebaseUser: User | null;
  localSave: SaveData;
  cloudSavePreview: SaveData | null;
  onCompleteUsernameSetup: (username: string, avatarId: AvatarId) => Promise<void>;
  onConfirmLocalMigration: (importLocal: boolean) => Promise<void>;
  onVerifyEmailRefresh: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export function AuthModal({
  initialStep,
  firebaseUser,
  localSave,
  cloudSavePreview,
  onCompleteUsernameSetup,
  onConfirmLocalMigration,
  onVerifyEmailRefresh,
  onSignOut,
  onClose,
}: AuthModalProps) {
  const [step, setStep] = useState<AuthModalStep>(initialStep);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState(() =>
    suggestUsernameFromEmailOrName(firebaseUser?.displayName, firebaseUser?.email)
  );
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('crest_emblem');

  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameHint, setUsernameHint] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync step when parent transitions into mandatory onboarding steps
  useEffect(() => {
    setStep(initialStep);
    setError(null);
    setNotice(null);
    if (initialStep === 'chooseUsername' && firebaseUser) {
      setUsername(suggestUsernameFromEmailOrName(firebaseUser.displayName, firebaseUser.email));
    }
  }, [initialStep, firebaseUser]);

  // Cooldown timer for verification email resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // Debounced username validation + availability check
  useEffect(() => {
    if (step !== 'register' && step !== 'chooseUsername') return;
    const trimmed = username.trim();
    if (!trimmed) {
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
        const available = await checkUsernameAvailable(validation.username, firebaseUser?.uid);
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
  }, [username, step, firebaseUser?.uid]);

  const strength = evaluatePasswordStrength(password);
  const canDismiss = step !== 'chooseUsername' && step !== 'migrateLocal';

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGooglePopup();
      // App's onAuthStateChanged listener drives next step (chooseUsername / migrateLocal / close)
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'E-mail inválido.');
      return;
    }
    if (!password) {
      setError('Informe sua senha.');
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailPassword(emailCheck.email, password);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const unameCheck = validateUsername(username);
    if (!unameCheck.valid) {
      setError(unameCheck.error || 'Nome de usuário inválido.');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('Este nome de usuário já está em uso. Escolha outro.');
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'E-mail inválido.');
      return;
    }
    if (!strength.meetsMinimum) {
      setError('A senha deve ter ao menos 8 caracteres, incluindo letras e números.');
      return;
    }
    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setBusy(true);
    try {
      await registerWithEmailPassword(unameCheck.username, emailCheck.email, password);
      setNotice('Conta criada! Enviamos um link de verificação para o seu e-mail.');
      setStep('verifyEmail');
      setResendCooldown(45);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Informe um e-mail válido.');
      return;
    }

    setBusy(true);
    try {
      await sendPasswordRecoveryEmail(emailCheck.email);
      setNotice(
        'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.'
      );
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const verified = await onVerifyEmailRefresh();
      if (!verified) {
        setError(
          'Seu e-mail ainda consta como não verificado. Clique no link enviado à sua caixa de entrada (ou pasta de spam) e tente novamente.'
        );
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser || resendCooldown > 0) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await resendVerificationEmail(firebaseUser);
      setNotice('Novo e-mail de verificação enviado. Verifique sua caixa de entrada.');
      setResendCooldown(45);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const unameCheck = validateUsername(username);
    if (!unameCheck.valid) {
      setError(unameCheck.error || 'Nome de usuário inválido.');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('Este nome de usuário já está em uso. Escolha outro.');
      return;
    }
    setBusy(true);
    try {
      await onCompleteUsernameSetup(unameCheck.username, selectedAvatar);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMigrationChoice = async (importLocal: boolean) => {
    setError(null);
    setBusy(true);
    try {
      await onConfirmLocalMigration(importLocal);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const strengthColors = [
    'bg-white/10',
    'bg-[#ef4444]',
    'bg-[#f59e0b]',
    'bg-[#eab308]',
    'bg-[#22c55e]',
  ];

  const availableOnboardingAvatars = PLAYER_AVATARS.filter(
    (a) => !a.secretClassId || localSave.unlockedSecretClasses.includes(a.secretClassId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conta Dungeon Ascension"
        data-testid="auth-modal"
        className="dark-panel animate-modal-enter w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a64a]/25 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/Emblema_da_Masmorra_com_Espada_e_Cristal_8fabb493.png"
              alt="Emblema Dungeon Ascension"
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-contain shrink-0 border border-[#d4a64a]/40 bg-[#120f19] p-0.5"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-[#f3e3be] tracking-wider truncate">
                {step === 'login' && 'Entrar na Conta'}
                {step === 'register' && 'Criar Conta'}
                {step === 'forgot' && 'Recuperar Senha'}
                {step === 'verifyEmail' && 'Verificar E-mail'}
                {step === 'chooseUsername' && 'Escolha seu Nome'}
                {step === 'migrateLocal' && 'Sincronizar Progresso'}
              </h2>
              <p className="text-xs text-[#9c9487] truncate">
                {step === 'login' && 'Salve seu progresso na nuvem entre dispositivos'}
                {step === 'register' && 'Conta própria independente para Dungeon Ascension'}
                {step === 'forgot' && 'Enviaremos um link seguro de redefinição'}
                {step === 'verifyEmail' && 'Confirme seu endereço para ativar o salvamento'}
                {step === 'chooseUsername' && 'Defina sua identidade única na masmorra'}
                {step === 'migrateLocal' && 'Encontramos progresso salvo neste navegador'}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de conta"
              className="p-1.5 text-[#9c9487] hover:text-white border border-white/15 hover:border-white/35 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mode Tabs (only on login/register) */}
        {(step === 'login' || step === 'register') && (
          <div className="grid grid-cols-2 border-b border-white/10 bg-[#110f17] shrink-0">
            <button
              type="button"
              data-testid="auth-tab-login"
              onClick={() => {
                setStep('login');
                setError(null);
                setNotice(null);
              }}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                step === 'login'
                  ? 'text-[#f8e3a8] bg-[#1a1624] border-b-2 border-[#d4a64a]'
                  : 'text-[#9c9487] hover:text-[#e8e3d9]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              data-testid="auth-tab-register"
              onClick={() => {
                setStep('register');
                setError(null);
                setNotice(null);
              }}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                step === 'register'
                  ? 'text-[#f8e3a8] bg-[#1a1624] border-b-2 border-[#d4a64a]'
                  : 'text-[#9c9487] hover:text-[#e8e3d9]'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-4">
          {error && (
            <div
              role="alert"
              data-testid="auth-error"
              className="flex items-start gap-2.5 px-3.5 py-2.5 bg-[#241216] border border-[#ef4444]/55 text-xs text-[#fecaca] leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div
              role="status"
              data-testid="auth-notice"
              className="flex items-start gap-2.5 px-3.5 py-2.5 bg-[#162217] border border-[#22c55e]/50 text-xs text-[#bbf7d0] leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* LOGIN STEP */}
          {step === 'login' && (
            <>
              <button
                type="button"
                data-testid="auth-google-btn"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 bg-[#1c1926] hover:bg-[#262235] disabled:opacity-60 text-[#f8f3e8] text-sm font-medium border border-[#d4a64a]/45 hover:border-[#d4a64a]/80 transition-colors cursor-pointer flex items-center justify-center gap-2.5"
              >
                <GoogleMark />
                <span>Entrar com Google</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-[#7a7267]">
                <span className="flex-1 h-px bg-white/10" />
                <span>ou entre com e-mail e senha</span>
                <span className="flex-1 h-px bg-white/10" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label htmlFor="auth-login-email" className="block text-xs text-[#c7bfb2] mb-1">
                    E-mail
                  </label>
                  <input
                    id="auth-login-email"
                    data-testid="auth-login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-login-password" className="text-xs text-[#c7bfb2]">
                      Senha
                    </label>
                    <button
                      type="button"
                      data-testid="auth-forgot-link"
                      onClick={() => {
                        setStep('forgot');
                        setError(null);
                        setNotice(null);
                      }}
                      className="text-xs text-[#d4a64a] hover:text-[#f8e3a8] transition-colors cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="auth-login-password"
                      data-testid="auth-login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha do jogo"
                      className="w-full px-3.5 py-2.5 pr-10 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9c9487] hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="auth-login-submit"
                  disabled={busy}
                  className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-60 text-[#faf6ef] font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Entrar</span>
                </button>
              </form>

              <div className="pt-2 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-[#9c9487] hover:text-[#e8e3d9] transition-colors cursor-pointer"
                >
                  Continuar jogando como Visitante
                </button>
              </div>
            </>
          )}

          {/* REGISTER STEP */}
          {step === 'register' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 bg-[#1c1926] hover:bg-[#262235] disabled:opacity-60 text-[#f8f3e8] text-sm font-medium border border-[#d4a64a]/45 hover:border-[#d4a64a]/80 transition-colors cursor-pointer flex items-center justify-center gap-2.5"
              >
                <GoogleMark />
                <span>Cadastrar com Google</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-[#7a7267]">
                <span className="flex-1 h-px bg-white/10" />
                <span>ou crie uma conta própria</span>
                <span className="flex-1 h-px bg-white/10" />
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label htmlFor="auth-reg-username" className="block text-xs text-[#c7bfb2] mb-1">
                    Nome de usuário
                  </label>
                  <input
                    id="auth-reg-username"
                    data-testid="auth-register-username"
                    type="text"
                    autoComplete="username"
                    maxLength={20}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: Cavaleiro_99"
                    className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                  />
                  {usernameHint && (
                    <p
                      data-testid="username-availability-hint"
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
                  <label htmlFor="auth-reg-email" className="block text-xs text-[#c7bfb2] mb-1">
                    E-mail
                  </label>
                  <input
                    id="auth-reg-email"
                    data-testid="auth-register-email"
                    type="email"
                    autoComplete="email"
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                  />
                </div>

                <div>
                  <label htmlFor="auth-reg-password" className="block text-xs text-[#c7bfb2] mb-1">
                    Senha (independente do Google)
                  </label>
                  <div className="relative">
                    <input
                      id="auth-reg-password"
                      data-testid="auth-register-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres com letras e números"
                      className="w-full px-3.5 py-2.5 pr-10 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9c9487] hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  <div className="mt-2 space-y-1.5" data-testid="password-strength-meter">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#9c9487]">Segurança da senha</span>
                      <span
                        data-testid="password-strength-label"
                        className={`font-medium ${
                          strength.score <= 1
                            ? 'text-[#f87171]'
                            : strength.score === 2
                              ? 'text-[#fbbf24]'
                              : strength.score === 3
                                ? 'text-[#facc15]'
                                : 'text-[#4ade80]'
                        }`}
                      >
                        {password.length === 0 ? 'Não informada' : strength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1.5">
                      {[1, 2, 3, 4].map((idx) => (
                        <div
                          key={idx}
                          className={`transition-colors ${
                            strength.score >= idx ? strengthColors[strength.score] : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5 text-[11px] text-[#9c9487]">
                      <RequirementItem met={strength.checks.minLength} label="8+ caracteres" />
                      <RequirementItem met={strength.checks.hasNumber} label="Número (0-9)" />
                      <RequirementItem met={strength.checks.hasUpper} label="Letra maiúscula" />
                      <RequirementItem met={strength.checks.hasSymbol} label="Símbolo (!@#)" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-reg-confirm" className="block text-xs text-[#c7bfb2] mb-1">
                    Confirmar senha
                  </label>
                  <input
                    id="auth-reg-confirm"
                    data-testid="auth-register-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8] placeholder:text-[#665f56]"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="auth-register-submit"
                  disabled={busy}
                  className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-60 text-[#faf6ef] font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Criar Conta</span>
                </button>
              </form>
            </>
          )}

          {/* FORGOT PASSWORD STEP */}
          {step === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-[#b8afa1] leading-relaxed">
                Informe o e-mail cadastrado na sua conta própria de Dungeon Ascension. Enviaremos um
                link seguro para você definir uma nova senha.
              </p>
              <div>
                <label htmlFor="auth-forgot-email" className="block text-xs text-[#c7bfb2] mb-1">
                  E-mail cadastrado
                </label>
                <input
                  id="auth-forgot-email"
                  data-testid="auth-forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full px-3.5 py-2.5 bg-[#0e0c14] border border-white/15 focus:border-[#d4a64a] focus:outline-none text-sm text-[#f8f3e8]"
                />
              </div>

              <button
                type="submit"
                data-testid="auth-forgot-submit"
                disabled={busy}
                className="w-full py-3 px-4 bg-[#241c13] hover:bg-[#332719] disabled:opacity-60 text-[#f8e3a8] font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#d4a64a]/65 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>Enviar Link de Recuperação</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('login');
                  setError(null);
                  setNotice(null);
                }}
                className="w-full py-2 text-xs text-[#9c9487] hover:text-white transition-colors cursor-pointer"
              >
                Voltar para o login
              </button>
            </form>
          )}

          {/* EMAIL VERIFICATION STEP */}
          {step === 'verifyEmail' && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto flex items-center justify-center bg-[#181422] border border-[#d4a64a]/50 text-[#f8e3a8]">
                <Mail className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-base font-bold text-[#f3e3be]">
                  Confirme seu endereço de e-mail
                </h3>
                <p className="text-xs text-[#b8afa1] leading-relaxed">
                  Enviamos um link de confirmação para{' '}
                  <span className="text-[#f8e3a8] font-medium">
                    {firebaseUser?.email || email}
                  </span>
                  . Após clicar no link, pressione o botão abaixo para ativar seu salvamento na nuvem.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCheckVerified}
                  className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-60 text-white font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Já verifiquei meu e-mail</span>
                </button>

                <button
                  type="button"
                  disabled={busy || resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="w-full py-2.5 px-4 bg-[#181522] hover:bg-[#231f30] disabled:opacity-50 text-[#e8e3d9] text-xs font-medium border border-white/15 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0
                      ? `Reenviar em ${resendCooldown}s`
                      : 'Reenviar e-mail de verificação'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="w-full py-2 text-xs text-[#9c9487] hover:text-white transition-colors cursor-pointer"
                >
                  Sair e voltar como visitante
                </button>
              </div>
            </div>
          )}

          {/* CHOOSE USERNAME STEP (First Google Login / Onboarding) */}
          {step === 'chooseUsername' && (
            <form onSubmit={handleCompleteUsername} className="space-y-4">
              <p className="text-xs text-[#b8afa1] leading-relaxed">
                Bem-vindo à masmorra! Escolha um nome de usuário exclusivo e um brasão inicial para
                identificar seu perfil.
              </p>

              <div>
                <label htmlFor="auth-choose-username" className="block text-xs text-[#c7bfb2] mb-1">
                  Nome de usuário exclusivo
                </label>
                <input
                  id="auth-choose-username"
                  data-testid="auth-choose-username-input"
                  type="text"
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: Guardiao_Sombrio"
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
                <div className="text-xs text-[#c7bfb2] mb-2">Brasão do Perfil</div>
                <div className="grid grid-cols-3 gap-2">
                  {availableOnboardingAvatars.map((opt) => {
                    const active = selectedAvatar === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedAvatar(opt.id)}
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

              <button
                type="submit"
                disabled={busy || usernameStatus === 'checking' || usernameStatus === 'taken'}
                className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-50 text-white font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Perfil</span>
              </button>
            </form>
          )}

          {/* LOCAL-TO-CLOUD MIGRATION STEP */}
          {step === 'migrateLocal' && (
            <div className="space-y-4">
              <p className="text-xs text-[#b8afa1] leading-relaxed">
                Detectamos progresso salvo localmente neste navegador. Deseja importar seus avanços
                para sua conta na nuvem? Recompensas, códigos e conquistas já resgatados não serão
                duplicados.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#14111c] border border-[#d4a64a]/35 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#f8e3a8]">
                    Progresso Local
                  </div>
                  <div className="text-xs text-[#c7bfb2] font-mono-num space-y-0.5">
                    <div>Melhor Andar: {localSave.bestFloor}</div>
                    <div>Cristais: {localSave.crystals}</div>
                    <div>Partidas: {localSave.totalRuns}</div>
                    <div>Abates: {localSave.totalKills}</div>
                    <div>Códigos: {localSave.redeemedCodes.length}</div>
                  </div>
                </div>

                <div className="p-3 bg-[#121018] border border-white/15 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c084fc]">
                    Conta na Nuvem
                  </div>
                  <div className="text-xs text-[#c7bfb2] font-mono-num space-y-0.5">
                    <div>Melhor Andar: {cloudSavePreview?.bestFloor ?? 0}</div>
                    <div>Cristais: {cloudSavePreview?.crystals ?? 25}</div>
                    <div>Partidas: {cloudSavePreview?.totalRuns ?? 0}</div>
                    <div>Abates: {cloudSavePreview?.totalKills ?? 0}</div>
                    <div>Códigos: {cloudSavePreview?.redeemedCodes.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  data-testid="migrate-import-local"
                  disabled={busy}
                  onClick={() => void handleMigrationChoice(true)}
                  className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-60 text-white font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Importar Progresso Local</span>
                </button>

                <button
                  type="button"
                  data-testid="migrate-keep-cloud"
                  disabled={busy}
                  onClick={() => void handleMigrationChoice(false)}
                  className="w-full py-2.5 px-4 bg-[#16131f] hover:bg-[#221d30] disabled:opacity-60 text-[#d6cfc2] text-xs font-medium border border-white/15 transition-colors cursor-pointer"
                >
                  Manter Apenas Progresso da Nuvem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${met ? 'text-[#4ade80]' : 'text-[#7c7469]'}`}>
      <Check className={`w-3 h-3 ${met ? 'opacity-100' : 'opacity-30'}`} />
      <span>{label}</span>
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.2H12z"
      />
      <path
        fill="#34A853"
        d="M3.4 7.5l3.2 2.3C7.5 7.7 9.6 6 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.3 12 2.3 8.1 2.3 4.8 4.4 3.4 7.5z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.7c2.6 0 4.9-.9 6.5-2.4l-3-2.5c-.8.6-1.9 1-3.5 1-3.1 0-5.6-2.1-6.5-5l-3.2 2.5c1.5 3.7 5.2 6.4 9.7 6.4z"
      />
      <path
        fill="#4285F4"
        d="M21.5 13.2H12v-3h9.4c.1.5.2 1.1.2 1.8 0 2.5-1 5.1-3.1 7.3l-3-2.5c1.1-.8 1.9-2 2.2-3.6h3.8z"
      />
    </svg>
  );
}
