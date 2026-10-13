import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

/**
 * Criptografia dos dados no aparelho: XChaCha20-Poly1305 (cifra autenticada).
 * A chave de 32 bytes vem do Keychain/Keystore; o nonce de 24 bytes é aleatório
 * a cada gravação. Formato: "b1." + base64(nonce || texto cifrado).
 */
const PREFIX = 'b1.';
export const KEY_BYTES = 32;
export const NONCE_BYTES = 24;

export function encryptString(plain: string, key: Uint8Array, nonce: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new Error('chave inválida');
  if (nonce.length !== NONCE_BYTES) throw new Error('nonce inválido');
  const sealed = xchacha20poly1305(key, nonce).encrypt(utf8Encode(plain));
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, nonce.length);
  return PREFIX + toBase64(out);
}

/** Lança erro se o conteúdo foi alterado ou se a chave não é a mesma. */
export function decryptString(payload: string, key: Uint8Array): string {
  if (!payload.startsWith(PREFIX)) throw new Error('formato desconhecido');
  const raw = fromBase64(payload.slice(PREFIX.length));
  if (raw.length <= NONCE_BYTES + 16) throw new Error('conteúdo truncado');
  const nonce = raw.subarray(0, NONCE_BYTES);
  const body = raw.subarray(NONCE_BYTES);
  return utf8Decode(xchacha20poly1305(key, nonce).decrypt(body));
}

// UTF-8 próprio: o Hermes não garante TextDecoder.
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (n - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length;) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    if (cp >= 0x10000) {
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    } else s += String.fromCharCode(cp);
  }
  return s;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    s += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return s;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let j = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_INDEX[clean.charCodeAt(i)];
    if (v === undefined || v < 0) throw new Error('base64 inválido');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (acc >> bits) & 255;
    }
  }
  return out.subarray(0, j);
}
