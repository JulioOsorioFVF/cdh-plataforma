'use client';

import React, { useState } from 'react';
import { KanbanTablero } from './kanban-tablero';

interface ModalKanbanProps {
  botonTexto?: string;
  botonEstilo?: string;
}

export function ModalKanban({
  botonTexto = 'Tablero Kanban (Trello)',
  botonEstilo,
}: ModalKanbanProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={
          botonEstilo ||
          'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-vin-900 hover:bg-vin-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer border border-oro-500/40'
        }
      >
        <span>📋</span>
        <span>{botonTexto}</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="relative w-full max-w-[96vw] h-[92vh] max-h-[920px]">
            <KanbanTablero modoModal={true} alCerrarModal={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
