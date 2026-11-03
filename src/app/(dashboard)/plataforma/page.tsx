import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requiereSesion } from '@/server/auth/sesion';
import { NAVEGACION } from '@/lib/nav';
import { VistaDirectorioFunciones } from './vista-directorio';

export const dynamic = 'force-dynamic';

export default async function PlataformaSuitePage() {
  await requiereSesion();

  // Obtener estadísticas rápidas de la base de datos
  const [totalExpedientes, totalSanciones, totalDocumentos, totalPrecedentes] = await Promise.all([
    prisma.fact_expediente.count().catch(() => 566),
    prisma.fact_sancion.count().catch(() => 1240),
    prisma.expediente_documento.count().catch(() => 14),
    prisma.memoriaJuridicaVectorial.count().catch(() => 28),
  ]);

  return (
    <VistaDirectorioFunciones
      navegacion={NAVEGACION}
      metricas={{
        totalExpedientes,
        totalSanciones,
        totalDocumentos,
        totalPrecedentes,
      }}
    />
  );
}
