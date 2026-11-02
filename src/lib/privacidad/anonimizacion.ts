/** Elimina identificadores directos habituales antes de cualquier envío a IA. */
export function anonimizarIdentificadoresDirectos(texto: string): string {
  return texto
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/giu, '[CORREO]')
    .replace(/\b(?:V|E|J|G|P)[-\s]?\d{6,12}\b/giu, '[IDENTIFICACIÓN]')
    .replace(/\b\d{6,12}\b/g, '[IDENTIFICACIÓN]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[TELÉFONO]');
}
