'use client';

import React, { useState } from 'react';
import { KanbanTablero } from './kanban-tablero';
import { ModalKanban } from './modal-kanban';
import { BotonAsistenteIA } from '@/components/ia/boton-asistente-ia';

interface VistaExpedientesContenedorProps {
  childrenPivot: React.ReactNode;
}

export function VistaExpedientesContenedor({
  childrenPivot,
}: VistaExpedientesContenedorProps) {
  const [vistaActiva, setVistaActiva] = useState<'kanban' | 'pivot'>('kanban');

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Conmutador de Vistas */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setVistaActiva('kanban')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              vistaActiva === 'kanban'
                ? 'bg-vin-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📋</span>
            <span>Tablero Kanban (Trello)</span>
          </button>
          <button
            onClick={() => setVistaActiva('pivot')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              vistaActiva === 'pivot'
                ? 'bg-vin-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📊</span>
            <span>Tabla Pivot & Métricas</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ModalKanban botonTexto="Abrir Modal Kanban" />
          <BotonAsistenteIA
            estilo="boton-accion"
            etiqueta="Orientador Procesal IA"
          />
        </div>
      </div>

      {/* Renderizado de la vista elegida */}
      {vistaActiva === 'kanban' ? (
        <KanbanTablero />
      ) : (
        <div className="space-y-6">{childrenPivot}</div>
      )}
    </div>
  );
}
