'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ingresar, type ResultadoForm } from '@/server/auth/acciones';

const INICIO: ResultadoForm = { ok: false };

/** Boton que se deshabilita mientras la accion corre, para no duplicar el envio. */
function BotonIngresar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? 'Verificando...' : 'Ingresar'}
    </button>
  );
}

export function FormularioIngresar({ next }: { next: string }) {
  const [estado, accion] = useActionState(ingresar, INICIO);

  return (
    <form action={accion} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="input"
          aria-invalid={estado.campos?.email ? true : undefined}
          aria-describedby={estado.campos?.email ? 'error-email' : undefined}
        />
        {estado.campos?.email ? (
          <p id="error-email" className="mt-1 text-xs text-vene-rojo">
            {estado.campos.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
          Contrasena
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          aria-invalid={estado.campos?.password ? true : undefined}
          aria-describedby={estado.campos?.password ? 'error-password' : undefined}
        />
        {estado.campos?.password ? (
          <p id="error-password" className="mt-1 text-xs text-vene-rojo">
            {estado.campos.password}
          </p>
        ) : null}
      </div>

      {estado.error ? (
        <p role="alert" className="badge badge-roja w-full justify-center py-2 text-xs">
          {estado.error}
        </p>
      ) : null}

      <BotonIngresar />
    </form>
  );
}
