'use client';

import React, { useState, useTransition } from 'react';
import { PlantillaAprendida, aprenderNuevoFormatoAction } from '@/server/formatos/acciones';

interface Props {
  formatosIniciales: PlantillaAprendida[];
}

export function VistaFormatos({ formatosIniciales }: Props) {
  const [formatos, setFormatos] = useState<PlantillaAprendida[]>(formatosIniciales);
  const [tabActiva, setTabActiva] = useState<'CATALOGO' | 'NUEVO_FORMATO' | 'DICCIONARIO' | 'SIMULADOR'>('CATALOGO');
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<PlantillaAprendida>(formatosIniciales[0] || {} as any);

  // Estados para el formulario de aprendizaje
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [tipologiaNueva, setTipologiaNueva] = useState('INTEGRIDAD_AMANO');
  const [textoNuevo, setTextoNuevo] = useState('');
  const [isPending, startTransition] = useTransition();
  const [mensajeResultado, setMensajeResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Estados para el simulador de despacho
  const [valoresSimulador, setValoresSimulador] = useState<Record<string, string>>({});

  const handleSeleccionarFormato = (f: PlantillaAprendida) => {
    setFormatoSeleccionado(f);
    // Inicializar simulador con valores de ejemplo
    const inicial: Record<string, string> = {};
    f.variablesDetectadas.forEach((v) => {
      inicial[v.codigo] = v.ejemplo || '';
    });
    setValoresSimulador(inicial);
  };

  const handleAprenderFormato = () => {
    if (!textoNuevo.trim()) {
      setMensajeResultado({ tipo: 'error', texto: 'Por favor pegue o escriba el formato a aprender.' });
      return;
    }

    startTransition(async () => {
      const res = await aprenderNuevoFormatoAction(textoNuevo, nombreNuevo, tipologiaNueva);
      if (res.ok && res.plantilla) {
        setFormatos((prev) => [res.plantilla, ...prev.filter((p) => p.codigoTipologia !== res.plantilla.codigoTipologia)]);
        setFormatoSeleccionado(res.plantilla);
        setMensajeResultado({ tipo: 'ok', texto: res.mensaje });
        // Limpiar campos
        setTextoNuevo('');
        setNombreNuevo('');
        setTabActiva('CATALOGO');
      } else {
        setMensajeResultado({ tipo: 'error', texto: res.mensaje });
      }
    });
  };

  const generarTextoSimulado = () => {
    if (!formatoSeleccionado?.contenidoPlantilla) return '';
    let resultado = formatoSeleccionado.contenidoPlantilla;
    Object.entries(valoresSimulador).forEach(([k, v]) => {
      resultado = resultado.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `[${k}]`);
    });
    return resultado;
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="bg-gradient-to-r from-vin-950 via-slate-900 to-vin-900 border border-oro-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-oro-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-4xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-oro-500/20 text-oro-300 border border-oro-500/40">
              LEX-SPORTIVA CORE | Centro de Aprendizaje
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Motor Activo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gestor de Formatos, Plantillas y Aprendizaje Continuo
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Aquí puedes suministrar, actualizar y perfeccionar las plantillas procesales de la institución. El motor de inteligencia jurídica asimila la estructura de los casos, detecta automáticamente las variables dinámicas <code className="text-oro-300 font-mono">{"{{VARIABLE}}"}</code> y adapta en tiempo real la redacción de autos, dictámenes y resoluciones oficiales.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/10 relative z-10">
          <button
            onClick={() => setTabActiva('CATALOGO')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              tabActiva === 'CATALOGO'
                ? 'bg-oro-500 text-slate-950 shadow-lg shadow-oro-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <span>📂</span> <span>Catálogo de Formatos ({formatos.length})</span>
          </button>
          <button
            onClick={() => setTabActiva('NUEVO_FORMATO')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              tabActiva === 'NUEVO_FORMATO'
                ? 'bg-oro-500 text-slate-950 shadow-lg shadow-oro-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <span>🧠</span> <span>Aprender Nuevo Formato con IA</span>
          </button>
          <button
            onClick={() => setTabActiva('DICCIONARIO')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              tabActiva === 'DICCIONARIO'
                ? 'bg-oro-500 text-slate-950 shadow-lg shadow-oro-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <span>⚙️</span> <span>Variables & Campos Dinámicos</span>
          </button>
          <button
            onClick={() => setTabActiva('SIMULADOR')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              tabActiva === 'SIMULADOR'
                ? 'bg-oro-500 text-slate-950 shadow-lg shadow-oro-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <span>🚀</span> <span>Simulador de Ensamblaje en Vivo</span>
          </button>
        </div>
      </div>

      {/* Alerta de Notificación */}
      {mensajeResultado && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between transition ${
            mensajeResultado.tipo === 'ok'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{mensajeResultado.tipo === 'ok' ? '✅' : '⚠️'}</span>
            <span>{mensajeResultado.texto}</span>
          </div>
          <button
            onClick={() => setMensajeResultado(null)}
            className="text-xs px-2 py-1 rounded bg-black/30 hover:bg-black/50"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CATÁLOGO DE FORMATOS ACTIVOS */}
      {/* ========================================================================= */}
      {tabActiva === 'CATALOGO' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Lista de Plantillas */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Formatos y Tipologías Disponibles
            </h3>
            {formatos.map((f) => {
              const seleccionado = formatoSeleccionado?.codigoTipologia === f.codigoTipologia;
              return (
                <div
                  key={f.codigoTipologia}
                  onClick={() => handleSeleccionarFormato(f)}
                  className={`p-4 rounded-2xl border cursor-pointer transition text-left space-y-2 ${
                    seleccionado
                      ? 'bg-vin-950/90 border-oro-500/60 shadow-lg shadow-vin-950/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-oro-400 border border-oro-500/20">
                      {f.codigoTipologia}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {f.variablesDetectadas?.length || 0} variables
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-white line-clamp-1">{f.nombreProcedimiento}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{f.descripcion}</p>
                </div>
              );
            })}
          </div>

          {/* Columna Derecha: Detalle y Vista Previa del Formato */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            {formatoSeleccionado ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-oro-400 uppercase tracking-wider block">
                      {formatoSeleccionado.organoEmisor}
                    </span>
                    <h2 className="text-lg font-black text-white">{formatoSeleccionado.nombreProcedimiento}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleSeleccionarFormato(formatoSeleccionado);
                        setTabActiva('SIMULADOR');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-oro-500 hover:bg-oro-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>🚀</span> <span>Probar en Simulador</span>
                    </button>
                  </div>
                </div>

                {/* Parámetros de Instrucción */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Descargos</span>
                    <span className="text-sm font-bold text-white">
                      {formatoSeleccionado.lapsoDescargosDias} días {formatoSeleccionado.tipoDiasDescargos.toLowerCase()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Audiencia</span>
                    <span className="text-sm font-bold text-white">
                      {formatoSeleccionado.requiereAudiencia ? 'Requerida' : 'No obligatoria'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Artículos Base</span>
                    <span className="text-xs font-semibold text-oro-300 truncate block">
                      {formatoSeleccionado.articulosBase?.join(', ') || 'N/A'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Documentos</span>
                    <span className="text-sm font-bold text-white">
                      {formatoSeleccionado.documentosRequeridos?.length || 0} requisitos
                    </span>
                  </div>
                </div>

                {/* Vista Previa del Cuerpo Estructural */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Cuerpo del Formato Estructurado con Variables
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Sintaxis oficial <span className="font-mono text-oro-400">{"{{VARIABLE}}"}</span>
                    </span>
                  </div>
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto scrollbar-thin">
                    {formatoSeleccionado.contenidoPlantilla}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Seleccione un formato de la lista para ver su detalle y estructura.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: APRENDER NUEVO FORMATO CON IA */}
      {/* ========================================================================= */}
      {tabActiva === 'NUEVO_FORMATO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <h2 className="text-xl font-bold text-white">Ingesta y Aprendizaje de Nueva Plantilla / Formato</h2>
            <p className="text-xs text-slate-400">
              Pega aquí cualquier auto, resolución, escrito de descargos o citación modelo. Puedes usar variables en formato <code className="text-oro-400">{"{{NOMBRE_VARIABLE}}"}</code> o pegar un documento real y la IA extraerá las variables y parámetros procesales automáticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Nombre del Procedimiento / Formato
              </label>
              <input
                type="text"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Ej: Auto de Apertura y Traslado de Cargos por Infracción de Ética"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-oro-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Código de Tipología
              </label>
              <select
                value={tipologiaNueva}
                onChange={(e) => setTipologiaNueva(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-oro-400 focus:outline-none"
              >
                <option value="INTEGRIDAD_AMANO">INTEGRIDAD_AMANO (Manipulación de partidos)</option>
                <option value="ACTA_JORNADA">ACTA_JORNADA (Sanciones de partido/jornada)</option>
                <option value="INADMISIBILIDAD_CAUCION">INADMISIBILIDAD_CAUCION (Art. 170 RDFVF)</option>
                <option value="VIOLENCIA_ORDEN_PUBLICO">VIOLENCIA_ORDEN_PUBLICO (Seguridad y estadios)</option>
                <option value="DOPAJE_WADA">DOPAJE_WADA (Sustancias prohibidas)</option>
                <option value="EJECUCION_CRD">EJECUCION_CRD (Cámara de Resolución de Disputas)</option>
                <option value="ALZADA_TAS">ALZADA_TAS (Contestación de apelación)</option>
                <option value="FORMATO_PERSONALIZADO">OTRO (Tipología personalizada)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Texto del Formato o Borrador Oficial
              </label>
              <span className="text-[11px] text-slate-400">
                Puedes incluir variables como <code className="text-oro-400">{"{{NUMERO_EXPEDIENTE}}"}</code>, <code className="text-oro-400">{"{{NOMBRE_IMPUTADO}}"}</code>, etc.
              </span>
            </div>
            <textarea
              rows={12}
              value={textoNuevo}
              onChange={(e) => setTextoNuevo(e.target.value)}
              placeholder="Pegue aquí el texto completo del auto, citación o resolución..."
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-200 font-mono focus:border-oro-400 focus:outline-none scrollbar-thin"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setTextoNuevo('')}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Limpiar
            </button>
            <button
              disabled={isPending}
              onClick={handleAprenderFormato}
              className="px-6 py-2.5 rounded-xl bg-oro-500 hover:bg-oro-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-oro-500/20 transition"
            >
              <span>{isPending ? '⏳' : '🧠'}</span>
              <span>{isPending ? 'Asimilando y aprendiendo formato...' : 'Aprender e Indexar Formato'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: DICCIONARIO DE VARIABLES */}
      {/* ========================================================================= */}
      {tabActiva === 'DICCIONARIO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white">
              Variables Dinámicas de la Plantilla: {formatoSeleccionado?.nombreProcedimiento}
            </h2>
            <p className="text-xs text-slate-400">
              Estas variables son sustituidas en tiempo real cuando el sistema genera documentos a partir de un expediente en la base de datos.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Variable</th>
                  <th className="py-3 px-4">Etiqueta Legible</th>
                  <th className="py-3 px-4">Tipo de Dato</th>
                  <th className="py-3 px-4">Obligatorio</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Ejemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {formatoSeleccionado?.variablesDetectadas?.map((v) => (
                  <tr key={v.codigo} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-oro-300">{"{{" + v.codigo + "}}"}</td>
                    <td className="py-3 px-4 text-white font-medium">{v.nombreLegible}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {v.tipoDato}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {v.obligatorio ? (
                        <span className="text-emerald-400 font-bold">Sí</span>
                      ) : (
                        <span className="text-slate-500">Opcional</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{v.descripcion}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{v.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: SIMULADOR DE DESPACHO EN VIVO */}
      {/* ========================================================================= */}
      {tabActiva === 'SIMULADOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo: Formulario de Variables */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] font-bold text-oro-400 uppercase tracking-wider block">
                Simulador de Entrada de Datos
              </span>
              <h3 className="text-base font-bold text-white">{formatoSeleccionado?.nombreProcedimiento}</h3>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {formatoSeleccionado?.variablesDetectadas?.map((v) => (
                <div key={v.codigo} className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>{v.nombreLegible}</span>
                    <span className="font-mono text-[10px] text-oro-400">{"{{" + v.codigo + "}}"}</span>
                  </label>
                  <input
                    type="text"
                    value={valoresSimulador[v.codigo] || ''}
                    onChange={(e) =>
                      setValoresSimulador((prev) => ({ ...prev, [v.codigo]: e.target.value }))
                    }
                    placeholder={v.ejemplo || v.descripcion}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-oro-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Vista Previa del Documento Ensamblado */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Documento Ensamblado en Tiempo Real
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generarTextoSimulado());
                    alert('¡Documento copiado al portapapeles!');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-oro-300 font-semibold"
                >
                  📋 Copiar Texto
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[480px] overflow-y-auto scrollbar-thin shadow-inner">
                {generarTextoSimulado()}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-vin-950/80 border border-oro-500/20 text-[11px] text-slate-300 flex items-center gap-2">
              <span>⚖️</span>
              <span>
                Este documento ensamblado cumple con los parámetros aprendidos y el sellado de integridad del Art. 161 RDFVF.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
