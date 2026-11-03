'use client';

import React, { useState, useRef } from 'react';
import type { AnalisisCompletoExpedientePDF } from '@/server/ia/extractor-expediente-pdf';
import { TipoAutoCDH } from '@/server/ia/matriz-evaluacion';
import {
  analizarDocumentoConIAAction,
  generarAutoConCorrelativoAction,
  adjuntarDocumentoAExpedienteAction,
  retroalimentarMatrizDecisionAction,
} from '@/server/expedientes/acciones';

interface AnalizadorPdfModalProps {
  abierto: boolean;
  alCerrar: () => void;
  expedienteId?: number;
  alAplicarAExpediente?: (datosExtraidos: AnalisisCompletoExpedientePDF) => void;
}

export function AnalizadorPdfModal({
  abierto,
  alCerrar,
  expedienteId,
  alAplicarAExpediente,
}: AnalizadorPdfModalProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [textoManual, setTextoManual] = useState<string>('');
  const [modoEntrada, setModoEntrada] = useState<'archivo' | 'texto'>('archivo');
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState<AnalisisCompletoExpedientePDF | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pestañaActiva, setPestañaActiva] = useState<
    'partes' | 'testigos' | 'argumentacion' | 'jurisprudencia' | 'normas' | 'antecedentes' | 'abogado_deportivo' | 'auto'
  >('partes');

  // Estado para la generación de Auto
  const [tipoAutoSeleccionado, setTipoAutoSeleccionado] = useState<TipoAutoCDH>('AUTO_INICIO_DESCARGOS');
  const [generandoAuto, setGenerandoAuto] = useState(false);
  const [autoGeneradoResultado, setAutoGeneradoResultado] = useState<{
    correlativo: string;
    texto: string;
  } | null>(null);
  const [retroalimentadoExito, setRetroalimentadoExito] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!abierto) return null;

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setArchivo(f);
      setErrorMsg(null);
    }
  };

  const handleProcesarYAnalizar = async () => {
    setAnalizando(true);
    setErrorMsg(null);
    setResultado(null);
    setAutoGeneradoResultado(null);

    try {
      let resp: Response;

      if (modoEntrada === 'archivo' && archivo) {
        const formData = new FormData();
        formData.append('archivo', archivo);
        if (textoManual.trim()) {
          formData.append('texto', textoManual);
        }
        if (expedienteId) {
          formData.append('expedienteId', String(expedienteId));
        }

        resp = await fetch('/api/ia/analizar-pdf', {
          method: 'POST',
          body: formData,
        });
      } else {
        if (!textoManual.trim()) {
          setErrorMsg('Por favor selecciona un archivo PDF o ingresa el texto del informe/expediente.');
          setAnalizando(false);
          return;
        }

        resp = await fetch('/api/ia/analizar-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texto: textoManual,
            nombreArchivo: 'escrito_disciplinario.pdf',
            tamanoBytes: textoManual.length,
            expedienteId,
          }),
        });
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al procesar el análisis en el servidor.');
      }

      const data = await resp.json();
      if (data.ok && data.analisis) {
        setResultado(data.analisis);
      } else {
        throw new Error(data.error || 'No se pudo estructurar la información del PDF.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error durante la extracción.');
    } finally {
      setAnalizando(false);
    }
  };

  const handleGenerarAuto = async () => {
    if (!expedienteId && !resultado) {
      setErrorMsg('Se requiere asociar a un expediente para generar el correlativo oficial.');
      return;
    }

    setGenerandoAuto(true);
    try {
      const res = await generarAutoConCorrelativoAction({
        expedienteId: expedienteId || 1,
        tipoAuto: tipoAutoSeleccionado,
        resumenHechos: resultado?.argumentacionJuridica.resumenHechos,
        articulosAplicables: resultado?.normasAplicables.map((n) => `${n.cuerpoNormativo} ${n.articulo}`),
        multaUcfvf: resultado?.propuestaSancion.multaUcfvf,
        suspensionDeportiva: resultado?.propuestaSancion.suspensionDeportiva,
      });

      if (res.ok && res.data) {
        setAutoGeneradoResultado({
          correlativo: res.data.numeroCorrelativoAuto,
          texto: res.data.textoAutoCompleto,
        });
      } else {
        setErrorMsg(res.error || 'No se pudo generar el auto oficial.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al emitir el auto.');
    } finally {
      setGenerandoAuto(false);
    }
  };

  const handleRetroalimentarMemoriaIA = async () => {
    if (!resultado) return;
    try {
      await retroalimentarMatrizDecisionAction({
        expedienteId: expedienteId || 1,
        criterioJuridico: resultado.evaluacionMatriz.orientacionCasosFuturos,
        motivoTipificado: resultado.identificacionExpediente.torneo + ' - ' + resultado.argumentacionJuridica.resumenHechos.slice(0, 100),
        articulosClave: resultado.normasAplicables.map((n) => n.articulo),
        multaAplicadaUcfvf: resultado.propuestaSancion.multaUcfvf,
        sancionDeportiva: resultado.propuestaSancion.suspensionDeportiva,
        extractoHechos: resultado.argumentacionJuridica.resumenHechos,
      });
      setRetroalimentadoExito(true);
      setTimeout(() => setRetroalimentadoExito(false), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-vin-800 to-oro-600 text-white text-lg shadow-lg">
              📄
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Análisis y Extracción Integral de Expedientes PDF con IA
              </h2>
              <p className="text-xs text-slate-400">
                Extrae Partes, Testigos, Declaraciones, Argumentación Jurídica, Jurisprudencia y Normas Nacionales/Internacionales.
              </p>
            </div>
          </div>
          <button
            onClick={alCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Zona de Carga / Input */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setModoEntrada('archivo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                modoEntrada === 'archivo'
                  ? 'bg-vin-900 text-white border border-vin-700 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              📎 Subir Archivo PDF
            </button>
            <button
              onClick={() => setModoEntrada('texto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                modoEntrada === 'texto'
                  ? 'bg-vin-900 text-white border border-vin-700 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ✍️ Pegar Texto / Acta / Transcripción
            </button>
          </div>

          {modoEntrada === 'archivo' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-oro-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                onChange={handleSeleccionarArchivo}
                className="hidden"
              />
              <span className="text-3xl block mb-2">📑</span>
              {archivo ? (
                <div>
                  <p className="text-sm font-semibold text-oro-400">{archivo.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(archivo.size / 1024).toFixed(1)} KB — Listo para estructurar con el Agente IA
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-300 font-medium">
                    Haz clic para seleccionar o arrastra el documento PDF del expediente
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Informes arbitrales, actas COMET, recursos, resoluciones o denuncias (hasta 25 MB)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={textoManual}
              onChange={(e) => setTextoManual(e.target.value)}
              placeholder="Pega aquí el texto completo del acta de partido, informe arbitral, descargos o resolución..."
              rows={4}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-oro-500 font-mono"
            />
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              💡 El modelo analizará automáticamente la tipicidad, artículos RDFVF/FIFA y reincidencia.
            </span>
            <button
              onClick={handleProcesarYAnalizar}
              disabled={analizando || (modoEntrada === 'archivo' && !archivo && !textoManual)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-vin-800 to-oro-600 hover:from-vin-700 hover:to-oro-500 transition-all shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {analizando ? (
                <>
                  <span className="animate-spin text-sm">🔄</span>
                  <span>Extrayendo y Analizando con IA...</span>
                </>
              ) : (
                <>
                  <span>⚡ Extraer Datos y Estructurar con IA</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-200">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Resultados del Análisis Estructurado */}
        {resultado ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
            {/* Pestañas de Navegación de Resultados */}
            <div className="flex items-center gap-1 overflow-x-auto p-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0">
              <button
                onClick={() => setPestañaActiva('partes')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'partes'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👥 Partes ({resultado.partes.length})
              </button>
              <button
                onClick={() => setPestañaActiva('testigos')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'testigos'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🗣️ Testigos y Declaraciones ({resultado.testigos.length})
              </button>
              <button
                onClick={() => setPestañaActiva('argumentacion')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'argumentacion'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚖️ Argumentación Jurídica
              </button>
              <button
                onClick={() => setPestañaActiva('jurisprudencia')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'jurisprudencia'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📚 Jurisprudencia Citada ({resultado.jurisprudenciaCitada.length})
              </button>
              <button
                onClick={() => setPestañaActiva('normas')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'normas'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📖 Normas Nacionales e Int. ({resultado.normasAplicables.length})
              </button>
              <button
                onClick={() => setPestañaActiva('antecedentes')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'antecedentes'
                    ? 'bg-vin-900 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔍 Antecedentes y Matriz
              </button>
              <button
                onClick={() => setPestañaActiva('abogado_deportivo')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'abogado_deportivo'
                    ? 'bg-emerald-900 text-emerald-200 font-bold border border-emerald-500/40'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                ⚖️ Abogado Deportivo (TAS/FVF)
              </button>
              <button
                onClick={() => setPestañaActiva('auto')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  pestañaActiva === 'auto'
                    ? 'bg-oro-600 text-slate-950 font-bold'
                    : 'text-oro-400 hover:text-oro-300'
                }`}
              >
                📜 Auto Oficial Automatizado
              </button>
            </div>

            {/* Contenido Dinámico según la Pestaña */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {/* 1. PARTES */}
              {pestañaActiva === 'partes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>👥</span> Partes Identificadas en el Expediente
                    </h3>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      Torneo: {resultado.identificacionExpediente.torneo} | {resultado.identificacionExpediente.jornada}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resultado.partes.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start justify-between"
                      >
                        <div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              p.rolProcesal === 'IMPUTADO_DEMANDADO'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : p.rolProcesal === 'DEMANDANTE'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {p.rolProcesal.replace(/_/g, ' ')}
                          </span>
                          <h4 className="text-sm font-semibold text-white mt-1.5">{p.nombre}</h4>
                          <p className="text-xs text-slate-400">Tipo de Sujeto: {p.tipo}</p>
                          {p.cedulaOComet && (
                            <p className="text-xs text-oro-400 font-mono mt-0.5">COMET ID: {p.cedulaOComet}</p>
                          )}
                        </div>
                        <span className="text-2xl">
                          {p.tipo === 'CLUB' ? '🛡️' : p.tipo === 'JUGADOR' ? '🏃' : p.tipo === 'ARBITRO' ? '🟨' : '👔'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. TESTIGOS Y DECLARACIONES */}
              {pestañaActiva === 'testigos' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🗣️</span> Testigos y Declaraciones Testimoniales Valoradas
                  </h3>
                  <div className="space-y-3">
                    {resultado.testigos.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-oro-400">{t.nombre}</h4>
                            <p className="text-xs text-slate-400">{t.cargoOAfiliacion}</p>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {t.credibilidadEstimada}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-lg border-l-2 border-l-oro-500 text-xs text-slate-300 italic">
                          "{t.declaracionOInforme}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. ARGUMENTACIÓN JURÍDICA */}
              {pestañaActiva === 'argumentacion' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>⚖️</span> Argumentación Jurídica y Valoración Fáctica
                  </h3>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-semibold text-oro-400 uppercase tracking-wider">
                      Resumen de Hechos Constatados
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {resultado.argumentacionJuridica.resumenHechos}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>⚔️</span> Alegatos de Acusación / Infracción
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {resultado.argumentacionJuridica.alegatosAcusacion.map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-red-400">•</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🛡️</span> Alegatos de Descargo / Defensa
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {resultado.argumentacionJuridica.alegatosDefensa.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-blue-400">•</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Conclusiones Jurídicas del Consejo de Honor
                    </h4>
                    <p className="text-xs text-slate-300">
                      {resultado.argumentacionJuridica.conclusionesJuridicas}
                    </p>
                  </div>
                </div>
              )}

              {/* 4. JURISPRUDENCIA CITADA */}
              {pestañaActiva === 'jurisprudencia' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📚</span> Jurisprudencia y Precedentes Citados
                  </h3>
                  <div className="space-y-3">
                    {resultado.jurisprudenciaCitada.map((j, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-oro-400">{j.codigoCasoPrecedente}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {j.tribunalUOrgano}
                            </span>
                            {j.esVinculante && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-vin-900 text-white font-bold">
                                Vinculante FVF
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{j.criterioAplicado}</p>
                        </div>
                        <span className="text-xl text-slate-500">🏛️</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. NORMAS NACIONALES E INTERNACIONALES */}
              {pestañaActiva === 'normas' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📖</span> Normativa Nacional e Internacional con Artículos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resultado.normasAplicables.map((n, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              n.tipoNorma === 'INTERNACIONAL'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-vin-950 text-vin-300 border border-vin-800'
                            }`}
                          >
                            {n.cuerpoNormativo} ({n.tipoNorma})
                          </span>
                          {n.esSancionatoria && (
                            <span className="text-[10px] text-red-400 font-semibold">Tipo Sancionatorio</span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-oro-400">{n.articulo}</h4>
                        <p className="text-xs text-slate-300">{n.epigrafeOContenido}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. ANTECEDENTES Y MATRIZ DE EVALUACIÓN */}
              {pestañaActiva === 'antecedentes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Gravedad de la Falta</p>
                      <p
                        className={`text-base font-bold mt-1 ${
                          resultado.evaluacionMatriz.gravedadFalta === 'MUY_GRAVE'
                            ? 'text-red-400'
                            : resultado.evaluacionMatriz.gravedadFalta === 'GRAVE'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {resultado.evaluacionMatriz.gravedadFalta}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Riesgo Reincidencia</p>
                      <p className="text-base font-bold text-oro-400 mt-1">
                        {(resultado.evaluacionMatriz.nivelRiesgoReincidencia * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Coherencia Jurisprudencial</p>
                      <p className="text-base font-bold text-emerald-400 mt-1">
                        {resultado.evaluacionMatriz.coherenciaJurisprudencialScore}%
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-semibold text-oro-400 uppercase tracking-wider">
                      Orientación para Casos Futuros
                    </h4>
                    <p className="text-xs text-slate-200">
                      {resultado.evaluacionMatriz.orientacionCasosFuturos}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Alimentar Cerebro de la IA con este caso</h4>
                      <p className="text-xs text-slate-400">
                        Registra esta ratio decidendi en la Memoria Vectorial para que el Agente crezca y aprenda.
                      </p>
                    </div>
                    <button
                      onClick={handleRetroalimentarMemoriaIA}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                    >
                      {retroalimentadoExito ? '✅ Memoria Actualizada' : '🧠 Alimentar Matriz IA'}
                    </button>
                  </div>
                </div>
              )}

              {/* FACTORES DE ABOGADO DEPORTIVO EXPERTO (LEX SPORTIVA & TAS) */}
              {pestañaActiva === 'abogado_deportivo' && resultado.factoresAbogadoDeportivo && (
                <div className="space-y-4">
                  {/* Dictamen Forense */}
                  <div className="p-4 bg-slate-900 border border-emerald-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Dictamen Forense de Derecho Disciplinario
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        Riesgo TAS: {resultado.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.riesgoRevocacionInstanciasSuperiores}%
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white">
                      {resultado.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.dictamenEstrategicoForense}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Excepciones */}
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-white uppercase text-[11px] block border-b border-slate-800 pb-1">
                        🛡️ Excepciones y Locus Standi
                      </span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Legitimación:</span>
                        <p className="text-slate-200">{resultado.factoresAbogadoDeportivo.excepcionesPrevias.legitimacionActivaPasiva}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Caducidad / Prescripción:</span>
                        <p className="text-slate-200">{resultado.factoresAbogadoDeportivo.excepcionesPrevias.caducidadPrescripcion.dictamen}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Caución Art. 170:</span>
                        <p className="text-slate-200">{resultado.factoresAbogadoDeportivo.excepcionesPrevias.caucionArancelArt170.consecuenciaJuridica}</p>
                      </div>
                    </div>

                    {/* Estándar Probatorio */}
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-white uppercase text-[11px] block border-b border-slate-800 pb-1">
                        ⚖️ Estándar Probatorio (TAS)
                      </span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Acta Arbitral (Art. 172 RDFVF):</span>
                        <span className="font-mono font-bold text-oro-400">
                          {resultado.factoresAbogadoDeportivo.estandarProbatorioSanaCritica.valorActaArbitral}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Doctrina Cuerda de Hilos TAS:</span>
                        <p className="text-slate-300 italic text-[11px]">
                          {resultado.factoresAbogadoDeportivo.estandarProbatorioSanaCritica.doctrinaCuerdaDeHilos}
                        </p>
                      </div>
                    </div>

                    {/* Tipicidad */}
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-white uppercase text-[11px] block border-b border-slate-800 pb-1">
                        🎯 Tipicidad & Culpabilidad
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Grado:</span>
                        <span className="font-bold text-white">{resultado.factoresAbogadoDeportivo.tipicidadYCulpabilidad.gradoEjecucion}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Culpabilidad:</span>
                        <span className="font-bold text-oro-400">{resultado.factoresAbogadoDeportivo.tipicidadYCulpabilidad.calificacionCulpabilidad}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Responsabilidad Objetiva Club:</span>
                        <p className="text-slate-300 text-[11px]">{resultado.factoresAbogadoDeportivo.tipicidadYCulpabilidad.responsabilidadObjetivaClub.motivacion}</p>
                      </div>
                    </div>

                    {/* Vías Recursivas */}
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-white uppercase text-[11px] block border-b border-slate-800 pb-1">
                        🧭 Recursos y Plazos Legales
                      </span>
                      <ul className="space-y-1.5 text-[11px]">
                        {resultado.factoresAbogadoDeportivo.estrategiaLitigiosaYVulnerabilidad.recursosProcedentesYPlazos.map((r, i) => (
                          <li key={i} className="flex items-center justify-between p-1.5 rounded bg-slate-950">
                            <span className="font-semibold text-slate-200">{r.recurso}</span>
                            <span className="font-mono text-oro-400 font-bold">{r.plazoDias} días</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. AUTO OFICIAL AUTOMATIZADO CON CORRELATIVO */}
              {pestañaActiva === 'auto' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>📜</span> Generador Automatizado de Auto Oficial
                      </h3>
                      <p className="text-xs text-slate-400">
                        Selecciona el tipo de auto y genera la providencia con asignación automática de correlativo.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={tipoAutoSeleccionado}
                        onChange={(e) => setTipoAutoSeleccionado(e.target.value as TipoAutoCDH)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-oro-500"
                      >
                        <option value="AUTO_ENTRADA_RADICACION">1. Auto de Entrada / Radicación</option>
                        <option value="AUTO_INICIO_DESCARGOS">2. Auto de Apertura de Instrucción y Descargos</option>
                        <option value="AUTO_PRUEBAS_MEJOR_PROVEER">3. Auto de Pruebas y Mejor Proveer</option>
                        <option value="AUTO_CONCLUSION_DELIBERACION">4. Auto de Conclusión y Deliberación</option>
                        <option value="RESOLUCION_SANCIONATORIA">5. Resolución Sancionatoria Final</option>
                        <option value="AUTO_ARCHIVO_SOBRESEIMIENTO">6. Auto de Archivo / Sobreseimiento</option>
                      </select>
                      <button
                        onClick={handleGenerarAuto}
                        disabled={generandoAuto}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-oro-500 hover:bg-oro-400 text-slate-950 transition-colors shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {generandoAuto ? 'Emitiendo...' : 'Emitir Auto Oficial'}
                      </button>
                    </div>
                  </div>

                  {autoGeneradoResultado ? (
                    <div className="p-4 bg-slate-950 border border-oro-600/50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-oro-500/20 text-oro-300 border border-oro-500/40">
                          {autoGeneradoResultado.correlativo}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(autoGeneradoResultado.texto);
                            alert('Texto del Auto copiado al portapapeles');
                          }}
                          className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800"
                        >
                          📋 Copiar Texto
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-900 rounded-lg text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-800">
                        {autoGeneradoResultado.texto}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <p className="text-xs text-slate-400">
                        Borrador preliminar sugerido por la IA para este expediente:
                      </p>
                      <pre className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {resultado.autoRecomendado.textoBorrador}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pie de Acciones */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Archivo: {resultado.metadatosDocumento.nombreArchivo} ({resultado.metadatosDocumento.paginasAproximadas} pág.)
              </span>
              <div className="flex items-center gap-2">
                {alAplicarAExpediente && (
                  <button
                    onClick={() => {
                      alAplicarAExpediente(resultado);
                      alCerrar();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-oro-400 hover:bg-oro-300 transition-colors shadow cursor-pointer"
                  >
                    💾 Volcar Datos al Expediente
                  </button>
                )}
                <button
                  onClick={alCerrar}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
