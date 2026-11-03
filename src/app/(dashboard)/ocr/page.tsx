'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function OcrActasPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const handleSimularOcr = () => {
    if (!archivo) return;
    setProcesando(true);
    setTimeout(() => {
      setResultado({
        partido: 'Caracas F.C. vs Deportivo Táchira',
        arbitro: 'Jesús Valenzuela (Principal)',
        fecha: new Date().toLocaleDateString('es-VE'),
        tarjetasAmarillas: [
          { minuto: '24', jugador: 'Rubert Quijada', club: 'Caracas F.C.', motivo: 'Juego brusco grave' },
          { minuto: '58', jugador: 'Maurice Cova', club: 'Deportivo Táchira', motivo: 'Desaprobar con palabras' },
        ],
        tarjetasRojas: [
          { minuto: '82', jugador: 'Edson Castillo', club: 'Caracas F.C.', motivo: 'Conducta violenta' },
        ],
        incidenciasPublico: 'Lanzamiento de objetos a la cancha al minuto 90+2.',
        cruceCometOk: true,
      });
      setProcesando(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-oro-500/20 text-oro-400 border border-oro-500/30">
                Digitalización & Visión Artificial
              </span>
              <span className="text-slate-500 text-xs">Reglas de Juego IFAB / COMET</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Actas Arbitrales & OCR Inteligente
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Digitalización óptica de planillas de partido, extracción automática de tarjetas amarillas, expulsiones e
              incidencias disciplinarias con validación cruzada en sistema COMET.
            </p>
          </div>

          <Link
            href="/expedientes"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-oro-500 text-slate-950 hover:bg-oro-400 transition shadow flex items-center gap-1.5 self-start md:self-auto"
          >
            <span>📋</span> Ver en Expedientes
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropzone de Planilla */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              📷 Subir Acta o Planilla de Juego
            </h2>

            <label className="border-2 border-dashed border-slate-700 hover:border-oro-500/80 bg-slate-950/60 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[180px] block">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setArchivo(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <span className="text-3xl mb-2 block">📄</span>
              <p className="text-xs font-semibold text-white">
                {archivo ? archivo.name : 'Selecciona foto o escaneo de la planilla arbitral'}
              </p>
              <span className="text-[10px] text-slate-500 block mt-1">Formatos: PDF, JPG, PNG (hasta 20 MB)</span>
            </label>

            <button
              onClick={handleSimularOcr}
              disabled={!archivo || procesando}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-oro-500 hover:bg-oro-400 text-slate-950 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              {procesando ? (
                <>
                  <span className="animate-spin">🔄</span>
                  <span>Extrayendo con OCR...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Ejecutar Reconocimiento Óptico</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Vista Previa de Datos Extraídos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🔍</span> Datos Extraídos del Acta Arbitral
              </h3>
              {resultado && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  COMET Validado
                </span>
              )}
            </div>

            {!resultado ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <span className="text-3xl block">📋</span>
                <p className="text-xs">Sube un acta arbitral para extraer automáticamente tarjetas e incidencias.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Partido:</span>
                    <span className="font-bold text-white text-sm">{resultado.partido}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">Árbitro:</span>
                    <span className="font-bold text-oro-300">{resultado.arbitro}</span>
                  </div>
                </div>

                {/* Tarjetas Amarillas */}
                <div className="space-y-1.5">
                  <span className="font-bold text-amber-400 text-[11px] uppercase block">
                    🟨 Tarjetas Amarillas (Amonestaciones):
                  </span>
                  {resultado.tarjetasAmarillas.map((ta: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-200">{ta.jugador}</span>
                        <span className="text-[11px] text-slate-500 block">{ta.club} • Minuto {ta.minuto}'</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{ta.motivo}</span>
                    </div>
                  ))}
                </div>

                {/* Tarjetas Rojas */}
                <div className="space-y-1.5">
                  <span className="font-bold text-rose-400 text-[11px] uppercase block">
                    🟥 Tarjetas Rojas (Expulsiones):
                  </span>
                  {resultado.tarjetasRojas.map((tr: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-rose-300">{tr.jugador}</span>
                        <span className="text-[11px] text-slate-500 block">{tr.club} • Minuto {tr.minuto}'</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{tr.motivo}</span>
                    </div>
                  ))}
                </div>

                {/* Botón para enviar a expediente */}
                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Link
                    href="/expedientes"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 text-slate-950 hover:bg-oro-400 transition shadow"
                  >
                    Crear Expediente con estos Datos →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
