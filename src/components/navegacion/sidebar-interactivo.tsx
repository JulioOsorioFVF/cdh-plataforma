'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVEGACION, ItemNavegacion, SubmenuItem } from '@/lib/nav';
import { BotonSalir } from '@/app/(dashboard)/salir';

interface SidebarInteractivoProps {
  usuario: {
    nombre: string;
    email: string;
    roles: string[];
    esAdmin: boolean;
  };
}

export function SidebarInteractivo({ usuario }: SidebarInteractivoProps) {
  const pathname = usePathname();

  // Estados interactivos
  const [colapsado, setColapsado] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [submenusAbiertos, setSubmenusAbiertos] = useState<Record<string, boolean>>({});
  const [busqueda, setBusqueda] = useState('');
  const [menuFlotanteActivo, setMenuFlotanteActivo] = useState<string | null>(null);

  // Cargar estado de colapsado desde localStorage
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('sidebar_colapsado');
      if (guardado !== null) {
        setColapsado(guardado === 'true');
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, []);

  // Abrir automáticamente el submenú si la ruta actual coincide
  useEffect(() => {
    const nuevosAbiertos: Record<string, boolean> = { ...submenusAbiertos };
    NAVEGACION.forEach((grupo) => {
      grupo.items.forEach((item) => {
        if (item.submenus) {
          const coincide =
            pathname === item.href ||
            item.submenus.some((sub) => pathname.startsWith(sub.href.split('?')[0] ?? ''));
          if (coincide) {
            nuevosAbiertos[item.href] = true;
          }
        }
      });
    });
    setSubmenusAbiertos(nuevosAbiertos);
    setMenuMovilAbierto(false);
  }, [pathname]);

  const toggleColapsado = () => {
    const nuevo = !colapsado;
    setColapsado(nuevo);
    try {
      localStorage.setItem('sidebar_colapsado', String(nuevo));
    } catch {}
  };

  const toggleSubmenu = (href: string) => {
    setSubmenusAbiertos((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  // Filtrado por buscador
  const gruposFiltrados = NAVEGACION.map((grupo) => {
    if (!busqueda.trim()) return grupo;
    const q = busqueda.toLowerCase();
    const itemsFiltrados = grupo.items.filter((item) => {
      const coincideItem =
        item.etiqueta.toLowerCase().includes(q) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(q));
      const coincideSub = item.submenus?.some((sub) =>
        sub.etiqueta.toLowerCase().includes(q)
      );
      return coincideItem || coincideSub;
    });
    return { ...grupo, items: itemsFiltrados };
  }).filter((grupo) => grupo.items.length > 0);

  return (
    <>
      {/* Botón flotante para abrir menú en móviles */}
      <div className="lg:hidden fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setMenuMovilAbierto(true)}
          className="w-12 h-12 rounded-full bg-vin-900 border-2 border-oro-500/60 text-white flex items-center justify-center shadow-2xl text-lg hover:bg-vin-800 transition-all cursor-pointer"
          title="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* Overlay oscuro para móvil */}
      {menuMovilAbierto && (
        <div
          onClick={() => setMenuMovilAbierto(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 lg:hidden"
        />
      )}

      {/* Barra Lateral / Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-vin-900/80 bg-vin-950 text-white transition-all duration-300 ease-in-out lg:static ${
          colapsado ? 'w-20' : 'w-72'
        } ${
          menuMovilAbierto
            ? 'translate-x-0 w-80'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Cabecera del Menú con Logo FVF y Botón de Ocultar/Colapsar */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-oro-400 to-oro-600 flex items-center justify-center shrink-0 shadow-md font-bold text-vin-950 text-xs">
              FVF
            </div>
            {(!colapsado || menuMovilAbierto) && (
              <div className="leading-tight truncate">
                <span className="text-[10px] font-bold tracking-widest text-oro-400 uppercase block">
                  Federación Venezolana
                </span>
                <span className="text-sm font-bold text-white tracking-tight truncate block">
                  Consejo de Honor
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Botón para cerrar en móvil */}
            <button
              onClick={() => setMenuMovilAbierto(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              ✕
            </button>

            {/* Botón para colapsar/expandir en Desktop */}
            <button
              onClick={toggleColapsado}
              className="hidden lg:flex w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 items-center justify-center text-xs text-slate-300 hover:text-white transition cursor-pointer"
              title={colapsado ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            >
              {colapsado ? '▶' : '◀'}
            </button>
          </div>
        </div>

        {/* Buscador Rápido de Funciones (solo visible si está expandido) */}
        {(!colapsado || menuMovilAbierto) && (
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar funciones, módulos..."
                className="w-full h-8 pl-7 pr-6 text-xs bg-black/40 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-oro-500 focus:border-oro-500"
              />
              <span className="absolute left-2 top-2 text-[11px] text-slate-500">🔍</span>
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lista de Navegación con Scroll */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 select-none scrollbar-thin">
          {gruposFiltrados.map((seccion) => (
            <div key={seccion.grupo} className="space-y-1">
              {/* Título del Grupo */}
              {(!colapsado || menuMovilAbierto) ? (
                <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-oro-400/80">
                  <span>{seccion.icono}</span>
                  <span>{seccion.grupo}</span>
                </div>
              ) : (
                <div className="h-px bg-white/10 my-2 mx-2" title={seccion.grupo} />
              )}

              {/* Items del Grupo */}
              <ul className="space-y-0.5">
                {seccion.items.map((item) => {
                  const tieneSub = item.submenus && item.submenus.length > 0;
                  const estaAbierto = Boolean(submenusAbiertos[item.href]);
                  const esRutaActiva =
                    pathname === item.href ||
                    item.submenus?.some((s) => pathname === s.href.split('?')[0]);

                  return (
                    <li key={item.href} className="relative">
                      {/* Enlace o Botón Desplegable del Módulo */}
                      <div className="flex items-center group">
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (menuMovilAbierto) setMenuMovilAbierto(false);
                          }}
                          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all ${
                            esRutaActiva
                              ? 'bg-oro-500/15 text-oro-300 font-bold border-l-2 border-oro-400 shadow-sm'
                              : 'text-slate-300 hover:text-white hover:bg-white/8'
                          } ${colapsado && !menuMovilAbierto ? 'justify-center px-0' : ''}`}
                          title={colapsado ? `${item.etiqueta}: ${item.descripcion || ''}` : undefined}
                          onMouseEnter={() => {
                            if (colapsado) setMenuFlotanteActivo(item.href);
                          }}
                        >
                          <span className="text-base shrink-0">{item.icono}</span>

                          {(!colapsado || menuMovilAbierto) && (
                            <span className="truncate flex-1">{item.etiqueta}</span>
                          )}

                          {(!colapsado || menuMovilAbierto) && item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-oro-500/20 text-oro-300 border border-oro-500/30">
                              {item.badge}
                            </span>
                          )}
                        </Link>

                        {/* Botón de alternancia de submenú */}
                        {tieneSub && (!colapsado || menuMovilAbierto) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSubmenu(item.href);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 text-[11px] mr-1"
                            title={estaAbierto ? 'Ocultar submenús' : 'Desplegar submenús'}
                          >
                            {estaAbierto ? '▾' : '▸'}
                          </button>
                        )}
                      </div>

                      {/* Submenús en Acordeón (Modo Expandido) */}
                      {tieneSub && estaAbierto && (!colapsado || menuMovilAbierto) && (
                        <ul className="pl-8 pr-1 py-1 space-y-0.5 border-l border-white/10 ml-5 my-1">
                          {item.submenus!.map((sub) => {
                            const esSubActivo = pathname === sub.href.split('?')[0];
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href}
                                  onClick={() => {
                                    if (menuMovilAbierto) setMenuMovilAbierto(false);
                                  }}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                                    esSubActivo
                                      ? 'text-oro-300 font-semibold bg-white/5'
                                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                  title={sub.descripcion}
                                >
                                  <span className="text-xs">{sub.icono}</span>
                                  <span className="truncate">{sub.etiqueta}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Pie de Barra Lateral: Usuario & Sesión */}
        <div className="border-t border-white/10 p-3 shrink-0 bg-black/20">
          {(!colapsado || menuMovilAbierto) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate" title={usuario.email}>
                    {usuario.nombre}
                  </p>
                  <p className="text-[10px] text-oro-400 font-medium">
                    {usuario.esAdmin ? 'Administrador CDH' : usuario.roles[0] || 'Oficial'}
                  </p>
                </div>
                <Link
                  href="/cambiar-password"
                  className="text-[10px] text-slate-400 hover:text-white underline"
                  title="Cambiar clave"
                >
                  ⚙️
                </Link>
              </div>
              <div className="pt-1">
                <BotonSalir />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-vin-900 border border-oro-500/40 flex items-center justify-center text-xs font-bold text-oro-300"
                title={`${usuario.nombre} (${usuario.email})`}
              >
                {usuario.nombre.charAt(0)}
              </div>
              <BotonSalir />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
