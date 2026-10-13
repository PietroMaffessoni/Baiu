const MINUS = '−';
const NBSP = ' ';

type Opts = {
  /** 'always' mostra + em valores positivos. */
  sign?: 'auto' | 'always' | 'never';
  /** Esconde os centavos (para valores redondos em frases). */
  cents?: boolean;
};

function groupThousands(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formata em reais no padrão brasileiro: R$ 1.234,56 */
export function brl(value: number, { sign = 'auto', cents = true }: Opts = {}) {
  const negative = value < 0;
  const totalCents = Math.round(Math.abs(value) * 100);
  const int = cents ? Math.floor(totalCents / 100) : Math.round(totalCents / 100);
  const dec = String(totalCents % 100).padStart(2, '0');
  const body = cents ? `${groupThousands(int)},${dec}` : groupThousands(int);
  const prefix = sign === 'never' ? '' : negative ? MINUS : sign === 'always' && value > 0 ? '+' : '';
  return `${prefix}R$${NBSP}${body}`;
}

/** Parte inteira e centavos separados, para compor o número grande. */
export function brlParts(value: number) {
  const totalCents = Math.round(Math.abs(value) * 100);
  return {
    negative: value < 0,
    int: groupThousands(Math.floor(totalCents / 100)),
    cents: String(totalCents % 100).padStart(2, '0'),
  };
}

export function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits).replace('.', ',')}%`;
}

export const HIDDEN = `R$${NBSP}••••`;
