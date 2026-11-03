import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requiereSesion } from '@/server/auth/sesion';

export const dynamic = 'force-dynamic';

export default async function SancionesPage() {
  await requiereSesion();

  const [sanciones, totalSanciones, totalMultasUc] = await Promise.all([
    prisma.fact_sancion.findMany({
      take: 50,
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        fecha: true,
        nombreRaw: true,
        cedulaRaw: true,
        motivoRaw: true,
        sanctionJuegos: true,
        sanctionDias: true,
        multaUc: true,
        multaUsd: true,
        proc: true,
        torneo: { select: { nombre: true } },
        club: { select: { nombre: true } },
        persona: { select: { nombreCompleto: true, cedula: true } },
      },
    }),
    prisma.fact_sancion.count(),
    prisma.fact_sancion.aggregate({
      _sum: { multaUc: true, multaUsd: true },
    }),
  ]);

  const multasUcTotal = totalMultasUc._sum.multaUc ? Number(totalMultasUc._sum.multaUc) : 0;
  const multasUsdTotal = totalMultasUc._sum.multaUsd ? Number(totalMultasUc._sum.multaUsd) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-oro-500/20 text-oro-400 border border-oro-500/30">
                Justicia y Régimen Disciplinario FVF
              </span>
              <span className="text-slate-500 text-xs">RDFVF / FIFA DC</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Registro Oficial de Sanciones Ejecutoriadas
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Catálogo histórico y en tiempo real de sanciones deportivas, suspensiones por partidos y multas
              pecuniarias impuestas por el Consejo de Honor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/finanzas"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>💰</span> Liquidación y Pagos
            </Link>
            <Link
              href="/expedientes"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-oro-500 text-slate-950 hover:bg-oro-400 transition shadow flex items-center gap-1.5"
            >
              <span>📋</span> Expedientes
            </Link>
          </div>
        </div>

        {/* Tickers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Total Sanciones
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {totalSanciones.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Multas Acumuladas (UCFVF)
            </span>
            <span className="text-2xl font-black text-oro-400 mt-0.5 block">
              {multasUcTotal.toLocaleString()} UC
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Equivalente USD (BCV)
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
              ${multasUsdTotal.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Tasa Oficial de Cambio
            </span>
            <span className="text-2xl font-black text-cyan-400 mt-0.5 block">
              $3.00 USD / UC
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de Sanciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Últimas Sanciones Registradas</h2>
            <p className="text-xs text-slate-400">Mostrando las 50 resoluciones disciplinarias más recientes</p>
          </div>
          <span className="px-2.5 py-1 rounded bg-slate-950 text-oro-400 border border-slate-800 text-xs font-mono">
            {sanciones.length} de {totalSanciones}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Sancionado / Sujeto</th>
                <th className="p-3">Club / Torneo</th>
                <th className="p-3">Motivo / Hecho Tipificado</th>
                <th className="p-3 text-center">Partidos / Días</th>
                <th className="p-3 text-right">Multa (UCFVF)</th>
                <th className="p-3 text-right">Multa (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sanciones.map((s) => {
                const nombre = s.persona?.nombreCompleto || s.nombreRaw || 'Sujeto bajo investigación';
                const club = s.club?.nombre || 'Club Federado';
                const torneo = s.torneo?.nombre || 'Liga FUTVE';
                const multaUc = s.multaUc ? Number(s.multaUc) : 0;
                const multaUsd = s.multaUsd ? Number(s.multaUsd) : 0;

                return (
                  <tr key={String(s.id)} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(s.fecha).toLocaleDateString('es-VE')}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-white block">{nombre}</span>
                      {s.cedulaRaw && (
                        <span className="text-[10px] text-slate-500 font-mono">ID: {s.cedulaRaw}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-slate-200 block font-semibold">{club}</span>
                      <span className="text-[11px] text-slate-400">{torneo}</span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-slate-300" title={s.motivoRaw || ''}>
                      {s.motivoRaw || 'Sanción disciplinaria oficial'}
                    </td>
                    <td className="p-3 text-center">
                      {s.sanctionJuegos ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          {s.sanctionJuegos} partidos
                        </span>
                      ) : s.sanctionDias ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {s.sanctionDias} días
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-oro-400">
                      {multaUc > 0 ? `${multaUc.toLocaleString()} UC` : '0'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      {multaUsd > 0 ? `$${multaUsd.toLocaleString()}` : '$0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
