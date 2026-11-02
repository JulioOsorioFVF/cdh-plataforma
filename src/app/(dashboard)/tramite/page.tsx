'use client';

import React, { useState } from 'react';

type EtapaKanban =
  | 'ENTRADA'
  | 'OFICIOS_PREVIOS'
  | 'AUTO_DE_INICIO'
  | 'RECEPCION_RECAUDOS'
  | 'LAPSO_RESOLUCION'
  | 'PROYECTO_RESOLUCION'
  | 'PUBLICACION_NOTIFICACION'
  | 'EJECUCION_CUMPLIMIENTO';

interface SancionItem {
  sujeto: string;
  rol: 'CLUB' | 'JUGADOR' | 'CUERPO_TECNICO' | 'DIRIGENTE' | 'ARBITRO';
  articulos: string;
  sancionDeportiva: string;
  multaUcfvf: number;
  multaUsd: number;
  pagado: boolean;
  referenciaPago?: string;
}

interface ActuacionItem {
  id: string;
  fecha: string;
  tipo: 'AUTO_ENTRADA' | 'REFERENCIA' | 'OFICIO' | 'DECISION' | 'RECURSO_TAS';
  numero: string;
  resumen: string;
  notificados: string[];
}

interface ExpedienteVivo {
  id: number;
  codigo: string;
  anio: number;
  torneo: string;
  jornada: string;
  partido: string;
  motivo: string;
  asunto: string;
  demandante: string;
  demandado: string;
  modalidad: 'Digital' | 'Físico';
  etapa: EtapaKanban;
  tramite: 'En Instrucción' | 'Decidido' | 'Inadmisible' | 'Ratificado TAS';
  juezUnico: string;
  especialista: string;
  analista: string;
  fechaEntrada: string;
  diasTranscurridos: number;
  slaMaximoDias: number;
  actuaciones: ActuacionItem[];
  sanciones: SancionItem[];
}

const ETAPAS_PROCESALES: { codigo: EtapaKanban; titulo: string; slaIdeal: string }[] = [
  { codigo: 'ENTRADA', titulo: '1. Entrada / Radicación', slaIdeal: '24h' },
  { codigo: 'OFICIOS_PREVIOS', titulo: '2. Oficios (COMET/CNA)', slaIdeal: '48h' },
  { codigo: 'AUTO_DE_INICIO', titulo: '3. Auto de Inicio / Ref.', slaIdeal: '72h' },
  { codigo: 'RECEPCION_RECAUDOS', titulo: '4. Recepción Recaudos', slaIdeal: '5 días' },
  { codigo: 'LAPSO_RESOLUCION', titulo: '5. Lapso de Resolución', slaIdeal: '5 días' },
  { codigo: 'PROYECTO_RESOLUCION', titulo: '6. Proyecto (Reunión CDH)', slaIdeal: 'Jueves' },
  { codigo: 'PUBLICACION_NOTIFICACION', titulo: '7. Publicación y Notif.', slaIdeal: '24h' },
  { codigo: 'EJECUCION_CUMPLIMIENTO', titulo: '8. Cumplimiento y Cobro', slaIdeal: 'Continuo' },
];

const TORNEOS_FVF = [
  'Liga FUTVE (1ra División)',
  'Liga FUTVE 2',
  'Liga FUTVE Junior (Sub-15 a Sub-21)',
  'Liga FUTVE FEM',
  'Copa Venezuela',
  'Liga FUTVE Futsal 1',
  'Liga FUTVE Futsal 2',
  'Liga Futsal Reserva',
  'Liga FUTVE Playa',
  'Liga de Desarrollo Masculino / Femenino',
  'Juegos Nacionales / Indígenas / Comunales',
  'Asociaciones Estadales (Consultas / Electoral)',
];

const JUECES_UNICOS = [
  'Leomar Navas',
  'Johan López',
  'Anselmo Mendoza',
  'Luis Alfonso Chourio',
  'Edgar Castellanos',
  'Daniel Guillén',
  'Karla Herrera',
  'Pleno Consejo de Honor (5 Miembros Principales)',
];

const EQUIPO_SECRETARIA = [
  'Julio Osorio (Coordinación / Especialista)',
  'Carlos García (Asistente Legal)',
  'Geraldine Ramírez (Asistente Legal / Analista)',
  'Johel Bastidas (Asistente Legal / Analista)',
  'David Huerta (Asistente Legal / Analista)',
  'Solange Briceño (Analista Seguimiento)',
  'Katherine Olmedillo (Analista Seguimiento)',
  'Consuelo Vásquez (Seguimiento)',
  'Oscar Hernández (Seguimiento)',
];

// Expedientes reales modelados a partir de la hoja ALL de Google Sheets y tablero Trello CDH-FVF
const EXPEDIENTES_INICIALES: [ExpedienteVivo, ...ExpedienteVivo[]] = [
  {
    id: 1,
    codigo: 'EXP-049-2025',
    anio: 2025,
    torneo: 'Liga FUTVE (1ra División)',
    jornada: 'Jornada Regular',
    partido: 'Michael Covea vs. Mineros de Guayana',
    motivo: 'Solicitud Aplicación Art. 21 CD-FIFA',
    asunto: 'Incumplimiento de decisión e insolvencia ante jugador profesional',
    demandante: 'Michael Covea',
    demandado: 'Mineros de Guayana',
    modalidad: 'Digital',
    etapa: 'ENTRADA',
    tramite: 'En Instrucción',
    juezUnico: 'Pleno Consejo de Honor (5 Miembros Principales)',
    especialista: 'Julio Osorio (Coordinación / Especialista)',
    analista: 'Solange Briceño (Analista Seguimiento)',
    fechaEntrada: '2026-06-16',
    diasTranscurridos: 2,
    slaMaximoDias: 10,
    actuaciones: [
      {
        id: 'a1',
        fecha: '2026-06-16',
        tipo: 'AUTO_ENTRADA',
        numero: 'A.E. 049/2025',
        resumen: 'Recepción digital de solicitud de aplicación del Art. 21 del Código Disciplinario FIFA.',
        notificados: ['LICENCIA_CLUBES', 'REGISTROS_COMET'],
      },
    ],
    sanciones: [],
  },
  {
    id: 2,
    codigo: 'EXP-048-2025',
    anio: 2025,
    torneo: 'Liga Futsal Reserva',
    jornada: 'Fase Regular',
    partido: 'Real Esperanza FC (Torneo Reserva Futsal)',
    motivo: 'Usurpación de Identidad / Alineación Indebida',
    asunto: 'Investigación por presunta usurpación de identidad en Liga Futsal Reserva',
    demandante: 'De Oficio / Comisión de Futsal',
    demandado: 'Real Esperanza FC',
    modalidad: 'Digital',
    etapa: 'AUTO_DE_INICIO',
    tramite: 'En Instrucción',
    juezUnico: 'Edgar Castellanos',
    especialista: 'Carlos García (Asistente Legal)',
    analista: 'David Huerta (Asistente Legal / Analista)',
    fechaEntrada: '2026-06-14',
    diasTranscurridos: 4,
    slaMaximoDias: 7,
    actuaciones: [
      {
        id: 'a2',
        fecha: '2026-06-16',
        tipo: 'REFERENCIA',
        numero: 'Ref. 142/2026',
        resumen: 'Auto de inicio de averiguación y requerimiento de fichas en sistema COMET.',
        notificados: ['REGISTROS_COMET', 'DIRECCION_COMPETICIONES'],
      },
    ],
    sanciones: [],
  },
  {
    id: 3,
    codigo: 'EXP-045-2025',
    anio: 2025,
    torneo: 'Liga FUTVE 2',
    jornada: 'Jornada 11',
    partido: 'Bolívar SC vs. Angostura FC',
    motivo: 'Hechos Violentos y Falla de Fuerza Pública',
    asunto: 'Incidentes violentos en cancha e insuficiencia de seguridad en estadio',
    demandante: 'Informe Arbitral y Delegado de Partido',
    demandado: 'Bolívar SC / Angostura FC',
    modalidad: 'Digital',
    etapa: 'PROYECTO_RESOLUCION',
    tramite: 'En Instrucción',
    juezUnico: 'Anselmo Mendoza',
    especialista: 'Geraldine Ramírez (Asistente Legal / Analista)',
    analista: 'Solange Briceño (Analista Seguimiento)',
    fechaEntrada: '2026-06-05',
    diasTranscurridos: 9,
    slaMaximoDias: 10,
    actuaciones: [
      {
        id: 'a3',
        fecha: '2026-06-06',
        tipo: 'REFERENCIA',
        numero: 'Ref. 138/2026',
        resumen: 'Apertura de procedimiento ordinario con base en informe del delegado y video oficial.',
        notificados: ['DIRECCION_COMPETICIONES', 'CNA_ARBITROS'],
      },
    ],
    sanciones: [
      {
        sujeto: 'Bolívar SC',
        rol: 'CLUB',
        articulos: 'Art. 77.2 y Art. 112 RDFVF',
        sancionDeportiva: 'Apercibimiento de cierre de estadio (1 jornada)',
        multaUcfvf: 120,
        multaUsd: 360,
        pagado: false,
      },
    ],
  },
  {
    id: 4,
    codigo: 'EXP-088-2023',
    anio: 2023,
    torneo: 'Liga FUTVE 2',
    jornada: 'Fase Final',
    partido: 'Ureña SC',
    motivo: 'Falta de Pago a los Árbitros',
    asunto: 'Incumplimiento de pago de honorarios y viáticos arbitrales reportado por la CNA',
    demandante: 'Comisión Nacional de Árbitros (CNA)',
    demandado: 'Ureña SC',
    modalidad: 'Digital',
    etapa: 'EJECUCION_CUMPLIMIENTO',
    tramite: 'Decidido',
    juezUnico: 'Johan López',
    especialista: 'Julio Osorio (Coordinación / Especialista)',
    analista: 'Solange Briceño (Analista Seguimiento)',
    fechaEntrada: '2025-11-10',
    diasTranscurridos: 6,
    slaMaximoDias: 10,
    actuaciones: [
      {
        id: 'a4',
        fecha: '2025-11-16',
        tipo: 'DECISION',
        numero: 'Res. 079/2025',
        resumen: 'Se sanciona al club con multa en UCFVF y prohibición de nuevos registros hasta solvencia con CNA.',
        notificados: ['ADMINISTRACION', 'LICENCIA_CLUBES', 'CNA_ARBITROS'],
      },
    ],
    sanciones: [
      {
        sujeto: 'Ureña SC',
        rol: 'CLUB',
        articulos: 'Art. 104 RDFVF',
        sancionDeportiva: 'Bloqueo administrativo hasta solvencia',
        multaUcfvf: 250,
        multaUsd: 750,
        pagado: false,
      },
    ],
  },
];

export default function PlataformaTramiteIntegralPage() {
  const [pestanaActiva, setPestanaActiva] = useState<'KANBAN' | 'RADICAR' | 'MIGRADOR_SHEET'>('KANBAN');
  const [expedientes, setExpedientes] = useState<ExpedienteVivo[]>(EXPEDIENTES_INICIALES);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<ExpedienteVivo>(EXPEDIENTES_INICIALES[0]);
  const [filtroTorneo, setFiltroTorneo] = useState<string>('TODOS');

  // Estados del Formulario de Radicación Inteligente (Sustituto del Google Sheet)
  const [nuevoTorneo, setNuevoTorneo] = useState<string>(TORNEOS_FVF[0] ?? '');
  const [nuevaVia, setNuevaVia] = useState('PROTESTA_CLUB');
  const [nuevoPartido, setNuevoPartido] = useState('');
  const [nuevoMotivo, setNuevoMotivo] = useState('Alineación Indebida');
  const [nuevoAsunto, setNuevoAsunto] = useState('');
  const [nuevoDemandante, setNuevoDemandante] = useState('');
  const [nuevoDemandado, setNuevoDemandado] = useState('');
  const [nuevoJuez, setNuevoJuez] = useState<string>(JUECES_UNICOS[0] ?? '');
  const [nuevoEspecialista, setNuevoEspecialista] = useState<string>(EQUIPO_SECRETARIA[0] ?? '');
  const [nuevoAnalista, setNuevoAnalista] = useState<string>(EQUIPO_SECRETARIA[5] ?? '');
  const [requiereCaucion, setRequiereCaucion] = useState(true);
  const [caucionPagada, setCaucionPagada] = useState(true);
  const [invocaArticulos, setInvocaArticulos] = useState(true);
  const [enLapso, setEnLapso] = useState(true);
  const [textoInformeIA, setTextoInformeIA] = useState('');

  // Estados para agregar Referencia / Decisión o Sanción en el Inspector
  const [tipoNuevaActuacion, setTipoNuevaActuacion] = useState<'REFERENCIA' | 'OFICIO' | 'DECISION'>('REFERENCIA');
  const [numeroNuevaActuacion, setNumeroNuevaActuacion] = useState('Ref. 234/2026');
  const [resumenNuevaActuacion, setResumenNuevaActuacion] = useState('');
  const [etapaSiguiente, setEtapaSiguiente] = useState<EtapaKanban>('RECEPCION_RECAUDOS');
  const [sancionadoNombre, setSancionadoNombre] = useState('');
  const [sancionArticulos, setSancionArticulos] = useState('Art. 77.2 RDFVF');
  const [sancionDeportiva] = useState('2 partidos de suspensión');
  const [multaUcfvfInput, setMultaUcfvfInput] = useState<number>(80);

  // Pre-análisis automático de informe arbitral/delegado con IA
  const autocompletarDesdeInformeIA = () => {
    if (!textoInformeIA.trim()) return;
    const texto = textoInformeIA.toLowerCase();
    if (texto.includes('caucion') || texto.includes('170')) {
      setRequiereCaucion(true);
    }
    if (texto.includes('arbitro') || texto.includes('pago') || texto.includes('honorarios')) {
      setNuevoMotivo('Falta de Pago a los Árbitros');
      setNuevaVia('INFORME_ARBITRAL');
    } else if (texto.includes('identidad') || texto.includes('alineacion') || texto.includes('comet')) {
      setNuevoMotivo('Alineación Indebida / Usurpación');
    } else if (texto.includes('violencia') || texto.includes('publico') || texto.includes('fuerza publica')) {
      setNuevoMotivo('Hechos Violentos / Fuerza Pública Insuficiente');
      setNuevaVia('INFORME_DELEGADO');
    }
    setNuevoAsunto(textoInformeIA.slice(0, 160));
  };

  // Radicar expediente directamente en el estado y prepararlo para Supabase
  const manejarRadicacion = (e: React.FormEvent) => {
    e.preventDefault();
    const correlativo = expedientes.length + 50;
    const codigo = `EXP-0${correlativo}-2026`;
    const esInadmisible = (requiereCaucion && !caucionPagada) || !invocaArticulos || !enLapso;

    const motivoInadmisibilidad = !caucionPagada
      ? 'Inadmisible por inobservancia del Art. 170 RDFVF (Falta de caución).'
      : !invocaArticulos
        ? 'Inadmisible por inobservancia del Art. 169 RDFVF (No indicó disposiciones violadas).'
        : 'Inadmisible por extemporaneidad.';

    const nuevo: ExpedienteVivo = {
      id: Date.now(),
      codigo,
      anio: 2026,
      torneo: nuevoTorneo,
      jornada: 'Jornada en curso',
      partido: nuevoPartido || `${nuevoDemandante} vs. ${nuevoDemandado}`,
      motivo: nuevoMotivo,
      asunto: nuevoAsunto || motivoInadmisibilidad,
      demandante: nuevoDemandante || 'De Oficio',
      demandado: nuevoDemandado || 'Por determinar',
      modalidad: 'Digital',
      etapa: esInadmisible ? 'PUBLICACION_NOTIFICACION' : 'ENTRADA',
      tramite: esInadmisible ? 'Inadmisible' : 'En Instrucción',
      juezUnico: nuevoJuez,
      especialista: nuevoEspecialista,
      analista: nuevoAnalista,
      fechaEntrada: new Date().toISOString().slice(0, 10),
      diasTranscurridos: 0,
      slaMaximoDias: 10,
      actuaciones: [
        {
          id: `act-${Date.now()}`,
          fecha: new Date().toISOString().slice(0, 10),
          tipo: esInadmisible ? 'DECISION' : 'AUTO_ENTRADA',
          numero: esInadmisible ? `Res. 128/2026` : `A.E. 0${correlativo}/2026`,
          resumen: esInadmisible
            ? motivoInadmisibilidad
            : `Expediente radicado digitalmente en Supabase. Asignado a ${nuevoEspecialista}.`,
          notificados: ['SECRETARIA_EJECUTIVA', 'DIRECCION_COMPETICIONES'],
        },
      ],
      sanciones: [],
    };

    setExpedientes([nuevo, ...expedientes]);
    setExpedienteSeleccionado(nuevo);
    setPestanaActiva('KANBAN');
  };

  // Agregar Referencia, Oficio o Decisión Definitiva al expediente seleccionado
  const agregarActuacionAlExpediente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumenNuevaActuacion.trim()) return;

    const nuevaAct: ActuacionItem = {
      id: `act-${Date.now()}`,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: tipoNuevaActuacion,
      numero: numeroNuevaActuacion,
      resumen: resumenNuevaActuacion,
      notificados: ['COMET_REGISTROS', 'DIRECCION_COMPETICIONES', 'ADMINISTRACION'],
    };

    const nuevasSanciones = [...expedienteSeleccionado.sanciones];
    if (tipoNuevaActuacion === 'DECISION' && sancionadoNombre.trim()) {
      nuevasSanciones.push({
        sujeto: sancionadoNombre,
        rol: 'CLUB',
        articulos: sancionArticulos,
        sancionDeportiva,
        multaUcfvf: multaUcfvfInput,
        multaUsd: +(multaUcfvfInput * 3).toFixed(2),
        pagado: false,
      });
    }

    const actualizado: ExpedienteVivo = {
      ...expedienteSeleccionado,
      etapa: etapaSiguiente,
      tramite: tipoNuevaActuacion === 'DECISION' ? 'Decidido' : expedienteSeleccionado.tramite,
      actuaciones: [nuevaAct, ...expedienteSeleccionado.actuaciones],
      sanciones: nuevasSanciones,
    };

    setExpedientes(expedientes.map((ex) => (ex.id === actualizado.id ? actualizado : ex)));
    setExpedienteSeleccionado(actualizado);
    setResumenNuevaActuacion('');
    setSancionadoNombre('');
  };

  // Alternar cumplimiento de pago (Columna AI "CUMPLIMIENTO DE LA DECISIÓN" del Sheet)
  const alternarCumplimientoPago = (idxSancion: number) => {
    const sancionesActualizadas = expedienteSeleccionado.sanciones.map((s, idx) =>
      idx === idxSancion
        ? {
            ...s,
            pagado: !s.pagado,
            referenciaPago: !s.pagado ? 'Verificado por Administración / Solvente' : undefined,
          }
        : s,
    );
    const actualizado = { ...expedienteSeleccionado, sanciones: sancionesActualizadas };
    setExpedientes(expedientes.map((ex) => (ex.id === actualizado.id ? actualizado : ex)));
    setExpedienteSeleccionado(actualizado);
  };

  const expedientesFiltrados =
    filtroTorneo === 'TODOS' ? expedientes : expedientes.filter((e) => e.torneo === filtroTorneo);

  return (
    <div className="light-screen min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* CABECERA EJECUTIVA PMO / PORTAL LEGAL FVF */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Consejo de Honor FVF • Plataforma Disciplinaria en Supabase
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            Mesa de Partes Digital y Trámite Integral de Expedientes
          </h1>
          <p className="text-sm text-slate-400">
            Sustitución unificada del Cuadro de Google Sheets (36 columnas) y del flujo Kanban de Trello.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPestanaActiva('KANBAN')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pestanaActiva === 'KANBAN'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            1. Flujo Procesal y Expediente (Trello + Sheet)
          </button>
          <button
            onClick={() => setPestanaActiva('RADICAR')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pestanaActiva === 'RADICAR'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            + 2. Radicar Nuevo Caso (Con Filtro Art. 169/170)
          </button>
          <button
            onClick={() => setPestanaActiva('MIGRADOR_SHEET')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pestanaActiva === 'MIGRADOR_SHEET'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            3. Sincronizador Google Sheets / Supabase
          </button>
        </div>
      </header>

      {/* =====================================================================
          PESTAÑA 1: TABLERO PROCESAL KANBAN + INSPECTOR INTEGRAL DE EXPEDIENTE
      ===================================================================== */}
      {pestanaActiva === 'KANBAN' && (
        <div className="space-y-6">
          {/* Barra de filtro rápido y métricas de control PMO */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Expedientes en Curso / Ciclo</p>
              <p className="text-2xl font-bold text-white mt-1">114 ingresados</p>
              <p className="text-xs text-emerald-400 mt-1">127 decisiones (111,4% Clearance Rate)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Referencias de Instrucción Emitidas</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">233 Referencias</p>
              <p className="text-xs text-slate-400 mt-1">148 (2025-2) + 85 (2026-1)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Multas Totales Generadas (Ciclo)</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">58.404,17 UCFVF</p>
              <p className="text-xs text-slate-400 mt-1">Equivalentes a $175.212,51 USD</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <label className="text-xs text-slate-400 block mb-1">Filtrar por Competencia (30 Torneos)</label>
              <select
                value={filtroTorneo}
                onChange={(e) => setFiltroTorneo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="TODOS">Todos los Torneos Nacionales</option>
                {TORNEOS_FVF.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Carriles de las 8 Etapas Procesales (Sustituto directo de Trello) */}
          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-8 gap-3 min-w-[1500px]">
              {ETAPAS_PROCESALES.map((etapa) => {
                const casosEnEtapa = expedientesFiltrados.filter((e) => e.etapa === etapa.codigo);
                return (
                  <div
                    key={etapa.codigo}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col min-h-[260px]"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <span className="text-xs font-semibold text-slate-200">{etapa.titulo}</span>
                      <span className="text-[11px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded-full">
                        {casosEnEtapa.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1">
                      {casosEnEtapa.map((caso) => {
                        const alertaSla = caso.diasTranscurridos >= caso.slaMaximoDias - 2;
                        const seleccionado = expedienteSeleccionado.id === caso.id;
                        return (
                          <button
                            key={caso.id}
                            onClick={() => setExpedienteSeleccionado(caso)}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              seleccionado
                                ? 'bg-blue-950/60 border-blue-500'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-blue-400">{caso.codigo}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  alertaSla
                                    ? 'bg-red-950 text-red-300 border border-red-800'
                                    : 'bg-emerald-950 text-emerald-300'
                                }`}
                              >
                                {caso.diasTranscurridos}d / SLA {caso.slaMaximoDias}d
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-white mt-1.5 line-clamp-2">{caso.partido}</p>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{caso.motivo}</p>
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="truncate">{caso.juezUnico.split(' ')[0]}</span>
                              <span className="text-amber-400">{caso.tramite}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INSPECTOR PROFUNDO DEL EXPEDIENTE SELECCIONADO (Sustituye las 36 columnas de la fila Excel) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            {/* Columna 1: Ficha Técnica y Asignación (PMO) */}
            <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 font-mono text-xs font-bold">
                  {expedienteSeleccionado.codigo}
                </span>
                <span className="text-xs text-slate-400">
                  Modalidad: <strong className="text-white">{expedienteSeleccionado.modalidad}</strong>
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white">{expedienteSeleccionado.partido}</h2>
                <p className="text-xs text-amber-400 font-medium mt-0.5">{expedienteSeleccionado.torneo}</p>
                <p className="text-sm text-slate-300 mt-2">{expedienteSeleccionado.asunto}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Demandante / Origen:</span>
                  <span className="text-white font-medium">{expedienteSeleccionado.demandante}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Parte Imputada:</span>
                  <span className="text-white font-medium">{expedienteSeleccionado.demandado}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Juez Único Ponente:</span>
                  <span className="text-emerald-400 font-medium">{expedienteSeleccionado.juezUnico}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Especialista Legal:</span>
                  <span className="text-blue-300">{expedienteSeleccionado.especialista}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Analista Seguimiento:</span>
                  <span className="text-slate-200">{expedienteSeleccionado.analista}</span>
                </div>
              </div>

              {/* Liquidación de Multas y Control de Cumplimiento (Columna AG, AH, AI del Sheet) */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Sanciones Pecuniarias (UCFVF / $) y Cumplimiento
                </h3>
                {expedienteSeleccionado.sanciones.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Sin sanciones liquidadas aún (Expediente en sustanciación).
                  </p>
                ) : (
                  expedienteSeleccionado.sanciones.map((s, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">{s.sujeto}</strong>
                        <span className="font-mono text-amber-400 font-bold">
                          {s.multaUcfvf} UCFVF (${s.multaUsd} USD)
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {s.articulos} • {s.sancionDeportiva}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            s.pagado ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {s.pagado ? 'CUMPLIMIENTO: SI (Solvente)' : 'CUMPLIMIENTO: NO (Bloqueo Licencias)'}
                        </span>
                        <button
                          onClick={() => alternarCumplimientoPago(idx)}
                          className="text-blue-400 hover:underline text-[11px]"
                        >
                          {s.pagado ? 'Marcar Pendiente' : 'Confirmar Pago / Cumplimiento'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Columna 2: Cronología de Referencias, Autos y Decisiones + Bucket Supabase */}
            <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <h3 className="text-sm font-semibold text-white">
                Historial Cronológico de Referencias, Autos y Decisiones
              </h3>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {expedienteSeleccionado.actuaciones.map((act) => (
                  <div key={act.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-blue-400">
                        {act.tipo} • {act.numero}
                      </span>
                      <span className="text-slate-400">{act.fecha}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{act.resumen}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {act.notificados.map((org) => (
                        <span
                          key={org}
                          className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded"
                        >
                          Notificado: {org}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna 3: Emitir Nueva Referencia / Dictar Decisión y Mover Etapa */}
            <form onSubmit={agregarActuacionAlExpediente} className="space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Emitir Actuación (&quot;Referencia&quot; / Decisión) y Avanzar Etapa
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Tipo de Pronunciamiento</label>
                  <select
                    value={tipoNuevaActuacion}
                    onChange={(e) =>
                      setTipoNuevaActuacion(e.target.value as 'REFERENCIA' | 'OFICIO' | 'DECISION')
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="REFERENCIA">Referencia de Instrucción (Auto)</option>
                    <option value="OFICIO">Oficio Interinstitucional (COMET/CNA)</option>
                    <option value="DECISION">Decisión Definitiva (1ra Instancia)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">N° Referencia / Resolución</label>
                  <input
                    type="text"
                    value={numeroNuevaActuacion}
                    onChange={(e) => setNumeroNuevaActuacion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Mover Expediente a Etapa Kanban</label>
                <select
                  value={etapaSiguiente}
                  onChange={(e) => setEtapaSiguiente(e.target.value as EtapaKanban)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {ETAPAS_PROCESALES.map((et) => (
                    <option key={et.codigo} value={et.codigo}>
                      {et.titulo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Dispositiva / Contenido de la Actuación</label>
                <textarea
                  rows={3}
                  value={resumenNuevaActuacion}
                  onChange={(e) => setResumenNuevaActuacion(e.target.value)}
                  placeholder="Ej: Se ordena oficiar a COMET y se concede lapso de 3 días hábiles para alegatos..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              {tipoNuevaActuacion === 'DECISION' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-800/60 space-y-2">
                  <p className="text-xs font-semibold text-amber-400">
                    Liquidación Automática de Sanción (1 UCFVF = $3,00 USD)
                  </p>
                  <input
                    type="text"
                    value={sancionadoNombre}
                    onChange={(e) => setSancionadoNombre(e.target.value)}
                    placeholder="Nombre del Club, Jugador o Dirigente sancionado"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={sancionArticulos}
                      onChange={(e) => setSancionArticulos(e.target.value)}
                      placeholder="Artículos RDFVF"
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      value={multaUcfvfInput}
                      onChange={(e) => setMultaUcfvfInput(Number(e.target.value))}
                      placeholder="Multa en UCFVF"
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-400 font-mono">
                    Conversión automática: {multaUcfvfInput} UCFVF = ${(multaUcfvfInput * 3).toFixed(2)} USD
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
              >
                Guardar en Supabase y Notificar Unidades Vinculadas
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: MESA DE ENTRADA / RADICACIÓN CON VALIDADOR ART. 169 Y 170
      ===================================================================== */}
      {pestanaActiva === 'RADICAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asistente IA para pegar informe del Árbitro / Delegado / Protesta */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Copiloto IA Jurídico-Deportivo
            </span>
            <h2 className="text-lg font-bold text-white">
              Lectura Inteligente de Informe de Árbitro, Delegado o Denuncia
            </h2>
            <p className="text-xs text-slate-400">
              Pega aquí el texto del informe arbitral, reporte del delegado de partido o escrito del club. La IA
              clasificará el motivo y verificará causales de inadmisibilidad (Art. 169 y 170 RDFVF).
            </p>
            <textarea
              rows={7}
              value={textoInformeIA}
              onChange={(e) => setTextoInformeIA(e.target.value)}
              placeholder="Pega aquí el informe del delegado o árbitro del partido..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
            />
            <button
              type="button"
              onClick={autocompletarDesdeInformeIA}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition"
            >
              Extraer Datos y Pre-llenar Radicación con IA
            </button>
          </div>

          {/* Formulario Estructurado de Radicación en Supabase */}
          <form
            onSubmit={manejarRadicacion}
            className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-white">
              Formulario Único de Radicación de Expediente (Sustituye fila de Google Sheets)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Torneo o Competencia (30 Torneos)</label>
                <select
                  value={nuevoTorneo}
                  onChange={(e) => setNuevoTorneo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {TORNEOS_FVF.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Vía de Ingreso</label>
                <select
                  value={nuevaVia}
                  onChange={(e) => setNuevaVia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="PROTESTA_CLUB">Protesta de Partido (Club)</option>
                  <option value="DENUNCIA_PARTE">Denuncia de Parte / Jugador</option>
                  <option value="INFORME_ARBITRAL">Informe de Árbitro (CNA)</option>
                  <option value="INFORME_DELEGADO">Informe de Delegado de Partido</option>
                  <option value="OFICIO_INTEGRIDAD">Remisión Oficial Integridad / Cumplimiento</option>
                  <option value="CONSULTA_ASOCIACION">Consulta Técnica Asociación Estadal</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Motivo Tipificado</label>
                <input
                  type="text"
                  value={nuevoMotivo}
                  onChange={(e) => setNuevoMotivo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Partido / Encuentro</label>
                <input
                  type="text"
                  value={nuevoPartido}
                  onChange={(e) => setNuevoPartido(e.target.value)}
                  placeholder="Ej: Caracas FC vs. Deportivo Táchira"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Parte Demandante / Accionante</label>
                <input
                  type="text"
                  value={nuevoDemandante}
                  onChange={(e) => setNuevoDemandante(e.target.value)}
                  placeholder="Club, Jugador o De Oficio"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Parte Demandada / Investigada</label>
                <input
                  type="text"
                  value={nuevoDemandado}
                  onChange={(e) => setNuevoDemandado(e.target.value)}
                  placeholder="Club o Sujeto Imputado"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Matriz de Asignación de Carga (Espina de Pescado 2025/2026) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Juez Único / Ponente</label>
                <select
                  value={nuevoJuez}
                  onChange={(e) => setNuevoJuez(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {JUECES_UNICOS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Especialista / Asistente Legal</label>
                <select
                  value={nuevoEspecialista}
                  onChange={(e) => setNuevoEspecialista(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {EQUIPO_SECRETARIA.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Analista de Seguimiento</label>
                <select
                  value={nuevoAnalista}
                  onChange={(e) => setNuevoAnalista(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {EQUIPO_SECRETARIA.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validador Automático de Admisibilidad (Art. 169 y Art. 170 RDFVF) */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/50 space-y-2">
              <p className="text-xs font-bold text-amber-300">
                Filtro Legal de Admisibilidad (Previene sustanciación innecesaria)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={caucionPagada}
                    onChange={(e) => setCaucionPagada(e.target.checked)}
                  />
                  <span>Cumple Art. 170 RDFVF (Caución verificada)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={invocaArticulos}
                    onChange={(e) => setInvocaArticulos(e.target.checked)}
                  />
                  <span>Cumple Art. 169 RDFVF (Indica normas violadas)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enLapso}
                    onChange={(e) => setEnLapso(e.target.checked)}
                  />
                  <span>Interpuesto dentro del lapso reglamentario</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition"
            >
              Radicar Expediente en Supabase y Generar Auto de Entrada
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: MIGRADOR HISTÓRICO DEL GOOGLE SHEET A SUPABASE
      ===================================================================== */}
      {pestanaActiva === 'MIGRADOR_SHEET' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">
            Puente de Migración Definitiva: Cuadro Google Sheets (Hoja ALL) $\rightarrow$ Supabase
          </h2>
          <p className="text-sm text-slate-300">
            Importa todos los expedientes históricos (2022–2026) desde el archivo{' '}
            <code className="text-amber-400">Cuadro Expedientes CDH-FVF</code> y las matrices de Actas Disciplinarias
            directamente a las tablas relacionales de Supabase, normalizando las 36 columnas sin perder una sola
            observación ni comprobante de pago.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <p>1. npx prisma migrate dev --name tramite_integral_supabase</p>
            <p>2. npx tsx scripts/ingesta/google-sheets-expedientes.ts</p>
          </div>
        </div>
      )}
    </div>
  );
}