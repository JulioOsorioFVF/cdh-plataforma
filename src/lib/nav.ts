/** Navegación principal e interactiva del Consejo de Honor de la FVF */

export interface SubmenuItem {
  etiqueta: string;
  href: string;
  icono: string;
  descripcion?: string;
  badge?: string;
}

export interface ItemNavegacion {
  href: string;
  etiqueta: string;
  icono: string;
  descripcion?: string;
  badge?: string;
  submenus?: SubmenuItem[];
}

export interface GrupoNavegacion {
  grupo: string;
  icono: string;
  items: ItemNavegacion[];
}

export const NAVEGACION: GrupoNavegacion[] = [
  {
    grupo: 'Gestión Procesal e IA',
    icono: '⚖️',
    items: [
      {
        href: '/dashboard',
        etiqueta: 'Tablero General',
        icono: '📊',
        descripcion: 'Visión ejecutiva del Consejo de Honor, actividad reciente y alertas.',
      },
      {
        href: '/expedientes',
        etiqueta: 'Expedientes & Kanban',
        icono: '📁',
        badge: 'Activo',
        descripcion: 'Flujo visual continuo de expedientes por fases procesales (Trello-style).',
        submenus: [
          {
            etiqueta: 'Tablero Kanban Continuo',
            href: '/expedientes',
            icono: '📋',
            descripcion: 'Arrastra y clasifica expedientes en las 6 fases reglamentarias.',
          },
          {
            etiqueta: 'Registrar Nuevo Expediente',
            href: '/expedientes?accion=nuevo',
            icono: '➕',
            descripcion: 'Apertura formal de procedimiento con partes y torneo.',
          },
          {
            etiqueta: 'Auditoría de Fases & SLA',
            href: '/expedientes?vista=fases',
            icono: '⏱️',
            descripcion: 'Monitoreo de tiempos de despacho y plazos por vencer.',
          },
        ],
      },
      {
        href: '/ingesta',
        etiqueta: 'Centro Data Analyst & Ingesta IA',
        icono: '🔬',
        badge: 'Nuevo',
        descripcion: 'Intake de PDFs grandes, extracción en 7 dimensiones y persistencia a PostgreSQL.',
        submenus: [
          {
            etiqueta: 'Intake & Dropzone de PDFs',
            href: '/ingesta',
            icono: '📥',
            descripcion: 'Procesamiento multipart de expedientes pesados y actas.',
          },
          {
            etiqueta: 'Data Analyst (7 Dimensiones)',
            href: '/ingesta?tab=ESTRUCTURACION',
            icono: '🔍',
            descripcion: 'Normalización de partes, testigos, normas, argumentos y baremos.',
          },
          {
            etiqueta: 'Abogado Deportivo (TAS / FVF)',
            href: '/ingesta?tab=ABOGADO_DEPORTIVO',
            icono: '⚖️',
            descripcion: 'Excepciones previas, estándar probatorio TAS y dictamen forense.',
          },
          {
            etiqueta: 'Project Manager & SLA',
            href: '/ingesta?tab=PROJECT_MANAGER',
            icono: '🚦',
            descripcion: 'Control de días hábiles, semáforo de descargos y emisión de autos.',
          },
          {
            etiqueta: 'Carga Masiva por Lotes',
            href: '/ingesta?tab=LOTES_EXCEL',
            icono: '📑',
            descripcion: 'Importación masiva de históricos en hojas Excel y CSV.',
          },
        ],
      },
      {
        href: '/tramite',
        etiqueta: 'Trámite Procesal y Autos',
        icono: '📜',
        descripcion: 'Gestión formal de autos interlocutorios y resoluciones del Consejo.',
        submenus: [
          {
            etiqueta: 'Registro de Actuaciones',
            href: '/tramite',
            icono: '📑',
            descripcion: 'Listado cronológico de movimientos procesales y despachos.',
          },
          {
            etiqueta: 'Emisión de Autos Oficiales',
            href: '/tramite?vista=autos',
            icono: '✍️',
            descripcion: 'Generador de providencias con correlativo anual automatizado.',
          },
          {
            etiqueta: 'Notificaciones Oficiales',
            href: '/tramite?vista=notificaciones',
            icono: '🔔',
            descripcion: 'Control de cómputo de términos a partir de la notificación.',
          },
        ],
      },
      {
        href: '/agente-ia',
        etiqueta: 'Agente IA Disciplinario & RAG',
        icono: '🤖',
        descripcion: 'Consultor jurídico inteligente entrenado con jurisprudencia TAS, FIFA y FVF.',
        submenus: [
          {
            etiqueta: 'Consultor Jurídico RAG',
            href: '/agente-ia',
            icono: '🧠',
            descripcion: 'Preguntas al cuerpo normativo con citas a artículos exactos.',
          },
          {
            etiqueta: 'Memoria Vectorial & Laudos TAS',
            href: '/agente-ia?vista=memoria',
            icono: '📚',
            descripcion: 'Precedentes históricos indexados en espacio vectorial 768d.',
          },
          {
            etiqueta: 'Redactor de Proyectos de Decisión',
            href: '/agente-ia?vista=redactor',
            icono: '📝',
            descripcion: 'Elaboración de proyectos de auto y resolución sancionatoria.',
          },
        ],
      },
      {
        href: '/indicadores',
        etiqueta: 'Indicadores y Métricas',
        icono: '📈',
        descripcion: 'Panel analítico, KPIs cuantitativos, multas en UCFVF/USD y simulador TAS.',
        submenus: [
          {
            etiqueta: 'Dashboard General de KPIs',
            href: '/indicadores',
            icono: '📊',
            descripcion: 'Volumen de casos, distribución por torneo e impacto pecuniario.',
          },
          {
            etiqueta: 'Auditoría de Multas (UCFVF/USD)',
            href: '/indicadores?modal=multas',
            icono: '💰',
            descripcion: 'Recaudación disciplinaria y conversión a tasa oficial BCV.',
          },
          {
            etiqueta: 'Matriz de Riesgo y Reincidencia',
            href: '/indicadores?modal=riesgo',
            icono: '⚠️',
            descripcion: 'Índices de peligrosidad disciplinaria por club y jugador.',
          },
          {
            etiqueta: 'Simulador Predictivo TAS / FVF',
            href: '/indicadores?modal=simulador',
            icono: '🔮',
            descripcion: 'Estimación de penas basada en laudos CAS y doctrina vinculante.',
          },
        ],
      },
    ],
  },
  {
    grupo: 'Justicia y Finanzas',
    icono: '🏛️',
    items: [
      {
        href: '/sanciones',
        etiqueta: 'Registro de Sanciones',
        icono: '⚖️',
        descripcion: 'Catálogo oficial de sanciones deportivas y pecuniarias ejecutoriadas.',
        submenus: [
          {
            etiqueta: 'Sanciones a Futbolistas',
            href: '/sanciones?tipo=jugador',
            icono: '🏃',
            descripcion: 'Suspensiones por partidos, tarjetas acumuladas y conductas antideportivas.',
          },
          {
            etiqueta: 'Sanciones a Clubes y Directivos',
            href: '/sanciones?tipo=club',
            icono: '🛡️',
            descripcion: 'Pérdidas de puntos, clausuras de estadio y multas institucionales.',
          },
          {
            etiqueta: 'Historial de Reincidentes',
            href: '/sanciones?filtro=reincidentes',
            icono: '🔁',
            descripcion: 'Agravantes por reiteración de faltas dentro del certamen.',
          },
        ],
      },
      {
        href: '/finanzas',
        etiqueta: 'Finanzas, Multas y Pagos',
        icono: '💰',
        descripcion: 'Control económico de multas en UCFVF, tasa de cambio BCV y estados de pago.',
        submenus: [
          {
            etiqueta: 'Liquidación en UCFVF y USD',
            href: '/finanzas',
            icono: '💵',
            descripcion: 'Cálculo automatizado a razón de $3.00 USD por UCFVF.',
          },
          {
            etiqueta: 'Control de Pagos y Depósitos',
            href: '/finanzas?vista=pagos',
            icono: '💳',
            descripcion: 'Comprobantes de pago bancario y conciliación de cuentas.',
          },
          {
            etiqueta: 'Solvencias Disciplinarias',
            href: '/finanzas?vista=solvencias',
            icono: '📄',
            descripcion: 'Constancias de paz y salvo para inscripción y transferencias.',
          },
        ],
      },
      {
        href: '/evaluacion',
        etiqueta: 'Matriz de Evaluación',
        icono: '🎯',
        descripcion: 'Parámetros objetivos de dosimetría punitiva y ponderación de sana crítica.',
        submenus: [
          {
            etiqueta: 'Baremos Punitivos Oficiales',
            href: '/evaluacion',
            icono: '⚖️',
            descripcion: 'Tablas de gravedad (Leve, Grave, Muy Grave) según RDFVF.',
          },
          {
            etiqueta: 'Ponderación de Agravantes y Atenuantes',
            href: '/evaluacion?vista=dosimetria',
            icono: '📐',
            descripcion: 'Modulación de penas por Arts. 16 y 17 del Código Disciplinario.',
          },
        ],
      },
      {
        href: '/incidencias',
        etiqueta: 'Incidencias y Licencias',
        icono: '🚨',
        descripcion: 'Control de licencias federativas, bloqueos COMET y medidas cautelares.',
        submenus: [
          {
            etiqueta: 'Bloqueos e Inhabilitaciones Cautelares',
            href: '/incidencias',
            icono: '🚫',
            descripcion: 'Medidas provisionales preventivas dictadas durante la instrucción.',
          },
          {
            etiqueta: 'Licencia de Clubes FVF',
            href: '/incidencias?vista=licencias',
            icono: '🏟️',
            descripcion: 'Cumplimiento normativo para competencias nacionales e internacionales.',
          },
        ],
      },
    ],
  },
  {
    grupo: 'Operación, Big Data y Auditoría',
    icono: '⚙️',
    items: [
      {
        href: '/plataforma',
        etiqueta: 'Directorio de Funciones (Suite)',
        icono: '🧭',
        badge: 'Hub',
        descripcion: 'Mapa integral interactivo de todas las herramientas y capacidades del sistema.',
      },
      {
        href: '/ocr',
        etiqueta: 'Actas Arbitrales y OCR',
        icono: '📷',
        descripcion: 'Digitalización automática y extracción óptica de informes de árbitros.',
        submenus: [
          {
            etiqueta: 'Digitalización de Planillas',
            href: '/ocr',
            icono: '📄',
            descripcion: 'Escaneo y OCR de actas físicas y planillas de juego.',
          },
          {
            etiqueta: 'Cruce con Sistema COMET',
            href: '/ocr?vista=comet',
            icono: '🔍',
            descripcion: 'Validación cruzada de alineaciones y amonestaciones oficiales.',
          },
        ],
      },
      {
        href: '/usuarios',
        etiqueta: 'Usuarios y Roles',
        icono: '👥',
        descripcion: 'Gestión de miembros del Consejo de Honor, jueces únicos y secretarios.',
        submenus: [
          {
            etiqueta: 'Jueces y Miembros de Sala',
            href: '/usuarios?rol=juez',
            icono: '👨‍⚖️',
            descripcion: 'Asignación de expedientes y ponencias a jueces del Consejo.',
          },
          {
            etiqueta: 'Oficiales de Cumplimiento',
            href: '/usuarios?rol=oficial',
            icono: '🛡️',
            descripcion: 'Acceso especial para Oficialía de Integridad y Ética.',
          },
        ],
      },
      {
        href: '/auditoria',
        etiqueta: 'Bitácora de Auditoría',
        icono: '📜',
        descripcion: 'Trazabilidad criptográfica, sellos de tiempo y registro de todas las operaciones.',
        submenus: [
          {
            etiqueta: 'Registro de Eventos',
            href: '/auditoria',
            icono: '🕒',
            descripcion: 'Historial inmutable de creación, edición y resolución de expedientes.',
          },
          {
            etiqueta: 'Firmas Digitales y Sellos',
            href: '/auditoria?vista=firmas',
            icono: '🔏',
            descripcion: 'Verificación de autenticidad y validez conforme al Art. 161 RDFVF.',
          },
        ],
      },
    ],
  },
];
