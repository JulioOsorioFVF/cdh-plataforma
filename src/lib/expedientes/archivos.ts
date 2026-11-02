import { resolve, basename } from 'node:path';

export const MAX_ADJUNTO_BYTES = 25 * 1024 * 1024;

export function directorioAdjuntos(): string {
  return resolve(
    process.env.CDH_ARCHIVOS_DIR || resolve(process.cwd(), 'storage', 'expedientes'),
  );
}

export function rutaAdjunto(nombreInterno: string): string {
  if (!/^[a-f0-9]{32}\.pdf$/i.test(basename(nombreInterno))) {
    throw new Error('La ruta del documento no es válida.');
  }
  return resolve(directorioAdjuntos(), basename(nombreInterno));
}
