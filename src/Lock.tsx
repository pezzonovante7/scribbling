import { useEffect, useState } from 'react';
import { Lock as LockIcon, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { dbVault, type VaultMeta } from './db';
import {
  deriveKey,
  makeVerifier,
  newSaltB64,
  checkVerifier,
  encryptString,
  PBKDF2_ITERATIONS,
} from './crypto';

interface Props {
  onUnlock: (key: CryptoKey) => void;
  // bump to force a re-probe (e.g., after creating the vault)
  refreshKey?: number;
}

export function LockScreen({ onUnlock, refreshKey = 0 }: Props) {
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [meta, setMeta] = useState<VaultMeta | undefined | null>(null);
  const [openErr, setOpenErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dbVault.open();
        const m = await dbVault.vault.get(1);
        if (!cancelled) setMeta(m ?? undefined);
      } catch (e) {
        if (!cancelled) setOpenErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const loading = meta === null;
  const isSetup = !loading && !meta;

  const reset = () => {
    setError('');
    setPass1('');
    setPass2('');
  };

  const handleSetup = async () => {
    setError('');
    if (pass1.length < 6) return setError('Use at least 6 characters.');
    if (pass1 !== pass2) return setError("Passphrases don't match.");
    setBusy(true);
    try {
      const saltB64 = newSaltB64();
      const key = await deriveKey(pass1, saltB64);
      const verifier = await makeVerifier(key);
      await dbVault.vault.put({
        id: 1,
        saltB64,
        verifierB64: verifier,
        iterations: PBKDF2_ITERATIONS,
        createdAt: new Date(),
      });
      const legacy = await dbVault.notes
        .filter((n) => (n as { _legacyTitle?: string })._legacyTitle !== undefined)
        .toArray();
      for (const n of legacy) {
        const data = await encryptString(
          key,
          JSON.stringify({
            title: n._legacyTitle ?? '',
            content: n._legacyContent ?? '',
            tags: n._legacyTags ?? [],
          })
        );
        await dbVault.notes.update(n.id!, {
          data,
          _legacyTitle: undefined,
          _legacyContent: undefined,
          _legacyTags: undefined,
        });
      }
      reset();
      onUnlock(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!meta) return;
    setError('');
    setBusy(true);
    try {
      const key = await deriveKey(pass1, meta.saltB64, meta.iterations);
      const ok = await checkVerifier(key, meta.verifierB64);
      if (!ok) {
        setError('Incorrect passphrase.');
        return;
      }
      reset();
      onUnlock(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => (isSetup ? handleSetup() : handleUnlock());

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-cocoa-soft gap-2 p-8 text-center">
        <div>Loading…</div>
        {openErr && (
          <div className="text-xs text-ember max-w-md break-words">{openErr}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-blush rounded-4xl border border-line p-8 shadow-soft">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-peach-soft flex items-center justify-center">
            <LockIcon className="w-8 h-8 text-coral" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-center text-cocoa">
          {isSetup ? 'Create your vault' : 'Welcome back'}
        </h2>
        <p className="text-center text-cocoa-soft mt-2 text-sm leading-relaxed">
          {isSetup
            ? 'Choose a passphrase. Your personal notes will be encrypted on this device.'
            : 'Enter your passphrase to unlock personal notes.'}
        </p>

        {isSetup && (
          <div className="mt-4 px-4 py-3 rounded-2xl bg-peach-soft text-cocoa text-xs flex gap-2 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-ember" />
            <span>
              If you forget your passphrase, your personal notes can't be recovered. There's
              no reset.
            </span>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={isSetup ? 'Choose a passphrase' : 'Passphrase'}
              autoFocus
              className="w-full px-4 py-3 pr-12 bg-cream border border-line rounded-2xl text-cocoa placeholder:text-cocoa-soft focus:outline-none focus:border-coral transition"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-soft hover:text-coral p-1"
              aria-label={show ? 'Hide passphrase' : 'Show passphrase'}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {isSetup && (
            <input
              type={show ? 'text' : 'password'}
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Confirm passphrase"
              className="w-full px-4 py-3 bg-cream border border-line rounded-2xl text-cocoa placeholder:text-cocoa-soft focus:outline-none focus:border-coral transition"
            />
          )}
          {error && <p className="text-sm text-ember">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || !pass1 || (isSetup && !pass2)}
            className="w-full py-3 rounded-2xl bg-coral hover:bg-coral-deep text-white font-semibold disabled:opacity-50 transition shadow-glow"
          >
            {busy ? 'Working…' : isSetup ? 'Create vault' : 'Unlock'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-cocoa-soft">
          {isSetup
            ? 'AES-GCM · 256-bit · PBKDF2 200k iterations'
            : 'Encrypted with AES-GCM on this device only'}
        </p>
      </div>
    </div>
  );
}
