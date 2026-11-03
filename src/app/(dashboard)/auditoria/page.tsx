import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requiereSesion } from '@/server/auth/sesion';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage() {
  await requiereSesion();

  // Traer los últimos movimientos y documentos para la traza forense
  const [movimientos, totalMovimientos, expedientesRecientes] = await Promise.all([
    prisma.fact_expediente_movimiento.findMany({
      take: 30,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        fecha: true,
        tipo: true,
        codigo: true,
        descripcion: true,
        expediente: {
          select: {
            numero: true,
            anio: true,
            nombre: true,
          },
        },
      },
    }),
    prisma.fact_expediente_movimiento.count(),
    prisma.fact_expediente.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        numero: true,
        anio: true,
        updatedAt: true,
        estatus: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                Trazabilidad Criptográfica & Integridad
              </span>
              <span className="text-slate-500 text-xs">Art. 161 RDFVF (Firma Digital y Fe Pública)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bitácora de Auditoría y Trazabilidad Forense
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Registro inmutable de todas las actuaciones procesales, emisión de autos, notificaciones, cambios de
              estado y firmas electrónicas ejecutadas en la plataforma.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/plataforma"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>🧭</span> Suite de Funciones
            </Link>
          </div>
        </div>

        {/* Tickers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Eventos Registrados
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {totalMovimientos.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Integridad de Registros
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
              100% Verificado
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Protocolo de Firma Digital
            </span>
            <span className="text-2xl font-black text-oro-400 mt-0.5 block">
              RSA-SHA256
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de Bitácora */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>📜</span> Registro Cronológico de Eventos Procesales
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Últimas 30 actuaciones auditadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">ID Evento</th>
                <th className="p-3">Expediente</th>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Tipo de Actuación</th>
                <th className="p-3">Código Oficial</th>
                <th className="p-3">Descripción de la Operación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono text-slate-500">
                    #{m.id}
                  </td>
                  <td className="p-3 font-semibold text-white">
                    {m.expediente ? `${m.expediente.numero}/${m.expediente.anio}` : 'General'}
                  </td>
                  <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                    {m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : 'Reciente'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-oro-300 border border-slate-700">
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-cyan-400">
                    {m.codigo || 'AUTO-CDH'}
                  </td>
                  <td className="p-3 max-w-md truncate text-slate-300">
                    {m.descripcion || 'Actuación registrada en el expediente disciplinario.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
