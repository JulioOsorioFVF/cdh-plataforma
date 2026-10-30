'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { cambiarContrasena, type ResultadoForm } from '@/server/auth/acciones';
import { REGLAS_CONTRASENA } from '@/lib/auth/reglas';

const INICIO: ResultadoForm = { ok: false };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? 'Guardando...' : 'Guardar contrasena y continuar'}
    </button>
  );
}

function Campo({
  id,
  name,
  etiqueta,
  autoComplete,
  error,
}: {
  id: string;
  name: string;
  etiqueta: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {etiqueta}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `error-${id}` : undefined}
      />
      {error ? (
        <p id={`error-${id}`} className="mt-1 text-xs text-vene-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormularioCambiarContrasena() {
  const [estado, accion] = useActionState(cambiarContrasena, INICIO);

  if (estado.ok) {
    return (
      <div className="card space-y-4 p-6">
        <p role="status" className="badge semaforo-cumple w-full justify-center py-2 text-xs">
          Contrasena actualizada.
        </p>
        <p className="text-center text-sm text-ink-soft">
          Ya puede continuar. Si esta pagina no avanza sola, recarguela.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="card space-y-4 p-6">
      <Campo
        id="actual"
        name="actual"
        etiqueta="Contrasena actual"
        autoComplete="current-password"
        error={estado.campos?.actual}
      />
      <Campo
        id="nueva"
        name="nueva"
        etiqueta="Contrasena nueva"
        autoComplete="new-password"
        error={estado.campos?.nueva}
      />
      <Campo
        id="repetir"
        name="repetir"
        etiqueta="Repita la contrasena nueva"
        autoComplete="new-password"
        error={estado.campos?.repetir}
      />

      {estado.error && !estado.campos ? (
        <p role="alert" className="badge badge-roja w-full justify-center py-2 text-xs">
          {estado.error}
        </p>
      ) : null}

      <BotonGuardar />
    </form>
  );
}

/** Reglas de la contrasena, visibles antes de escribir. */
export function ReglasContrasena() {
  return (
    <ul className="mt-4 space-y-1 text-xs text-ink-faint">
      {REGLAS_CONTRASENA.map((r) => (
        <li key={r}>· {r}</li>
      ))}
    </ul>
  );
}
