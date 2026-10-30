'use client';

import { useMemo, useState } from 'react';
import type { FilaMulta } from '@/lib/datos/expedientes';
import { NOMBRES_MES } from '@/types/filtros-expedientes';

/**
 * Tabla dinamica (pivot) de multas de expedientes.
 *
 * La jerarquia es Año > Mes > Fecha > Nº Auto y/o Decision > Sancionado.
 *
 * El componente no consulta nada: recibe del servidor la fila mas fina (un
 * auto, en una fecha, para un sancionado) y arma el arbol aqui. Es
 * deliberado: si los totales de cada nivel los calculara el servidor por una
 * consulta aparte, el padre y el hijo podrian discrepar y el usuario veria
 * una tabla que no cuadra. Aqui la suma del padre es la suma de sus hijos por
 * construccion.
 */

type Props = {
  filas: FilaMulta[];
  compararAnios: boolean;
  compararMeses: boolean;
};

type Nodo = {
  clave: string;
  etiqueta: string;
  /** 0 anio, 1 mes, 2 fecha, 3 decision, 4 sancionado. */
  nivel: number;
  /** Clave numerica para ordenar: el anio, el mes, el timestamp ISO… */
  orden: number | string;
  multa_uc: number;
  multa_usd: number;
  /** Descendientes totales, para decidir si hace falta boton [+]/[-]. */
  descendientes: number;
  /** Nota opcional, por ejemplo el cruce de años expediente/resolución. */
  nota?: string;
  hijos: Nodo[];
};

const ETIQUETA_NIVEL = ['Año', 'Mes', 'Fecha', 'Decisión', 'Sancionado'];

/** El "sin mes" se ordena al final del ano, no al principio. */
function ordenMes(mes: number): number {
  return mes === 0 ? 99 : mes;
}

function fmtNum(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

/** La fecha llega como `date` (sin zona); se lee con sus partes locales. */
function fmtFecha(d: Date | null): string {
  if (!d) return 'Sin fecha';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

function fmtCantidad(n: number): string {
  // Cantidades grandes se separan con punto, como el resto de la plataforma.
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

/**
 * Inserta `fila` en el nivel `nivel` del mapa correspondiente, colgandola del
 * padre. Los mapas son "cacheados" por prefijo para no recorrer el arbol.
 */
function inserta(
  nivel: number,
  clave: string,
  etiqueta: string,
  orden: number | string,
  padre: Nodo | null,
  caches: Map<string, Nodo>[],
  fila: FilaMulta,
): Nodo {
  // `noUncheckedIndexedAccess` obliga a comprobar el indice; el mapa del nivel
  // siempre existe porque `caches` se construye con los cinco niveles.
  const cache = caches[nivel];
  if (!cache) throw new Error(`Nivel fuera de rango: ${nivel}`);

  let nodo = cache.get(clave);
  if (!nodo) {
    nodo = {
      clave,
      etiqueta,
      nivel,
      orden,
      multa_uc: 0,
      multa_usd: 0,
      descendientes: 0,
      hijos: [],
    };
    cache.set(clave, nodo);
    if (padre) padre.hijos.push(nodo);
  }
  nodo.multa_uc += fila.multa_uc;
  nodo.multa_usd += fila.multa_usd;
  return nodo;
}

function construir(filas: FilaMulta[]): Nodo[] {
  const caches: Map<string, Nodo>[] = [0, 1, 2, 3, 4].map(() => new Map<string, Nodo>());

  for (const f of filas) {
    // En modo "año de la resolución" pueden entrar filas sin año (expedientes
    // que aun no tienen resolución emitida). Van a un grupo propio, al final,
    // en vez de caer en un año inventado.
    const sinAnio = f.anio === null;
    const etiquetaAnio = f.anio === null ? 'Sin año de referencia' : String(f.anio);
    const anioOrden = f.anio ?? 9999;

    const mes = f.mes ?? 0;
    const fecha = f.fecha ? fmtFecha(f.fecha) : 'Sin fecha';
    const fechaIso = f.fecha
      ? `${f.fecha.getFullYear()}-${String(f.fecha.getMonth() + 1).padStart(2, '0')}-${String(f.fecha.getDate()).padStart(2, '0')}`
      : '9999-99-99';
    const decision = f.numero_decision?.trim() || `Exp ${f.numero}/${f.anio_expediente}`;
    const sancionado = f.sancionado_raw ?? 'SIN SANCIONADO';

    const cAnio = `a${sinAnio ? 'sin' : f.anio}`;
    const cMes = `${cAnio}|m${mes}`;
    const cFecha = `${cMes}|f${fechaIso}`;
    const cDec = `${cFecha}|d${decision}`;
    const cSan = `${cDec}|s${sancionado}`;

    const nAnio = inserta(0, cAnio, etiquetaAnio, anioOrden, null, caches, f);
    const nMes = inserta(
      1,
      cMes,
      mes === 0 ? 'Sin fecha' : (NOMBRES_MES[mes - 1] ?? String(mes)),
      ordenMes(mes),
      nAnio,
      caches,
      f,
    );
    const nFecha = inserta(2, cFecha, fecha, fechaIso, nMes, caches, f);
    const nDec = inserta(3, cDec, decision, decision, nFecha, caches, f);

    /**
     * Cuando los dos años difieren, el número del acto ya lo dice ("Res.
     * 052/2025" dentro de un expediente de 2024). Se lo dice también la
     * columna de la derecha para no tener que abrir el grupo.
     */
    const notaAnios =
      !sinAnio && f.anio_resolucion !== null && f.anio_resolucion !== f.anio_expediente
        ? `Exp. ${f.anio_expediente} · Res. ${f.anio_resolucion}`
        : null;
    const nSan = inserta(4, cSan, sancionado, sancionado, nDec, caches, f);
    if (notaAnios) nSan.nota = notaAnios;
  }

  // `descendientes` se calcula de abajo hacia arriba, una sola vez.
  const cuenta = (n: Nodo): number => {
    n.descendientes = n.hijos.reduce((s, h) => s + 1 + cuenta(h), 0);
    return n.descendientes;
  };
  const raices = [...(caches[0]?.values() ?? [])];
  for (const r of raices) cuenta(r);

  return raices.sort((a, b) => Number(b.orden) - Number(a.orden));
}

function ordenaHijos(hijos: Nodo[]): Nodo[] {
  return hijos.slice().sort((a, b) => {
    if (typeof a.orden === 'number' && typeof b.orden === 'number') {
      return b.orden - a.orden; // anio y mes: del mas reciente al mas antiguo
    }
    return String(a.orden).localeCompare(String(b.orden)); // fecha, decision, nombre
  });
}

export function TablaPivotMultas({ filas, compararAnios, compararMeses }: Props) {
  const arbol = useMemo(() => construir(filas), [filas]);

  /**
   * Los toggles de comparacion eligen hasta que nivel se despliega:
   *
   * - apagados: solo la linea por año (el resumen de un vistazo)
   * - "comparar años": además sale el desglose por mes de cada año
   * - "comparar meses": además sale el desglose por fecha dentro del mes
   *
   * Asi el toggle no es decorativo: es el control de la profundidad del
   * contraste entre los periodos seleccionados.
   */
  const nivelInicial = compararMeses ? 2 : compararAnios ? 1 : 0;
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const [contraerTodo, setContraerTodo] = useState(false);

  const visibles = useMemo(() => {
    const set = new Set<string>();
    if (contraerTodo) return set;
    // Se abren en cascada los niveles hasta el pedido. Con `nivelInicial = 0`
    // (sin comparar) no se abre nada: solo las lineas de año.
    if (nivelInicial >= 1) {
      for (const r of arbol) {
        for (const m of r.hijos) {
          set.add(m.clave);
          if (nivelInicial >= 2) for (const fd of m.hijos) set.add(fd.clave);
        }
      }
    }
    for (const c of abiertos) set.add(c);
    return set;
  }, [arbol, abiertos, contraerTodo, nivelInicial]);

  /**
   * Diferencia contra el periodo anterior seleccionado, por año.
   *
   * Solo con "comparar años": es lo que convierte un listado en un contraste.
   * El comparador es el año que aparece justo encima en la tabla (el
   * inmediatamente anterior de los que el usuario eligio), no el año
   * calendario previo, porque puede no estar en el filtro.
   */
  const deltaPorAnio = useMemo(() => {
    const m = new Map<string, { abs: number; pct: number | null }>();
    if (!compararAnios) return m;
    for (let i = 0; i < arbol.length - 1; i++) {
      const actual = arbol[i]!;
      const previo = arbol[i + 1]!;
      const abs = actual.multa_uc - previo.multa_uc;
      const pct = previo.multa_uc > 0 ? (abs / previo.multa_uc) * 100 : null;
      m.set(actual.clave, { abs, pct });
    }
    return m;
  }, [arbol, compararAnios]);

  function alterna(clave: string) {
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }

  const totales = useMemo(
    () => ({
      filas: filas.length,
      uc: filas.reduce((s, f) => s + f.multa_uc, 0),
      usd: filas.reduce((s, f) => s + f.multa_usd, 0),
    }),
    [filas],
  );

  if (filas.length === 0) {
    return (
      <section className="card p-8 text-center">
        <p className="text-ink-soft">No hay expedientes que cumplan el filtro.</p>
      </section>
    );
  }

  const cuerpo: React.ReactNode[] = [];

  function pinta(n: Nodo, depth: number) {
    const abierto = visibles.has(n.clave);
    const plegable = n.descendientes > 0;

    cuerpo.push(
      <tr key={n.clave} className={depth === 0 ? 'bg-vin-50/60' : undefined}>
        <td className="px-3 py-1.5">
          <span
            className="inline-flex items-center gap-1.5"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {plegable ? (
              <button
                type="button"
                onClick={() => alterna(n.clave)}
                aria-expanded={abierto}
                aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${n.etiqueta}`}
                className="grid h-4 w-4 shrink-0 place-items-center rounded border border-vin-300 text-[11px] leading-none text-ink-soft hover:bg-vin-100"
              >
                {abierto ? '−' : '+'}
              </button>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
            <span className={depth === 0 ? 'font-semibold text-vin-900' : undefined}>
              {n.etiqueta}
            </span>
            {n.nota && (
              <span className="ml-1.5 rounded bg-amarilla/30 px-1.5 py-0.5 text-[11px] text-vin-900">
                {n.nota}
              </span>
            )}
          </span>
        </td>
        <td className="px-3 py-1.5 text-xs text-ink-faint">{ETIQUETA_NIVEL[n.nivel]}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(n.multa_uc)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(n.multa_usd)}</td>
      </tr>,
    );

    if (abierto) {
      for (const h of ordenaHijos(n.hijos)) {
        if (visibles.has(h.clave)) pinta(h, depth + 1);
      }
    }
  }

  for (const raiz of ordenaHijos(arbol)) {
    const delta = deltaPorAnio.get(raiz.clave);
    cuerpo.push(
      <tr key={`t-${raiz.clave}`} className="border-t-2 border-vin-200 bg-vin-100/70">
        <th className="px-3 py-1.5 text-left font-display text-xs tracking-wider text-vin-900 uppercase">
          Total {raiz.etiqueta}
        </th>
        <td className="px-3 py-1.5" />
        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
          {fmtNum(raiz.multa_uc)}
          {delta && (
            <span
              className={`ml-2 text-xs font-medium ${
                delta.abs > 0
                  ? 'text-roja'
                  : delta.abs < 0
                    ? 'text-emerald-700'
                    : 'text-ink-faint'
              }`}
            >
              {delta.abs > 0 ? '+' : ''}
              {fmtNum(delta.abs)} UC
              {delta.pct !== null && ` (${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%)`}
            </span>
          )}
        </td>
        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
          {fmtNum(raiz.multa_usd)}
        </td>
      </tr>,
    );
    // Un hijo solo se dibuja si esta visible: sin "comparar años" la tabla
    // muestra la linea de año y nada mas, aunque los hijos existan en el arbol.
    for (const m of ordenaHijos(raiz.hijos)) {
      if (visibles.has(m.clave)) pinta(m, 1);
    }
  }

  return (
    <section className="card overflow-hidden" aria-label="Tabla de multas por expediente">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-vin-100 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-vin-900">
          Multas por expediente
        </h2>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="tabular-nums">
            {totales.filas} filas · {fmtCantidad(totales.uc)} UC · ${fmtCantidad(totales.usd)}
          </span>
          <button
            type="button"
            onClick={() => setContraerTodo((v) => !v)}
            className="rounded border border-vin-200 px-2 py-1 text-xs"
          >
            {contraerTodo ? 'Expandir' : 'Contraer'}
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vin-200 text-left text-xs tracking-wider text-ink-soft uppercase">
              <th className="px-3 py-2">Año · Mes · Fecha · Decisión · Sancionado</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2 text-right">Multa UCFVF</th>
              <th className="px-3 py-2 text-right">Multa $</th>
            </tr>
          </thead>
          <tbody>{cuerpo}</tbody>
        </table>
      </div>
    </section>
  );
}
