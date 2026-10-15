import { HIDDEN } from '../money';

/** Com "Ocultar valores" ligado, a conversa também esconde os reais. */
export function maskValues(text: string) {
  return text.replace(/[−-]?R\$\s?\d[\d.]*(,\d{2})?/g, HIDDEN);
}

/** A IA é orientada a responder em texto simples; isto limpa o que escapar. */
export function cleanReply(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
