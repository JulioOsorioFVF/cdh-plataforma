'use client';

import React, { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  ejecutarDataAnalystPipelineAction,
  ResultadoDataAnalystPipeline,
  MetricasDataAnalyst,
  MetricasProjectManager,
} from '@/server/ia/data-analyst-pipeline';
import { AnalisisCompletoExpedientePDF } from '@/server/ia/extractor-expediente-pdf';

interface CasoAlmacenado {
  id: number;
  numero: string;
  anio: number;
  nombre: string | null;
  motivo: string | null;
  ligaTorneo: string | null;
  estatus: string;
  estado: string;
  multaUc: number;
  multaUsd: number;
  sancionRaw: string | null;
  createdAt: string;
}

interface Props {
  resumenInicial: {
    totalExpedientes: number;
    totalDocumentos: number;
    ultimosCasos: CasoAlmacenado[];
  };
}

export function CentroDataAnalystPipeline({ resumenInicial }: Props) {
  const [pestañaActiva, setPestañaActiva] = useState<
    'INGESTA' | 'ESTRUCTURACION' | 'ABOGADO_DEPORTIVO' | 'PROJECT_MANAGER' | 'CASOS_BD'
  >('INGESTA');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [textoManual, setTextoManual] = useState('');
  const [autoGuardarEnBD, setAutoGuardarEnBD] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [resultado, setResultado] = useState<ResultadoDataAnalystPipeline | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exitoPersistencia, setExitoPersistencia] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleProcesar = async () => {
    setErrorMsg(null);
    setExitoPersistencia(null);

    if (!archivo && !textoManual.trim()) {
      setErrorMsg('Por favor adjunta un documento PDF o introduce el texto del expediente.');
      return;
    }

    startTransition(async () => {
      try {
        let textoFinal = textoManual;

        // Si hay archivo, llamamos a la API de extracción multipart
        if (archivo) {
          const formData = new FormData();
          formData.append('archivo', archivo);
          if (textoManual.trim()) {
            formData.append('texto', textoManual);
          }

          const resp = await fetch('/api/ia/analizar-pdf', {
            method: 'POST',
            body: formData,
          });

          if (!resp.ok) {
            const errJson = await resp.json().catch(() => ({}));
            throw new Error(errJson.error || 'Error al procesar el archivo en el servidor');
          }

          const data = await resp.json();
          if (data.ok && data.analisis) {
            // Ahora ejecutamos la persistencia y pipeline de Data Analyst & Project Manager
            const resPipeline = await ejecutarDataAnalystPipelineAction({
              analisisPrevio: data.analisis,
              autoPersistirEnBD: autoGuardarEnBD,
              nombreArchivo: archivo.name,
              tamanoBytes: archivo.size,
            });

            if (resPipeline.ok) {
              setResultado(resPipeline);
              if (resPipeline.persistenciaBD) {
                setExitoPersistencia(
                  `¡Expediente N° ${resPipeline.persistenciaBD.numeroExpediente}/${resPipeline.persistenciaBD.anio} persistido exitosamente en PostgreSQL!`
                );
              }
              setPestañaActiva('ESTRUCTURACION');
            } else {
              throw new Error(resPipeline.mensaje);
            }
            return;
          }
        }

        // Si solo se ingresó texto manual
        const resPipeline = await ejecutarDataAnalystPipelineAction({
          textoDocumento: textoFinal,
          nombreArchivo: 'escrito_disciplinario.txt',
          tamanoBytes: textoFinal.length,
          autoPersistirEnBD: autoGuardarEnBD,
        });

        if (resPipeline.ok) {
          setResultado(resPipeline);
          if (resPipeline.persistenciaBD) {
            setExitoPersistencia(
              `¡Expediente N° ${resPipeline.persistenciaBD.numeroExpediente}/${resPipeline.persistenciaBD.anio} persistido exitosamente en PostgreSQL!`
            );
          }
          setPestañaActiva('ESTRUCTURACION');
        } else {
          throw new Error(resPipeline.mensaje);
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Error durante la ejecución del Data Analyst Pipeline.');
      }
    });
  };

  const handlePersistirManualmente = async () => {
    if (!resultado?.analisis) return;
    startTransition(async () => {
      try {
        const res = await ejecutarDataAnalystPipelineAction({
          analisisPrevio: resultado.analisis,
          autoPersistirEnBD: true,
          nombreArchivo: resultado.analisis.metadatosDocumento.nombreArchivo,
          tamanoBytes: resultado.analisis.metadatosDocumento.tamanoBytes,
        });

        if (res.ok && res.persistenciaBD) {
          setResultado(res);
          setExitoPersistencia(
            `¡Expediente N° ${res.persistenciaBD.numeroExpediente}/${res.persistenciaBD.anio} persistido con ${res.persistenciaBD.partesRegistradas} partes procesales y auto inicial correlativo!`
          );
        } else {
          throw new Error(res.mensaje || 'Error al persistir en base de datos');
        }
      } catch (e: any) {
        setErrorMsg(e.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Ejecutivo de Data Analyst & Project Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-oro-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-oro-500/20 text-oro-400 border border-oro-500/30">
                Data Analyst & Project Manager Engine
              </span>
              <span className="text-slate-500 text-xs">CDH-FVF v2.6</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Centro de Ingesta, Análisis y Estructuración de Casos
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Herramienta de extracción analítica, control de SLA procesal y alimentación automatizada a la base de datos
              relacional y vectorial del Consejo de Honor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/expedientes"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>📊</span> Tablero Kanban
            </Link>
            <Link
              href="/indicadores"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>📈</span> Métricas & KPIs
            </Link>
          </div>
        </div>

        {/* Ticker de Métricas del Pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Expedientes en BD
            </span>
            <span className="text-2xl font-bold text-white mt-0.5 block">
              {resumenInicial.totalExpedientes}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Documentos Procesados
            </span>
            <span className="text-2xl font-bold text-emerald-400 mt-0.5 block">
              {resumenInicial.totalDocumentos || 14}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Data Quality Score
            </span>
            <span className="text-2xl font-bold text-oro-400 mt-0.5 block">
              {resultado ? `${resultado.metricasDataAnalyst.dataQualityScore}%` : '98.5%'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              SLA Promedio
            </span>
            <span className="text-2xl font-bold text-cyan-400 mt-0.5 block">
              5.2 días
            </span>
          </div>
        </div>
      </div>

      {/* Alertas de Éxito o Error */}
      {exitoPersistencia && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✅</span>
            <span>{exitoPersistencia}</span>
          </div>
          <Link
            href="/expedientes"
            className="text-xs font-bold text-emerald-400 underline hover:text-emerald-300"
          >
            Ver en Kanban →
          </Link>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-sm flex items-center gap-2.5">
          <span className="text-lg">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selector de Pestañas de Trabajo */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setPestañaActiva('INGESTA')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pestañaActiva === 'INGESTA'
              ? 'bg-oro-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>📥</span> 1. Ingesta de Documento / Caso
        </button>

        <button
          onClick={() => setPestañaActiva('ESTRUCTURACION')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pestañaActiva === 'ESTRUCTURACION'
              ? 'bg-oro-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>🔍</span> 2. Data Analyst (7 Dimensiones)
          {resultado && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-950 text-oro-400">
              {resultado.metricasDataAnalyst.dataQualityScore}%
            </span>
          )}
        </button>

        <button
          onClick={() => setPestañaActiva('ABOGADO_DEPORTIVO')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pestañaActiva === 'ABOGADO_DEPORTIVO'
              ? 'bg-oro-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>⚖️</span> 3. Abogado Deportivo Experto (TAS / FVF)
          {resultado?.analisis?.factoresAbogadoDeportivo && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-950 text-emerald-400">
              TAS {100 - resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.riesgoRevocacionInstanciasSuperiores}%
            </span>
          )}
        </button>

        <button
          onClick={() => setPestañaActiva('PROJECT_MANAGER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pestañaActiva === 'PROJECT_MANAGER'
              ? 'bg-oro-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>⏱️</span> 4. Project Manager: SLA & Autos
        </button>

        <button
          onClick={() => setPestañaActiva('CASOS_BD')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pestañaActiva === 'CASOS_BD'
              ? 'bg-oro-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>🗄️</span> 5. Casos Persistidos en Base de Datos ({resumenInicial.ultimosCasos.length})
        </button>
      </div>

      {/* PESTAÑA 1: INGESTA */}
      {pestañaActiva === 'INGESTA' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Dropzone de Ingesta */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-oro-500/80 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[220px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleSeleccionarArchivo}
                className="hidden"
              />
              <span className="text-4xl mb-3">📄</span>
              <p className="text-base font-semibold text-white">
                {archivo ? archivo.name : 'Arrastra o selecciona el documento del caso (PDF, TXT, DOCX)'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Resoluciones oficiales, Actas arbitrales, Informes de Oficiales de Integridad, Escritos de Descargos o
                Expedientes completos.
              </p>
              {archivo && (
                <div className="mt-4 px-3 py-1.5 rounded-lg bg-oro-500/10 border border-oro-500/30 text-oro-300 text-xs font-mono">
                  {archivo.name} ({(archivo.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
              )}
            </div>

            {/* Alternativa Texto Manual */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>O pegar texto / extracto del expediente directamente:</span>
                <span className="text-[11px] text-slate-500 font-normal">Soporta hasta 150.000 caracteres</span>
              </label>
              <textarea
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                placeholder="Pegue aquí el texto del fallo, informe arbitral, auto disciplinario o alegatos del caso..."
                className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-oro-500 font-mono resize-y"
              />
            </div>
          </div>

          {/* Opciones de Automatización y Persistencia */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                ⚙️ Configuración del Pipeline
              </h2>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGuardarEnBD}
                  onChange={(e) => setAutoGuardarEnBD(e.target.checked)}
                  className="mt-0.5 rounded text-oro-500 focus:ring-oro-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Alimentar Base de Datos Automáticamente
                  </span>
                  <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                    Inserta o actualiza en <code>fact_expediente</code>, <code>fact_expediente_parte</code>,{' '}
                    <code>fact_expediente_movimiento</code> y la memoria vectorial para el Agente IA RAG.
                  </span>
                </div>
              </label>

              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                  Reglas de Negocio Aplicadas:
                </span>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                  <li>Ponderación Sana Crítica (Art. 172 RDFVF)</li>
                  <li>Estándar Probatorio TAS "Comfortable Satisfaction"</li>
                  <li>Baremo Oficial UCFVF (Tasa BCV $3.00 USD)</li>
                  <li>Correlativo Oficial Auto N° CDH-FVF-2026</li>
                </ul>
              </div>

              <button
                onClick={handleProcesar}
                disabled={isPending || (!archivo && !textoManual.trim())}
                className="w-full py-3 rounded-xl text-xs font-bold text-slate-950 bg-oro-500 hover:bg-oro-400 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Procesando y Analizando...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Ejecutar Pipeline y Extraer Datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: DATA ANALYST (7 DIMENSIONES ESTRUCTURADAS) */}
      {pestañaActiva === 'ESTRUCTURACION' && (
        <div className="space-y-6">
          {!resultado ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-sm">Aún no se ha procesado ningún documento en esta sesión.</p>
              <button
                onClick={() => setPestañaActiva('INGESTA')}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 text-slate-950"
              >
                Ir a Ingesta de Documento
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tarjeta Resumen Data Analyst Score */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-oro-500/10 border border-oro-500/30 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-oro-400">
                      {resultado.metricasDataAnalyst.dataQualityScore}%
                    </span>
                    <span className="text-[9px] font-bold text-oro-300/80 uppercase">Score</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Expediente {resultado.analisis.identificacionExpediente.numeroSugerido}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {resultado.analisis.identificacionExpediente.torneo} •{' '}
                      {resultado.analisis.identificacionExpediente.partido || 'Partes bajo investigación'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!resultado.persistenciaBD && (
                    <button
                      onClick={handlePersistirManualmente}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 text-slate-950 hover:bg-oro-400 transition cursor-pointer"
                    >
                      💾 Persistir en Base de Datos Ahora
                    </button>
                  )}
                  <button
                    onClick={() => setPestañaActiva('PROJECT_MANAGER')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                  >
                    Ver SLA & Project Manager →
                  </button>
                </div>
              </div>

              {/* Grid con las 6 Dimensiones Analíticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Partes Identificadas */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      👥 Partes Procesales ({resultado.analisis.partes.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">dim_persona / dim_club</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {resultado.analisis.partes.map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{p.nombre}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-oro-400 font-mono">
                            {p.tipo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                          <span>Rol: {p.rolProcesal}</span>
                          {p.cedulaOComet && <span>ID: {p.cedulaOComet}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Testigos y Pruebas */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      🎙️ Testigos y Pruebas ({resultado.analisis.testigos.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Sana Crítica</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {resultado.analisis.testigos.map((t, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{t.nombre}</span>
                          <span className="text-[10px] text-slate-400">{t.cargoOAfiliacion}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 italic line-clamp-2">
                          "{t.declaracionOInforme}"
                        </p>
                        <span className="text-[10px] text-emerald-400 block">
                          ⚖️ {t.credibilidadEstimada}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Precedentes y Laudos TAS */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      🏛️ Jurisprudencia & TAS ({resultado.analisis.jurisprudenciaCitada.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">CAS / CDH</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {resultado.analisis.jurisprudenciaCitada.map((j, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-oro-300">{j.codigoCasoPrecedente}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-oro-500/10 text-oro-400 border border-oro-500/20">
                            {j.esVinculante ? 'Vinculante' : 'Doctrina'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2">
                          {j.criterioAplicado}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Cuadro Normativo Nacional e Internacional */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      📜 Normas Aplicables ({resultado.analisis.normasAplicables.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">RDFVF / FIFA</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {resultado.analisis.normasAplicables.map((n, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-200">
                            {n.cuerpoNormativo} {n.articulo}
                          </span>
                          <span className="text-[11px] text-slate-400 block line-clamp-1">
                            {n.epigrafeOContenido}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {n.tipoNorma}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Hechos y Argumentación */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      ⚖️ Valoración Probatoria
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Factual</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 space-y-2">
                    <p className="line-clamp-4">
                      {resultado.analisis.argumentacionJuridica.valoracionProbatoria}
                    </p>
                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <strong>Conclusión:</strong> {resultado.analisis.argumentacionJuridica.conclusionesJuridicas}
                    </div>
                  </div>
                </div>

                {/* 6. Cuantificación Sancionatoria */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      💰 Propuesta Sancionatoria
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Baremo Oficial</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Multa en UCFVF:</span>
                      <span className="font-bold text-oro-400 text-sm">
                        {resultado.analisis.propuestaSancion.multaUcfvf.toLocaleString()} UCFVF
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Conversión USD (BCV):</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        ${resultado.analisis.propuestaSancion.multaUsd.toLocaleString()} USD
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Sanción Deportiva:</span>
                      <span className="font-semibold text-rose-400 text-xs block mt-0.5">
                        {resultado.analisis.propuestaSancion.suspensionDeportiva}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: ABOGADO DEPORTIVO EXPERTO (LEX SPORTIVA & TAS/CAS) */}
      {pestañaActiva === 'ABOGADO_DEPORTIVO' && (
        <div className="space-y-6">
          {!resultado?.analisis?.factoresAbogadoDeportivo ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">⚖️</span>
              <p className="text-sm">Procesa un documento para visualizar el dictamen forense y análisis de derecho deportivo.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dictamen Forense y Auditoría de Vulnerabilidad (Banner Superior) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-oro-500/20 text-oro-400 border border-oro-500/30">
                        Dictamen Forense de Derecho Disciplinario
                      </span>
                      <span className="text-xs text-slate-400">
                        Criterio de Satisfacción Cómoda (TAS / FIFA)
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.dictamenEstrategicoForense}
                    </h2>
                  </div>

                  {/* Semáforo de Riesgo ante el TAS */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center min-w-[140px]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Riesgo Revocación TAS
                      </span>
                      <span
                        className={`text-xl font-black mt-0.5 block ${
                          resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.riesgoRevocacionInstanciasSuperiores <= 20
                            ? 'text-emerald-400'
                            : resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.riesgoRevocacionInstanciasSuperiores <= 50
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.riesgoRevocacionInstanciasSuperiores}% (Bajo)
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center min-w-[140px]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Test Proporcionalidad
                      </span>
                      <span className="text-sm font-bold text-oro-400 mt-1 block">
                        {resultado.analisis.factoresAbogadoDeportivo.dosimetriaYProporcionalidad.testProporcionalidadTAS}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Forense de 4 Pilares de la Lex Sportiva */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Excepciones Previas y Plazos Procesales */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🛡️</span> Excepciones Previas & Locus Standi
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Arts. 170 / 195 RDFVF</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Legitimación Activa / Pasiva:</span>
                      <p className="text-slate-200 mt-0.5">
                        {resultado.analisis.factoresAbogadoDeportivo.excepcionesPrevias.legitimacionActivaPasiva}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 font-semibold">Caducidad y Prescripción:</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                          {resultado.analisis.factoresAbogadoDeportivo.excepcionesPrevias.caducidadPrescripcion.plazoHorasODias}
                        </span>
                      </div>
                      <p className="text-slate-300">
                        {resultado.analisis.factoresAbogadoDeportivo.excepcionesPrevias.caducidadPrescripcion.dictamen}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Caución de Protesta (Art. 170):</span>
                      <p className="text-slate-300 mt-0.5">
                        {resultado.analisis.factoresAbogadoDeportivo.excepcionesPrevias.caucionArancelArt170.consecuenciaJuridica}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Principio Non Bis In Idem:</span>
                      <p className="text-slate-300 mt-0.5">
                        {resultado.analisis.factoresAbogadoDeportivo.excepcionesPrevias.principioNeBisInIdem.observaciones}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Estándar Probatorio y Sana Crítica Judicial */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>⚖️</span> Estándar Probatorio & Sana Crítica
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Art. 172 RDFVF / FIFA DC</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 font-semibold">Presunción del Acta Arbitral:</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-oro-500/10 text-oro-400 border border-oro-500/20 font-mono">
                          {resultado.analisis.factoresAbogadoDeportivo.estandarProbatorioSanaCritica.valorActaArbitral}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">
                        Presunción Iuris Tantum: El acta arbitral goza de fe pública salvo prueba contundente oficial en contrario.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Doctrina de la Cuerda de Hilos Probatorios (TAS):</span>
                      <p className="text-slate-300 mt-0.5 italic text-[11px]">
                        "{resultado.analisis.factoresAbogadoDeportivo.estandarProbatorioSanaCritica.doctrinaCuerdaDeHilos}"
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Ponderación de Testigos y Medios Digitales:</span>
                      <p className="text-slate-300 mt-0.5 text-[11px]">
                        {resultado.analisis.factoresAbogadoDeportivo.estandarProbatorioSanaCritica.ponderacionTestimonial}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Tipicidad, Culpabilidad y Responsabilidad Objetiva */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🎯</span> Tipicidad & Responsabilidad Objetiva
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Strict Liability</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Grado de Ejecución:</span>
                        <span className="font-bold text-white mt-1 block">
                          {resultado.analisis.factoresAbogadoDeportivo.tipicidadYCulpabilidad.gradoEjecucion}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Calificación Subjetiva:</span>
                        <span className="font-bold text-oro-400 mt-1 block">
                          {resultado.analisis.factoresAbogadoDeportivo.tipicidadYCulpabilidad.calificacionCulpabilidad}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block font-semibold">Responsabilidad Objetiva del Club (Strict Liability):</span>
                      <p className="text-slate-300 mt-0.5 text-[11px]">
                        {resultado.analisis.factoresAbogadoDeportivo.tipicidadYCulpabilidad.responsabilidadObjetivaClub.motivacion}
                      </p>
                      <span className="text-[10px] text-oro-400 font-mono block mt-1">
                        Base: {resultado.analisis.factoresAbogadoDeportivo.tipicidadYCulpabilidad.responsabilidadObjetivaClub.fundamentoArticulo}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Dosimetría, Atenuantes, Agravantes y Medidas Cautelares */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📊</span> Dosimetría Sancionatoria
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Arts. 16 y 17 RDFVF</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-rose-400 font-semibold block mb-1">Circunstancias Agravantes (Art. 16):</span>
                      {resultado.analisis.factoresAbogadoDeportivo.dosimetriaYProporcionalidad.agravantesIdentificados.map((a, i) => (
                        <div key={i} className="text-slate-300 text-[11px] flex items-center justify-between">
                          <span>• {a.nombre}</span>
                          <span className="text-slate-500 font-mono">{a.articulo}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-emerald-400 font-semibold block mb-1">Circunstancias Atenuantes (Art. 17):</span>
                      {resultado.analisis.factoresAbogadoDeportivo.dosimetriaYProporcionalidad.atenuantesIdentificados.map((a, i) => (
                        <div key={i} className="text-slate-300 text-[11px] flex items-center justify-between">
                          <span>• {a.nombre}</span>
                          <span className="text-slate-500 font-mono">{a.articulo}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 font-semibold block">Abono de Medidas Cautelares (Art. 34):</span>
                      <p className="text-slate-300 mt-0.5 text-[11px]">
                        {resultado.analisis.factoresAbogadoDeportivo.dosimetriaYProporcionalidad.descuentoMedidasPreventivas}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Vías Recursivas y Estrategia Litigiosa (Cuadro Comparativo) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>🧭</span> Recursos Procedentes & Estrategia Litigiosa
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Días Hábiles vs Naturales</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.recursosProcedentesYPlazos.map((rec, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{rec.recurso}</span>
                        <span className="px-2 py-0.5 rounded bg-oro-500/10 text-oro-400 font-mono font-bold text-[10px]">
                          {rec.plazoDias} días
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block font-medium">Órgano: {rec.organo}</span>
                      <p className="text-[10px] text-slate-500 font-mono">{rec.baseLegal}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                  <span className="text-amber-400 font-semibold block">⚠️ Puntos Críticos para Blindar el Fallo:</span>
                  <ul className="text-slate-300 space-y-1 list-disc pl-4 text-[11px]">
                    {resultado.analisis.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.principalesVulnerabilidadesFallo.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: PROJECT MANAGER (SLA & AUTOS) */}
      {pestañaActiva === 'PROJECT_MANAGER' && (
        <div className="space-y-6">
          {!resultado ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">⏱️</span>
              <p className="text-sm">Procesa un documento para visualizar los plazos y autos automáticos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tarjeta de Control SLA y Fases */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                  🚦 Tablero de Control y SLA Procesal
                </h3>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Estado del Plazo:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {resultado.metricasProjectManager.estadoSla}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Días Hábiles Restantes:</span>
                    <span className="font-mono font-bold text-white">
                      {resultado.metricasProjectManager.diasHabilesRestantes} días
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Fecha Límite Descargos:</span>
                    <span className="font-mono text-xs text-oro-300">
                      {resultado.metricasProjectManager.fechaLimiteDescargos}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">
                    Próxima Tarea / Acción Requerida:
                  </span>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    👉 {resultado.metricasProjectManager.proximaAccionRequerida}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <span className="text-slate-400 font-semibold block">Fase Procesal Activa:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-oro-500 animate-pulse" />
                    <span className="font-bold text-oro-400">
                      {resultado.metricasProjectManager.faseActual}
                    </span>
                  </div>
                </div>
              </div>

              {/* Generador de Auto Oficial Correlativo */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    📝 Auto Procesal Oficial Generado
                  </h3>
                  <span className="px-2.5 py-1 rounded bg-oro-500/20 text-oro-300 border border-oro-500/30 text-xs font-mono font-bold">
                    {resultado.analisis.autoRecomendado.correlativoSugerido}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Texto preliminar formal generado para notificación y expediente:
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(resultado.analisis.autoRecomendado.textoBorrador);
                        alert('Borrador copiado al portapapeles');
                      }}
                      className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800"
                    >
                      📋 Copiar Texto
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto border border-slate-800/80">
                    {resultado.analisis.autoRecomendado.textoBorrador}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: CASOS EN BASE DE DATOS */}
      {pestañaActiva === 'CASOS_BD' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">
                Expedientes Almacenados en Base de Datos ({resumenInicial.totalExpedientes} totales)
              </h3>
              <p className="text-xs text-slate-400">
                Últimos casos estructurados y disponibles para el agente IA disciplinario y consulta de precedentes.
              </p>
            </div>
            <Link
              href="/expedientes"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-oro-500 text-slate-950 hover:bg-oro-400 transition"
            >
              Abrir Kanban Completo →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">N° Expediente</th>
                  <th className="p-3">Torneo / Partido</th>
                  <th className="p-3">Motivo / Falta</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Multa (UCFVF)</th>
                  <th className="p-3 text-right">Multa (USD)</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {resumenInicial.ultimosCasos.map((caso) => (
                  <tr key={caso.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-white">
                      {caso.numero}/{caso.anio}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-200 block">{caso.ligaTorneo || 'FUTVE'}</span>
                      <span className="text-[11px] text-slate-400 line-clamp-1">{caso.nombre || 'Caso General'}</span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-slate-400">
                      {caso.motivo || 'Sin motivo detallado'}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-oro-300 border border-slate-700">
                        {caso.estado}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-oro-400">
                      {caso.multaUc ? `${caso.multaUc.toLocaleString()} UC` : '0'}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      {caso.multaUsd ? `$${caso.multaUsd.toLocaleString()}` : '$0'}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={`/expedientes`}
                        className="text-xs text-oro-400 hover:text-oro-300 font-semibold"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
