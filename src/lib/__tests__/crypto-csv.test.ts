import { createDemo } from '@/data/demo';
import { cell, transactionsCsv } from '../csv';
import { decryptString, encryptString, fromBase64, toBase64, utf8Decode, utf8Encode } from '../crypto';
import { brl } from '../money';

const key = Uint8Array.from({ length: 32 }, (_, i) => i * 7);
const nonce = (seed: number) => Uint8Array.from({ length: 24 }, (_, i) => (i * 13 + seed) & 255);

describe('cofre', () => {
  it('cifra e decifra texto com acentos e emoji', () => {
    const plain = JSON.stringify({ nome: 'Pão de Açúcar', valor: 187.35, nota: 'ok 🐡' });
    const sealed = encryptString(plain, key, nonce(1));
    expect(sealed.startsWith('b1.')).toBe(true);
    expect(sealed).not.toContain('Açúcar');
    expect(decryptString(sealed, key)).toBe(plain);
  });

  it('nonce diferente gera texto cifrado diferente', () => {
    expect(encryptString('igual', key, nonce(1))).not.toBe(encryptString('igual', key, nonce(2)));
  });

  it('recusa conteúdo alterado ou chave errada', () => {
    const sealed = encryptString('segredo', key, nonce(3));
    const raw = fromBase64(sealed.slice(3));
    raw[raw.length - 1] ^= 1;
    expect(() => decryptString('b1.' + toBase64(raw), key)).toThrow();
    const other = Uint8Array.from(key, (b) => b ^ 255);
    expect(() => decryptString(sealed, other)).toThrow();
  });

  it('base64 e utf-8 próprios fazem ida e volta', () => {
    const bytes = Uint8Array.from({ length: 257 }, (_, i) => i % 256);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    const text = 'çãé ñ 漢字 🐡';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
    expect(Array.from(utf8Encode(text))).toEqual(Array.from(new TextEncoder().encode(text)));
  });
});

describe('exportação CSV', () => {
  it('neutraliza células que viram fórmula', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell('+55 11')).toBe(`"'+55 11"`);
    expect(cell('Mercado')).toBe('"Mercado"');
    expect(cell(-46.9)).toBe('"-46,90"');
  });

  it('exporta todos os movimentos com cabeçalho', () => {
    const demo = createDemo(new Date(2026, 9, 13, 15));
    const csv = transactionsCsv(demo);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('"Data";"Descrição"');
    expect(lines.length).toBe(demo.txs.length + 1);
  });
});

describe('dinheiro', () => {
  it('formata no padrão brasileiro', () => {
    expect(brl(16563.35)).toBe('R$ 16.563,35');
    expect(brl(-46.9)).toBe('−R$ 46,90');
    expect(brl(120, { sign: 'always' })).toBe('+R$ 120,00');
  });
});
