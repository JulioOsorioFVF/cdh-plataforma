import { NextResponse } from 'next/server';
import { analizarExpedienteCompletoConIA } from '@/server/ia/extractor-expediente-pdf';
import { prisma } from '@/lib/prisma';
import { obtenerSesion } from '@/server/auth/sesion';

export const maxDuration = 60;

const LIMITE_TAMANO_BYTES = 25 * 1024 * 1024; // 25 MB máximo por expediente
const EXTENSIONES_PERMITIDAS = new Set(['.pdf', '.txt', '.doc', '.docx', '.rtf', '.csv']);

/**
 * Sanitiza nombres de archivos para prevenir ataques de Path Traversal o caracteres de control.
 */
function sanitizarNombreArchivo(nombreOriginal: string): string {
  const nombreLimpio = nombreOriginal
    .replace(/[/\\]/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
  return nombreLimpio || 'expediente_documento.pdf';
}

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
    // En entornos de producción se exige autenticación formal
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
        // Validación de tamaño máximo (Protección DoS)
        if (archivo.size > LIMITE_TAMANO_BYTES) {
          return NextResponse.json(
            { error: 'El archivo excede el tamaño máximo permitido de 25 MB por seguridad.' },
            { status: 413 }
          );
        }

        nombreArchivo = sanitizarNombreArchivo(archivo.name);
        const ext = '.' + (nombreArchivo.split('.').pop() || '').toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.has(ext)) {
          return NextResponse.json(
            { error: 'Formato de archivo no permitido. Solo se admiten archivos PDF, TXT, DOC, DOCX o RTF.' },
            { status: 415 }
          );
        }

        tamanoBytes = archivo.size;
        const arrayBuffer = await archivo.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (ext === '.pdf') {
          // Verificación de cabecera PDF (Magic bytes %PDF)
          const esPdfValido = buffer.slice(0, 5).toString('ascii').startsWith('%PDF');
          if (!esPdfValido && buffer.length > 100) {
            console.warn('Advertencia: El archivo no contiene la cabecera estándar %PDF.');
          }
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
      nombreArchivo = sanitizarNombreArchivo(body.nombreArchivo || 'documento_expediente.pdf');
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
    const mensajeSeguro =
      process.env.NODE_ENV === 'production'
        ? 'Error al procesar y extraer datos del documento.'
        : error.message || 'Error al procesar y extraer datos del PDF';

    return NextResponse.json({ error: mensajeSeguro }, { status: 500 });
  }
}
