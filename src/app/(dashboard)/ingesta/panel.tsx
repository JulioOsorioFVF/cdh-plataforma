'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  aprobarPdfParaAgenteAction,
  adjuntarPdfAction,
  confirmarCargaLoteAction,
  importarPdfDriveAction,
  previsualizarLoteAction,
  previsualizarPdfAction,
  type ResultadoAccion,
} from './acciones';

type Expediente = { id: number; numero: string; anio: number; motivo: string | null };
type Documento = {
  id: number;
  nombre: string;
  expedienteId: number;
  subidoEn: string;
  indexado: boolean;
  expediente: { numero: string; anio: number };
};
type Lote = {
  id: number;
  archivo: string | null;
  estado: string;
  filasLeidas: number;
  filasValidas: number;
  filasAdvertencia: number;
  filasRechazadas: number;
  filasCargadas: number;
  mensaje: string | null;
  iniciadaEn: string;
};
type VistaPrevia = {
  loteId: number;
  filasLeidas: number;
  validas: number;
  advertencias: number;
  rechazadas: number;
  omitidas: number;
  esquema: { ok: boolean; faltantes: string[]; sobrantes: string[] };
  muestra: Array<{ numero: string; anio: string }>;
};

function avisoClases(ok: boolean) {
  return ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-rose-200 bg-rose-50 text-rose-900';
}

export function PanelIngestaHistorica({
  expedientes,
  documentos,
  lotes,
  documentosTotales,
  precedentesAprobados,
  carpetaDriveConfigurada,
}: {
  expedientes: Expediente[];
  documentos: Documento[];
  lotes: Lote[];
  documentosTotales: number;
  precedentesAprobados: number;
  carpetaDriveConfigurada: boolean;
}) {
  const router = useRouter();
  const [vistaPrevia, setVistaPrevia] = useState<VistaPrevia | null>(null);
  const [aviso, setAviso] = useState<ResultadoAccion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [pdfEnRevision, setPdfEnRevision] = useState<number | null>(null);
  const [textoAnonimizado, setTextoAnonimizado] = useState('');
  const [confirmacionAnonimizado, setConfirmacionAnonimizado] = useState(false);
  const [mensajeRevision, setMensajeRevision] = useState<string | null>(null);
  const [documentoIndexadoLocal, setDocumentoIndexadoLocal] = useState<number[]>([]);
  const [erroresDrive, setErroresDrive] = useState<string[]>([]);
  const hayCargaActiva = lotes.some((lote) => lote.estado === 'PROCESANDO');

  useEffect(() => {
    if (!hayCargaActiva) return;
    const intervalo = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(intervalo);
  }, [hayCargaActiva, router]);

  async function previsualizar(formulario: FormData) {
    setProcesando(true);
    setAviso(null);
    setVistaPrevia(null);
    const respuesta = await previsualizarLoteAction(formulario);
    if (respuesta.ok) {
      setVistaPrevia(respuesta.recepcion);
    } else {
      setAviso({ ok: false, mensaje: respuesta.mensaje });
    }
    setProcesando(false);
    router.refresh();
  }

  async function confirmarCarga() {
    if (!vistaPrevia) return;
    setProcesando(true);
    const respuesta = await confirmarCargaLoteAction(vistaPrevia.loteId);
    setAviso(respuesta);
    setProcesando(false);
    if (respuesta.ok) {
      setVistaPrevia(null);
      router.refresh();
    }
  }

  async function adjuntar(formulario: FormData) {
    setProcesando(true);
    const respuesta = await adjuntarPdfAction(formulario);
    setAviso(respuesta);
    setProcesando(false);
    if (respuesta.ok) router.refresh();
  }

  async function importarDrive() {
    setProcesando(true);
    setAviso(null);
    const respuesta = await importarPdfDriveAction();
    setAviso({ ok: respuesta.ok, mensaje: respuesta.mensaje });
    setErroresDrive(respuesta.errores ?? []);
    setProcesando(false);
    router.refresh();
  }

  async function revisarPdf(documentoId: number) {
    setProcesando(true);
    setAviso(null);
    setMensajeRevision(null);
    const respuesta = await previsualizarPdfAction(documentoId);
    if (respuesta.ok) {
      setPdfEnRevision(documentoId);
      setTextoAnonimizado(respuesta.textoAnonimizado);
      setMensajeRevision(respuesta.mensaje);
      setConfirmacionAnonimizado(false);
    } else {
      setAviso({ ok: false, mensaje: respuesta.mensaje });
    }
    setProcesando(false);
  }

  async function aprobarPdf() {
    if (pdfEnRevision === null) return;
    setProcesando(true);
    const respuesta = await aprobarPdfParaAgenteAction(
      pdfEnRevision,
      textoAnonimizado,
      confirmacionAnonimizado,
    );
    setAviso(respuesta);
    setProcesando(false);
    if (respuesta.ok) {
      setDocumentoIndexadoLocal((actuales) => [...actuales, pdfEnRevision]);
      setPdfEnRevision(null);
      setTextoAnonimizado('');
      setConfirmacionAnonimizado(false);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm font-semibold tracking-wide text-oro-700 uppercase">Operación</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-vin-950">
          Importación histórica
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-soft">
          Importa expedientes desde el cuadro CSV/Excel y asocia sus documentos PDF. El PDF se
          procesa localmente; solo un texto anonimizado, revisado y aprobado por una persona
          puede llegar al índice del agente jurídico.
        </p>
      </header>

      {aviso && (
        <p role="status" className={`rounded-lg border p-3 text-sm ${avisoClases(aviso.ok)}`}>
          {aviso.mensaje}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-ink-soft">Expedientes disponibles</p>
          <p className="mt-1 text-2xl font-semibold text-vin-950">{expedientes.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-ink-soft">PDF asociados</p>
          <p className="mt-1 text-2xl font-semibold text-vin-950">{documentosTotales}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-ink-soft">Pendientes de revisión</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">
            {Math.max(0, documentosTotales - precedentesAprobados)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-ink-soft">Aprobados para el agente</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">{precedentesAprobados}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-vin-950">
          1. Importar cuadro de expedientes
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Se conserva el orden original de las columnas, incluso cuando los encabezados se
          repiten. Primero se valida; la carga requiere confirmación explícita.
        </p>
        <form action={previsualizar} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium text-ink">
            Archivo CSV o XLSX (máx. 20 MB)
            <input
              name="archivo"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={procesando}
            className="rounded-md bg-vin-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vin-800 disabled:opacity-50"
          >
            {procesando ? 'Validando…' : 'Validar y previsualizar'}
          </button>
        </form>

        {vistaPrevia && (
          <div className="bg-surface-muted mt-5 rounded-lg border border-border p-4">
            <h3 className="font-semibold text-vin-950">
              Vista previa del lote #{vistaPrevia.loteId}
            </h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-soft">Filas leídas</dt>
                <dd className="font-semibold">{vistaPrevia.filasLeidas}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Válidas</dt>
                <dd className="font-semibold text-emerald-800">{vistaPrevia.validas}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Con advertencias</dt>
                <dd className="font-semibold text-amber-800">{vistaPrevia.advertencias}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Rechazadas</dt>
                <dd className="font-semibold text-rose-800">{vistaPrevia.rechazadas}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Omitidas</dt>
                <dd className="font-semibold">{vistaPrevia.omitidas}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Contrato de columnas</dt>
                <dd className="font-semibold">
                  {vistaPrevia.esquema.ok ? 'Correcto' : 'No coincide'}
                </dd>
              </div>
            </dl>
            {vistaPrevia.muestra.length > 0 && (
              <p className="mt-3 text-xs text-ink-soft">
                Muestra (número/año):{' '}
                {vistaPrevia.muestra.map((fila) => `${fila.numero}/${fila.anio}`).join(' · ')}
              </p>
            )}
            {!vistaPrevia.esquema.ok && (
              <p className="mt-3 text-sm text-rose-800">
                Faltan columnas requeridas:{' '}
                {vistaPrevia.esquema.faltantes.join(', ') || 'ninguna'}.
              </p>
            )}
            <button
              type="button"
              disabled={
                procesando ||
                !vistaPrevia.esquema.ok ||
                vistaPrevia.validas + vistaPrevia.advertencias === 0
              }
              onClick={confirmarCarga}
              className="mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Confirmar carga de {vistaPrevia.validas + vistaPrevia.advertencias} filas
              aceptadas
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-vin-950">
          2. Asociar PDFs a expedientes
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Los archivos quedan fuera de la carpeta pública con un nombre interno aleatorio. Los
          PDF importados desde Drive deben incluir su código de expediente en el nombre, por
          ejemplo EXP-012-2025.pdf.
        </p>
        <form
          action={adjuntar}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <label className="text-sm font-medium text-ink">
            Expediente
            <select
              name="expedienteId"
              required
              className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2"
            >
              <option value="">Selecciona expediente</option>
              {expedientes.map((expediente) => (
                <option key={expediente.id} value={expediente.id}>
                  {expediente.numero}/{expediente.anio} · {expediente.motivo || 'Sin motivo'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            PDF (máx. 25 MB)
            <input
              name="archivo"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={procesando}
            className="rounded-md bg-vin-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Adjuntar PDF
          </button>
        </form>
        {carpetaDriveConfigurada ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={procesando}
              onClick={importarDrive}
              className="rounded-md border border-vin-800 px-4 py-2 text-sm font-semibold text-vin-900 hover:bg-vin-50 disabled:opacity-50"
            >
              {procesando ? 'Procesando…' : 'Importar PDFs de Google Drive'}
            </button>
            {erroresDrive.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-rose-800">
                {erroresDrive.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-soft">
            Para habilitar Drive, configura la carpeta y la cuenta de servicio en las variables
            de entorno.
          </p>
        )}

        <h3 className="mt-6 font-semibold text-vin-950">Documentos recientes</h3>
        {documentos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Todavía no hay documentos asociados.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-ink-soft">
                <tr>
                  <th className="py-2 pr-3">Expediente</th>
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2 pr-3">Estado IA</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documentos.map((documento) => {
                  const indexado =
                    documento.indexado || documentoIndexadoLocal.includes(documento.id);
                  return (
                    <tr key={documento.id}>
                      <td className="py-2 pr-3 font-medium">
                        {documento.expediente.numero}/{documento.expediente.anio}
                      </td>
                      <td className="py-2 pr-3">{documento.nombre}</td>
                      <td className="py-2 pr-3">
                        {indexado ? 'Aprobado e indexado' : 'Pendiente de revisión'}
                      </td>
                      <td className="flex gap-3 py-2">
                        <a
                          className="text-vin-800 underline"
                          href={`/ingesta/documento/${documento.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PDF
                        </a>
                        {!indexado && (
                          <button
                            type="button"
                            disabled={procesando}
                            onClick={() => revisarPdf(documento.id)}
                            className="text-vin-800 underline disabled:opacity-50"
                          >
                            Revisar texto
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pdfEnRevision !== null && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-950">Revisión humana antes de indexar</h3>
            <p className="mt-1 text-sm text-amber-900">
              Este texto es solo una sugerencia de redacción automática. Revisa nombres, clubes,
              identificaciones, teléfonos, menores y cualquier detalle que permita identificar a
              una persona. El contenido original no se envía al proveedor de IA.
            </p>
            {mensajeRevision && (
              <p className="mt-2 text-sm text-amber-900">{mensajeRevision}</p>
            )}
            <label className="mt-3 block text-sm font-medium text-ink">
              Texto anonimizado que se propondrá al agente
              <textarea
                value={textoAnonimizado}
                onChange={(evento) => setTextoAnonimizado(evento.target.value)}
                rows={10}
                maxLength={100000}
                className="mt-1 w-full rounded-md border border-border bg-white p-3 text-sm text-ink"
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={confirmacionAnonimizado}
                onChange={(evento) => setConfirmacionAnonimizado(evento.target.checked)}
                className="mt-1"
              />
              Revisé el texto editado y confirmé que no contiene nombres ni datos que
              identifiquen a las partes o a menores.
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={procesando || !confirmacionAnonimizado}
                onClick={aprobarPdf}
                className="rounded-md bg-vin-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {procesando ? 'Indexando…' : 'Aprobar e indexar'}
              </button>
              <button
                type="button"
                onClick={() => setPdfEnRevision(null)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-vin-950">
          3. Progreso de cargas
        </h2>
        {lotes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Aún no se han creado lotes de importación.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-ink-soft">
                <tr>
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Archivo</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Válidas / cargadas</th>
                  <th className="py-2">Rechazadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lotes.map((lote) => (
                  <tr key={lote.id}>
                    <td className="py-2 pr-3">#{lote.id}</td>
                    <td className="py-2 pr-3">{lote.archivo || '—'}</td>
                    <td className="py-2 pr-3">
                      <span>{lote.estado}</span>
                      {lote.estado === 'PROCESANDO' && (
                        <progress
                          className="mt-1 block h-2 w-32 accent-emerald-700"
                          max={Math.max(lote.filasValidas + lote.filasAdvertencia, 1)}
                          value={lote.filasCargadas}
                          aria-label={`Carga del lote ${lote.id}`}
                        />
                      )}
                      {lote.estado === 'CON_ERRORES' && lote.mensaje && (
                        <p className="mt-1 max-w-xs text-xs text-rose-800">{lote.mensaje}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {lote.filasCargadas} / {lote.filasValidas + lote.filasAdvertencia}
                    </td>
                    <td className="py-2">{lote.filasRechazadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
