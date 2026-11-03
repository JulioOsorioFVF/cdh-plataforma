'use client';

import React, { useState, useEffect, useTransition } from 'react';

import {
  obtenerTableroKanban,
  moverEstadoExpedienteKanban,
} from '@/server/expedientes/acciones';
import { EstadoExpediente, type ColumnaKanban, type ExpedienteTarjetaKanban } from '@/types/kanban';
import { ModalCrearExpediente } from './modal-crear-expediente';
import { ModalDetalleExpediente } from './modal-detalle-expediente';
import { AsistenteDisciplinarioModal } from '@/components/ia/asistente-disciplinario-modal';
import { AnalizadorPdfModal } from './analizador-pdf-modal';

interface KanbanTableroProps {
  columnasIniciales?: ColumnaKanban[];
  modoModal?: boolean;
  alCerrarModal?: () => void;
}

export function KanbanTablero({
  columnasIniciales,
  modoModal = false,
  alCerrarModal,
}: KanbanTableroProps) {
  const [columnas, setColumnas] = useState<ColumnaKanban[]>(columnasIniciales || []);
  const [cargando, setCargando] = useState(!columnasIniciales);
  const [busqueda, setBusqueda] = useState('');
  const [anioFiltro, setAnioFiltro] = useState<string>('todos');

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [modalDetalleId, setModalDetalleId] = useState<number | null>(null);
  const [modalIAAbierto, setModalIAAbierto] = useState(false);
  const [modalPdfAbierto, setModalPdfAbierto] = useState(false);
  const [expedienteParaIA, setExpedienteParaIA] = useState<any>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollHorizontal = (direccion: 'izq' | 'der') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direccion === 'der' ? 360 : -360,
        behavior: 'smooth',
      });
    }
  };

  // Drag and drop state
  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null);
  const [columnaDestinoHover, setColumnaDestinoHover] = useState<EstadoExpediente | null>(null);
  const [isPending, startTransition] = useTransition();

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const anioNum = anioFiltro !== 'todos' ? parseInt(anioFiltro, 10) : undefined;
      const res = await obtenerTableroKanban({
        busqueda: busqueda.trim() || undefined,
        anio: anioNum,
      });
      setColumnas(res);
    } catch (err) {
      console.error('Error al cargar datos del Kanban:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [busqueda, anioFiltro]);

  const handleMoverTarjeta = async (
    expedienteId: number,
    nuevoEstado: EstadoExpediente,
  ) => {
    // Actualización optimista en la UI
    setColumnas((prev) => {
      let tarjetaMovida: ExpedienteTarjetaKanban | null = null;
      const nuevas = prev.map((col) => {
        const filtrados = col.expedientes.filter((e) => {
          if (e.id === expedienteId) {
            tarjetaMovida = { ...e, estado: nuevoEstado };
            return false;
          }
          return true;
        });
        return { ...col, expedientes: filtrados };
      });

      if (tarjetaMovida) {
        return nuevas.map((col) => {
          if (col.estado === nuevoEstado) {
            return {
              ...col,
              expedientes: [tarjetaMovida!, ...col.expedientes],
            };
          }
          return col;
        });
      }
      return prev;
    });

    startTransition(async () => {
      const res = await moverEstadoExpedienteKanban({
        expedienteId,
        nuevoEstado,
      });
      if (!res.ok) {
        // En caso de error, recargar estado real
        cargarDatos();
      }
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setArrastrandoId(id);
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const handleDragOver = (e: React.DragEvent, estado: EstadoExpediente) => {
    e.preventDefault();
    setColumnaDestinoHover(estado);
  };

  const handleDragLeave = () => {
    setColumnaDestinoHover(null);
  };

  const handleDrop = (e: React.DragEvent, nuevoEstado: EstadoExpediente) => {
    e.preventDefault();
    setColumnaDestinoHover(null);
    const id = arrastrandoId || parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (id) {
      handleMoverTarjeta(id, nuevoEstado);
    }
    setArrastrandoId(null);
  };

  const totalExpedientes = columnas.reduce((acc, c) => acc + c.expedientes.length, 0);

  return (
    <div className={`flex flex-col ${modoModal ? 'h-[92vh]' : 'min-h-[700px]'} bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl`}>
      {/* Barra Superior del Kanban */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vin-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-vin-900 dark:text-oro-400">
                  Tablero de Gestión de Expedientes (Kanban FVF)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {totalExpedientes} en vista
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arrastre tarjetas entre columnas para actualizar su fase procesal en Supabase / PostgreSQL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalPdfAbierto(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-all border border-slate-700 cursor-pointer"
              title="Anexar documento PDF y extraer Partes, Testigos, Normas y Autos con IA"
            >
              <span>📎</span>
              <span>Extraer de PDF con IA</span>
            </button>

            <button
              onClick={() => {
                setExpedienteParaIA(null);
                setModalIAAbierto(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-oro-500 hover:bg-oro-400 text-vin-950 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>⚖️</span>
              <span>Orientador IA</span>
            </button>

            <button
              onClick={() => setModalCrearAbierto(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-vin-900 hover:bg-vin-800 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>+</span>
              <span>Nuevo Expediente</span>
            </button>

            {modoModal && alCerrarModal && (
              <button
                onClick={alCerrarModal}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-lg leading-none transition-colors"
                title="Cerrar modal"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filtros de Búsqueda */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por número (ej: 001), motivo, club, árbitro o juez..."
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-oro-500"
            />
            <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Año:</span>
            {['todos', '2026', '2025', '2024', '2023', '2022'].map((a) => (
              <button
                key={a}
                onClick={() => setAnioFiltro(a)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  anioFiltro === a
                    ? 'bg-vin-900 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-oro-400'
                }`}
              >
                {a === 'todos' ? 'Todos' : a}
              </button>
            ))}
          </div>

          <button
            onClick={cargarDatos}
            disabled={cargando}
            className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 transition-colors ml-auto flex items-center gap-1 cursor-pointer"
            title="Refrescar datos"
          >
            <span>🔄</span>
            <span>{cargando ? 'Actualizando...' : 'Refrescar'}</span>
          </button>
        </div>
      </div>

      {/* Guía de Fases Procesales y Controles de Desplazamiento Horizontal */}
      <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Fases del Proceso:
          </span>
          {columnas.map((col, idx) => (
            <div key={col.estado} className="flex items-center gap-1 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${col.colorBadge}`}>
                <span>{col.icono}</span>
                <span>{idx + 1}. {col.titulo}</span>
                <span className="opacity-75">({col.expedientes.length})</span>
              </span>
              {idx < columnas.length - 1 && <span className="text-slate-400 text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Botones de Desplazamiento Horizontal */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            onClick={() => scrollHorizontal('izq')}
            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-xs shadow-xs cursor-pointer transition-colors"
            title="Desplazar a la izquierda"
          >
            ◀
          </button>
          <button
            onClick={() => scrollHorizontal('der')}
            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-xs shadow-xs cursor-pointer transition-colors"
            title="Desplazar a la derecha"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Tablero de Columnas (Trello-Style) con Desplazamiento Horizontal */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto p-4 sm:p-5 scroll-smooth"
      >
        <div className="flex gap-4 items-start min-w-max pb-4">
          {columnas.map((col) => {
            const esDestinoHover = columnaDestinoHover === col.estado;
            return (
              <div
                key={col.estado}
                onDragOver={(e) => handleDragOver(e, col.estado)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.estado)}
                className={`w-80 shrink-0 flex flex-col rounded-xl bg-slate-200/70 dark:bg-slate-900/80 border-t-4 ${col.colorBorde} border-x border-b border-slate-200 dark:border-slate-800 max-h-[75vh] transition-colors ${
                  esDestinoHover ? 'ring-2 ring-oro-500 bg-oro-50/20 dark:bg-oro-950/20' : ''
                }`}
              >
                {/* Cabecera de la Columna */}
                <div className="p-3 bg-white/70 dark:bg-slate-900/90 rounded-t-lg border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icono}</span>
                    <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      {col.titulo}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.colorBadge}`}>
                    {col.expedientes.length}
                  </span>
                </div>

                {/* Lista de Tarjetas de Expedientes */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {col.expedientes.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                      Sin expedientes en esta fase
                    </div>
                  ) : (
                    col.expedientes.map((exp) => (
                      <div
                        key={exp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, exp.id)}
                        onClick={() => setModalDetalleId(exp.id)}
                        className="group p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-oro-500 dark:hover:border-oro-400 transition-all cursor-pointer relative"
                      >
                        {/* Fila superior: Número / Año y badges */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-bold text-xs text-vin-900 dark:text-oro-400 font-mono bg-vin-50 dark:bg-vin-950/60 px-2 py-0.5 rounded border border-vin-200 dark:border-vin-800">
                            N° {exp.numero}/{exp.anio}
                          </span>
                          {exp.modalidad && (
                            <span className="text-[0.65rem] text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {exp.modalidad}
                            </span>
                          )}
                        </div>

                        {/* Motivo Principal */}
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                          {exp.motivo || 'Sin motivo registrado'}
                        </h4>

                        {/* Torneo / Partes */}
                        <p className="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {exp.ligaTorneo || 'Competición FVF'}
                        </p>
                        {exp.equipos && (
                          <p className="text-[0.7rem] font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                            {exp.equipos}
                          </p>
                        )}

                        {/* Alerta procesal */}
                        {exp.alerta && (
                          <div className="mt-2 p-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[0.68rem] text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1">
                            <span>⚠️</span>
                            <span className="truncate">{exp.alerta}</span>
                          </div>
                        )}

                        {/* Multa o Decisión si existe */}
                        {(exp.multaUc || exp.numeroDecision) && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[0.68rem]">
                            {exp.numeroDecision && (
                              <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[120px]">
                                {exp.numeroDecision}
                              </span>
                            )}
                            {exp.multaUc ? (
                              <span className="font-bold text-vin-900 dark:text-oro-400 ml-auto">
                                {exp.multaUc} UCFVF
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Fila de controles rápidos (Mover y botón IA) */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1 opacity-90 group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpedienteParaIA({
                                numero: exp.numero,
                                anio: exp.anio,
                                motivo: exp.motivo,
                                torneo: exp.ligaTorneo,
                                equipos: exp.equipos,
                                estado: exp.estado,
                                alerta: exp.alerta,
                              });
                              setModalIAAbierto(true);
                            }}
                            className="px-2 py-0.5 rounded text-[0.68rem] font-semibold bg-oro-100 hover:bg-oro-200 dark:bg-oro-950/60 dark:hover:bg-oro-900 text-vin-950 dark:text-oro-300 border border-oro-300 dark:border-oro-700 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Consultar caso con Agente IA"
                          >
                            <span>⚖️</span>
                            <span>IA</span>
                          </button>

                          {/* Menú rápido de mover de fase */}
                          <select
                            onClick={(e) => e.stopPropagation()}
                            value={exp.estado}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleMoverTarjeta(exp.id, e.target.value as EstadoExpediente);
                            }}
                            className="text-[0.65rem] h-6 px-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none"
                          >
                            {columnas.map((c) => (
                              <option key={c.estado} value={c.estado}>
                                {c.icono} {c.titulo.split('/')[0]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modales Vinculados */}
      <ModalCrearExpediente
        abierto={modalCrearAbierto}
        alCerrar={() => setModalCrearAbierto(false)}
        alCrearExitoso={() => {
          cargarDatos();
        }}
      />

      <ModalDetalleExpediente
        expedienteId={modalDetalleId}
        alCerrar={() => setModalDetalleId(null)}
        alActualizar={() => {
          cargarDatos();
        }}
      />

      <AsistenteDisciplinarioModal
        abierto={modalIAAbierto}
        alCerrar={() => setModalIAAbierto(false)}
        expedienteContexto={expedienteParaIA}
      />

      {/* Modal de Extracción IA de Documentos PDF */}
      <AnalizadorPdfModal
        abierto={modalPdfAbierto}
        alCerrar={() => setModalPdfAbierto(false)}
        alAplicarAExpediente={() => {
          cargarDatos();
        }}
      />
    </div>
  );
}
