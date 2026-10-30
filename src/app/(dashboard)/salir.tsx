'use client';

import { useFormStatus } from 'react-dom';
import { salir } from '@/server/auth/acciones';

/** Cierra la sesion borrando la cookie y vuelve al ingreso. */
export function BotonSalir() {
  const { pending } = useFormStatus();

  return (
    <form action={salir}>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
      >
        {pending ? 'Saliendo...' : 'Cerrar sesion'}
      </button>
    </form>
  );
}
