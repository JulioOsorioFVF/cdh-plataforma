'use server';

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EstadoFila, EstadoIngesta, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { generarCsv } from '@/lib/ingesta/csv';
import { lanzarCarga, recibir } from '@/lib/ingesta/motor';
import { directorioAdjuntos, MAX_ADJUNTO_BYTES, rutaAdjunto } from '@/lib/expedientes/archivos';
import { anonimizarIdentificadoresDirectos } from '@/lib/privacidad/anonimizacion';
import { requierePermiso } from '@/server/auth/sesion';

const RUTA = '/ingesta';
const MAX_HOJA_BYTES = 20 * 1024 * 1024;
const MAX_TEXTO_PDF = 100_000;

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; mensaje: string };

function resultadoError(error: unknown): ResultadoAccion {
  return {
    ok: false,
    mensaje: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
  };
}

function textoFormulario(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

function nombreSeguro(nombre: string): string {
  const limpio = path
    .basename(nombre)
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .slice(0, 180);
  return limpio || 'documento.pdf';
}

function valorCeldaExcel(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  throw new Error('El libro contiene un tipo de celda no admitido.');
}

async function extraerCsv(bytes: Buffer, nombre: string): Promise<string> {
  const extension = path.extname(nombre).toLowerCase();
  if (extension === '.csv') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  if (extension !== '.xlsx') {
    throw new Error(
      'Selecciona un archivo CSV o XLSX. Guarda los libros XLS antiguos como XLSX.',
    );
  }

  let readXlsx: any;
  try {
    const mod = await import('read-excel-file/node');
    readXlsx = mod.default || mod;
  } catch {
    throw new Error('Para procesar libros XLSX se requiere el módulo read-excel-file o exportar el archivo a formato .csv.');
  }

  const hojas = await readXlsx(bytes, { trim: false });
  const hoja =
    hojas.find((candidata) => candidata.sheet.trim().toLocaleUpperCase() === 'ALL') ?? hojas[0];
  if (!hoja) throw new Error('El libro no contiene una hoja válida.');
  return generarCsv(hoja.data.map((fila) => fila.map(valorCeldaExcel)));
}

export async function previsualizarLoteAction(datos: FormData) {
  try {
    const sesion = await requierePermiso('ingesta:run');
    const archivo = datos.get('archivo');
    if (!(archivo instanceof File) || archivo.size === 0) {
      throw new Error('Selecciona el archivo histórico que deseas importar.');
    }
    if (archivo.size > MAX_HOJA_BYTES) throw new Error('El archivo excede el límite de 20 MB.');

    const nombre = nombreSeguro(archivo.name);
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const contenido = await extraerCsv(bytes, nombre);
    const recepcion = await recibir({
      clave: 'expedientes',
      contenido,
      fuente: 'ARCHIVO',
      archivo: nombre,
      usuarioId: sesion.id,
    });

    revalidatePath(RUTA);
    return {
      ok: true as const,
      recepcion: {
        loteId: recepcion.loteId,
        filasLeidas: recepcion.filasLeidas,
        validas: recepcion.validas,
        advertencias: recepcion.advertencias,
        rechazadas: recepcion.rechazadas,
        omitidas: recepcion.omitidas,
        esquema: recepcion.esquema,
        muestra: recepcion.aceptadas.slice(0, 5).map((fila) => ({
          numero: fila[0] ?? '',
          anio: fila[1] ?? '',
        })),
      },
    };
  } catch (error) {
    return { ok: false as const, mensaje: resultadoError(error).mensaje };
  }
}

export async function confirmarCargaLoteAction(loteId: number): Promise<ResultadoAccion> {
  try {
    const sesion = await requierePermiso('ingesta:run');
    if (!Number.isSafeInteger(loteId) || loteId < 1)
      throw new Error('El lote indicado no es válido.');
    const lote = await prisma.stg_lote.findUnique({ where: { id: loteId } });
    if (!lote || lote.documento !== 'EXPEDIENTES')
      throw new Error('No se encontró el lote de expedientes.');
    if (lote.estado !== EstadoIngesta.VALIDADO) {
      throw new Error('Este lote ya se cargó o no está listo para confirmar.');
    }
    if (!lote.esquemaOk) {
      throw new Error('Corrige el esquema del archivo antes de cargar sus filas.');
    }

    const filasStaging = await prisma.stg_fila.findMany({
      where: {
        loteId,
        estado: { in: [EstadoFila.VALIDA, EstadoFila.ADVERTENCIA] },
      },
      orderBy: { numeroFila: 'asc' },
      select: { crudo: true },
    });
    const filas = filasStaging.map(({ crudo }) => {
      if (!Array.isArray(crudo) || !crudo.every((celda) => typeof celda === 'string')) {
        throw new Error('Falta el contenido original de una fila; no se inició la carga.');
      }
      return crudo;
    });
    if (filas.length === 0) throw new Error('El lote no tiene filas aceptadas para cargar.');

    const reservado = await prisma.stg_lote.updateMany({
      where: { id: loteId, estado: EstadoIngesta.VALIDADO },
      data: { estado: EstadoIngesta.PROCESANDO, fase: 'EN_COLA' },
    });
    if (reservado.count !== 1) throw new Error('Otro proceso ya confirmó este lote.');

    lanzarCarga({
      loteId,
      clave: 'expedientes',
      filas,
      archivo: lote.archivo ?? 'expedientes.xlsx',
      fuente: 'ARCHIVO',
      usuarioId: sesion.id,
    });
    revalidatePath(RUTA);
    revalidatePath('/expedientes');
    return { ok: true, mensaje: `Carga iniciada para ${filas.length} expedientes aceptados.` };
  } catch (error) {
    return resultadoError(error);
  }
}

async function guardarDocumento(expedienteId: number, nombre: string, bytes: Buffer) {
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('El archivo no tiene una cabecera PDF válida.');
  }
  if (bytes.length > MAX_ADJUNTO_BYTES)
    throw new Error('Cada PDF debe pesar como máximo 25 MB.');
  const identificador = randomBytes(16).toString('hex');
  const ruta = rutaAdjunto(`${identificador}.pdf`);
  await mkdir(directorioAdjuntos(), { recursive: true });
  await writeFile(ruta, bytes, { flag: 'wx', mode: 0o600 });

  try {
    return await prisma.expediente_documento.create({
      data: {
        expedienteId,
        nombre: nombreSeguro(nombre),
        ruta,
        mimeType: 'application/pdf',
        tamanoBytes: bytes.length,
        tipo: 'PDF',
      },
      select: { id: true },
    });
  } catch (error) {
    await rm(ruta, { force: true });
    throw error;
  }
}

export async function adjuntarPdfAction(datos: FormData): Promise<ResultadoAccion> {
  try {
    await requierePermiso('ingesta:run');
    const expedienteId = Number(textoFormulario(datos, 'expedienteId'));
    const archivo = datos.get('archivo');
    if (!Number.isSafeInteger(expedienteId) || expedienteId < 1) {
      throw new Error('Selecciona un expediente válido.');
    }
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error('Selecciona un PDF.');
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Solo se permiten documentos PDF.');
    }
    if (archivo.size > MAX_ADJUNTO_BYTES) throw new Error('El PDF excede el límite de 25 MB.');
    if (
      !(await prisma.fact_expediente.findUnique({
        where: { id: expedienteId },
        select: { id: true },
      }))
    ) {
      throw new Error('El expediente seleccionado ya no existe.');
    }
    const bytes = Buffer.from(await archivo.arrayBuffer());
    await guardarDocumento(expedienteId, archivo.name, bytes);
    revalidatePath(RUTA);
    return { ok: true, mensaje: 'PDF guardado en el almacenamiento privado del servidor.' };
  } catch (error) {
    return resultadoError(error);
  }
}

function anonimizarTexto(texto: string, nombres: string[]): string {
  let salida = texto;
  for (const nombre of [...new Set(nombres.filter((valor) => valor.trim().length >= 3))].sort(
    (a, b) => b.length - a.length,
  )) {
    const escaped = nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    salida = salida.replace(new RegExp(escaped, 'giu'), '[PERSONA U ORGANIZACIÓN]');
  }
  return anonimizarIdentificadoresDirectos(salida).slice(0, MAX_TEXTO_PDF);
}

async function extraerTextoPdf(bytes: Buffer): Promise<string> {
  try {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const getDoc = mod.getDocument || (mod as any).default?.getDocument;
    if (getDoc) {
      const documento = await getDoc({ data: new Uint8Array(bytes) }).promise;
      const paginas: string[] = [];
      try {
        for (let numero = 1; numero <= Math.min(documento.numPages, 120); numero++) {
          const pagina = await documento.getPage(numero);
          const contenido = await pagina.getTextContent();
          paginas.push(
            contenido.items
              .filter((item): item is typeof item & { str: string } => 'str' in item)
              .map((item) => item.str)
              .join(' '),
          );
        }
      } finally {
        await documento.destroy();
      }
      if (paginas.length > 0) return paginas.join('\n').slice(0, MAX_TEXTO_PDF);
    }
  } catch {
    // Fallback nativo
  }

  const raw = bytes.toString('latin1');
  const asciiRegex = /[\x20-\x7E\xA0-\xFF]{4,}/g;
  const matches = raw.match(asciiRegex) || [];
  return matches.slice(0, 1000).join(' ').slice(0, MAX_TEXTO_PDF);
}

export async function previsualizarPdfAction(documentoId: number) {
  try {
    await requierePermiso('ingesta:run');
    if (!Number.isSafeInteger(documentoId) || documentoId < 1)
      throw new Error('Documento no válido.');
    const documento = await prisma.expediente_documento.findUnique({
      where: { id: documentoId },
      include: {
        expediente: {
          include: { partes: { select: { nombre: true, cedula: true } } },
        },
      },
    });
    if (!documento) throw new Error('No se encontró el PDF asociado.');
    const bytes = await readFile(rutaAdjunto(documento.ruta));
    const textoExtraido = await extraerTextoPdf(bytes);
    const nombres = [
      documento.expediente.nombre,
      documento.expediente.sancionadoRaw,
      ...documento.expediente.partes.flatMap((parte) => [parte.nombre, parte.cedula]),
    ].filter((valor): valor is string => Boolean(valor));

    return {
      ok: true as const,
      documentoId,
      textoAnonimizado: anonimizarTexto(textoExtraido, nombres),
      mensaje:
        textoExtraido.length > 0
          ? 'Texto extraído localmente. Revisa y elimina cualquier dato identificable restante.'
          : 'El PDF no contiene texto extraíble (posible escaneo). Puedes pegar una transcripción anonimizada; no se envía el PDF a ningún servicio externo.',
    };
  } catch (error) {
    return { ok: false as const, mensaje: resultadoError(error).mensaje };
  }
}

export async function aprobarPdfParaAgenteAction(
  documentoId: number,
  textoAnonimizado: string,
  confirmacion: boolean,
): Promise<ResultadoAccion> {
  try {
    const sesion = await requierePermiso('ingesta:run');
    const texto = textoAnonimizado.trim();
    if (!confirmacion)
      throw new Error('Confirma que revisaste y anonimizaste el texto antes de indexarlo.');
    if (texto.length < 40)
      throw new Error('El texto anonimizado debe contener al menos 40 caracteres.');
    if (texto.length > MAX_TEXTO_PDF)
      throw new Error('El texto excede el límite de 100.000 caracteres.');

    const documento = await prisma.expediente_documento.findUnique({
      where: { id: documentoId },
      include: { expediente: true },
    });
    if (!documento) throw new Error('No se encontró el PDF asociado.');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Define GEMINI_API_KEY para indexar el texto aprobado.');

    const { GoogleGenAI } = await import('@google/genai');
    const respuesta = await new GoogleGenAI({ apiKey }).models.embedContent({
      model: 'text-embedding-004',
      contents: texto.slice(0, 6000),
    });
    const vector = respuesta.embeddings?.[0]?.values;
    if (!vector || vector.length !== 768 || !vector.every(Number.isFinite)) {
      throw new Error('El proveedor no devolvió un vector válido de 768 dimensiones.');
    }

    const codigoReferencia = `HIST-DOC-${documento.id}`;
    await prisma.$transaction(async (tx) => {
      const memoria = await tx.memoriaJuridicaVectorial.upsert({
        where: { codigoReferencia },
        create: {
          tipoDocumento: 'REFERENCIA_CDH',
          codigoReferencia,
          anio: documento.expediente.anio,
          torneo: documento.expediente.ligaTorneo,
          motivoTipificado: documento.expediente.motivo || 'No especificado',
          articulosClave: [],
          extractoHechos: texto,
          criterioJuridico: texto,
          multaAplicadaUcfvf: 0,
          metadatosJson: {
            expedienteId: documento.expedienteId,
            documentoId: documento.id,
            anonimizado: true,
            aprobadoPor: sesion.id,
            aprobadoEn: new Date().toISOString(),
          },
        },
        update: {
          extractoHechos: texto,
          criterioJuridico: texto,
          metadatosJson: {
            expedienteId: documento.expedienteId,
            documentoId: documento.id,
            anonimizado: true,
            aprobadoPor: sesion.id,
            aprobadoEn: new Date().toISOString(),
          },
        },
        select: { id: true },
      });
      const vectorSql = `[${vector.join(',')}]`;
      await tx.$executeRaw(
        Prisma.sql`UPDATE memoria_juridica_vectorial SET embedding = ${vectorSql}::vector WHERE id = ${memoria.id}`,
      );
    });

    revalidatePath(RUTA);
    revalidatePath('/agente-ia');
    return {
      ok: true,
      mensaje: 'Texto anonimizado aprobado e indexado para consulta del agente.',
    };
  } catch (error) {
    return resultadoError(error);
  }
}

export async function importarPdfDriveAction(): Promise<{
  ok: boolean;
  mensaje: string;
  importados?: number;
  sinAsociar?: number;
  errores?: string[];
}> {
  try {
    await requierePermiso('ingesta:run');
    const folderId = process.env.GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!folderId || !email || !privateKey) {
      throw new Error(
        'Configura GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY.',
      );
    }
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const expedientes = await prisma.fact_expediente.findMany({
      select: { id: true, numero: true, anio: true },
    });
    const casos = new Map(
      expedientes.map((caso) => [`${caso.anio}-${Number(caso.numero)}`, caso.id]),
    );

    let importados = 0;
    let sinAsociar = 0;
    const errores: string[] = [];
    let pageToken: string | undefined;
    do {
      const respuesta = await drive.files.list({
        q: `'${folderId.replaceAll("'", "\\'")}' in parents and mimeType = 'application/pdf' and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const archivo of respuesta.data.files ?? []) {
        const nombre = archivo.name ?? 'documento.pdf';
        const coincidencia = nombre.match(
          /(?:exp(?:ediente)?[-_.\s]*)?(\d{1,4})[\/_\-\s]+(20\d{2})/i,
        );
        const expedienteId = coincidencia
          ? casos.get(`${coincidencia[2]}-${Number(coincidencia[1])}`)
          : undefined;
        if (!expedienteId || !archivo.id) {
          sinAsociar++;
          continue;
        }
        const bytesEsperados = Number(archivo.size ?? 0);
        if (bytesEsperados > MAX_ADJUNTO_BYTES) {
          errores.push(`${nombre}: excede 25 MB.`);
          continue;
        }
        const yaExiste = await prisma.expediente_documento.findFirst({
          where: { expedienteId, nombre },
          select: { id: true },
        });
        if (yaExiste) continue;

        try {
          const descarga = await drive.files.get(
            { fileId: archivo.id, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' },
          );
          await guardarDocumento(
            expedienteId,
            nombre,
            Buffer.from(descarga.data as ArrayBuffer),
          );
          importados++;
        } catch (error) {
          errores.push(
            `${nombre}: ${error instanceof Error ? error.message : 'no se pudo importar'}`,
          );
        }
      }
      pageToken = respuesta.data.nextPageToken ?? undefined;
    } while (pageToken);

    revalidatePath(RUTA);
    return {
      ok: errores.length === 0,
      mensaje: `${importados} PDF(s) importados; ${sinAsociar} sin código de expediente reconocible.`,
      importados,
      sinAsociar,
      errores,
    };
  } catch (error) {
    return { ok: false, mensaje: resultadoError(error).mensaje };
  }
}
