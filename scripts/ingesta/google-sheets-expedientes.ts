/**
 * Sincronizador en Node.js para la hoja "ALL" del Cuadro de Expedientes CDH-FVF.
 * Ejecutar con: npx tsx scripts/ingesta/google-sheets-expedientes.ts
 */
import { config } from 'dotenv';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

config();
const prisma = new PrismaClient();

const VALOR_UCFVF_USD = 3.0; // Relación oficial observada en Memoria y Cuenta ($3 por 1 UCFVF)

function parsearFechaLatam(valor?: string): Date | null {
  if (!valor || !valor.trim()) return null;
  const limpio = valor.trim().replace(/-/g, '/');
  const partes = limpio.split('/');
  if (partes.length !== 3) return null;
  const [diaTexto, mesTexto, anioTexto] = partes;
  if (!diaTexto || !mesTexto || !anioTexto) return null;

  // Soporta DD/MM/YYYY y MM/DD/YYYY cuando el segundo valor > 12
  let dia = parseInt(diaTexto, 10);
  let mes = parseInt(mesTexto, 10);
  let anio = parseInt(anioTexto, 10);
  if (anio < 100) anio += 2000;
  if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCDate() === dia && fecha.getUTCMonth() === mes - 1 ? fecha : null;
}

function extraerMontoUcfvf(colMulta?: string, colSancion?: string, colObs?: string, colDecision?: string): number {
  if (colMulta && !isNaN(parseFloat(colMulta.replace(',', '.')))) {
    return parseFloat(colMulta.replace(',', '.'));
  }
  if (colSancion && /^\d+(\.\d+)?$/.test(colSancion.trim())) {
    return parseFloat(colSancion.trim());
  }
  // Rescate inteligente si la multa quedó escrita en Observaciones o Decisión (ej. "80 UCFVF")
  const textoCombinado = `${colObs ?? ''} ${colDecision ?? ''}`;
  const match = textoCombinado.match(/(\d+(?:[.,]\d+)?)\s*UC\s*FVF/i);
  return match?.[1] ? parseFloat(match[1].replace(',', '.')) : 0;
}

export async function sincronizarGoogleSheetExpedientes() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_EXPEDIENTES_DOC_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error(
      'Define GOOGLE_SHEETS_EXPEDIENTES_DOC_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en tu archivo .env',
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const respuesta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'ALL!A2:AJ10550',
  });

  const filas = respuesta.data.values ?? [];
  let procesados = 0;

  for (const valores of filas) {
    const fila = Array.from({ length: 36 }, (_, indice) => String(valores[indice] ?? ''));
    const numeroExp = (fila[0] ?? '').toString().trim();
    const anio = parseInt((fila[1] ?? '').toString().trim(), 10);
    if (!numeroExp || isNaN(anio)) continue;

    const fechaEntrada = parsearFechaLatam(fila[3]);
    const fechaDecision = parsearFechaLatam(fila[17]);

    // Cálculo automático de SLA (Días de Sustanciación)
    const diasSustanciacion =
      fechaEntrada && fechaDecision
        ? Math.max(0, Math.round((fechaDecision.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    const multaUcfvf = extraerMontoUcfvf(fila[32], fila[30], fila[29], fila[21]);
    const multaUsdExplicita = parseFloat((fila[33] ?? '').toString().replace(/[$,\s]/g, ''));
    const multaUsd = !isNaN(multaUsdExplicita) && multaUsdExplicita > 0
      ? multaUsdExplicita
      : +(multaUcfvf * VALOR_UCFVF_USD).toFixed(2);

    await prisma.expedienteJuridico.upsert({
      where: { exp_anio_unico: { numeroExp, anio } },
      update: {
        autoEntrada: fila[2] || null,
        fechaAutoEntrada: fechaEntrada,
        motivoEntrada: fila[4] || null,
        asunto: fila[5] || null,
        parteDemandante: fila[6] || null,
        parteDemandada: fila[7] || null,
        torneoCategoria: fila[8] || null,
        equipos: fila[9] || null,
        tramite: fila[10] || 'En Instrucción',
        modalidad: fila[11] || 'Digital',
        asignadoA: fila[12] || 'Sin Asignar',
        statusKanban: fila[13] || null,
        fechaAsignacion: parsearFechaLatam(fila[14]),
        fechaSeguimiento: parsearFechaLatam(fila[15]),
        alerta: fila[16] || null,
        fechaDecision,
        anioDecision: fila[18] ? parseInt(fila[18], 10) : null,
        mesDecision: fila[19] ? parseInt(fila[19], 10) : null,
        numeroAutoDecision: fila[20] || null,
        textoDecision: fila[21] || null,
        numeroUsurpacionFecha: fila[22] || null,
        segundaDecisionFlag: fila[23] || null,
        recursoEjercido: fila[24] || null,
        fechaRecurso: parsearFechaLatam(fila[25]),
        numeroDecisionRecurso: fila[26] || null,
        fechaEmisionRecurso: parsearFechaLatam(fila[27]),
        textoDecisionRecurso: fila[28] || null,
        observaciones: fila[29] || null,
        sancionResumen: fila[30] || null,
        sancionadoNombre: fila[31] || null,
        multaUcfvf,
        multaUsd,
        cumplimientoDecision: fila[34] || 'PENDIENTE',
        motivoCumplimiento: fila[35] || null,
        diasSustanciacion,
      },
      create: {
        numeroExp,
        anio,
        autoEntrada: fila[2] || null,
        fechaAutoEntrada: fechaEntrada,
        motivoEntrada: fila[4] || null,
        asunto: fila[5] || null,
        parteDemandante: fila[6] || null,
        parteDemandada: fila[7] || null,
        torneoCategoria: fila[8] || null,
        equipos: fila[9] || null,
        tramite: fila[10] || 'En Instrucción',
        modalidad: fila[11] || 'Digital',
        asignadoA: fila[12] || 'Sin Asignar',
        statusKanban: fila[13] || null,
        fechaAsignacion: parsearFechaLatam(fila[14]),
        fechaSeguimiento: parsearFechaLatam(fila[15]),
        alerta: fila[16] || null,
        fechaDecision,
        anioDecision: fila[18] ? parseInt(fila[18], 10) : null,
        mesDecision: fila[19] ? parseInt(fila[19], 10) : null,
        numeroAutoDecision: fila[20] || null,
        textoDecision: fila[21] || null,
        numeroUsurpacionFecha: fila[22] || null,
        segundaDecisionFlag: fila[23] || null,
        recursoEjercido: fila[24] || null,
        fechaRecurso: parsearFechaLatam(fila[25]),
        numeroDecisionRecurso: fila[26] || null,
        fechaEmisionRecurso: parsearFechaLatam(fila[27]),
        textoDecisionRecurso: fila[28] || null,
        observaciones: fila[29] || null,
        sancionResumen: fila[30] || null,
        sancionadoNombre: fila[31] || null,
        multaUcfvf,
        multaUsd,
        cumplimientoDecision: fila[34] || 'PENDIENTE',
        motivoCumplimiento: fila[35] || null,
        diasSustanciacion,
      },
    });
    procesados++;
  }

  console.log(`Sincronización completada: ${procesados} expedientes actualizados.`);
}