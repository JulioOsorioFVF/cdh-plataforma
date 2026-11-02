'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PrecedenteJurisprudencial, RespuestaAgenteIA } from '@/server/ia/agente-disciplinario';
import { PASOS_PROCESO_DISCIPLINARIO } from '@/server/ia/agente-disciplinario';

interface MensajeUI {
  id: string;
  remitente: 'usuario' | 'ia';
  texto: string;
  fecha: string;
  pasoSugerido?: number;
  articulosCitados?: string[];
  alertasProcesales?: string[];
  precedentes?: PrecedenteJurisprudencial[];
  proximasAcciones?: string[];
}

interface AsistenteDisciplinarioModalProps {
  abierto: boolean;
  alCerrar: () => void;
  expedienteContexto?: {
    numero?: string;
    anio?: number;
    motivo?: string;
    torneo?: string;
    equipos?: string;
    estado?: string;
    alerta?: string;
  };
}

export function AsistenteDisciplinarioModal({
  abierto,
  alCerrar,
  expedienteContexto,
}: AsistenteDisciplinarioModalProps) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([
    {
      id: 'bienvenida',
      remitente: 'ia',
      texto: `**Bienvenido al Orientador Procesal y Asistente Jurisprudencial del Consejo de Honor FVF.**

Estoy programado para orientar cada etapa del procedimiento disciplinario con base en el **Reglamento Disciplinario FVF (RDFVF)**, el **Código Disciplinario FIFA** y el histórico de expedientes resueltos en nuestra base de datos.

Puedes consultarme sobre:
1. **Admisibilidad**: Examen de requisitos formales y caución del **Art. 170 RDFVF**.
2. **Auto de Entrada (A.E.)**: Apertura y plazos de descargos probatorios.
3. **Cotejo de Precedentes**: Búsqueda jurisprudencial por motivo (alineación indebida, violencia, impago arbitral).
4. **Dosimetría de Sanciones**: Baremos de suspensión y liquidación de multas en **UCFVF**.
5. **Recursos**: Sustanciación de Reconsideración (Art. 182) y apelaciones.`,
      fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pasoSugerido: 1,
      articulosCitados: ['Art. 169 RDFVF', 'Art. 170 RDFVF', 'Art. 77 RDFVF'],
      proximasAcciones: [
        'Verificar voucher de caución económica para protestas.',
        'Constatar sello de recepción y cómputo de 48h hábiles.',
      ],
    },
  ]);

  const [inputTexto, setInputTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [pasoActivo, setPasoActivo] = useState<number>(1);
  const finMensajesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (abierto) {
      finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, abierto]);

  // Si cambia el contexto del expediente, avisar al usuario
  useEffect(() => {
    if (expedienteContexto && expedienteContexto.numero) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `ctx-${Date.now()}`,
          remitente: 'ia',
          texto: `🔍 **Expediente cargado en contexto:**\n- **N°:** ${expedienteContexto.numero}/${expedienteContexto.anio || ''}\n- **Motivo:** ${expedienteContexto.motivo || 'N/A'}\n- **Torneo / Equipos:** ${expedienteContexto.torneo || ''} | ${expedienteContexto.equipos || ''}\n- **Estado actual:** ${expedienteContexto.estado || 'RECIBIDO'}\n\n¿Deseas que analicemos la admisibilidad, busquemos jurisprudencia análoga o proyectemos la resolución sancionatoria?`,
          fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [expedienteContexto]);

  const enviarMensaje = async (textoAEnviar?: string) => {
    const texto = (textoAEnviar || inputTexto).trim();
    if (!texto || cargando) return;

    const nuevoMensajeUsuario: MensajeUI = {
      id: `user-${Date.now()}`,
      remitente: 'usuario',
      texto,
      fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setInputTexto('');
    setCargando(true);

    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: texto,
          expedienteContexto,
          pasoFoco: pasoActivo,
        }),
      });

      if (!res.ok) {
        throw new Error('Error en el servicio de IA');
      }

      const data: RespuestaAgenteIA = await res.json();

      const nuevoMensajeIA: MensajeUI = {
        id: `ia-${Date.now()}`,
        remitente: 'ia',
        texto: data.respuesta,
        fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pasoSugerido: data.pasoActualSugerido,
        articulosCitados: data.articulosCitados,
        alertasProcesales: data.alertasProcesales,
        precedentes: data.precedentesRelevantes,
        proximasAcciones: data.proximasAcciones,
      };

      if (data.pasoActualSugerido) {
        setPasoActivo(data.pasoActualSugerido);
      }

      setMensajes((prev) => [...prev, nuevoMensajeIA]);
    } catch (err) {
      console.error('Error al consultar agente disciplinario:', err);
      setMensajes((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          remitente: 'ia',
          texto:
            '⚠️ Se produjo una interrupción momentánea al procesar la consulta. Por favor intente nuevamente o elija una de las acciones rápidas.',
          fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="relative flex flex-col w-full max-w-4xl h-[92vh] max-h-[850px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Encabezado del Agente */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-vin-900 via-vin-950 to-vin-900 text-white border-b border-vin-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-oro-500/20 border border-oro-400/40 flex items-center justify-center text-xl shadow-inner">
              ⚖️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-base sm:text-lg text-white leading-tight">
                  Agente Jurídico Disciplinario FVF
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Activo
                </span>
              </div>
              <p className="text-xs text-white/70">
                Orientación en 5 pasos del procedimiento & Consulta de jurisprudencia en base de datos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('¿Desea reiniciar la conversación con el asistente?')) {
                  const primero = mensajes[0];
                  if (primero) setMensajes([primero]);
                }
              }}
              title="Reiniciar conversación"
              className="px-2.5 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              🔄 Limpiar
            </button>
            <button
              onClick={alCerrar}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-lg leading-none"
              title="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de progreso de los 5 pasos del procedimiento */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] gap-2 text-xs">
            {PASOS_PROCESO_DISCIPLINARIO.map((p) => {
              const esActivo = pasoActivo === p.paso;
              const esCompletado = pasoActivo > p.paso;
              return (
                <button
                  key={p.paso}
                  onClick={() => {
                    setPasoActivo(p.paso);
                    enviarMensaje(`Orientación paso a paso para la etapa: Paso ${p.paso} - ${p.titulo}`);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all ${
                    esActivo
                      ? 'bg-vin-900 text-white border-vin-700 shadow-xs'
                      : esCompletado
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-oro-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[0.7rem] ${
                      esActivo
                        ? 'bg-oro-500 text-vin-950'
                        : esCompletado
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p.paso}
                  </span>
                  <span className="font-medium truncate max-w-[100px]">{p.titulo.split(' ')[0]} {p.titulo.split(' ')[1] || ''}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zona de Mensajes del Chat */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.remitente === 'usuario' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-xs text-sm leading-relaxed ${
                  m.remitente === 'usuario'
                    ? 'bg-vin-900 text-white rounded-tr-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                }`}
              >
                {/* Texto del mensaje formateado */}
                <div className="whitespace-pre-wrap space-y-2">
                  {m.texto}
                </div>

                {/* Alertas procesales si existen */}
                {m.alertasProcesales && m.alertasProcesales.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700 space-y-1.5">
                    {m.alertasProcesales.map((alerta, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-medium"
                      >
                        {alerta}
                      </div>
                    ))}
                  </div>
                )}

                {/* Precedentes Jurisprudenciales encontrados en la base de datos de Supabase */}
                {m.precedentes && m.precedentes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-vin-900 dark:text-oro-400 flex items-center gap-1.5 mb-2">
                      <span>📚</span> Precedentes Jurisprudenciales en Base de Datos:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {m.precedentes.map((prec) => (
                        <div
                          key={prec.id}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                            <span>Exp. N° {prec.numero}/{prec.anio}</span>
                            <span className="px-1.5 py-0.5 rounded text-[0.65rem] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {prec.estado}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            {prec.motivo || 'Motivo no especificado'}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 text-[0.7rem] mt-0.5">
                            Auto / Decisión: <strong>{prec.numeroDecision || 'N/A'}</strong>
                            {prec.multaUc ? ` · Multa: ${prec.multaUc} UCFVF` : ''}
                          </p>
                          {prec.sancionRaw && (
                            <p className="text-slate-700 dark:text-slate-300 italic text-[0.7rem] mt-1 border-l-2 border-oro-500 pl-2">
                              &ldquo;{prec.sancionRaw}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones recomendadas */}
                {m.proximasAcciones && m.proximasAcciones.length > 0 && (
                  <div className="mt-3 pt-2 text-xs border-t border-slate-200/60 dark:border-slate-700">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Checklist procesal:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                      {m.proximasAcciones.map((acc, idx) => (
                        <li key={idx}>{acc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className={`mt-2 text-[0.65rem] text-right ${
                    m.remitente === 'usuario' ? 'text-white/60' : 'text-slate-400'
                  }`}
                >
                  {m.fecha}
                </div>
              </div>
            </div>
          ))}

          {cargando && (
            <div className="flex items-center gap-2 text-slate-500 text-xs p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
              <span className="w-2 h-2 rounded-full bg-oro-500 animate-ping" />
              <span>Consultando normativa FVF y cotejando jurisprudencia en base de datos...</span>
            </div>
          )}

          <div ref={finMensajesRef} />
        </div>

        {/* Chips de Consultas Rápidas */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Sugerencias:
          </span>
          {[
            'Verificar requisitos de admisibilidad (Art. 170 Caución)',
            'Jurisprudencia: Protesta por Alineación Indebida',
            'Incumplimiento de pago de honorarios a árbitros',
            'Sanción por conducta violenta e invasión de público',
            'Redactar Auto de Entrada y emplazamiento a descargos',
            'Cálculo de multa en UCFVF y recursos de reconsideración',
          ].map((sugerencia, idx) => (
            <button
              key={idx}
              onClick={() => enviarMensaje(sugerencia)}
              disabled={cargando}
              className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-oro-500 hover:text-vin-900 dark:hover:text-oro-400 shrink-0 transition-colors cursor-pointer"
            >
              {sugerencia}
            </button>
          ))}
        </div>

        {/* Barra de Entrada / Envío */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensaje();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Haz una consulta jurídica, pide orientación sobre un paso o cita un caso..."
              disabled={cargando}
              className="flex-1 h-11 px-4 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-oro-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={cargando || !inputTexto.trim()}
              className="h-11 px-5 bg-vin-900 hover:bg-vin-800 text-white rounded-xl font-medium text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
              <span>Orientar</span>
              <span>➔</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
