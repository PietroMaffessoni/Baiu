import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { auth, AuthFailure, type AuthBackend, type Profile, type SignUpInput } from '@/lib/auth';
import { clearReminders } from '@/lib/reminders';
import { blockSaves, wipeVault } from '@/lib/vault';

type Status = 'loading' | 'signedOut' | 'signedIn';

type Ctx = {
  status: Status;
  profile: Profile | null;
  /** Explorando os dados de exemplo, sem conta. */
  demo: boolean;
  /** Entrou com o código de recuperação e ainda precisa criar a senha nova. */
  recovering: boolean;
  configured: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  signUp: (input: SignUpInput) => Promise<void>;
  verifySignUp: (email: string, code: string) => Promise<void>;
  resendSignUp: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  verifyReset: (email: string, code: string) => Promise<void>;
  finishReset: (password: string) => Promise<void>;
  cancelReset: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  updateProfile: (p: { fullName: string; phone: string }) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children, backend = auth }: { children: ReactNode; backend?: AuthBackend }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const profileRef = useRef<Profile | null>(null);

  const apply = useCallback((p: Profile | null) => {
    profileRef.current = p;
    setProfile(p);
    setStatus(p ? 'signedIn' : 'signedOut');
    if (p) setDemo(false);
  }, []);

  useEffect(() => {
    let alive = true;
    backend
      .restore()
      .then((p) => alive && apply(p))
      .catch(() => alive && apply(null));
    const off = backend.subscribe((p) => alive && apply(p));
    return () => {
      alive = false;
      off();
    };
  }, [backend, apply]);

  const requireProfile = () => {
    const p = profileRef.current;
    if (!p) throw new AuthFailure('session_expired');
    return p;
  };

  const value = useMemo<Ctx>(
    () => ({
      status,
      profile,
      demo,
      recovering,
      configured: backend.configured,
      enterDemo: () => setDemo(true),
      exitDemo: () => setDemo(false),
      signUp: (input) => backend.signUp(input),
      verifySignUp: async (email, code) => apply(await backend.verifySignUp(email, code)),
      resendSignUp: (email) => backend.resendSignUp(email),
      signIn: async (email, password) => apply(await backend.signIn(email, password)),
      requestReset: (email) => backend.requestReset(email),
      verifyReset: async (email, code) => {
        // segura a pessoa na tela de nova senha mesmo já conectada
        setRecovering(true);
        try {
          apply(await backend.verifyReset(email, code));
        } catch (e) {
          setRecovering(false);
          throw e;
        }
      },
      finishReset: async (password) => {
        await backend.updatePassword(password);
        setRecovering(false);
      },
      cancelReset: async () => {
        setRecovering(false);
        await backend.signOut();
        apply(null);
      },
      changePassword: async (current, next) => {
        const p = requireProfile();
        await backend.confirmPassword(p.email, current).catch((e) => {
          throw e instanceof AuthFailure && e.code === 'invalid_credentials'
            ? new AuthFailure('invalid_credentials', 'A senha atual está incorreta.')
            : e;
        });
        await backend.updatePassword(next);
      },
      updateProfile: async (p) => apply(await backend.updateProfile(p)),
      deleteAccount: async (password) => {
        const p = requireProfile();
        await backend.confirmPassword(p.email, password).catch((e) => {
          throw e instanceof AuthFailure && e.code === 'invalid_credentials'
            ? new AuthFailure('invalid_credentials', 'Senha incorreta.')
            : e;
        });
        blockSaves(p.id, true);
        try {
          await backend.deleteAccount();
        } catch (e) {
          blockSaves(p.id, false);
          throw e;
        }
        await wipeVault(p.id, { forever: true }).catch(() => {});
        await clearReminders().catch(() => {});
        apply(null);
      },
      signOut: async () => {
        await clearReminders().catch(() => {});
        await backend.signOut().catch(() => {});
        apply(null);
      },
    }),
    [status, profile, demo, recovering, backend, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
