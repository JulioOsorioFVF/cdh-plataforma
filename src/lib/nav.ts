/** Navegacion principal del Consejo de Honor. */

export const NAVEGACION = [
  {
    grupo: 'Gestión Procesal e IA',
    items: [
      { href: '/dashboard', etiqueta: 'Tablero General', icono: 'grid' },
      { href: '/expedientes', etiqueta: 'Expedientes (Kanban)', icono: 'folder' },
      { href: '/tramite', etiqueta: 'Trámite Procesal y Autos', icono: 'file-text' },
      { href: '/agente-ia', etiqueta: 'Agente IA Disciplinario & RAG', icono: 'cpu' },
      { href: '/indicadores', etiqueta: 'Indicadores y Métricas', icono: 'chart' },
    ],
  },
  {
    grupo: 'Justicia y Finanzas',
    items: [
      { href: '/sanciones', etiqueta: 'Registro de Sanciones', icono: 'gavel' },
      { href: '/finanzas', etiqueta: 'Finanzas, Multas y Pagos', icono: 'wallet' },
      { href: '/evaluacion', etiqueta: 'Matriz de Evaluación Disciplinaria', icono: 'target' },
      { href: '/incidencias', etiqueta: 'Incidencias y Licencias', icono: 'alert' },
    ],
  },
  {
    grupo: 'Operación y Big Data',
    items: [
      { href: '/ingesta', etiqueta: 'Sincronización de Datos', icono: 'refresh' },
      { href: '/ocr', etiqueta: 'Actas Arbitrales y OCR', icono: 'scan' },
      { href: '/usuarios', etiqueta: 'Usuarios y Roles', icono: 'users' },
      { href: '/auditoria', etiqueta: 'Bitácora de Auditoría', icono: 'history' },
    ],
  },
] as const;
