/** Navegacion principal del Consejo de Honor. */

export const NAVEGACION = [
  {
    grupo: 'Analisis',
    items: [
      { href: '/dashboard', etiqueta: 'Tablero general', icono: 'grid' },
      { href: '/sanciones', etiqueta: 'Sanciones', icono: 'gavel' },
      { href: '/expedientes', etiqueta: 'Expedientes', icono: 'folder' },
      { href: '/incidencias', etiqueta: 'Incidencias', icono: 'alert' },
      { href: '/administracion', etiqueta: 'Administracion y multas', icono: 'wallet' },
    ],
  },
  {
    grupo: 'Inspiracional',
    items: [
      { href: '/inspiracional', etiqueta: 'Plan de accion', icono: 'target' },
      { href: '/inspiracional/kpis', etiqueta: 'Pilares y KPIs', icono: 'chart' },
    ],
  },
  {
    grupo: 'Operacion',
    items: [
      { href: '/ocr', etiqueta: 'Actas y OCR', icono: 'scan' },
      { href: '/ingesta', etiqueta: 'Sincronizacion', icono: 'refresh' },
      { href: '/usuarios', etiqueta: 'Usuarios y roles', icono: 'users' },
      { href: '/auditoria', etiqueta: 'Auditoria', icono: 'history' },
    ],
  },
] as const;
