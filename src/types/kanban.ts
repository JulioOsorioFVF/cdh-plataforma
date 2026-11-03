export type EstadoExpediente =
  | 'RECIBIDO'
  | 'EN_ESTUDIO'
  | 'RESUELTO'
  | 'NOTIFICADO'
  | 'EN_RECURSO'
  | 'ARCHIVADO'
  | 'DESESTIMADO'
  | 'REMITIDO';

export const EstadoExpediente = {
  RECIBIDO: 'RECIBIDO',
  EN_ESTUDIO: 'EN_ESTUDIO',
  RESUELTO: 'RESUELTO',
  NOTIFICADO: 'NOTIFICADO',
  EN_RECURSO: 'EN_RECURSO',
  ARCHIVADO: 'ARCHIVADO',
  DESESTIMADO: 'DESESTIMADO',
  REMITIDO: 'REMITIDO',
} as const;

export type TipoParte =
  | 'JUGADOR'
  | 'CUERPO_TECNICO'
  | 'CLUB'
  | 'COMISION'
  | 'LIGA'
  | 'ORGANIZADOR'
  | 'FVF'
  | 'OTRO';

export const TipoParte = {
  JUGADOR: 'JUGADOR',
  CUERPO_TECNICO: 'CUERPO_TECNICO',
  CLUB: 'CLUB',
  COMISION: 'COMISION',
  LIGA: 'LIGA',
  ORGANIZADOR: 'ORGANIZADOR',
  FVF: 'FVF',
  OTRO: 'OTRO',
} as const;

export interface CrearExpedienteInput {
  numero?: string;
  anio: number;
  nombre?: string;
  motivo: string;
  subMotivo?: string;
  ligaTorneo: string;
  equipos?: string;
  asignado?: string;
  modalidad?: string;
  alerta?: string;
  estado?: EstadoExpediente;
  notas?: string;
  partes?: Array<{
    nombre: string;
    tipo: TipoParte;
    cedula?: string;
  }>;
}

export interface ExpedienteTarjetaKanban {
  id: number;
  numero: string;
  anio: number;
  nombre: string | null;
  motivo: string | null;
  subMotivo: string | null;
  ligaTorneo: string | null;
  equipos: string | null;
  asignado: string | null;
  alerta: string | null;
  estatus: string;
  estado: EstadoExpediente;
  numeroDecision: string | null;
  sancionRaw: string | null;
  sancionadoRaw: string | null;
  multaUc: number | null;
  multaUsd: number | null;
  fechaRecepcion: Date | null;
  fechaResolucion: Date | null;
  fechaAutoEntrada: Date | null;
  modalidad: string | null;
  notas: string | null;
  totalMovimientos: number;
  totalPartes: number;
}

export interface ColumnaKanban {
  estado: EstadoExpediente;
  titulo: string;
  colorBorde: string;
  colorBadge: string;
  icono: string;
  descripcion: string;
  expedientes: ExpedienteTarjetaKanban[];
}

export const COLUMNAS_KANBAN_CONFIG: {
  estado: EstadoExpediente;
  titulo: string;
  colorBorde: string;
  colorBadge: string;
  icono: string;
  descripcion: string;
}[] = [
  {
    estado: EstadoExpediente.RECIBIDO,
    titulo: 'Recibidos / Por Iniciar',
    colorBorde: 'border-blue-500',
    colorBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    icono: '📥',
    descripcion: 'Informes de árbitros o protestas recién ingresadas, pendientes de admisibilidad.',
  },
  {
    estado: EstadoExpediente.EN_ESTUDIO,
    titulo: 'En Instrucción / Análisis',
    colorBorde: 'border-amber-500',
    colorBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    icono: '🔍',
    descripcion: 'Auto de Entrada emitido, fase probatoria y descargos en curso.',
  },
  {
    estado: EstadoExpediente.EN_RECURSO,
    titulo: 'En Reconsideración',
    colorBorde: 'border-purple-500',
    colorBadge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    icono: '⚖️',
    descripcion: 'Recurso de Reconsideración presentado dentro del lapso de 3 días.',
  },
  {
    estado: EstadoExpediente.RESUELTO,
    titulo: 'Resueltos / Con Decisión',
    colorBorde: 'border-emerald-600',
    colorBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    icono: '📜',
    descripcion: 'Resolución o decisión definitiva dictada por el Consejo de Honor.',
  },
  {
    estado: EstadoExpediente.NOTIFICADO,
    titulo: 'Notificados (COMET)',
    colorBorde: 'border-teal-600',
    colorBadge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    icono: '📬',
    descripcion: 'Fallo formalmente notificado a las partes y registrado en el sistema COMET.',
  },
  {
    estado: EstadoExpediente.DESESTIMADO,
    titulo: 'Desestimados / Inadmisibles',
    colorBorde: 'border-rose-500',
    colorBadge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    icono: '❌',
    descripcion: 'Protestas inadmisibles (sin caución Art. 170 o extemporáneas).',
  },
  {
    estado: EstadoExpediente.ARCHIVADO,
    titulo: 'Archivados / Concluidos',
    colorBorde: 'border-slate-500',
    colorBadge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-300',
    icono: '📁',
    descripcion: 'Expedientes cerrados, firmes o con cumplimiento de sanción verificado.',
  },
];
