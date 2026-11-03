import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requiereSesion } from '@/server/auth/sesion';

export const dynamic = 'force-dynamic';

export default async function IncidenciasPage() {
  await requiereSesion();

  const [clubes, sancionesConAlerta, totalSancionesAlerta] = await Promise.all([
    prisma.dim_club.findMany({
      take: 20,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        liga: true,
        vigente: true,
      },
    }),
    prisma.fact_sancion.findMany({
      where: { alertaSuspension: true },
      take: 25,
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        fecha: true,
        nombreRaw: true,
        motivoRaw: true,
        sanctionJuegos: true,
        sanctionDias: true,
        club: { select: { nombre: true } },
      },
    }),
    prisma.fact_sancion.count({
      where: { alertaSuspension: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Control de Incidencias & Licencias FVF
              </span>
              <span className="text-slate-500 text-xs">Sistema COMET / Licencias de Clubes</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Incidencias, Bloqueos y Medidas Cautelares
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Monitoreo en tiempo real de inhabilitaciones provisionales, alertas de suspensión de licencias y
              medidas preventivas de aseguramiento deportivo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/expedientes"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-oro-500 text-slate-950 hover:bg-oro-400 transition shadow flex items-center gap-1.5"
            >
              <span>📋</span> Ver Expedientes
            </Link>
          </div>
        </div>

        {/* Tickers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Alertas de Suspensión Activas
            </span>
            <span className="text-2xl font-black text-rose-400 mt-0.5 block">
              {totalSancionesAlerta}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Clubes Monitoreados
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {clubes.length}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Estado de Integridad
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
              Solvente
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Alertas de Suspensión */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🚨</span> Inhabilitaciones y Alertas COMET
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
              {sancionesConAlerta.length} registros
            </span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {sancionesConAlerta.map((s) => (
              <div
                key={String(s.id)}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 hover:border-rose-500/40 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{s.nombreRaw || 'Persona bajo sanción'}</span>
                  <span className="text-rose-400 font-mono text-[10px] font-bold">
                    {s.sanctionJuegos ? `${s.sanctionJuegos} partidos` : s.sanctionDias ? `${s.sanctionDias} días` : 'Alerta'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] line-clamp-2">
                  {s.motivoRaw || 'Suspensión cautelar preventiva ejecutoriada.'}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                  <span>Club: {s.club?.nombre || 'Federación'}</span>
                  <span>{new Date(s.fecha).toLocaleDateString('es-VE')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directorio de Clubes y Estado de Licencia */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🏟️</span> Licencias de Clubes FVF
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-oro-300">
              Vigentes
            </span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {clubes.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between hover:border-oro-500/40 transition"
              >
                <div>
                  <span className="font-bold text-slate-200 block">{c.nombre}</span>
                  <span className="text-[11px] text-slate-500">Liga: {c.liga || 'Liga FUTVE'} • Código: {c.codigo || 'N/A'}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {c.vigente ? 'Licencia Activa' : 'En Revisión'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
