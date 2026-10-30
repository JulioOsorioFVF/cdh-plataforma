/**
 * Reglas de contrasena del Consejo de Honor.
 *
 * Este modulo es PURO: no importa nada de Node, para que el formulario de
 * cambio de clave (que corre en el navegador) pueda mostrar las reglas sin
 * arrastrar `node:crypto` al bundle del cliente. El hashing vive aparte, en
 * `password.ts`, que es solo servidor.
 */

/**
 * Contrasena estandar que entrega el Consejo de Honor. El administrador puede
 * restablecer cualquier usuario a esta clave; el sistema entonces obliga a
 * cambiarla en el siguiente ingreso.
 */
export const PASSWORD_ESTANDAR = 'FVF123456*';

export const LONGITUD_MINIMA = 8;
export const LONGITUD_MAXIMA = 200;

/**
 * Politica de contrasenias.
 *
 * Devuelve un array de requisitos incumplidos; vacio significa aceptable.
 * No se exige composicion de simbolos: las claves del Consejo se teclean en
 * mostradores de sala y una regla que obligue a `!@#$` produce contrasenias
 * apuntadas en un papel pegado a la pantalla.
 */
export function validarContrasena(clave: string): string[] {
  const errores: string[] = [];

  if (clave.length < LONGITUD_MINIMA) {
    errores.push(`Debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
  }
  if (clave.length > LONGITUD_MAXIMA) {
    errores.push(`No puede superar ${LONGITUD_MAXIMA} caracteres.`);
  }
  if (!/[a-z]/.test(clave)) {
    errores.push('Debe incluir al menos una letra minuscula.');
  }
  if (!/[A-Z]/.test(clave)) {
    errores.push('Debe incluir al menos una letra mayuscula.');
  }
  if (!/\d/.test(clave)) {
    errores.push('Debe incluir al menos un digito.');
  }
  if (clave === PASSWORD_ESTANDAR) {
    errores.push('No puede ser igual a la contrasena estandar.');
  }
  if (clave.length > 1 && /^(.)\1+$/.test(clave)) {
    errores.push('No puede ser un unico caracter repetido.');
  }

  return errores;
}

/** Reglas que se muestran al usuario en la pantalla de cambio de clave. */
export const REGLAS_CONTRASENA = [
  `Al menos ${LONGITUD_MINIMA} caracteres`,
  'Una letra minuscula',
  'Una letra mayuscula',
  'Al menos un digito',
  'Distinta de la contrasena estandar',
] as const;
