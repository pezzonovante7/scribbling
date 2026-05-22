const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 200_000;
const VERIFIER_PLAINTEXT = 'scribbling-vault-v1';

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function newSaltB64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64encode(salt);
}

export async function deriveKey(
  passphrase: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const salt = b64decode(saltB64);
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return `${b64encode(iv)}.${b64encode(ct)}`;
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split('.');
  if (!ivB64 || !ctB64) throw new Error('malformed payload');
  const iv = b64decode(ivB64);
  const ct = b64decode(ctB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
}

export async function makeVerifier(key: CryptoKey): Promise<string> {
  return encryptString(key, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(key: CryptoKey, verifierB64: string): Promise<boolean> {
  try {
    const pt = await decryptString(key, verifierB64);
    return pt === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
