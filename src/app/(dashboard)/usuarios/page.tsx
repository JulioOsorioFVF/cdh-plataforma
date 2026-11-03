import React from 'react';
import { prisma } from '@/lib/prisma';
import { requiereSesion } from '@/server/auth/sesion';

export const dynamic = 'force-dynamic';

export default async function UsuariosRolesPage() {
  await requiereSesion();

  const [usuarios, totalUsuarios] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        ultimoAcceso: true,
        cambiosPassword: true,
        roles: {
          select: {
            rol: { select: { codigo: true, nombre: true } },
          },
        },
      },
    }),
    prisma.usuario.count(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-oro-500/20 text-oro-400 border border-oro-500/30">
                Gobernanza & Seguridad Institucional
              </span>
              <span className="text-slate-500 text-xs">Estatutos FVF Art. 71</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Directorio de Miembros, Jueces y Roles
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Administración de miembros del Consejo de Honor, jueces de sala, secretarios letrados y
              oficiales de cumplimiento con permisos por perfil.
            </p>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-slate-950 text-oro-400 border border-slate-800 text-xs font-mono font-bold self-start md:self-auto">
            {totalUsuarios} Usuarios Registrados
          </span>
        </div>
      </div>

      {/* Tabla de Usuarios y Miembros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>👥</span> Miembros Activos de la Sala y Oficiales
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Nombre del Funcionario</th>
                <th className="p-3">Correo Institucional</th>
                <th className="p-3">Roles y Facultades</th>
                <th className="p-3">Último Acceso</th>
                <th className="p-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-white">
                    {u.nombre}
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {u.email}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r.rol.codigo}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-oro-500/10 text-oro-400 border border-oro-500/20 font-mono"
                        >
                          {r.rol.nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-slate-400">
                    {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-VE') : 'Sin registro reciente'}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.activo
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
