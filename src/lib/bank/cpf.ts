/** Só os números do CPF. */
export const cpfDigits = (raw: string) => raw.replace(/\D/g, '').slice(0, 11);

/** 000.000.000-00, conforme a pessoa digita. */
export function formatCpf(raw: string) {
  const d = cpfDigits(raw);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.') + (d.length > 9 ? `-${d.slice(9)}` : '');
}

/** CPF com os dígitos verificadores certos. */
export function validCpf(raw: string) {
  const d = cpfDigits(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}
