/**
 * Analizador CSV minimo pero correcto (RFC 4180).
 *
 * Se escribe a mano en lugar de usar una libreria porque las hojas de Google
 * meten saltos de linea DENTRO de los campos de texto (motivos, decisiones,
 * observaciones). Un `split('\n')` parte el archivo a la mitad y desplaza todas
 * las columnas siguientes, de modo que el dato acaba en la columna vecina sin
 * que nada lo advierta.
 *
 * Soporta: comillas dobles, el caracter de escape doblado (""), CRLF, LF,
 * BOM UTF-8 y el separador configurable (las hojas usan coma, pero el
 * descargador antiguo de Drive usaba punto y coma).
 */

/** Divide el texto CSV en filas de celdas. */
export function parseCsv(texto: string, separador = ','): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;
  let i = 0;

  // El BOM rompe la comparacion del primer encabezado.
  if (texto.charCodeAt(0) === 0xfeff) i = 1;

  const n = texto.length;
  while (i < n) {
    const c = texto[i]!;

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i += 2;
          continue;
        }
        enComillas = false;
        i++;
        continue;
      }
      celda += c;
      i++;
      continue;
    }

    if (c === '"') {
      enComillas = true;
      i++;
      continue;
    }
    if (c === separador) {
      fila.push(celda);
      celda = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
      i++;
      continue;
    }
    celda += c;
    i++;
  }

  // Ultima fila sin salto de linea final.
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  // Descarta la fila vacia final que dejan algunos exportadores.
  while (filas.length > 0) {
    const u = filas[filas.length - 1]!;
    if (u.length === 1 && u[0]!.trim() === '') filas.pop();
    else break;
  }

  return filas;
}

/**
 * Detecta el separador real contando el que aparece fuera de comillas en la
 * primera linea. Las hojas exportadas por Drive a veces dicen CSV pero envian
 * punto y coma cuando la configuracion regional lo impone.
 */
export function detectarSeparador(texto: string): string {
  const primeraLinea = texto.slice(
    0,
    texto.indexOf('\n') === -1 ? texto.length : texto.indexOf('\n'),
  );
  const candidatos = [',', ';', '\t'];
  let mejor = ',';
  let max = -1;
  for (const sep of candidatos) {
    let n = 0;
    let enComillas = false;
    for (const c of primeraLinea) {
      if (c === '"') enComillas = !enComillas;
      else if (!enComillas && c === sep) n++;
    }
    if (n > max) {
      max = n;
      mejor = sep;
    }
  }
  return mejor;
}

export type Tabla = { encabezados: string[]; filas: string[][] };

/** Parsea el archivo completo y separa encabezados de filas. */
export function leerTabla(texto: string): Tabla {
  const filas = parseCsv(texto, detectarSeparador(texto));
  const encabezados = (filas.shift() ?? []).map((h) => h.trim());
  // Descarta filas totalmente vacias.
  return {
    encabezados,
    filas: filas.filter((f) => f.some((c) => c.trim() !== '')),
  };
}

/**
 * Devuelve el valor de una celda por POSICION, no por nombre.
 *
 * En el CUADRO DE EXPEDIENTES los encabezados se repiten: "Ano" aparece en las
 * columnas 1 y 18, y "Decision" en la 21 y la 28. Buscar por nombre daria el
 * valor equivocado, asi que la ingesta accede siempre por indice.
 */
export function celda(fila: string[], indice: number): string {
  const v = fila[indice];
  return v === undefined ? '' : v.trim();
}

/** Igual que `celda` pero conserva los espacios, para texto que se guarda tal cual. */
export function celdaCruda(fila: string[], indice: number): string {
  const v = fila[indice];
  return v === undefined ? '' : v;
}

/**
 * Escapa una celda para CSV (RFC 4180).
 *
 * Se comilla cuando el valor trae el separador, comillas o saltos de linea. Si
 * no se hiciera, un motivo con una coma partiria la fila en dos y el archivo de
 * rechazos quedaria desalineado justo donde hay que corregirlo.
 */
export function escaparCelda(valor: string, separador = ','): string {
  const necesita =
    valor.includes(separador) || valor.includes('"') || valor.includes('\n') || valor.includes('\r');
  return necesita ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/** Serializa una matriz de celdas a texto CSV, con CRLF (el que espera Excel). */
export function generarCsv(filas: string[][], separador = ','): string {
  return filas.map((f) => f.map((c) => escaparCelda(c ?? '', separador)).join(separador)).join('\r\n');
}
