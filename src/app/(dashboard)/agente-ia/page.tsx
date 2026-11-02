'use client';

import React, { useState } from 'react';
import {
  ejecutarAgenteJuridicoCDHAction,
  type DictamenEstructuradoAgenteIA,
  type PrecedenteRecuperadoRAG,
} from '@/server/ia/agente-jurisdiccional';

const CASOS_PRUEBA_REALES = [
  {
    titulo: '1. Informe Arbitral y Delegado (Hechos Violentos + Fuerza Pública + 4ta Amarilla)',
    torneo: 'Liga FUTVE 2',
    jornada: 11,
    origen: 'INFORME_ARBITRAL' as const,
    texto: `INFORME ARBITRAL Y DEL DELEGADO DE PARTIDO - JORNADA 11 LIGA FUTVE 2.
Partido: Bolívar SC vs. Angostura FC.
1) Al minuto 64 fue amonestado el jugador Juan Pérez (Ficha COMET #44910, Bolívar SC) por conducta antideportiva (acumula su 4ta tarjeta amarilla del torneo).
2) Al minuto 88 fue expulsado con tarjeta roja directa el Director Técnico de Angostura FC por ingresar al terreno de juego sin autorización y menospreciar públicamente al árbitro principal gritándole a viva voz.
3) El Delegado de Partido deja constancia de que en el estadio solo se presentaron 4 efectivos policiales (Fuerza Pública Insuficiente según protocolo), el camerino de árbitros no contaba con suministro de agua ni cerradura segura, y al finalizar el encuentro hubo lanzamiento de objetos desde la tribuna principal hacia el terreno de juego.`,
  },
  {
    titulo: '2. Protesta de Partido por Alineación Indebida (Sin Caución Art. 170 RDFVF)',
    torneo: 'Liga Futsal Reserva',
    jornada: 6,
    origen: 'PROTESTA_CLUB' as const,
    texto: `ESCRITO DE PROTESTA DE PARTIDO.
El club Centauros de Caracas interpone formal protesta contra el club Real Esperanza FC por presunta alineación indebida y usurpación de identidad del jugador dorsal N° 14 en el partido de la Jornada 6 del Torneo Reserva Futsal.
Nota de Secretaría: El club accionante invoca el Art. 77 y Art. 108 del RDFVF dentro de las 24 horas siguientes al partido, pero NO adjuntó el comprobante de transferencia bancaria correspondiente a la caución reglamentaria exigida en el artículo 170 del Reglamento Disciplinario FVF.`,
  },
  {
    titulo: '3. Remisión CNA por Falta de Pago de Honorarios Arbitrales (Bloqueo Licencias)',
    torneo: 'Liga FUTVE 2',
    jornada: 14,
    origen: 'INFORME_DELEGADO' as const,
    texto: `OFICIO COMISIÓN NACIONAL DE ÁRBITROS (CNA) Y DELEGADO FVF.
Se reporta formalmente que el club Ureña SC incumplió con el pago de los honorarios y viáticos de la terna arbitral designada para la Jornada 14, acumulando reincidencia en insolvencia operativa. Se solicita apertura de procedimiento y aplicación del Art. 104 RDFVF en concordancia con el Art. 21 del Código Disciplinario de la FIFA.`,
  },
] as const;

export default function ConsolaAgenteJuridicoIAPage() {
  const [torneo, setTorneo] = useState('Liga FUTVE 2');
  const [jornada, setJornada] = useState(11);
  const [origen, setOrigen] = useState<'INFORME_ARBITRAL' | 'INFORME_DELEGADO' | 'PROTESTA_CLUB' | 'CONSULTA_REGIONAL'>('INFORME_ARBITRAL');
  const [textoInforme, setTextoInforme] = useState<string>(CASOS_PRUEBA_REALES[0].texto);
  const [guardarEnActa, setGuardarEnActa] = useState(true);

  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dictamen, setDictamen] = useState<DictamenEstructuradoAgenteIA | null>(null);
  const [precedentes, setPrecedentes] = useState<PrecedenteRecuperadoRAG[]>([]);
  const [actaCreada, setActaCreada] = useState<string | undefined>(undefined);

  const cargarCasoEjemplo = (idx: number) => {
    const c = CASOS_PRUEBA_REALES[idx];
    if (!c) return;
    setTorneo(c.torneo);
    setJornada(c.jornada);
    setOrigen(c.origen);
    setTextoInforme(c.texto);
  };

  const ejecutarAnalisis = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setErrorMsg(null);
    try {
      const resultado = await ejecutarAgenteJuridicoCDHAction({
        torneo,
        jornada,
        origen,
        textoInforme,
        guardarEnActaSupabase: guardarEnActa,
      });
      setDictamen(resultado.dictamen);
      setPrecedentes(resultado.precedentesRAG);
      setActaCreada(resultado.actaGuardadaCodigo);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al procesar con el Agente IA. Verifica GEMINI_API_KEY en tu archivo .env.',
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* ENCABEZADO EJECUTIVO */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">
            Arquitectura Legal-RAG (pgvector) + Motor Determinista RDFVF
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            Agente IA Jurisdiccional y Procesador de Actas (Árbitros y Delegados)
          </h1>
          <p className="text-sm text-slate-400">
            Alimentado por el repositorio histórico de expedientes, jurisprudencia CDH-FVF y el Feature Store de reincidencia en Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {CASOS_PRUEBA_REALES.map((caso, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => cargarCasoEjemplo(idx)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-purple-500 text-xs text-slate-300 transition"
            >
              Cargar Caso #{idx + 1}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO (5 COLUMNAS): INGESTA DE ACTA ARBITRAL / DELEGADO / EXPEDIENTE */}
        <form
          onSubmit={ejecutarAnalisis}
          className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 h-fit"
        >
          <h2 className="text-base font-bold text-white">
            1. Entrada de Informe Arbitral, Delegado o Escrito
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Torneo (30 Competencias)</label>
              <select
                value={torneo}
                onChange={(e) => setTorneo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="Liga FUTVE (1ra División)">Liga FUTVE (1ra División)</option>
                <option value="Liga FUTVE 2">Liga FUTVE 2</option>
                <option value="Liga FUTVE Junior">Liga FUTVE Junior</option>
                <option value="Liga FUTVE Futsal 1">Liga FUTVE Futsal 1</option>
                <option value="Liga Futsal Reserva">Liga Futsal Reserva</option>
                <option value="Copa Venezuela">Copa Venezuela</option>
                <option value="Liga de Desarrollo">Liga de Desarrollo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">N° de Jornada (471 Jornadas)</label>
              <input
                type="number"
                value={jornada}
                onChange={(e) => setJornada(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Fuente Documental</label>
            <select
              value={origen}
              onChange={(e) =>
                setOrigen(
                  e.target.value as
                    | 'INFORME_ARBITRAL'
                    | 'INFORME_DELEGADO'
                    | 'PROTESTA_CLUB'
                    | 'CONSULTA_REGIONAL',
                )
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="INFORME_ARBITRAL">Acta / Informe de Árbitro Principal (CNA)</option>
              <option value="INFORME_DELEGADO">Informe de Delegado de Partido FVF</option>
              <option value="PROTESTA_CLUB">Protesta o Denuncia de Club / Parte</option>
              <option value="CONSULTA_REGIONAL">Consulta Técnica de Asociación Estadal</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Texto del Informe Arbitral, Reporte del Delegado o Denuncia
            </label>
            <textarea
              rows={10}
              value={textoInforme}
              onChange={(e) => setTextoInforme(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 leading-relaxed font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={guardarEnActa}
              onChange={(e) => setGuardarEnActa(e.target.checked)}
            />
            <span>
              Asentar automáticamente las sanciones e incidencias en la tabla{' '}
              <code className="text-purple-400">acta_disciplinaria_jornada</code> de Supabase
            </span>
          </label>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-bold text-white transition disabled:opacity-50"
          >
            {cargando
              ? 'Consultando Vector Store (pgvector) y Calculando Sanciones...'
              : 'Procesar con Agente IA y Liquidar Sanciones RDFVF'}
          </button>
        </form>

        {/* PANEL DERECHO (7 COLUMNAS): DICTAMEN ESTRUCTURADO, LIQUIDACIÓN Y BORRADOR */}
        <div className="lg:col-span-7 space-y-6">
          {!dictamen ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-300">
                Agente Jurisdiccional Listo para Procesar
              </p>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Selecciona uno de los 3 casos reales en la barra superior o pega un informe arbitral/delegado y presiona el botón morado para ejecutar el cruce RAG + cálculo de multas en UCFVF/USD.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Semáforo de Admisibilidad Procesal (Art. 169 y 170 RDFVF) y Clasificación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-2xl border ${
                    dictamen.admisibilidadProcesal.esAdmisible
                      ? 'bg-emerald-950/30 border-emerald-800'
                      : 'bg-red-950/40 border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                      Test de Admisibilidad (Arts. 169 / 170)
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        dictamen.admisibilidadProcesal.esAdmisible
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {dictamen.admisibilidadProcesal.esAdmisible ? 'ADMISIBLE' : 'INADMISIBLE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-2">
                    {dictamen.admisibilidadProcesal.motivacionAdmisibilidad}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Tipificación Estandarizada</span>
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      Severidad: {dictamen.tipificacionJuridica.nivelSeveridad}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {dictamen.tipificacionJuridica.motivoEstandarizado}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {dictamen.tipificacionJuridica.articulosAplicables.map((art) => (
                      <span
                        key={art}
                        className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-mono"
                      >
                        {art}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Tabla de Sanciones Liquidadas Automáticamente (Partidos y Multas UCFVF / USD) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Liquidación de Sanciones Deportivas y Pecuniarias (1 UCFVF = $3,00 USD)
                  </h3>
                  {actaCreada && (
                    <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded">
                      Guardado en Supabase: {actaCreada}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Sujeto / Imputado</th>
                        <th className="p-2.5">Tipo</th>
                        <th className="p-2.5">Sanción</th>
                        <th className="p-2.5">Suspensión</th>
                        <th className="p-2.5">Multa UCFVF</th>
                        <th className="p-2.5">Multa USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {dictamen.propuestaSancionatoria.map((s, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-semibold text-white">
                            {s.sujetoSancionado}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {s.fundamentoCalculo}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300">{s.tipoSujeto}</td>
                          <td className="p-2.5 text-amber-300 font-medium">{s.tipoSancion}</td>
                          <td className="p-2.5 font-mono text-white">
                            {s.partidosSuspension > 0 ? `${s.partidosSuspension} partido(s)` : 'N/A'}
                          </td>
                          <td className="p-2.5 font-mono text-amber-400 font-bold">
                            {s.multaSugeridaUcfvf} UCFVF
                          </td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">
                            ${s.multaSugeridaUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Borrador Oficial de Referencia / Decisión / Acta Listo para Firma */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Proyecto Redactado ({dictamen.borradorDocumentoOficial.tipoPronunciamiento})
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {dictamen.oficiosYNotificaciones.map((org) => (
                      <span
                        key={org}
                        className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded"
                      >
                        Notificar: {org}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 space-y-3 whitespace-pre-wrap">
                  <p className="font-bold text-blue-400">
                    {dictamen.borradorDocumentoOficial.encabezadoSugerido}
                  </p>
                  <p>{dictamen.borradorDocumentoOficial.vistosYConsiderandos}</p>
                  <p className="font-semibold text-emerald-300 border-t border-slate-800 pt-2">
                    {dictamen.borradorDocumentoOficial.dispositivaOficial}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/60 text-xs text-blue-200">
                  <strong>Recomendación de Gestión (CSO / Liderazgo):</strong>{' '}
                  {dictamen.recomendacionEstrategicaCSO}
                </div>
              </div>

              {/* 4. Precedentes Vectoriales Utilizados por el Agente (Transparencia RAG) */}
              {precedentes.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Precedentes y Normas Recuperadas de Supabase (pgvector)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {precedentes.map((p) => (
                      <div
                        key={p.codigoReferencia}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-mono">
                          <span className="text-purple-400 font-bold">{p.codigoReferencia}</span>
                          <span className="text-slate-400">Similitud: {(p.similitud * 100).toFixed(1)}%</span>
                        </div>
                        <p className="text-white font-medium">{p.motivoTipificado}</p>
                        <p className="text-slate-400 line-clamp-2">{p.criterioJuridico}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}