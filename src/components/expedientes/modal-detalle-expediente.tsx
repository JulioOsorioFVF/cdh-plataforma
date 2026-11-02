'use client';

import React, { useState, useEffect } from 'react';
import { EstadoExpediente } from '@prisma/client';
import {
  obtenerDetalleExpedienteConJurisprudencia,
  moverEstadoExpedienteKanban,
  COLUMNAS_KANBAN_CONFIG,
} from '@/server/expedientes/acciones';
import type { PrecedenteJurisprudencial } from '@/server/ia/agente-disciplinario';
import { BotonAsistenteIA } from '@/components/ia/boton-asistente-ia';

interface ModalDetalleExpedienteProps {
  expedienteId: number | null;
  alCerrar: () => void;
  alActualizar?: () => void;
}

export function ModalDetalleExpediente({
  expedienteId,
  alCerrar,
  alActualizar,
}: ModalDetalleExpedienteProps) {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<{
    expediente: any;
    precedentesJurisprudenciales: PrecedenteJurisprudencial[];
  } | null>(null);

  const [pestanaActiva, setPestanaActiva] = useState<'general' | 'jurisprudencia' | 'movimientos'>('general');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    if (!expedienteId) {
      setDatos(null);
      return;
    }

    let montado = true;
    setCargando(true);

    obtenerDetalleExpedienteConJurisprudencia(expedienteId)
      .then((resultado) => {
        if (montado && resultado) {
          setDatos(resultado);
        }
      })
      .catch((err) => console.error('Error cargando detalle:', err))
      .finally(() => {
        if (montado) setCargando(false);
      });

    return () => {
      montado = false;
    };
  }, [expedienteId]);

  if (!expedienteId) return null;

  const exp = datos?.expediente;

  const handleCambiarEstado = async (nuevoEstado: EstadoExpediente) => {
    if (!exp || exp.estado === nuevoEstado) return;
    setCambiandoEstado(true);

    const res = await moverEstadoExpedienteKanban({
      expedienteId: exp.id,
      nuevoEstado,
      descripcionMovimiento: `Estado actualizado a ${nuevoEstado} desde la ficha de detalle.`,
    });

    setCambiandoEstado(false);
    if (res.ok) {
      setDatos((prev) =>
        prev
          ? {
              ...prev,
              expediente: { ...prev.expediente, estado: nuevoEstado },
            }
          : null,
      );
      if (alActualizar) alActualizar();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 bg-vin-900 text-white border-b border-vin-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-oro-500/20 border border-oro-400/40 flex items-center justify-center text-xl">
              ⚖️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-lg text-white leading-tight">
                  Expediente N° {exp ? `${exp.numero}/${exp.anio}` : 'Cargando...'}
                </h3>
                {exp && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                    {exp.estado}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70">
                {exp?.ligaTorneo || 'Consejo de Honor de la Federación Venezolana de Fútbol'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {exp && (
              <BotonAsistenteIA
                estilo="boton-accion"
                etiqueta="Orientar este caso con IA"
                expedienteContexto={{
                  numero: exp.numero,
                  anio: exp.anio,
                  motivo: exp.motivo,
                  torneo: exp.ligaTorneo,
                  equipos: exp.equipos,
                  estado: exp.estado,
                  alerta: exp.alerta,
                }}
              />
            )}
            <button
              onClick={alCerrar}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de Pestañas y selector de estado */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPestanaActiva('general')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                pestanaActiva === 'general'
                  ? 'bg-vin-900 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              📋 Información General
            </button>
            <button
              onClick={() => setPestanaActiva('jurisprudencia')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                pestanaActiva === 'jurisprudencia'
                  ? 'bg-vin-900 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span>📚 Referencia Jurisprudencial</span>
              {datos?.precedentesJurisprudenciales?.length ? (
                <span className="px-1.5 py-0.2 rounded-full text-[0.65rem] bg-oro-500 text-vin-950 font-bold">
                  {datos.precedentesJurisprudenciales.length}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setPestanaActiva('movimientos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                pestanaActiva === 'movimientos'
                  ? 'bg-vin-900 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              📜 Autos y Movimientos ({exp?.movimientos?.length || 0})
            </button>
          </div>

          {/* Control rápido de estado en Kanban */}
          {exp && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium hidden sm:inline">Mover a columna:</span>
              <select
                disabled={cambiandoEstado}
                value={exp.estado}
                onChange={(e) => handleCambiarEstado(e.target.value as EstadoExpediente)}
                className="h-8 px-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-oro-500"
              >
                {COLUMNAS_KANBAN_CONFIG.map((col) => (
                  <option key={col.estado} value={col.estado}>
                    {col.icono} {col.titulo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Contenido de la ficha */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm gap-3">
              <span className="w-6 h-6 border-2 border-vin-900 border-t-transparent rounded-full animate-spin" />
              <span>Cargando expediente y antecedentes de Supabase...</span>
            </div>
          ) : !exp ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No se pudo cargar la información del expediente.
            </div>
          ) : (
            <>
              {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
              {pestanaActiva === 'general' && (
                <div className="space-y-5">
                  {/* Banner de alerta si existe */}
                  {exp.alerta && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2.5">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide">
                          Alerta Procesal Activa
                        </p>
                        <p className="text-xs mt-0.5">{exp.alerta}</p>
                      </div>
                    </div>
                  )}

                  {/* Tarjetas de datos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <h4 className="text-xs font-bold text-vin-900 dark:text-oro-400 uppercase tracking-wider">
                        Datos del Procedimiento
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-500">Motivo:</span>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                            {exp.motivo || 'No especificado'}
                          </p>
                        </div>
                        {exp.subMotivo && (
                          <div>
                            <span className="text-slate-500">Sub-Motivo:</span>
                            <p className="text-slate-700 dark:text-slate-300">{exp.subMotivo}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Equipos / Partes:</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {exp.equipos || 'No especificado'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div>
                            <span className="text-slate-500">Juez Asignado:</span>
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              {exp.asignado || 'Sin asignar'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Modalidad:</span>
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              {exp.modalidad || 'Digital'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <h4 className="text-xs font-bold text-vin-900 dark:text-oro-400 uppercase tracking-wider">
                        Resolución y Multas
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-500">N° de Auto / Decisión:</span>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {exp.numeroDecision || 'Pendiente de emisión'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Sancionado:</span>
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {exp.sancionadoRaw || 'N/A'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div>
                            <span className="text-slate-500">Multa en UCFVF:</span>
                            <p className="font-bold text-vin-900 dark:text-oro-400 text-sm">
                              {exp.multaUc ? `${exp.multaUc} UCFVF` : '0 UCFVF'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Equivalente USD:</span>
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                              {exp.multaUsd ? `$${exp.multaUsd}` : '$0.00'}
                            </p>
                          </div>
                        </div>
                        {exp.sancionRaw && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <span className="text-slate-500">Texto de la Sanción:</span>
                            <p className="italic text-slate-700 dark:text-slate-300 mt-0.5">
                              &ldquo;{exp.sancionRaw}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  {exp.notas && (
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Notas y Observaciones
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {exp.notas}
                      </p>
                    </div>
                  )}

                  {/* Partes formalmente registradas */}
                  {exp.partes && exp.partes.length > 0 && (
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Partes Constituidas
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {exp.partes.map((p: any) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                          >
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {p.nombre}
                              </p>
                              {p.cedula && (
                                <p className="text-[0.65rem] text-slate-500">C.I.: {p.cedula}</p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-vin-100 text-vin-800 dark:bg-vin-950 dark:text-oro-400">
                              {p.tipo}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 2: REFERENCIA JURISPRUDENCIAL */}
              {pestanaActiva === 'jurisprudencia' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-oro-50 dark:bg-oro-950/20 border border-oro-300 dark:border-oro-800/40 text-xs text-slate-700 dark:text-slate-300">
                    <p className="font-bold text-vin-900 dark:text-oro-400 text-sm flex items-center gap-1.5 mb-1">
                      <span>⚖️</span> Precedentes Análogos en la Base de Datos del Consejo de Honor
                    </p>
                    <p>
                      Casos históricos resueltos con motivos o infracciones similares a este expediente.
                      Sirven de doctrina y referencia para garantizar la coherencia jurisprudencial y la
                      igualdad de trato en los fallos sancionatorios.
                    </p>
                  </div>

                  {datos?.precedentesJurisprudenciales &&
                  datos.precedentesJurisprudenciales.length > 0 ? (
                    <div className="space-y-3">
                      {datos.precedentesJurisprudenciales.map((prec) => (
                        <div
                          key={prec.id}
                          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-oro-500 transition-colors shadow-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-vin-900 dark:text-oro-400">
                                Exp. N° {prec.numero}/{prec.anio}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[0.7rem] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                {prec.estado}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">
                              Torneo: {prec.ligaTorneo || 'General'}
                            </span>
                          </div>

                          <div className="pt-2 space-y-1.5 text-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {prec.motivo}
                            </p>
                            {prec.equipos && (
                              <p className="text-slate-600 dark:text-slate-400">
                                Partes: {prec.equipos}
                              </p>
                            )}

                            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-1">
                              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                <span>Decisión: <strong>{prec.numeroDecision || 'Auto resuelto'}</strong></span>
                                {prec.multaUc && (
                                  <span className="font-bold text-vin-900 dark:text-oro-400">
                                    Multa: {prec.multaUc} UCFVF
                                  </span>
                                )}
                              </div>
                              {prec.sancionRaw && (
                                <p className="text-slate-600 dark:text-slate-400 italic">
                                  &ldquo;{prec.sancionRaw}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-sm">
                      <p className="text-xl mb-1">🔍</p>
                      <p>No se encontraron precedentes exactos con las palabras clave de este motivo.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Puedes consultar al Agente de IA para rastrear precedentes más amplios por normativa FVF.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 3: MOVIMIENTOS Y AUTOS */}
              {pestanaActiva === 'movimientos' && (
                <div className="space-y-3">
                  {exp.movimientos && exp.movimientos.length > 0 ? (
                    exp.movimientos.map((mov: any, idx: number) => (
                      <div
                        key={mov.id || idx}
                        className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-vin-100 dark:bg-vin-950 text-vin-900 dark:text-oro-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {mov.tipo} — {mov.codigo || 'S/N'}
                            </span>
                            <span className="text-[0.7rem] text-slate-500">
                              {mov.fecha ? new Date(mov.fecha).toLocaleDateString() : 'Sin fecha'}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                            {mov.descripcion || 'Sin descripción.'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-sm">
                      Aún no hay movimientos procesales registrados para este expediente.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            Base de datos: <span className="font-medium text-slate-700 dark:text-slate-300">Supabase / PostgreSQL CDH</span>
          </p>
          <button
            onClick={alCerrar}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
