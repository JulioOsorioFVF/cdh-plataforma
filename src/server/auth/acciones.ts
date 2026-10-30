'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  COOKIE_SESION,
  DURACION_SESION_SEG,
  emitirToken,
  opcionesCookie,
} from '@/lib/auth/token';
import { hashearContrasena, verificarContrasena } from '@/lib/auth/password';
import { PASSWORD_ESTANDAR, validarContrasena } from '@/lib/auth/reglas';
import { obtenerSesion, requiereSesion, versionClave } from './sesion';

/**
 * Acciones de autenticacion.
 *
 * Todas devuelven el mismo tipo de resultado para que el formulario pueda
 * pintar errores sin que se escape una excepcion: la unica excepcion posible
 * es un redirect de Next.
 */

export type ResultadoForm = {
  ok: boolean;
  error?: string;
  /** Errores por campo, para marcar los inputs. */
  campos?: Record<string, string>;
};

/** Espera constante para no revelar por tiempo si el correo existe. */
const RETARDO_FALLO_MS = 400;

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function registrarAuditoria(entrada: {
  entidad: string;
  entidadId: string;
  operacion: string;
  cambios?: unknown;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
}): Promise<void> {
  try {
    const h = await headers();
    await prisma.bitacora_auditoria.create({
      data: {
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        operacion: entrada.operacion,
        cambios:
          entrada.cambios === undefined
            ? undefined
            : JSON.parse(JSON.stringify(entrada.cambios)),
        usuarioId: entrada.usuarioId ?? null,
        usuarioNombre: entrada.usuarioNombre ?? null,
        ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: h.get('user-agent'),
      },
    });
  } catch {
    // La bitacora nunca debe impedir una operacion valida.
  }
}

/** Limpia espacios y baja a minusculas un correo. */
function normalizarEmail(v: FormDataEntryValue | null): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

/** Normaliza numero y temporada: "08/2025" -> "8", " 2025 " -> 2025. */
function numeroDeTexto(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

/**
 * Destino posterior al ingreso. Solo se aceptan rutas internas, para que un
 * `next=https://sitio-malicioso` no convierta el login en un redireccionador
 * abierto.
 */
function destinoSeguro(next: FormDataEntryValue | null): string {
  const s = String(next ?? '');
  if (!s.startsWith('/') || s.startsWith('//')) return '/dashboard';
  return s;
}

/** Fija la cookie de sesion y regenera la version de clave del usuario. */
async function abrirSesion(usuarioId: number, version: number): Promise<void> {
  const token = await emitirToken(usuarioId, version);
  (await cookies()).set(COOKIE_SESION, token, opcionesCookie(DURACION_SESION_SEG));
}

// -----------------------------------------------------------------------------
// Ingreso
// -----------------------------------------------------------------------------

export async function ingresar(prev: ResultadoForm, datos: FormData): Promise<ResultadoForm> {
  void prev;

  const email = normalizarEmail(datos.get('email'));
  const clave = String(datos.get('password') ?? '');
  const campos: Record<string, string> = {};

  if (!email) campos['email'] = 'Escriba su correo.';
  if (!clave) campos['password'] = 'Escriba su contrasena.';
  if (Object.keys(campos).length > 0) {
    return { ok: false, error: 'Revise los campos marcados.', campos };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nombre: true,
      activo: true,
      passwordHash: true,
      debeCambiarPassword: true,
      passwordActualizadoEn: true,
    },
  });

  // Se verifica siempre, exista o no el usuario, para que el tiempo de respuesta
  // no revele que correos estan dados de alta.
  const hash = usuario?.passwordHash ?? hashearContrasena('placeholder-no-existe');
  const coincide = verificarContrasena(clave, hash);

  if (!usuario || !coincide) {
    await dormir(RETARDO_FALLO_MS);
    await registrarAuditoria({
      entidad: 'usuario',
      entidadId: email,
      operacion: 'LOGIN_FALLIDO',
      usuarioNombre: email,
    });
    return { ok: false, error: 'Correo o contrasena incorrectos.' };
  }

  if (!usuario.activo) {
    await dormir(RETARDO_FALLO_MS);
    await registrarAuditoria({
      entidad: 'usuario',
      entidadId: String(usuario.id),
      operacion: 'LOGIN_BLOQUEADO',
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
    });
    return { ok: false, error: 'Su cuenta esta desactivada. Contacte al administrador.' };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcceso: new Date() },
  });

  await abrirSesion(usuario.id, versionClave(usuario.passwordActualizadoEn));

  await registrarAuditoria({
    entidad: 'usuario',
    entidadId: String(usuario.id),
    operacion: 'LOGIN',
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
  });

  const destino = destinoSeguro(datos.get('next'));
  redirect(usuario.debeCambiarPassword ? '/cambiar-password' : destino);
}

// -----------------------------------------------------------------------------
// Salida
// -----------------------------------------------------------------------------

export async function salir(): Promise<void> {
  const sesion = await obtenerSesion();
  if (sesion) {
    await registrarAuditoria({
      entidad: 'usuario',
      entidadId: String(sesion.id),
      operacion: 'LOGOUT',
      usuarioId: sesion.id,
      usuarioNombre: sesion.nombre,
    });
  }
  (await cookies()).delete(COOKIE_SESION);
  redirect('/ingresar');
}

// -----------------------------------------------------------------------------
// Cambio de contrasena por el propio usuario
// -----------------------------------------------------------------------------

export async function cambiarContrasena(
  prev: ResultadoForm,
  datos: FormData,
): Promise<ResultadoForm> {
  void prev;

  const sesion = await obtenerSesion();
  if (!sesion) {
    // Sin sesion no se puede validar la clave actual: es el caso del
    // restablecimiento del administrador, que usa su propia accion.
    return { ok: false, error: 'Su sesion expiro. Ingrese de nuevo.' };
  }

  const actual = String(datos.get('actual') ?? '');
  const nueva = String(datos.get('nueva') ?? '');
  const repetir = String(datos.get('repetir') ?? '');
  const campos: Record<string, string> = {};

  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.id },
    select: { id: true, nombre: true, email: true, passwordHash: true },
  });
  if (!usuario) return { ok: false, error: 'Su sesion expiro. Ingrese de nuevo.' };

  if (!actual) campos['actual'] = 'Escriba su contrasena actual.';
  else if (!verificarContrasena(actual, usuario.passwordHash)) {
    campos['actual'] = 'La contrasena actual no coincide.';
  }

  if (!nueva) campos['nueva'] = 'Escriba la contrasena nueva.';
  else {
    const errores = validarContrasena(nueva);
    if (errores.length > 0) campos['nueva'] = errores[0]!;
    else if (nueva === actual) campos['nueva'] = 'La contrasena nueva debe ser distinta.';
  }

  if (nueva !== repetir) campos['repetir'] = 'Las contrasenas no coinciden.';

  if (Object.keys(campos).length > 0) {
    return { ok: false, error: 'Revise los campos marcados.', campos };
  }

  const ahora = new Date();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: hashearContrasena(nueva),
      passwordActualizadoEn: ahora,
      debeCambiarPassword: false,
      cambiosPassword: { increment: 1 },
    },
  });

  // La version cambio: el token anterior ya no vale. Se emite uno nuevo para no
  // expulsar al usuario de la sesion que acaba de autenticarse.
  await abrirSesion(usuario.id, ahora.getTime());

  await registrarAuditoria({
    entidad: 'usuario',
    entidadId: String(usuario.id),
    operacion: 'CAMBIO_CONTRASENA',
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
  });

  return { ok: true, error: undefined };
}

// -----------------------------------------------------------------------------
// Restablecimiento por el administrador
// -----------------------------------------------------------------------------

/**
 * Devuelve un usuario a la contrasena estandar y lo obliga a cambiarla en su
 * proximo ingreso. Es la unica via para recuperar el acceso de alguien que
 * olvido su clave: no se guarda ninguna copia recuperable.
 */
export async function restablecerContrasenaEstandar(datos: FormData): Promise<ResultadoForm> {
  const admin = await requiereSesion();
  if (!admin.permisos.includes('admin:usuarios')) {
    return { ok: false, error: 'No tiene permiso para administrar usuarios.' };
  }

  const usuarioId = numeroDeTexto(datos.get('usuarioId'));
  if (usuarioId === null) return { ok: false, error: 'Usuario no indicado.' };

  if (usuarioId === admin.id) {
    return { ok: false, error: 'No puede restablecer su propia clave desde aqui.' };
  }

  const objetivo = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true, nombre: true },
  });
  if (!objetivo) return { ok: false, error: 'El usuario no existe.' };

  const ahora = new Date();
  await prisma.usuario.update({
    where: { id: objetivo.id },
    data: {
      passwordHash: hashearContrasena(PASSWORD_ESTANDAR),
      passwordActualizadoEn: ahora,
      debeCambiarPassword: true,
    },
  });

  await registrarAuditoria({
    entidad: 'usuario',
    entidadId: String(objetivo.id),
    operacion: 'RESTABLECER_CONTRASENA',
    cambios: { email: objetivo.email },
    usuarioId: admin.id,
    usuarioNombre: admin.nombre,
  });

  return {
    ok: true,
    error: `Se restablecio la clave de ${objetivo.email} y debera cambiarla al ingresar.`,
  };
}
