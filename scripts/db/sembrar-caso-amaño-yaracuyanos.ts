import { prisma } from '../../src/lib/prisma';
import { EstadoExpediente, TipoMovimientoExpediente, TipoParte } from '../../src/types/kanban';

async function sembrarCasoYaracuyanos() {
  console.log('--- Sembrando Precedente Histórico: Resolución N° 127/2025 (Exp. 142/2024) ---');

  // 1. Crear o actualizar el expediente en fact_expediente
  const expExistente = await prisma.fact_expediente.findFirst({
    where: { numero: '142/2024' },
  });

  const datosExp = {
    numero: '142/2024',
    anio: 2024,
    nombre: 'Caso Manipulación y Amaño de Partidos - Yaracuyanos S.C.',
    motivo: 'Amaño y/o Manipulación de Competencia y Apuestas Ilegales (Responsabilidad Objetiva y Conspiración)',
    subMotivo: 'Art. 10 lit. k) RDFVF en concordancia con Art. 20 Código Disciplinario FIFA y Art. 19 CONMEBOL',
    ligaTorneo: 'Liga FUTVE 2 (Segunda División)',
    equipos: 'Real Frontera S.C. vs Yaracuyanos S.C.',
    asignado: 'Consejo de Honor FVF (Pleno - Ponente Abg. Consuelo Vásquez Mariño)',
    modalidad: 'Digital / Telemático',
    alerta: 'CASO FIRME - Doctrina de Integridad Deportiva y Satisfacción Cómoda del TAS',
    estado: 'RESUELTO' as any,
    estatus: 'Resuelto con Decisión Sancionatoria Firme',
    numeroDecision: 'Resolución N° 127/2025',
    sancionRaw: '4 años de prohibición de ejercer actividades futbolísticas + 5.000 UCFVF por jugador; Amonestación y 30 UCFVF al Club por Art. 179 RDFVF',
    sancionadoRaw: 'Cristian Enrique Cruz Meleán, Kevin Raphael Díaz, Yaracuyanos S.C.',
    multaUc: 10030,
    multaUsd: 30090.0,
    fechaRecepcion: new Date('2024-12-16'),
    fechaResolucion: new Date('2025-08-01'),
    fechaAutoEntrada: new Date('2024-12-23'),
    notas: 'Landmark Precedent CDH-FVF: Sienta jurisprudencia sobre el estándar de prueba de "satisfacción suficiente / cómoda", la punibilidad autónoma de la tentativa de amaño (Doctrina CAS 2011/A/2490 Köllerer), la valoración de indicios como "hilos de un cable" (CAS 2015/A/4059) y la sanción por obstrucción procesal al club (Art. 179 RDFVF).',
  };

  let expId: number;

  if (expExistente) {
    const actualizado = await prisma.fact_expediente.update({
      where: { id: expExistente.id },
      data: datosExp,
    });
    expId = actualizado.id;
    console.log(`Expediente existente actualizado con ID: ${expId}`);
  } else {
    const creado = await prisma.fact_expediente.create({
      data: datosExp,
    });
    expId = creado.id;
    console.log(`Nuevo Expediente creado con ID: ${expId}`);
  }

  // 2. Partes involucradas
  await prisma.fact_expediente_parte.deleteMany({ where: { expedienteId: expId } });
  await prisma.fact_expediente_parte.createMany({
    data: [
      {
        expedienteId: expId,
        nombre: 'Cristian Enrique Cruz Meleán',
        tipo: 'JUGADOR' as any,
        cedula: 'V-29.755.294',
        orden: 1,
      },
      {
        expedienteId: expId,
        nombre: 'Kevin Raphael Díaz',
        tipo: 'JUGADOR' as any,
        cedula: 'V-28.341.231',
        orden: 2,
      },
      {
        expedienteId: expId,
        nombre: 'Yaracuyanos Sport Club, C.A.',
        tipo: 'CLUB' as any,
        cedula: 'J-31689234-1',
        orden: 3,
      },
      {
        expedienteId: expId,
        nombre: 'Alexis Yáñez Angulo Vallejo',
        tipo: 'JUGADOR' as any,
        cedula: 'V-26.114.882',
        orden: 4,
      },
      {
        expedienteId: expId,
        nombre: 'Real Frontera S.C. (Denunciante)',
        tipo: 'CLUB' as any,
        cedula: 'J-40598123-0',
        orden: 5,
      },
      {
        expedienteId: expId,
        nombre: 'Oficialía de Integridad y Cumplimiento FVF (Abg. Evelin Evies)',
        tipo: 'COMISION' as any,
        orden: 6,
      },
    ],
  });

  // 3. Actuaciones Procesales y Movimientos
  await prisma.fact_expediente_movimiento.deleteMany({ where: { expedienteId: expId } });
  await prisma.fact_expediente_movimiento.createMany({
    data: [
      {
        expedienteId: expId,
        tipo: 'AUTO_ADMISORIO' as any,
        codigo: 'AUTO N° 248/2024',
        fecha: new Date('2024-12-23'),
        descripcion: 'Auto de Entrada y Admisión formal. Se ordena inicio de investigación e inhabilitación preventiva de los jugadores Cristian Cruz y Kevin Díaz.',
        orden: 1,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 250/2024',
        fecha: new Date('2024-12-27'),
        descripcion: 'Traslado del informe de la Oficialía de Integridad al Presidente de Yaracuyanos S.C. para su contestación.',
        orden: 2,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 252/2024',
        fecha: new Date('2024-12-30'),
        descripcion: 'Solicitud de informe a Trujillanos F.C. y citación a declarar a jugadores, árbitro Marco Tulio Perdomo y delegada Maryluz Vega.',
        orden: 3,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 253/2024',
        fecha: new Date('2025-01-02'),
        descripcion: 'Prórroga de lapso probatorio conforme al Art. 173 RDFVF concedida a Yaracuyanos S.C. con reserva de informe SportRadar.',
        orden: 4,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 004/2025',
        fecha: new Date('2025-01-13'),
        descripcion: 'Admisión de pruebas testimoniales y documentales promovidas por la defensa del Club.',
        orden: 5,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 006/2025',
        fecha: new Date('2025-01-14'),
        descripcion: 'Incorporación de antecedentes documentales y descarga de perfiles COMET de los implicados.',
        orden: 6,
      },
      {
        expedienteId: expId,
        tipo: 'AUTO' as any,
        codigo: 'AUTO N° 052/2025',
        fecha: new Date('2025-03-24'),
        descripcion: 'Prórroga de inhabilitación preventiva por 30 días continuos contra Kevin Raphael Díaz.',
        orden: 7,
      },
      {
        expedienteId: expId,
        tipo: 'RESOLUCION' as any,
        codigo: 'RESOLUCIÓN N° 127/2025',
        fecha: new Date('2025-08-01'),
        descripcion: 'Decisión de fondo definitiva del Consejo de Honor. Se sanciona a Cristian Cruz y Kevin Díaz con 4 años de suspensión y 5.000 UCFVF a cada uno. Se sanciona a Yaracuyanos S.C. con amonestación y 30 UCFVF por obstrucción procesal.',
        orden: 8,
      },
    ],
  });

  // 4. Registro en la Memoria Jurídica si la tabla existe
  try {
    await (prisma as any).memoriaJuridicaVectorial.upsert({
      where: { codigoReferencia: 'RES-127-2025' },
      update: {
        criterioJuridico:
          'Doctrina del Consejo de Honor FVF sobre Amaño y Manipulación de Partidos: 1) Estándar probatorio de "satisfacción suficiente/cómoda" (comfortable satisfaction) superior al balance de probabilidades pero inferior a la duda razonable. 2) La conspiración o tentativa de amaño es una infracción autónoma que se sanciona como consumada (Doctrina CAS 2011/A/2490 Daniel Köllerer vs ATP). 3) Las pruebas se aprecian como "hilos de un cable" (CAS 2015/A/4059). 4) Los testimonios referenciales que buscan dilatar son desechados con sanción por obstrucción al club (Art. 179 RDFVF).',
        motivoTipificado: 'Amaño y/o Manipulación de Partidos, Apuestas Ilegales y Conspiración (Responsabilidad Objetiva y Tentativa Punible)',
        articulosClave: [
          'Art. 9 RDFVF',
          'Art. 10 lit. k RDFVF',
          'Art. 14 num. 2 y 3 RDFVF',
          'Art. 16 RDFVF (Agravantes)',
          'Art. 19 RDFVF (Tentativa)',
          'Art. 172 RDFVF',
          'Art. 174 RDFVF',
          'Art. 179 RDFVF',
          'Art. 33 Código Ética FVF',
          'Art. 20 Código Disciplinario FIFA',
          'Art. 39 Código Disciplinario FIFA',
          'Art. 19 Código Disciplinario CONMEBOL',
          'CAS 2011/A/2490 Köllerer',
          'CAS 2018/A/5920',
        ],
        multaAplicadaUcfvf: 10030,
        sancionDeportiva: 'Cuatro (4) años de prohibición de ejercer actividades relacionadas con el fútbol para cada jugador implicado',
        extractoHechos:
          'Conspiración y propuesta ilícita para amañar el encuentro Real Frontera S.C. vs Yaracuyanos S.C. (Jornada 19 Liga FUTVE 2, 27/08/2024), mediante ofrecimiento de sumas de dinero ($3.000 y $500 USD) para conceder goles o penales a partir del minuto 60/70. Denunciado por jugadores que rechazaron la oferta y ratificado en sede disciplinaria.',
      },
      create: {
        tipoDocumento: 'DECISION_CDH',
        codigoReferencia: 'RES-127-2025',
        anio: 2024,
        torneo: 'Liga FUTVE 2 (Segunda División)',
        motivoTipificado: 'Amaño y/o Manipulación de Partidos, Apuestas Ilegales y Conspiración (Responsabilidad Objetiva y Tentativa Punible)',
        articulosClave: [
          'Art. 9 RDFVF',
          'Art. 10 lit. k RDFVF',
          'Art. 14 num. 2 y 3 RDFVF',
          'Art. 16 RDFVF (Agravantes)',
          'Art. 19 RDFVF (Tentativa)',
          'Art. 172 RDFVF',
          'Art. 174 RDFVF',
          'Art. 179 RDFVF',
          'Art. 33 Código Ética FVF',
          'Art. 20 Código Disciplinario FIFA',
          'Art. 39 Código Disciplinario FIFA',
          'Art. 19 Código Disciplinario CONMEBOL',
          'CAS 2011/A/2490 Köllerer',
          'CAS 2018/A/5920',
        ],
        extractoHechos:
          'Conspiración y propuesta ilícita para amañar el encuentro Real Frontera S.C. vs Yaracuyanos S.C. (Jornada 19 Liga FUTVE 2, 27/08/2024), mediante ofrecimiento de sumas de dinero ($3.000 y $500 USD) para conceder goles o penales a partir del minuto 60/70. Denunciado por jugadores que rechazaron la oferta y ratificado en sede disciplinaria.',
        criterioJuridico:
          'Doctrina del Consejo de Honor FVF sobre Amaño y Manipulación de Partidos: 1) Estándar probatorio de "satisfacción suficiente/cómoda" (comfortable satisfaction) superior al balance de probabilidades pero inferior a la duda razonable. 2) La conspiración o tentativa de amaño es una infracción autónoma que se sanciona como consumada (Doctrina CAS 2011/A/2490 Daniel Köllerer vs ATP). 3) Las pruebas se aprecian como "hilos de un cable" (CAS 2015/A/4059). 4) Los testimonios referenciales que buscan dilatar son desechados con sanción por obstrucción al club (Art. 179 RDFVF).',
        multaAplicadaUcfvf: 10030,
        sancionDeportiva: 'Cuatro (4) años de prohibición de ejercer actividades relacionadas con el fútbol para cada jugador implicado',
        metadatosJson: {
          resolucionNumero: '127/2025',
          expedienteNumero: '142/2024',
        },
      },
    });
  } catch (err) {
    console.log('(Memoria vectorial opcional no migrada en base de datos local, continuando...)');
  }

  console.log('✅ Caso sembrado y parametrizado con éxito en PostgreSQL.');
}

sembrarCasoYaracuyanos()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error al sembrar:', e);
    process.exit(1);
  });
