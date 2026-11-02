'use client';

import React, { useState } from 'react';
import { EstadoExpediente, TipoParte } from '@prisma/client';
import { crearExpedienteEnSupabase, type CrearExpedienteInput } from '@/server/expedientes/acciones';

interface ModalCrearExpedienteProps {
  abierto: boolean;
  alCerrar: () => void;
  alCrearExitoso?: (expedienteId: number) => void;
  estadoInicialSugerido?: EstadoExpediente;
}

const TORNEOS_COMUNES = [
  'Liga FUTVE (Primera División)',
  'Liga FUTVE 2 (Segunda División)',
  'Liga FUTVE Junior Sub-20',
  'Liga FUTVE Junior Sub-17',
  'Liga FUTVE Junior Sub-15',
  'Liga FUTVE Femenina',
  'Copa Venezuela',
  'Fútbol Sala - Liga FUTVE Futsal 1',
  'Torneo Nacional de Asociaciones',
];

const MOTIVOS_COMUNES = [
  'Protesta Partido. Alineación indebida (Art. 77.2 RDFVF)',
  'Falta de pago de honorarios a Árbitros (CNA)',
  'Honorarios Delegados Federativos',
  'Hechos Informados por el Árbitro (Conducta Violenta / Agresión)',
  'Incumplimiento de requisitos de Seguridad e Invasión de Público',
  'Falta de Director Técnico en el banquillo',
  'Falta de Visa de Transeúnte Laboral Vigente (Art. 39)',
  'Infracción de Licencia de Clubes',
  'Declaraciones difamatorias u ofensivas contra oficiales FVF',
];

export function ModalCrearExpediente({
  abierto,
  alCerrar,
  alCrearExitoso,
  estadoInicialSugerido = EstadoExpediente.RECIBIDO,
}: ModalCrearExpedienteProps) {
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [numero, setNumero] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [subMotivo, setSubMotivo] = useState<string>('');
  const [ligaTorneo, setLigaTorneo] = useState<string>(TORNEOS_COMUNES[0] ?? '');
  const [equipos, setEquipos] = useState<string>('');
  const [asignado, setAsignado] = useState<string>('');
  const [modalidad, setModalidad] = useState<string>('Digital');
  const [estado, setEstado] = useState<EstadoExpediente>(estadoInicialSugerido);
  const [alerta, setAlerta] = useState<string>('');
  const [notas, setNotas] = useState<string>('');

  // Partes
  const [parte1Nombre, setParte1Nombre] = useState<string>('');
  const [parte1Tipo, setParte1Tipo] = useState<TipoParte>(TipoParte.CLUB);
  const [parte2Nombre, setParte2Nombre] = useState<string>('');
  const [parte2Tipo, setParte2Tipo] = useState<TipoParte>(TipoParte.CLUB);

  const [guardando, setGuardando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  if (!abierto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim() || !ligaTorneo.trim()) {
      setErrorMensaje('El motivo y el torneo son obligatorios.');
      return;
    }

    setGuardando(true);
    setErrorMensaje(null);

    const partesInput = [];
    if (parte1Nombre.trim()) {
      partesInput.push({ nombre: parte1Nombre.trim(), tipo: parte1Tipo });
    }
    if (parte2Nombre.trim()) {
      partesInput.push({ nombre: parte2Nombre.trim(), tipo: parte2Tipo });
    }

    const payload: CrearExpedienteInput = {
      numero: numero.trim() || undefined,
      anio,
      motivo: motivo.trim(),
      subMotivo: subMotivo.trim() || undefined,
      ligaTorneo: ligaTorneo.trim(),
      equipos: equipos.trim() || undefined,
      asignado: asignado.trim() || undefined,
      modalidad,
      estado,
      alerta: alerta.trim() || undefined,
      notas: notas.trim() || undefined,
      partes: partesInput.length > 0 ? partesInput : undefined,
    };

    const res = await crearExpedienteEnSupabase(payload);
    setGuardando(false);

    if (res.ok && res.expedienteId) {
      if (alCrearExitoso) alCrearExitoso(res.expedienteId);
      alCerrar();
    } else {
      setErrorMensaje(res.mensaje || 'Error al persistir el expediente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 bg-vin-900 text-white border-b border-vin-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📁</span>
            <div>
              <h3 className="font-display font-semibold text-lg text-white leading-tight">
                Nuevo Expediente Disciplinario
              </h3>
              <p className="text-xs text-white/70">
                Radicación y registro en base de datos Supabase / PostgreSQL
              </p>
            </div>
          </div>
          <button
            onClick={alCerrar}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMensaje && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-medium">
              {errorMensaje}
            </div>
          )}

          {/* Fila 1: Año y Número correlativo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Año del Expediente *
              </label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número (ej. 018)
              </label>
              <input
                type="text"
                placeholder="Automático si vacío"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Columna Kanban Inicial
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoExpediente)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500 font-medium"
              >
                <option value={EstadoExpediente.RECIBIDO}>📥 RECIBIDO (Por Iniciar)</option>
                <option value={EstadoExpediente.EN_ESTUDIO}>🔍 EN ESTUDIO (Instrucción)</option>
                <option value={EstadoExpediente.EN_RECURSO}>⚖️ EN RECURSO (Reconsideración)</option>
                <option value={EstadoExpediente.RESUELTO}>📜 RESUELTO (Con Decisión)</option>
                <option value={EstadoExpediente.DESESTIMADO}>❌ DESESTIMADO (Inadmisible)</option>
              </select>
            </div>
          </div>

          {/* Fila 2: Torneo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Torneo / Competición FVF *
            </label>
            <input
              type="text"
              list="lista-torneos"
              value={ligaTorneo}
              onChange={(e) => setLigaTorneo(e.target.value)}
              placeholder="Seleccione o escriba el torneo..."
              className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              required
            />
            <datalist id="lista-torneos">
              {TORNEOS_COMUNES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Fila 3: Motivo e Incidencia */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Motivo Principal / Incidencia Disciplinaria *
            </label>
            <input
              type="text"
              list="lista-motivos"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Protesta Partido. Alineación indebida (Art. 77.2 RDFVF)..."
              className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              required
            />
            <datalist id="lista-motivos">
              {MOTIVOS_COMUNES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* Fila 4: Equipos / Encuentro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Equipos / Partido
              </label>
              <input
                type="text"
                placeholder="Ej: Caracas F.C. Vs. Deportivo Táchira"
                value={equipos}
                onChange={(e) => setEquipos(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Juez Instructor Asignado
              </label>
              <input
                type="text"
                placeholder="Ej: Dr. Julio Osorio / Sala 1"
                value={asignado}
                onChange={(e) => setAsignado(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              />
            </div>
          </div>

          {/* Fila 5: Partes Involucradas */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <p className="text-xs font-semibold text-vin-900 dark:text-oro-400">
              Partes Intervinientes (Demandante / Sancionado / Denunciado)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.7rem] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Parte 1 (Club o Persona)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nombre club o persona"
                    value={parte1Nombre}
                    onChange={(e) => setParte1Nombre(e.target.value)}
                    className="flex-1 h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <select
                    value={parte1Tipo}
                    onChange={(e) => setParte1Tipo(e.target.value as TipoParte)}
                    className="h-9 px-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value={TipoParte.CLUB}>Club</option>
                    <option value={TipoParte.JUGADOR}>Jugador</option>
                    <option value={TipoParte.CUERPO_TECNICO}>C. Técnico</option>
                    <option value={TipoParte.COMISION}>Comisión</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[0.7rem] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Parte 2 (Contraparte o Imputado)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nombre club o persona"
                    value={parte2Nombre}
                    onChange={(e) => setParte2Nombre(e.target.value)}
                    className="flex-1 h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <select
                    value={parte2Tipo}
                    onChange={(e) => setParte2Tipo(e.target.value as TipoParte)}
                    className="h-9 px-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value={TipoParte.CLUB}>Club</option>
                    <option value={TipoParte.JUGADOR}>Jugador</option>
                    <option value={TipoParte.CUERPO_TECNICO}>C. Técnico</option>
                    <option value={TipoParte.COMISION}>Comisión</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Fila 6: Alerta procesal y modalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Alerta Procesal (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Verificar comprobante caución Art. 170"
                value={alerta}
                onChange={(e) => setAlerta(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Modalidad del Expediente
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
              >
                <option value="Digital">Digital (COMET)</option>
                <option value="Físico">Físico (Papel / Despacho)</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>
          </div>

          {/* Fila 7: Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas Preliminares del Caso
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalles sobre hechos informados, anexos consignados o estado del informe..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-oro-500"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 text-sm font-semibold bg-vin-900 hover:bg-vin-800 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {guardando ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Guardando en Supabase...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Radicar y Guardar Expediente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
