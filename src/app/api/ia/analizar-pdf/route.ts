import { NextResponse } from 'next/server';
import { analizarExpedienteCompletoConIA } from '@/server/ia/extractor-expediente-pdf';
import { prisma } from '@/lib/prisma';
import { obtenerSesion } from '@/server/auth/sesion';

export async function POST(request: Request) {
  try {
    const sesion = await obtenerSesion();
    if (!sesion) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión en la plataforma.' }, { status: 401 });
    }

    const body = await request.json();
    const { texto, nombreArchivo, tamanoBytes, expedienteId } = body;

    if (!texto || typeof texto !== 'string') {
      return NextResponse.json({ error: 'El contenido o texto del documento es requerido.' }, { status: 400 });
    }

    // Ejecutar análisis y extracción integral
    const analisis = await analizarExpedienteCompletoConIA(
      texto,
      nombreArchivo || 'documento_expediente.pdf',
      tamanoBytes || texto.length
    );

    // Si viene expedienteId, persistir registro en expediente_documento
    if (expedienteId && typeof expedienteId === 'number') {
      try {
        await prisma.expediente_documento.create({
          data: {
            expedienteId,
            nombre: nombreArchivo || 'documento_expediente.pdf',
            tipo: 'PDF',
            tamanoBytes: tamanoBytes || texto.length,
            mimeType: 'application/pdf',
            ruta: `storage/expedientes/${Date.now()}_${nombreArchivo || 'expediente.pdf'}`,
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
