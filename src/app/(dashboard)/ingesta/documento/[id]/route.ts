import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { rutaAdjunto } from '@/lib/expedientes/archivos';
import { prisma } from '@/lib/prisma';
import { requierePermiso } from '@/server/auth/sesion';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requierePermiso('ingesta:run');
  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isSafeInteger(documentoId) || documentoId < 1) {
    return new NextResponse('Documento no válido.', { status: 400 });
  }

  const documento = await prisma.expediente_documento.findUnique({
    where: { id: documentoId },
    select: { ruta: true, nombre: true, mimeType: true },
  });
  if (!documento) return new NextResponse('Documento no encontrado.', { status: 404 });

  const bytes = await readFile(rutaAdjunto(documento.ruta));
  const nombre = documento.nombre.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/["\r\n]/g, '_');
  const nombreCodificado = encodeURIComponent(documento.nombre).replace(
    /[!'()*]/g,
    (caracter) => `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': documento.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="${nombre}"; filename*=UTF-8''${nombreCodificado}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
