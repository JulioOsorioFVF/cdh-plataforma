'use client';

import React, { useState } from 'react';

interface PagoPendienteConciliacion {
  idReporte: number;
  codigoExpediente: string;
  imputado: string;
  torneo: string;
  referencia: string;
  montoUsd: number;
  montoUcfvf: number;
  fechaReporte: string;
  estado: 'PENDIENTE_VERIFICACION' | 'VERIFICADO_CONCILIADO';
}

const REPORTES_INICIALES: PagoPendienteConciliacion[] = [
  {
    idReporte: 101,
    codigoExpediente: 'EXP-045-2025',
    imputado: 'Bolívar SC',
    torneo: 'Liga FUTVE 2',
    referencia: 'Transf. Bco. Venezuela #98765432',
    montoUsd: 360,
    montoUcfvf: 120,
    fechaReporte: '2026-06-18',
    estado: 'PENDIENTE_VERIFICACION',
  },
  {
    idReporte: 102,
    codigoExpediente: 'EXP-088-2023',
    imputado: 'Ureña SC',
    torneo: 'Liga FUTVE 2',
    referencia: 'Depósito Divisas BNC #004411',
    montoUsd: 750,
    montoUcfvf: 250,
    fechaReporte: '2026-06-17',
    estado: 'VERIFICADO_CONCILIADO',
  },
];

export default function ModuloFinancieroTesoreriaPage() {
  const [reportes, setReportes] = useState<PagoPendienteConciliacion[]>(REPORTES_INICIALES);
  const [enlacePublicoCopiado, setEnlacePublicoCopiado] = useState(false);

  const aprobarConciliacion = (id: number) => {
    setReportes(
      reportes.map((r) => (r.idReporte === id ? { ...r, estado: 'VERIFICADO_CONCILIADO' as const } : r)),
    );
  };

  const copiarEnlacePublico = () => {
    navigator.clipboard.writeText('https://cdh.fvf.com.ve/reportar-pago');
    setEnlacePublicoCopiado(true);
    setTimeout(() => setEnlacePublicoCopiado(false), 3000);
  };

  return (
    <div className="light-screen min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Tesorería, Administración y Consejo de Honor FVF
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            Módulo de Recaudación, Cruce de Datos y Solvencias
          </h1>
          <p className="text-sm text-slate-400">
            Control integral de multas pecuniarias ($175.212,51 total ciclo) y validación de pagos de afectados.
          </p>
        </div>

        <button
          onClick={copiarEnlacePublico}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition flex items-center gap-2"
        >
          <span>{enlacePublicoCopiado ? '¡Enlace Copiado!' : 'Copiar Enlace Portal de Pago para Afectados'}</span>
        </button>
      </header>

      {/* Tarjetas Indicadoras Financieras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400">Total Multas Impuestas (Ciclo)</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">$175.212,51 USD</p>
          <p className="text-xs text-slate-400 mt-1">58.404,17 UCFVF (Decisiones + Actas + Futsal)</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400">Multas Conciliadas y Cobradas</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">$112.450,00 USD</p>
          <p className="text-xs text-emerald-400 mt-1">Solvencias emitidas y licencias activas</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400">Pendientes de Pago / Bloqueados</p>
          <p className="text-2xl font-bold text-red-400 mt-1">$62.762,51 USD</p>
          <p className="text-xs text-red-400 mt-1">Bajo control estricto de Licencia de Clubes</p>
        </div>
      </div>

      {/* Tabla de Conciliación de Pagos Reportados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">
          Bandeja de Validación de Pagos (Reportados por Clubes / Afectados o Registrados por Admin)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="p-3">Expediente</th>
                <th className="p-3">Imputado / Club</th>
                <th className="p-3">Torneo</th>
                <th className="p-3">Referencia Bancaria</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Estatus Conciliación</th>
                <th className="p-3 text-right">Acciones (Admin / CDH)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reportes.map((rep) => (
                <tr key={rep.idReporte} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-blue-400">{rep.codigoExpediente}</td>
                  <td className="p-3 font-semibold text-white">{rep.imputado}</td>
                  <td className="p-3 text-slate-300">{rep.torneo}</td>
                  <td className="p-3 font-mono text-slate-300">{rep.referencia}</td>
                  <td className="p-3 font-mono text-amber-400 font-bold">
                    ${rep.montoUsd} ({rep.montoUcfvf} UCFVF)
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rep.estado === 'VERIFICADO_CONCILIADO'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {rep.estado === 'VERIFICADO_CONCILIADO' ? 'Conciliado y Solvente' : 'Pendiente de Validación'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {rep.estado === 'PENDIENTE_VERIFICACION' && (
                      <button
                        onClick={() => aprobarConciliacion(rep.idReporte)}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition"
                      >
                        Aprobar y Notificar Licencias
                      </button>
                    )}
                    <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition">
                      Ver Comprobante
                    </button>
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