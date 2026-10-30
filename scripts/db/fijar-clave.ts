/**
 * Fija la contrasena de un usuario desde la linea de comandos.
 *
 *   npm run db:clave                                  -> ADMIN_EMAIL + ADMIN_PASSWORD de .env
 *   npm run db:clave -- --email x@y --clave "Otra1*"  -> usuario y clave indicados
 *
 * Por omision NO obliga a cambiar la clave en el siguiente ingreso (la clave
 * es la definitiva). Con `--obligar-cambio` se comporta como el restablecimiento
 * del administrador: deja la cuenta marcada para que pida una nueva al entrar.
 *
 * Es la via de emergencia cuando no hay acceso a la interfaz de usuarios:
 * no guarda copia recuperable, solo el hash scrypt, y deja rastro en la bitacora.
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashearContrasena } from '../../src/lib/auth/password';
import { LONGITUD_MINIMA, validarContrasena } from '../../src/lib/auth/reglas';

config();

const prisma = new PrismaClient();

/** Lee `--nombre valor` o `--nombre=valor` de los argumentos. */
function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i >= 0) {
    const siguiente = process.argv[i + 1];
    if (siguiente && !siguiente.startsWith('--')) return siguiente;
  }
  const conIgual = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return conIgual?.slice(nombre.length + 3);
}

async function main(): Promise<void> {
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const clave = arg('clave') ?? process.env.ADMIN_PASSWORD ?? '';
  const obligarCambio = process.argv.includes('--obligar-cambio');

  if (!email) {
    throw new Error('Falta el correo. Use --email correo@dominio o defina ADMIN_EMAIL en .env.');
  }
  if (!clave) {
    throw new Error(
      'Falta la contrasena. Use --clave "..." o defina ADMIN_PASSWORD en .env.',
    );
  }

  const problemas = validarContrasena(clave);
  if (problemas.length > 0) {
    throw new Error(`La contrasena no cumple la politica: ${problemas.join(' ')}`);
  }
  if (clave.length < LONGITUD_MINIMA) {
    throw new Error(`La contrasena debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nombre: true, activo: true, roles: { select: { rol: { select: { codigo: true } } } } },
  });
  if (!usuario) {
    throw new Error(
      `No existe el usuario ${email}. Para crearlo: npm run db:seed:usuario (con ADMIN_EMAIL en .env).`,
    );
  }

  const ahora = new Date();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: hashearContrasena(clave),
      passwordActualizadoEn: ahora,
      debeCambiarPassword: obligarCambio,
      activo: true,
      cambiosPassword: { increment: 1 },
    },
  });

  await prisma.bitacora_auditoria.create({
    data: {
      entidad: 'usuario',
      entidadId: String(usuario.id),
      operacion: 'RESTABLECER_CONTRASENA',
      cambios: { email, origen: 'db:clave', obligarCambio },
      usuarioNombre: usuario.nombre,
    },
  });

  const roles = usuario.roles.map((r) => r.rol.codigo).join(', ') || '(sin rol)';
  console.log(`  usuario        ${email}  [${roles}]  ${usuario.activo ? 'activo' : 'estaba inactivo -> reactivado'}`);
  console.log(`  clave          actualizada (scrypt, ${clave.length} caracteres)`);
  console.log(`  al ingresar    ${obligarCambio ? 'LE PEDIRA CAMBIARLA' : 'entra directo con la clave nueva'}`);
  console.log('  sesiones       las anteriores quedan invalidadas al instante');
}

main()
  .then(() => console.log('\nClave lista.'))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
