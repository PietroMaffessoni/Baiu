import { createEmpty } from '@/data/demo';
import { migrate } from '../migrate';
import { hsl, paletteFor } from '../palette';

describe('cores do Baiu', () => {
  it('converte HSL para hex', () => {
    expect(hsl(0, 1, 0.5)).toBe('#FF0000');
    expect(hsl(120, 1, 0.25)).toBe('#008000');
    expect(hsl(0, 0, 1)).toBe('#FFFFFF');
  });

  it('gera uma paleta válida em todos os humores', () => {
    for (const m of ['murcho', 'meio', 'cheio', 'estufado'] as const) {
      const p = paletteFor(m);
      for (const v of [p.core, p.mid, p.edge, p.rim, p.spot, p.belly, p.fin, p.spine, p.glowColor]) {
        expect(v).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('o Baiu murcho brilha menos e fica mais apagado que o estufado', () => {
    const murcho = paletteFor('murcho');
    const estufado = paletteFor('estufado');
    expect(murcho.glow).toBeLessThan(estufado.glow);
    const sat = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return Math.max(...c) - Math.min(...c);
    };
    expect(sat(murcho.mid)).toBeLessThan(sat(estufado.mid));
  });

  it('a cor e os enfeites guardados por versões antigas são descartados', () => {
    const old = { ...createEmpty(), baiu: { color: 'rosa', seasonal: false } };
    expect(migrate(old)).not.toHaveProperty('baiu');
  });
});
