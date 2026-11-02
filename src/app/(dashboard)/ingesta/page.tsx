import { prisma } from '@/lib/prisma';
import { requierePermiso } from '@/server/auth/sesion';
import { ultimosLotes } from '@/lib/ingesta/lotes';
import { PanelIngestaHistorica } from './panel';

export const dynamic = 'force-dynamic';

export default async function IngestaPage() {
  await requierePermiso('ingesta:run');
  const [expedientes, documentos, lotes, documentosTotales, precedentesAprobados] =
    await Promise.all([
      prisma.fact_expediente.findMany({
        orderBy: [{ anio: 'desc' }, { numero: 'asc' }],
        select: { id: true, numero: true, anio: true, motivo: true },
      }),
      prisma.expediente_documento.findMany({
        orderBy: { subidoEn: 'desc' },
        take: 30,
        select: {
          id: true,
          nombre: true,
          expedienteId: true,
          subidoEn: true,
          expediente: { select: { numero: true, anio: true } },
        },
      }),
      ultimosLotes(10),
      prisma.expediente_documento.count(),
      prisma.memoriaJuridicaVectorial.count({
        where: { codigoReferencia: { startsWith: 'HIST-DOC-' } },
      }),
    ]);

  const referencias = documentos.map((documento) => `HIST-DOC-${documento.id}`);
  const indexados = referencias.length
    ? await prisma.memoriaJuridicaVectorial.findMany({
        where: { codigoReferencia: { in: referencias } },
        select: { codigoReferencia: true },
      })
    : [];
  const codigosIndexados = new Set(indexados.map((documento) => documento.codigoReferencia));

  return (
    <PanelIngestaHistorica
      expedientes={expedientes}
      documentos={documentos.map((documento) => ({
        ...documento,
        subidoEn: documento.subidoEn.toISOString(),
        indexado: codigosIndexados.has(`HIST-DOC-${documento.id}`),
      }))}
      lotes={lotes}
      documentosTotales={documentosTotales}
      precedentesAprobados={precedentesAprobados}
      carpetaDriveConfigurada={Boolean(process.env.GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID)}
    />
  );
}
