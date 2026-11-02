'use client';

import React, { useState } from 'react';
import { AsistenteDisciplinarioModal } from './asistente-disciplinario-modal';

interface BotonAsistenteIAProps {
  expedienteContexto?: {
    numero?: string;
    anio?: number;
    motivo?: string;
    torneo?: string;
    equipos?: string;
    estado?: string;
    alerta?: string;
  };
  estilo?: 'flotante' | 'boton-accion' | 'header';
  etiqueta?: string;
}

export function BotonAsistenteIA({
  expedienteContexto,
  estilo = 'flotante',
  etiqueta = 'Asistente IA Jurídico',
}: BotonAsistenteIAProps) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      {estilo === 'flotante' && (
        <button
          onClick={() => setModalAbierto(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-vin-900 to-vin-950 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-oro-500/50 group cursor-pointer"
          title="Abrir Asistente Jurídico y Orientador Disciplinario FVF"
        >
          <div className="relative">
            <span className="text-xl">⚖️</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-vin-900 animate-pulse" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-white tracking-wide leading-tight">
              Agente Disciplinario IA
            </p>
            <p className="text-[0.65rem] text-oro-300 font-medium">
              Orientador procesal & Jurisprudencia
            </p>
          </div>
        </button>
      )}

      {estilo === 'boton-accion' && (
        <button
          onClick={() => setModalAbierto(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-vin-900 hover:bg-vin-800 text-white border border-oro-500/40 shadow-xs transition-colors cursor-pointer"
        >
          <span>⚖️</span>
          <span>{etiqueta}</span>
        </button>
      )}

      {estilo === 'header' && (
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white/90 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors cursor-pointer"
        >
          <span>⚖️</span>
          <span className="hidden md:inline">Agente IA FVF</span>
        </button>
      )}

      <AsistenteDisciplinarioModal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        expedienteContexto={expedienteContexto}
      />
    </>
  );
}
