import { NextResponse } from 'next/server';
import { consultarAgenteDisciplinario, type ConsultaAgenteIA } from '@/server/ia/agente-disciplinario';
import { obtenerSesion } from '@/server/auth/sesion';

export async function POST(request: Request) {
  try {
    const sesion = await obtenerSesion();
    if (!sesion) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión en la plataforma.' }, { status: 401 });
    }

    const body = (await request.json()) as ConsultaAgenteIA;
    if (!body || !body.mensaje || typeof body.mensaje !== 'string') {
      return NextResponse.json({ error: 'El mensaje de consulta es obligatorio.' }, { status: 400 });
    }

    const resultado = await consultarAgenteDisciplinario(body);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error en API /api/ia/chat:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar la consulta disciplinaria.' },
      { status: 500 },
    );
  }
}
