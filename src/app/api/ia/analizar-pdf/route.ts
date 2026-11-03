import { NextResponse } from 'next/server';
import { analizarExpedienteCompletoConIA } from '@/server/ia/extractor-expediente-pdf';
import { prisma } from '@/lib/prisma';
import { obtenerSesion } from '@/server/auth/sesion';

export const maxDuration = 60;

/**
 * Extrae cadenas legibles y objetos de texto de un buffer PDF en memoria sin dependencias nativas.
 */
function extraerTextoDeBufferPdf(buffer: Buffer): string {
  try {
    const rawString = buffer.toString('binary');
    const fragmentos: string[] = [];

    // 1. Extraer bloques de texto en streams de PDF: (texto) Tj o [(texto)] TJ
    const textRegex = /\(([^()]{2,500})\)\s*(?:Tj|'|")/g;
    let match: RegExpExecArray | null;
    while ((match = textRegex.exec(rawString)) !== null) {
      if (match[1]) {
        // Limpiar secuencias de escape comunes en PDFs: \r, \n, \t, \(, \)
        const limpio = match[1]
          .replace(/\\([()\\])/g, '$1')
          .replace(/\\r/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ');
        if (limpio.trim().length > 1) {
          fragmentos.push(limpio.trim());
        }
      }
    }

    // 2. Si se extrajeron suficientes bloques de texto, unirlos
    if (fragmentos.length > 20) {
      return fragmentos.join(' ');
    }

    // 3. Fallback: extraer secuencias de caracteres ASCII/Latin legibles (4 o más caracteres consecutivos)
    const asciiRegex = /[\x20-\x7E\xA0-\xFF]{4,}/g;
    const coincidencias = rawString.match(asciiRegex) || [];
    const textoExtraido = coincidencias
      .filter((s) => !s.startsWith('/Length') && !s.startsWith('/Filter') && !s.includes('endobj'))
      .join(' ')
      .replace(/\s+/g, ' ');

    return textoExtraido.slice(0, 150_000);
  } catch (err) {
    console.error('Error al decodificar buffer PDF:', err);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const sesion = await obtenerSesion();
    // En entornos locales o de desarrollo permitimos la ejecución; en prod sesion debe ser válida
    if (process.env.NODE_ENV === 'production' && !sesion) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión en la plataforma.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let textoDocumento = '';
    let nombreArchivo = 'expediente.pdf';
    let tamanoBytes = 0;
    let expedienteId: number | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const archivo = formData.get('archivo') as File | null;
      const textoManual = formData.get('texto') as string | null;
      const expIdRaw = formData.get('expedienteId') as string | null;

      if (expIdRaw) {
        expedienteId = parseInt(expIdRaw, 10);
      }

      if (archivo && archivo.size > 0) {
        nombreArchivo = archivo.name;
        tamanoBytes = archivo.size;
        const arrayBuffer = await archivo.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (nombreArchivo.toLowerCase().endsWith('.pdf')) {
          textoDocumento = extraerTextoDeBufferPdf(buffer);
        } else {
          textoDocumento = buffer.toString('utf-8');
        }
      }

      if (textoManual && textoManual.trim()) {
        textoDocumento = textoDocumento ? `${textoDocumento}\n\n${textoManual}` : textoManual;
      }
    } else {
      // JSON payload
      const body = await request.json().catch(() => ({}));
      textoDocumento = body.texto || '';
      nombreArchivo = body.nombreArchivo || 'documento_expediente.pdf';
      tamanoBytes = body.tamanoBytes || (textoDocumento ? textoDocumento.length : 0);
      expedienteId = body.expedienteId;
    }

    if (!textoDocumento || textoDocumento.trim().length === 0) {
      return NextResponse.json(
        { error: 'No se pudo extraer texto legible del archivo. Por favor ingrese el texto del informe o auto directamente.' },
        { status: 400 }
      );
    }

    // Ejecutar análisis y extracción integral
    const analisis = await analizarExpedienteCompletoConIA(
      textoDocumento,
      nombreArchivo,
      tamanoBytes || textoDocumento.length
    );

    // Si viene expedienteId, persistir registro en expediente_documento
    if (expedienteId && typeof expedienteId === 'number' && !isNaN(expedienteId)) {
      try {
        await prisma.expediente_documento.create({
          data: {
            expedienteId,
            nombre: nombreArchivo,
            tipo: 'PDF',
            tamanoBytes: tamanoBytes || textoDocumento.length,
            mimeType: 'application/pdf',
            ruta: `storage/expedientes/${Date.now()}_${nombreArchivo}`,
          },
        });
      } catch (err) {
        console.error('Error al asociar documento a expediente:', err);
      }
    }

    return NextResponse.json({ ok: true, analisis });
  } catch (error: any) {
    console.error('Error en /api/ia/analizar-pdf:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar y extraer datos del PDF' },
      { status: 500 }
    );
  }
}
