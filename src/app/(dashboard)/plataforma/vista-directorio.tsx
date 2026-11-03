'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GrupoNavegacion, ItemNavegacion } from '@/lib/nav';

interface Props {
  navegacion: GrupoNavegacion[];
  metricas: {
    totalExpedientes: number;
    totalSanciones: number;
    totalDocumentos: number;
    totalPrecedentes: number;
  };
}

export function VistaDirectorioFunciones({ navegacion, metricas }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('todos');
  const [modoVisualizacion, setModoVisualizacion] = useState<'grid' | 'lista'>('grid');

  // Filtrado de navegación
  const gruposFiltrados = navegacion
    .filter((g) => grupoSeleccionado === 'todos' || g.grupo === grupoSeleccionado)
    .map((grupo) => {
      if (!busqueda.trim()) return grupo;
      const q = busqueda.toLowerCase();
      const items = grupo.items.filter((item) => {
        const enTitulo = item.etiqueta.toLowerCase().includes(q);
        const enDesc = item.descripcion?.toLowerCase().includes(q);
        const enSub = item.submenus?.some(
          (s) => s.etiqueta.toLowerCase().includes(q) || s.descripcion?.toLowerCase().includes(q)
        );
        return enTitulo || enDesc || enSub;
      });
      return { ...grupo, items };
    })
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Banner Principal de la Suite */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-oro-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-oro-500/20 text-oro-400 border border-oro-500/30">
                Directorio Integral de Funciones
              </span>
              <span className="text-xs text-slate-400">Consejo de Honor FVF</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Suite Tecnológica y Disciplinaria
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mapa general interactivo con acceso a todos los módulos, submenús y herramientas de gestión
              procesal, analítica forense, baremos punitivos y control financiero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/expedientes"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-oro-500 text-slate-950 hover:bg-oro-400 transition shadow-lg flex items-center gap-2"
            >
              <span>📋</span> Tablero Kanban
            </Link>
            <Link
              href="/ingesta"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2"
            >
              <span>🔬</span> Data Analyst Pipeline
            </Link>
          </div>
        </div>

        {/* Tickers de Métricas Generales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Expedientes Totales
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {metricas.totalExpedientes.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Sanciones Registradas
            </span>
            <span className="text-2xl font-black text-oro-400 mt-0.5 block">
              {metricas.totalSanciones.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Documentos & Actas
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
              {metricas.totalDocumentos.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Precedentes & TAS
            </span>
            <span className="text-2xl font-black text-cyan-400 mt-0.5 block">
              {metricas.totalPrecedentes.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Buscador y Conmutador de Vista */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Buscador Interactivo */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por módulo, submenú o función..."
            className="w-full h-10 pl-9 pr-8 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-oro-500"
          />
          <span className="absolute left-3 top-3 text-xs text-slate-500">🔍</span>
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Chips de Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setGrupoSeleccionado('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              grupoSeleccionado === 'todos'
                ? 'bg-oro-500 text-slate-950 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          {navegacion.map((g) => (
            <button
              key={g.grupo}
              onClick={() => setGrupoSeleccionado(g.grupo)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                grupoSeleccionado === g.grupo
                  ? 'bg-oro-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span>{g.icono}</span>
              <span>{g.grupo}</span>
            </button>
          ))}
        </div>

        {/* Switcher de Vista */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-end md:self-auto shrink-0">
          <button
            onClick={() => setModoVisualizacion('grid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              modoVisualizacion === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
            title="Vista Cuadrícula"
          >
            ▦ Grid
          </button>
          <button
            onClick={() => setModoVisualizacion('lista')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              modoVisualizacion === 'lista' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
            title="Vista Lista"
          >
            ☰ Lista
          </button>
        </div>
      </div>

      {/* Contenedor de Módulos y Submenús */}
      <div className="space-y-10">
        {gruposFiltrados.map((grupo) => (
          <div key={grupo.grupo} className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-xl">{grupo.icono}</span>
              <h2 className="text-lg font-bold text-white tracking-tight">{grupo.grupo}</h2>
              <span className="text-xs text-slate-500 font-mono ml-auto">
                {grupo.items.length} {grupo.items.length === 1 ? 'módulo' : 'módulos'}
              </span>
            </div>

            {/* Malla de Módulos (Grid Mode) */}
            {modoVisualizacion === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {grupo.items.map((item) => (
                  <div
                    key={item.href}
                    className="bg-slate-900 border border-slate-800 hover:border-oro-500/50 rounded-2xl p-5 shadow-lg transition-all hover:shadow-xl flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cabecera de la Tarjeta */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-inner">
                          {item.icono}
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-oro-500/20 text-oro-300 border border-oro-500/30">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-oro-300 transition-colors">
                        {item.etiqueta}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.descripcion}
                      </p>

                      {/* Lista de Submenús Desplegados */}
                      {item.submenus && item.submenus.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                            Submenús & Funciones:
                          </span>
                          <div className="space-y-1">
                            {item.submenus.map((sub) => (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/60 hover:border-oro-500/40 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group/sub"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-xs">{sub.icono}</span>
                                  <span className="truncate font-medium">{sub.etiqueta}</span>
                                </div>
                                <span className="text-slate-500 group-hover/sub:text-oro-400 text-xs">
                                  →
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono truncate max-w-[150px]">
                        {item.href}
                      </span>
                      <Link
                        href={item.href}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-oro-500 hover:text-slate-950 text-slate-200 transition-all flex items-center gap-1.5"
                      >
                        <span>Abrir</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Vista Lista */
              <div className="space-y-3">
                {grupo.items.map((item) => (
                  <div
                    key={item.href}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-oro-500/40 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shrink-0">
                        {item.icono}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{item.etiqueta}</h3>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-oro-500/20 text-oro-300">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.descripcion}</p>

                        {/* Badges de Submenús */}
                        {item.submenus && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.submenus.map((s) => (
                              <Link
                                key={s.href}
                                href={s.href}
                                className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 hover:text-oro-300 hover:border-oro-500/40 transition flex items-center gap-1"
                              >
                                <span>{s.icono}</span>
                                <span>{s.etiqueta}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Link
                      href={item.href}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-oro-500 text-slate-950 hover:bg-oro-400 transition self-start md:self-auto shrink-0 shadow"
                    >
                      Abrir Módulo →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
