'use client';

import React, { useState } from 'react';
import { CentroDataAnalystPipeline } from '@/components/analista/centro-data-analyst-pipeline';
import { PanelIngestaHistorica } from './panel';

interface Props {
  resumenPipeline: {
    totalExpedientes: number;
    totalDocumentos: number;
    ultimosCasos: any[];
  };
  propsHistoricos: {
    expedientes: any[];
    documentos: any[];
    lotes: any[];
    documentosTotales: number;
    precedentesAprobados: number;
    carpetaDriveConfigurada: boolean;
  };
}

export function VistaIngestaCompleta({ resumenPipeline, propsHistoricos }: Props) {
  const [modo, setModo] = useState<'ANALISTA_IA' | 'LOTES_EXCEL'>('ANALISTA_IA');

  return (
    <div className="space-y-6">
      {/* Switcher Superior */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModo('ANALISTA_IA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              modo === 'ANALISTA_IA'
                ? 'bg-oro-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🔬</span> Data Analyst & Ingesta IA de Casos
          </button>
          <button
            onClick={() => setModo('LOTES_EXCEL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              modo === 'LOTES_EXCEL'
                ? 'bg-oro-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📊</span> Carga Masiva por Lotes (Excel / CSV)
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono hidden md:inline pr-2">
          Base de Datos Conectada: PostgreSQL 17
        </span>
      </div>

      {modo === 'ANALISTA_IA' ? (
        <CentroDataAnalystPipeline resumenInicial={resumenPipeline} />
      ) : (
        <PanelIngestaHistorica
          expedientes={propsHistoricos.expedientes}
          documentos={propsHistoricos.documentos}
          lotes={propsHistoricos.lotes}
          documentosTotales={propsHistoricos.documentosTotales}
          precedentesAprobados={propsHistoricos.precedentesAprobados}
          carpetaDriveConfigurada={propsHistoricos.carpetaDriveConfigurada}
        />
      )}
    </div>
  );
}
