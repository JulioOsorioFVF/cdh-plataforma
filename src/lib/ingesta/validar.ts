/**
 * Validacion y perfilado.
 *
 * `validarFila` aplica el contrato a una fila y decide si se puede cargar:
 *
 *   VALIDA       entra sin observaciones.
 *   ADVERTENCIA  entra, pero algo merece revision (se guarda el motivo).
 *   RECHAZADA    no entra; el motivo queda registrado y la fila se puede
 *                descargar para corregirla en la hoja de origen.
 *
 * El perfilado calcula, en la misma pasada, la forma de cada columna (nulos,
 * distintos, minimos y maximos, valores mas frecuentes). Es lo que permite
 * detectar un cambio de formato en la fuente antes de que ensucie el tablero.
 */
import type { Contrato, FilaNormalizada, Hallazgo } from './contratos.js';
import { convertir, limpiar } from './estandar.js';
import { hashFila } from './util.js';

export type EstadoValidacion = 'VALIDA' | 'ADVERTENCIA' | 'RECHAZADA';

export type ResultadoFila = {
  numeroFila: number;
  hash: string;
  estado: EstadoValidacion;
  errores: Hallazgo[];
  avisos: Hallazgo[];
  /** Solo se guarda el crudo cuando hay algo que diagnosticar. */
  crudo: string[] | null;
  valores: Record<string, string | number | boolean | null>;
};

/** Forma de una columna a lo largo del lote. */
export type PerfilColumna = {
  campo: string;
  tipo: string;
  nulos: number;
  distintos: number;
  top: [string, number][];
  minimo?: number;
  maximo?: number;
  longitudMaxima?: number;
};

const LIMITE_DISTINTOS = 5000;
const TOP = 5;

class Perfilador {
  private readonly datos = new Map<
    string,
    {
      tipo: string;
      nulos: number;
      distintos: Set<string>;
      conteo: Map<string, number>;
      minimo?: number;
      maximo?: number;
      longitudMaxima?: number;
    }
  >();

  agregar(campo: string, tipo: string, valor: string | number | boolean | null): void {
    let d = this.datos.get(campo);
    if (!d) {
      d = { tipo, nulos: 0, distintos: new Set(), conteo: new Map() };
      this.datos.set(campo, d);
    }

    if (valor === null || valor === '') {
      d.nulos++;
      return;
    }

    const texto = String(valor);
    if (typeof valor === 'number') {
      d.minimo = d.minimo === undefined ? valor : Math.min(d.minimo, valor);
      d.maximo = d.maximo === undefined ? valor : Math.max(d.maximo, valor);
    } else {
      d.longitudMaxima = Math.max(d.longitudMaxima ?? 0, texto.length);
    }

    if (d.distintos.size < LIMITE_DISTINTOS) d.distintos.add(texto);
    const previo = d.conteo.get(texto);
    if (previo !== undefined) {
      d.conteo.set(texto, previo + 1);
    } else if (d.conteo.size < LIMITE_DISTINTOS) {
      d.conteo.set(texto, 1);
    }
  }

  resumen(): PerfilColumna[] {
    const salida: PerfilColumna[] = [];
    for (const [campo, d] of this.datos) {
      const top = [...d.conteo.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP)
        .map(([v, n]): [string, number] => [v.length > 80 ? `${v.slice(0, 80)}…` : v, n]);
      salida.push({
        campo,
        tipo: d.tipo,
        nulos: d.nulos,
        distintos: d.distintos.size,
        top,
        minimo: d.minimo,
        maximo: d.maximo,
        longitudMaxima: d.longitudMaxima,
      });
    }
    return salida;
  }
}

export class Analizador {
  readonly contrato: Contrato;
  private readonly perfil = new Perfilador();
  /** Huellas ya vistas en este lote, para detectar filas repetidas en el archivo. */
  private readonly huellas = new Set<string>();

  constructor(contrato: Contrato) {
    this.contrato = contrato;
  }

  analizar(fila: string[], numeroFila: number): ResultadoFila {
    const contrato = this.contrato;
    const errores: Hallazgo[] = [];
    const avisos: Hallazgo[] = [];
    const valores: Record<string, string | number | boolean | null> = {};

    for (const campo of contrato.campos) {
      const crudo = fila[campo.indice] ?? '';
      const conv = convertir(campo.tipo, crudo);

      if (!conv.ok) {
        errores.push({
          codigo: campo.tipo === 'fecha' ? 'FECHA_INVALIDA' : 'VALOR_INVALIDO',
          campo: campo.campo,
          mensaje: conv.motivo,
          valor: crudo.slice(0, 200),
        });
        valores[campo.campo] = null;
        this.perfil.agregar(campo.campo, campo.tipo, null);
        continue;
      }

      let valor = conv.valor;

      if (valor === null && campo.obligatorio) {
        errores.push({
          codigo: 'CAMPO_OBLIGATORIO',
          campo: campo.campo,
          mensaje: `Falta un dato obligatorio (${campo.encabezado}).`,
        });
      }

      if (typeof valor === 'number') {
        if (campo.min !== undefined && valor < campo.min) {
          errores.push({
            codigo: 'FUERA_DE_RANGO',
            campo: campo.campo,
            mensaje: `Valor por debajo del mínimo (${campo.min}): ${valor}.`,
            valor: String(valor),
          });
        }
        if (campo.max !== undefined && valor > campo.max) {
          errores.push({
            codigo: 'FUERA_DE_RANGO',
            campo: campo.campo,
            mensaje: `Valor por encima del máximo (${campo.max}): ${valor}.`,
            valor: String(valor),
          });
          valor = null;
        }
      }

      if (typeof valor === 'string' && campo.maxLongitud && valor.length > campo.maxLongitud) {
        avisos.push({
          codigo: 'TEXTO_LARGO',
          campo: campo.campo,
          mensaje: `Texto de ${valor.length} caracteres (máximo recomendado ${campo.maxLongitud}).`,
          valor: `${valor.slice(0, 60)}…`,
        });
      }

      valores[campo.campo] = valor;
      this.perfil.agregar(campo.campo, campo.tipo, valor);
    }

    // Reglas de negocio de la fila completa.
    if (contrato.reglas) {
      const normalizada: FilaNormalizada = { valores, crudo: fila };
      avisos.push(...contrato.reglas(normalizada));
    }

    const huella = hashFila(
      contrato.documento,
      fila.map((c) => limpiar(c)),
    );

    if (this.huellas.has(huella)) {
      errores.push({
        codigo: 'DUPLICADO_EN_ARCHIVO',
        campo: '(fila)',
        mensaje: 'Esta fila ya apareció antes en el mismo archivo; se conserva la primera.',
      });
    } else {
      this.huellas.add(huella);
    }

    const estado: EstadoValidacion =
      errores.length > 0 ? 'RECHAZADA' : avisos.length > 0 ? 'ADVERTENCIA' : 'VALIDA';

    return {
      numeroFila,
      hash: huella,
      estado,
      errores,
      avisos,
      // El crudo solo se persiste cuando hay algo que explicar: ahorra ~90 % de
      // espacio y deja la evidencia donde hace falta.
      crudo: estado === 'VALIDA' && avisos.length === 0 ? null : fila,
      valores,
    };
  }

  perfilColumnas(): PerfilColumna[] {
    return this.perfil.resumen();
  }
}

/** Agrupa hallazgos por codigo, para el resumen de calidad del lote. */
export function contarPorCodigo(resultados: ResultadoFila[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const r of resultados) {
    for (const h of r.errores) conteo[h.codigo] = (conteo[h.codigo] ?? 0) + 1;
    for (const h of r.avisos) conteo[h.codigo] = (conteo[h.codigo] ?? 0) + 1;
  }
  return conteo;
}
