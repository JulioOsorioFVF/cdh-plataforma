import { obtenerFormatosProcesalesAction } from '@/server/formatos/acciones';
import { VistaFormatos } from './vista-formatos';

export const metadata = {
  title: 'Gestor de Formatos y Plantillas Procesales | Consejo de Honor FVF',
  description: 'Centro de administración, aprendizaje e ingesta de formatos y estructuras procesales del Consejo de Honor de la FVF.',
};

export default async function FormatosPage() {
  const formatos = await obtenerFormatosProcesalesAction();

  return <VistaFormatos formatosIniciales={formatos} />;
}
