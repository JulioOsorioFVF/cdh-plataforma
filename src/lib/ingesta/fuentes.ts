/**
 * Registro de fuentes y descarga.
 *
 * Las URLs viven en `.env` con los mismos nombres que usa la CLI, y si no
 * estan se cae a los valores por defecto del proyecto. Asi la web y la consola
 * leen exactamente la misma fuente, sin dos configuraciones que se desincronicen.
 */
import { createHash } from 'node:crypto';

export type ClaveDocumento = 'competencias' | 'expedientes';

export type Fuente = {
  clave: ClaveDocumento;
  documento: 'COMPETENCIAS' | 'EXPEDIENTES';
  etiqueta: string;
  descripcion: string;
  url: string;
  gid: string;
  archivo: string;
};

const DEFECTO: Record<ClaveDocumento, Omit<Fuente, 'clave' | 'etiqueta' | 'descripcion'>> = {
  competencias: {
    documento: 'COMPETENCIAS',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNosjqXFHJudTeOffMON_e-W0oslKa1oaR50-SzFIhDbD5X24T7j-FxrV9z4NsQA/pub?gid=1639745222&single=true&output=csv',
    gid: '1639745222',
    archivo: 'competencias.csv',
  },
  expedientes: {
    documento: 'EXPEDIENTES',
    url: 'https://docs.google.com/spreadsheets/d/1Njhrbdf32k4TfAAaTh-gVYH6BaVUZ8yMh5vUs3h7PgE/export?format=csv&gid=1385768914',
    gid: '1385768914',
    archivo: 'expedientes.csv',
  },
};

const TEXTOS: Record<ClaveDocumento, { etiqueta: string; descripcion: string }> = {
  competencias: {
    etiqueta: 'Competencias',
    descripcion: 'Una fila por sanción disciplinaria: torneo, club, persona, norma y monto en U.C.',
  },
  expedientes: {
    etiqueta: 'Cuadro de expedientes',
    descripcion: 'Un expediente por fila: partes, trámite, decisión, sanción y multas.',
  },
};

/** Devuelve la fuente configurada para un documento. */
export function buscarFuente(clave: ClaveDocumento): Fuente {
  const base = DEFECTO[clave];
  const env =
    clave === 'competencias'
      ? process.env.GOOGLE_SHEETS_COMPETENCIAS_URL
      : process.env.GOOGLE_SHEETS_EXPEDIENTES_CSV_URL;

  return {
    clave,
    documento: base.documento,
    url: (env && env.trim()) || base.url,
    gid:
      (clave === 'competencias'
        ? process.env.GOOGLE_SHEETS_COMPETENCIAS_GID
        : process.env.GOOGLE_SHEETS_EXPEDIENTES_GID) || base.gid,
    archivo: base.archivo,
    ...TEXTOS[clave],
  };
}

export function clavesDeDocumento(): ClaveDocumento[] {
  return ['competencias', 'expedientes'];
}

/** Huella del contenido: identifica un lote y permite comparar dos corridas. */
export function huella(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * Descarga el CSV de una fuente.
 *
 * Se exige un tamano minimo porque Google devuelve una pagina de error HTML
 * con estado 200 cuando la hoja se despublica; sin esta comprobacion la ingesta
 * "funcionaria" y cargaria cero filas.
 */
export async function descargarCsv(url: string, timeoutMs = 90_000): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8' },
  });

  if (!res.ok) throw new Error(`La fuente respondió HTTP ${res.status}.`);

  const texto = await res.text();
  if (texto.length < 1000) {
    throw new Error(
      `La fuente devolvió ${texto.length} bytes. Suele significar que la hoja dejó de estar publicada.`,
    );
  }
  if (/<html/i.test(texto.slice(0, 200))) {
    throw new Error('La fuente devolvió HTML en vez de CSV. Revise los permisos de la hoja.');
  }
  return texto;
}
