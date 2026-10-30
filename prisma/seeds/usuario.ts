/**
 * CONSEJO DE HONOR FVF â€” Semilla del usuario administrador
 *
 * Crea (o actualiza) la cuenta de acceso inicial, le asigna el rol
 * ADMINISTRADOR y le aplica un hash de la contrasena leida de ADMIN_PASSWORD.
 *
 * Ejecutar con: npm run db:seed:usuario
 *
 * Variables que respeta (todas en .env):
 *   ADMIN_EMAIL     correo de la cuenta inicial
 *   ADMIN_PASSWORD  contrasena inicial
 *   ADMIN_NOMBRE    nombre que se muestra en la plataforma (opcional)
 *
 * Es idempotente: se puede reejecutar. OJO, si el usuario ya existe y se pasa
 * --reset, esto RESTABLECE su clave a la de ADMIN_PASSWORD y obliga a
 * cambiarla; sin --reset solo garantiza que el rol siga asignado.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashearContrasena } from '../../src/lib/auth/password';
import { PASSWORD_ESTANDAR } from '../../src/lib/auth/reglas';

const prisma = new PrismaClient();

/**
 * Carga el .env del proyecto con el parser de dotenv si esta disponible.
 * Los scripts de prisma lo hacen por su cuenta, pero los de tsx no siempre.
 */
function cargarEnv(): void {
  const ruta = join(process.cwd(), '.env');
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (!m) continue;
    const clave = m[1]!;
    if (process.env[clave] !== undefined) continue;
    process.env[clave] = (m[2] ?? '').replace(/^["']|["']$/g, '');
  }
}

function requerido(clave: string): string {
  const v = process.env[clave]?.trim();
  if (!v) {
    throw new Error(`Falta ${clave} en .env. Agregar ${clave}=... antes de correr este seed.`);
  }
  return v;
}

async function main() {
  cargarEnv();

  const email = requerido('ADMIN_EMAIL').toLowerCase();
  const clave = requerido('ADMIN_PASSWORD');
  const nombre = process.env.ADMIN_NOMBRE?.trim() || email.split('@')[0]!;
  const reset = process.argv.includes('--reset');

  const rol = await prisma.rol.findUnique({ where: { codigo: 'ADMINISTRADOR' } });
  if (!rol) {
    throw new Error('No existe el rol ADMINISTRADOR. Correr antes: npm run db:seed:roles');
  }

  const existente = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nombre: true },
  });

  if (!existente) {
    const usuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        passwordHash: hashearContrasena(clave),
        passwordActualizadoEn: new Date(),
        // La clave inicial se marca para cambio: el administrador tambien
        // tiene que sustituirla en su primer ingreso.
        debeCambiarPassword: true,
        activo: true,
        roles: { create: { rolId: rol.id } },
      },
      select: { id: true },
    });

    await prisma.bitacora_auditoria.create({
      data: {
        entidad: 'usuario',
        entidadId: String(usuario.id),
        operacion: 'ALTA_USUARIO',
        cambios: { email, rol: rol.codigo, origen: 'db:seed:usuario' },
        usuarioNombre: nombre,
      },
    });

    console.log(`  usuario        ${email} (creado, rol ${rol.codigo})`);
  } else {
    const datos: Record<string, unknown> = { nombre, activo: true };
    if (reset) {
      datos['passwordHash'] = hashearContrasena(clave);
      datos['passwordActualizadoEn'] = new Date();
      datos['debeCambiarPassword'] = true;
    }

    await prisma.$transaction([
      prisma.usuario.update({ where: { id: existente.id }, data: datos }),
      prisma.usuario_rol.upsert({
        where: { usuarioId_rolId: { usuarioId: existente.id, rolId: rol.id } },
        update: {},
        create: { usuarioId: existente.id, rolId: rol.id },
      }),
    ]);

    if (reset) {
      await prisma.bitacora_auditoria.create({
        data: {
          entidad: 'usuario',
          entidadId: String(existente.id),
          operacion: 'RESTABLECER_CONTRASENA',
          cambios: { email, origen: 'db:seed:usuario --reset' },
          usuarioNombre: nombre,
        },
      });
    }

    console.log(`  usuario        ${email} (ya existia, rol ${rol.codigo} asegurado)`);
  }

  const esEstandar = clave === PASSWORD_ESTANDAR;
  console.log(
    `  clave           ${esEstandar ? 'es la estandar: debera cambiarla al ingresar' : 'la que definio ADMIN_PASSWORD'}`,
  );
  if (!reset && existente) {
    console.log('  para restablecerla: npm run db:seed:usuario -- --reset');
  }
}

main()
  .then(() => {
    console.log('\nUsuario administrador listo.');
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
