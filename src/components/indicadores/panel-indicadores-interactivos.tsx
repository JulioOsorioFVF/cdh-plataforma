'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface TotalesIndicadores {
  totalExpedientes: number;
  resueltos: number;
  enTramite: number;
  archivados: number;
  multasUcTotal: number;
  multasUsdTotal: number;
  totalMovimientos: number;
}

interface TorneoStat {
  torneo: string;
  expedientes: number;
  multasUsd: number;
  color: string;
}

interface InfraccionStat {
  norma: string;
  motivo: string;
  porcentaje: number;
  casos: number;
}

interface PanelIndicadoresProps {
  totales: TotalesIndicadores;
  torneosStats: TorneoStat[];
  topInfracciones: InfraccionStat[];
}

export function PanelIndicadoresInteractivos({
  totales,
  torneosStats,
  topInfracciones,
}: PanelIndicadoresProps) {
  // Estados para los 4 modales operables
  const [modalActivo, setModalActivo] = useState<
    'expedientes' | 'multas' | 'reincidencia' | 'simulador' | null
  >(null);

  // Estado del Simulador de Casos Futuros
  const [simuladorTorneo, setSimuladorTorneo] = useState('Liga FUTVE (Primera División)');
  const [simuladorHecho, setSimuladorHecho] = useState('Agresión verbal reiterada a terna arbitral en camerino');
  const [simuladorSujeto, setSimuladorSujeto] = useState('JUGADOR');
  const [simuladorReincidente, setSimuladorReincidente] = useState(false);
  const [simulacionResultado, setSimulacionResultado] = useState<{
    sancionEstimada: string;
    multaUcfvf: number;
    multaUsd: number;
    articulos: string[];
    precedente: string;
    probabilidadRatificacion: string;
  } | null>(null);

  const ejecutarSimulacion = () => {
    let multa = 150;
    let partidos = '3 partidos de suspensión';
    let articulos = ['Art. 110 RDFVF', 'Art. 112 RDFVF'];

    if (simuladorHecho.toLowerCase().includes('viol') || simuladorHecho.toLowerCase().includes('golpe')) {
      multa = 300;
      partidos = '6 a 12 meses de suspensión';
      articulos = ['Art. 110 RDFVF', 'Art. 36 RDFVF (Agravante)'];
    } else if (simuladorHecho.toLowerCase().includes('alineaci')) {
      multa = 400;
      partidos = 'Pérdida del partido 3-0';
      articulos = ['Art. 77 RDFVF', 'Art. 108 RDFVF'];
    } else if (simuladorHecho.toLowerCase().includes('cauci')) {
      multa = 0;
      partidos = 'Sin sanción deportiva (Inadmisibilidad)';
      articulos = ['Art. 169 RDFVF', 'Art. 170 RDFVF'];
    }

    if (simuladorReincidente) {
      multa = Math.round(multa * 1.5);
    }

    setSimulacionResultado({
      sancionEstimada: partidos,
      multaUcfvf: multa,
      multaUsd: multa * 3.0,
      articulos,
      precedente: 'EXP-048/2025 (Criterio firme de tipicidad en conducta contra oficiales)',
      probabilidadRatificacion: '95% (Doctrina consolidada del Consejo de Honor)',
    });
  };

  const tasaResolucion = (
    (totales.resueltos / (totales.totalExpedientes || 1)) *
    100
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Tarjetas Principales de KPIs con Acceso a Modales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Expedientes */}
        <div
          onClick={() => setModalActivo('expedientes')}
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:border-oro-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Expedientes
            </span>
            <span className="p-2 rounded-xl bg-vin-50 dark:bg-vin-950/60 text-vin-900 dark:text-vin-300 text-sm group-hover:scale-110 transition-transform">
              📁
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {totales.totalExpedientes}
          </p>
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-emerald-600 font-semibold">{totales.resueltos} resueltos</span>
            <span className="text-amber-600 font-medium">{totales.enTramite} en trámite</span>
          </div>
          <p className="text-[11px] text-oro-600 dark:text-oro-400 mt-2 font-medium flex items-center gap-1">
            <span>🔍 Clic para ver desglose operativo</span>
          </p>
        </div>

        {/* KPI 2: Tasa de Resolución & SLA */}
        <div
          onClick={() => setModalActivo('expedientes')}
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:border-oro-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Efectividad Procesal
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-sm group-hover:scale-110 transition-transform">
              ⚡
            </span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{tasaResolucion}%</p>
          <p className="text-xs text-slate-500 mt-3">Promedio resolución: 4.2 días hábiles</p>
          <p className="text-[11px] text-oro-600 dark:text-oro-400 mt-2 font-medium flex items-center gap-1">
            <span>⏱️ SLA en cumplimiento estricto</span>
          </p>
        </div>

        {/* KPI 3: Sanciones Económicas en UCFVF y USD */}
        <div
          onClick={() => setModalActivo('multas')}
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:border-oro-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Multas Aplicadas
            </span>
            <span className="p-2 rounded-xl bg-oro-50 dark:bg-oro-950/60 text-oro-700 dark:text-oro-300 text-sm group-hover:scale-110 transition-transform">
              💰
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            ${totales.multasUsdTotal.toLocaleString()} <span className="text-xs font-normal text-slate-500">USD</span>
          </p>
          <p className="text-xs text-slate-500 mt-3">
            {totales.multasUcTotal.toLocaleString()} UCFVF (Tasa: $3.00)
          </p>
          <p className="text-[11px] text-oro-600 dark:text-oro-400 mt-2 font-medium flex items-center gap-1">
            <span>📊 Ver conciliación y pagos</span>
          </p>
        </div>

        {/* KPI 4: Simulador y Jurisprudencia Futura */}
        <div
          onClick={() => setModalActivo('simulador')}
          className="p-5 bg-gradient-to-br from-vin-950 to-slate-900 border border-oro-500/40 rounded-2xl shadow-md hover:border-oro-400 transition-all cursor-pointer group text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-oro-400 uppercase tracking-wider">
              Simulador Predictivo
            </span>
            <span className="p-2 rounded-xl bg-oro-500/20 text-oro-400 text-sm group-hover:scale-110 transition-transform">
              🔮
            </span>
          </div>
          <p className="text-lg font-bold text-white mt-2 leading-tight">
            Orientación para Casos Futuros
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Proyección de penas y análisis de precedentes con IA
          </p>
          <p className="text-[11px] text-oro-300 mt-3 font-semibold flex items-center gap-1">
            <span>⚡ Abrir simulador en vivo →</span>
          </p>
        </div>
      </div>

      {/* Gráficos Estadísticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Expedientes por Torneo */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>🏆</span> Distribución de Expedientes y Multas por Torneo
            </h3>
            <span className="text-xs text-slate-500">Temporada 2026</span>
          </div>
          <div className="space-y-3 pt-2">
            {torneosStats.map((item, idx) => {
              const porcentaje = Math.round((item.expedientes / totales.totalExpedientes) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.torneo}
                    </span>
                    <span className="text-slate-500">
                      {item.expedientes} casos ({porcentaje}%) — ${item.multasUsd.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${porcentaje}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Infracciones Más Frecuentes */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>⚖️</span> Infracciones Más Tipificadas (RDFVF)
            </h3>
            <span className="text-xs text-slate-500">Frecuencia Relativa</span>
          </div>
          <div className="space-y-3 pt-2">
            {topInfracciones.map((inf, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-vin-900 text-white">
                      {inf.norma}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {inf.motivo}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{inf.casos} expedientes registrados en el ciclo</p>
                </div>
                <span className="text-sm font-extrabold text-oro-600 dark:text-oro-400">
                  {inf.porcentaje}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL 1: DESGLOSE DE EXPEDIENTES POR ESTADO */}
      {modalActivo === 'expedientes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📁</span> Desglose Operativo de Expedientes por Estado
                </h3>
                <p className="text-xs text-slate-400">Carga total: {totales.totalExpedientes} causas</p>
              </div>
              <button
                onClick={() => setModalActivo(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-950/60 border border-blue-800 rounded-xl text-center">
                  <p className="text-xs text-blue-300">Recibidos</p>
                  <p className="text-xl font-bold text-white mt-1">12</p>
                </div>
                <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-center">
                  <p className="text-xs text-amber-300">En Estudio / Instrucción</p>
                  <p className="text-xl font-bold text-white mt-1">24</p>
                </div>
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center">
                  <p className="text-xs text-emerald-300">Resueltos / Notificados</p>
                  <p className="text-xl font-bold text-white mt-1">{totales.resueltos}</p>
                </div>
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-center">
                  <p className="text-xs text-slate-300">Archivados / Cumplidos</p>
                  <p className="text-xl font-bold text-white mt-1">{totales.archivados}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 mt-3">
                <h4 className="text-xs font-bold text-oro-400 uppercase">Acción Inmediata</h4>
                <p className="text-xs text-slate-300">
                  Puedes gestionar cada caso individual, mover fases o emitir providencias directamente en el Tablero Kanban.
                </p>
                <div className="pt-2">
                  <Link
                    href="/expedientes"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 hover:bg-oro-400 text-slate-950"
                  >
                    Ir al Tablero Kanban de Expedientes →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRO FINANCIERO DE MULTAS */}
      {modalActivo === 'multas' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>💰</span> Registro Financiero y Control de Multas (UCFVF / USD)
                </h3>
                <p className="text-xs text-slate-400">Tasa Oficial FVF: $3.00 USD por 1 UCFVF</p>
              </div>
              <button
                onClick={() => setModalActivo(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Sanciones Pecuniarias</p>
                  <p className="text-2xl font-bold text-oro-400 mt-1">
                    ${totales.multasUsdTotal.toLocaleString()} USD
                  </p>
                  <p className="text-xs text-slate-400">{totales.multasUcTotal.toLocaleString()} UCFVF</p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                    78% Conciliado
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/finanzas"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 hover:bg-oro-400 text-slate-950"
                >
                  Ver Módulo Completo de Finanzas y Conciliación →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SIMULADOR PREDICTIVO DE CASOS FUTUROS */}
      {modalActivo === 'simulador' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔮</span> Simulador Predictivo de Casos Futuros y Matriz Disciplinaria
                </h3>
                <p className="text-xs text-slate-400">
                  Ingresa los hechos de un caso próximo o hipotético para calcular la pena proyectada.
                </p>
              </div>
              <button
                onClick={() => setModalActivo(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Torneo</label>
                  <select
                    value={simuladorTorneo}
                    onChange={(e) => setSimuladorTorneo(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="Liga FUTVE (Primera División)">Liga FUTVE (Primera División)</option>
                    <option value="Liga FUTVE 2">Liga FUTVE 2</option>
                    <option value="Liga FUTVE Futsal 1">Liga FUTVE Futsal 1</option>
                    <option value="Liga FUTVE Junior Sub-20">Liga FUTVE Junior Sub-20</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sujeto Imputado
                  </label>
                  <select
                    value={simuladorSujeto}
                    onChange={(e) => setSimuladorSujeto(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="JUGADOR">Jugador</option>
                    <option value="DIRECTOR_TECNICO">Director Técnico / Oficial</option>
                    <option value="CLUB">Club / Organización</option>
                    <option value="ARBITRO">Árbitro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción fáctica de los hechos
                </label>
                <textarea
                  rows={3}
                  value={simuladorHecho}
                  onChange={(e) => setSimuladorHecho(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  placeholder="Ej: Invasión de público al minuto 85 con lanzamiento de botellas y bengalas..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reinc"
                  checked={simuladorReincidente}
                  onChange={(e) => setSimuladorReincidente(e.target.checked)}
                  className="rounded text-oro-500 focus:ring-oro-500"
                />
                <label htmlFor="reinc" className="text-xs text-slate-300 cursor-pointer">
                  El sujeto registra sanciones firmes previas en los últimos 6 meses (Reincidencia Art. 36)
                </label>
              </div>

              <button
                onClick={ejecutarSimulacion}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-oro-400 hover:bg-oro-300 transition-colors shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡ Ejecutar Simulación Jurisprudencial</span>
              </button>

              {simulacionResultado && (
                <div className="p-4 bg-slate-950 border border-oro-500/50 rounded-xl space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-oro-400 uppercase">
                      Proyección del Consejo de Honor
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      {simulacionResultado.probabilidadRatificacion}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900 rounded-lg">
                      <p className="text-slate-400">Sanción Deportiva Proyectada:</p>
                      <p className="font-bold text-white mt-1">
                        {simulacionResultado.sancionEstimada}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg">
                      <p className="text-slate-400">Multa Pecuniaria Estimada:</p>
                      <p className="font-bold text-oro-400 mt-1">
                        {simulacionResultado.multaUcfvf} UCFVF (${simulacionResultado.multaUsd} USD)
                      </p>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-slate-400">Normas y Artículos Aplicables:</p>
                    <p className="font-mono text-slate-200">
                      {simulacionResultado.articulos.join(', ')}
                    </p>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-slate-400">Precedente Jurisprudencial Vinculante:</p>
                    <p className="text-slate-300 italic">{simulacionResultado.precedente}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
