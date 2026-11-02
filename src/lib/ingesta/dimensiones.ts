/**
 * Resolucion de dimensiones durante la ingesta.
 *
 * La hoja viene aplanada: cada fila repite el nombre del torneo, el del club, el
 * del motivo... miles de veces. Consultar la base 27.000 veces por columna seria
 * lentisimo, asi que se trabaja en dos pasos:
 *
 *   1. `registrar*` anota el valor en una cola y devuelve su CLAVE (string).
 *   2. `volcar()` inserta lo que falte y devuelve el id real de cada clave.
 *
 * `volcar()` empieza leyendo lo que YA hay en la base. Eso importa por dos
 * razones: los catalogos camearon del seed con nombres en mayuscula inicial
 * ("Juego") mientras la hoja los trae en mayusculas ("JUEGO"), y sin esa
 * lectura se crearian duplicados que romparian los indices unicos. Ademas hace
 * que reejecutar la ingesta no duplique nada.
 */
import { PrismaClient } from '@prisma/client';
import { aCodigo, compacta, normalizar, separarNombre, textoONulo } from './util';

type Cliente = PrismaClient;
type Fila = Record<string, unknown>;
type ClienteDinamico = Record<
  string,
  {
    findMany(args: { select: Record<string, unknown> }): Promise<Fila[]>;
    createMany(args: { data: Fila[]; skipDuplicates: true }): Promise<{ count: number }>;
  }
>;

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export class Dimensiones {
  private readonly prisma: Cliente;

  /** clave -> datos pendientes de insertar */
  private readonly cola = new Map<string, { modelo: string; datos: Fila }>();
  /** clave -> id ya existente en la base */
  private readonly ids = new Map<string, number>();
  /**
   * nombre normalizado -> cedula conocida de esa persona.
   *
   * La hoja escribe a veces la cedula y a veces solo el nombre, y hay filas donde
   * la cedula esta mal escrita (12776610 frente a 12776810 para la misma
   * persona). Como `dim_persona.nombre_normalizado` es unico, crear una fila por
   * cedula divergente revienta el indice. Con este indice, una fila que solo trae
   * el nombre se resuelve contra la cedula que ya conocemos de esa misma persona.
   */
  private readonly cedulaPorNombre = new Map<string, string>();

  constructor(prisma: Cliente) {
    this.prisma = prisma;
  }

  /**
   * Registra un valor y devuelve la clave con la que habra que pedir su id.
   * `modelo` es el nombre del delegate de Prisma; `construir` arma la fila.
   * Los campos `__*` viajan solo dentro de la cola: sirven para resolver el
   * padre y se eliminan antes de insertar.
   */
  private registrar(modelo: string, clave: string, construir: () => Fila): string {
    const k = `${modelo}::${clave}`;
    if (this.ids.has(k)) return k;
    if (!this.cola.has(k)) {
      this.cola.set(k, { modelo, datos: construir() });
    }
    return k;
  }

  /**
   * Id real de una clave devuelta por `registrar*`, o null.
   *
   * La clave ya viene prefijada con su modelo, asi que no se vuelve a prefijar.
   * El prefijo importa: sin el, dos dimensiones con el mismo nombre
   * ("DEPORTIVA" es a la vez tipo de infraccion e incidencia de licencia) se
   * pisarian en el mapa y una recuperaria el id de la otra.
   */
  idDe(clave: string | null | undefined): number | null {
    if (!clave) return null;
    const id = this.ids.get(clave);
    return id === undefined ? null : id;
  }

  /** Id del padre de una clave hija, a partir del nombre del padre. */
  idDeNombre(modelo: string, nombre: string | null | undefined): number | null {
    if (!nombre) return null;
    const id = this.ids.get(`${modelo}::${normalizar(nombre)}`);
    return id === undefined ? null : id;
  }

  // ---------------------------------------------------------------------------
  // REGISTRO
  // ---------------------------------------------------------------------------

  fecha(iso: string | null): string | null {
    if (!iso) return null;
    const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(a, m - 1, d));
    return this.registrar('dim_fecha', iso, () => ({
      fecha: dt,
      anio: a,
      trimestre: Math.floor((m - 1) / 3) + 1,
      mes: m,
      dia: d,
      semanaIso: semanaIso(dt),
      diaSemana: dt.getUTCDay() === 0 ? 7 : dt.getUTCDay(),
      nombreMes: MESES[m - 1]!,
      nombreTrimestre: `T${Math.floor((m - 1) / 3) + 1}`,
      esFinSemana: dt.getUTCDay() === 0 || dt.getUTCDay() === 6,
      esFeriado: false,
    }));
  }

  /**
   * Reduce una variante de escritura a la forma en que se comparan las claves.
   *
   * La hoja escribe el mismo torneo de varias formas ("LIGA FUTVE-PRIMERA
   * DIVISION", "LIGA FUTVE (PRIMERA DIVISION)", "LIGA FUTVE PRIMERA DIVISION") y
   * ademas con punto final. Como `dim_torneo.nombre` es unico, `createMany` con
   * skipDuplicates descartaba las variantes y la fila se quedaba sin torneo.
   * Los parentesis y los guiones son solo separadores: no distinguen un torneo de
   * otro, asi que se aplanan antes de comparar.
   */
  private canonico(v: string): string {
    return normalizar(v)
      .replace(/[.\-()[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  torneo(nombre: string | null, temporada: number | null): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    const clave = this.canonico(n);
    return this.registrar('dim_torneo', clave, () => ({
      codigo: aCodigo(n, 'TORNEO'),
      nombre: n,
      temporada,
      temporadaSlug: temporada ? `T${temporada}` : null,
    }));
  }

  categoria(nombre: string | null): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_categoria', this.canonico(n), () => ({
      codigo: aCodigo(n, 'CAT'),
      nombre: n,
    }));
  }

  /** Fase, ronda y jornada cuelgan de un torneo: la clave incluye el torneo. */
  private hijo(
    nombre: string | null,
    torneoNombre: string | null,
    modelo: string,
    prefijo: string,
    extra?: Record<string, unknown>,
  ): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    const clave = `${normalizar(torneoNombre ?? '')}::${normalizar(n)}`;
    return this.registrar(modelo, clave, () => ({
      codigo: aCodigo(`${torneoNombre ?? ''} ${n}`, prefijo),
      nombre: n,
      torneoId: 0, // se sustituye en volcar(), cuando ya se conoce el torneo
      __torneo: textoONulo(torneoNombre),
      ...extra,
    }));
  }

  fase(nombre: string | null, torneoNombre: string | null): string | null {
    return this.hijo(nombre, torneoNombre, 'dim_fase', 'FASE');
  }

  ronda(nombre: string | null, torneoNombre: string | null): string | null {
    return this.hijo(nombre, torneoNombre, 'dim_ronda', 'RONDA');
  }

  jornada(
    nombre: string | null,
    torneoNombre: string | null,
    numero: number | null,
  ): string | null {
    return this.hijo(nombre, torneoNombre, 'dim_jornada', 'JOR', {
      numero,
      orden: numero ?? 0,
    });
  }

  club(nombre: string | null): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_club', normalizar(n), () => ({
      nombre: n,
      nombreNormalizado: normalizar(n),
    }));
  }

  /**
   * Lee de la base el indice nombre -> cedula.
   *
   * Tiene que correr ANTES del bucle de `persona()`: ese metodo resuelve la
   * cedula de una fila sin cedula contra este indice, y `volcar()` (que es donde
   * se lee el resto de la base) se ejecuta cuando ya se registraron todas las
   * filas. Si el indice llega tarde, cada persona nueva nace con una cedula
   * sintetizada que luego choca con la fila real de la base.
   */
  async cargarIndicePersonas(): Promise<void> {
    const g = await this.prisma.dim_persona.findMany({
      select: { cedula: true, nombreNormalizado: true },
    });
    for (const fila of g) {
      if (!fila.nombreNormalizado || !fila.cedula) continue;
      // Una cedula sintetizada no debe ganar a una cedula real ya conocida.
      const actual = this.cedulaPorNombre.get(fila.nombreNormalizado);
      if (actual === undefined || actual.startsWith('SIN-CEDULA-')) {
        this.cedulaPorNombre.set(fila.nombreNormalizado, fila.cedula);
      }
    }
  }

  /**
   * Aprende que cedula corresponde a cada nombre, antes de registrar a nadie.
   *
   * `persona()` resuelve contra `cedulaPorNombre`, asi que si una fila con la
   * cedula correcta aparece DESPUES de otra que trae la errata, esta ultima se
   * crearia con una cedula inventada y chocaria con `nombre_normalizado` unico.
   * El resultado dependeria del orden de la hoja. Por eso el llamador hace una
   * pasada previa sobre todas las filas y despues si registra.
   */
  aprenderCedulas(entradas: Iterable<{ cedula: string | null; nombre: string | null }>): void {
    for (const { cedula, nombre } of entradas) {
      const c = textoONulo(cedula);
      const n = textoONulo(nombre);
      if (!c || !n) continue;
      // Solo cuenta como cedula real un numero (con o sin prefijo V-). Si el
      // campo SANCIONADO trae un nombre o el nombre de un club, no es una cedula
      // y no debe fijarse como la definitiva de ese nombre.
      if (!/^V?-?\d{5,}$/i.test(c)) continue;
      const k = normalizar(n);
      if (!this.cedulaPorNombre.has(k)) this.cedulaPorNombre.set(k, c);
    }
  }

  persona(
    cedula: string | null,
    nombreCompleto: string | null,
    rolTexto: string | null,
    clubNombre: string | null,
  ): string | null {
    const c = textoONulo(cedula);
    const nombre = textoONulo(nombreCompleto);
    if (!c && !nombre) return null;
    // La tabla exige `cedula` unica y `nombre_normalizado` tambien. Cuando una
    // persona aparece con dos cedulas distintas en la hoja (erratas de tecleo
    // como 12776610 frente a 12776810 para el mismo nombre), se conserva una
    // sola identidad. Manda el NOMBRE, que es lo que choca en el indice unico:
    //   1. la cedula ya conocida para ese nombre (de la base o de la hoja);
    //   2. la cedula que trae la fila, si parece una cedula de verdad;
    //   3. la cedula que trae la fila aunque no sea un numero (a veces el
    //      campo SANCIONADO trae un nombre o el nombre de un club);
    //   4. una cedula sintetizada a partir del nombre normalizado.
    // La cedula tal como venia en la hoja no se pierde: queda guardada en
    // `fact_sancion.cedula_sancionado_raw`.
    const nombreNorm = normalizar(nombre ?? '');
    const cedulaEsNumero = c !== null && /^V?-?\d{5,}$/i.test(c);
    const cedulaConocida = nombreNorm ? this.cedulaPorNombre.get(nombreNorm) : undefined;
    const cedulaFinal =
      cedulaConocida ?? (cedulaEsNumero ? c : undefined) ?? c ?? `SIN-CEDULA-${nombreNorm}`;
    if (nombreNorm && !cedulaConocida) {
      this.cedulaPorNombre.set(nombreNorm, cedulaFinal);
    }
    const { apellidos, nombres } = nombre
      ? separarNombre(nombre)
      : { apellidos: null, nombres: null };
    return this.registrar('dim_persona', `C:${cedulaFinal}`, () => ({
      cedula: cedulaFinal,
      nombreCompleto: nombre ?? '(sin nombre)',
      nombres,
      apellidos,
      nombreNormalizado: normalizar(nombre ?? '(sin nombre)'),
      rolTexto,
      __club: textoONulo(clubNombre),
    }));
  }

  tipoSancionado(nombre: string | null, orden: number): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_tipo_sancionado', normalizar(n), () => ({
      codigo: aCodigo(n, 'TS'),
      nombre: n,
      orden,
      aplicaAPersona: !/CLUB/i.test(n),
      aplicaAClub: /CLUB|OFICIAL|DELEGADO/i.test(n),
    }));
  }

  tipoDecision(nombre: string | null, orden: number): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    const alta = normalizar(n);
    return this.registrar('dim_tipo_decision', normalizar(n), () => ({
      codigo: aCodigo(n, 'TD'),
      nombre: n,
      orden,
      esMulta: alta.includes('MULTA'),
      esSuspension: alta.includes('SUSPENSION'),
    }));
  }

  motivo(
    nombre: string | null,
    tipoDecisionNombre: string | null,
    orden: number,
  ): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_motivo', normalizar(n), () => ({
      codigo: aCodigo(n, 'MO'),
      nombre: n,
      orden,
      tipoDecisionId: 0,
      __tipoDecision: textoONulo(tipoDecisionNombre),
    }));
  }

  tipoInfraccion(nombre: string | null, orden: number): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_tipo_infraccion', normalizar(n), () => ({
      codigo: aCodigo(n, 'TI'),
      nombre: n,
      orden,
    }));
  }

  observacion(texto: string | null): string | null {
    const n = textoONulo(texto);
    if (!n) return null;
    return this.registrar('dim_observacion', normalizar(n), () => ({
      texto: n,
      textoNormalizado: normalizar(n),
    }));
  }

  incidencia(nombre: string | null, orden: number): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    return this.registrar('dim_incidencia_licencia', normalizar(n), () => ({
      codigo: aCodigo(n, 'INC'),
      nombre: n,
      orden,
    }));
  }

  detalle(
    nombre: string | null,
    incidenciaNombre: string | null,
    orden: number,
  ): string | null {
    const n = textoONulo(nombre);
    if (!n) return null;
    const clave = `${normalizar(incidenciaNombre ?? '')}::${normalizar(n)}`;
    return this.registrar('dim_detalle_incidencia', clave, () => ({
      codigo: aCodigo(`${incidenciaNombre ?? ''} ${n}`, 'DET'),
      nombre: n,
      orden,
      incidenciaId: 0,
      __incidencia: textoONulo(incidenciaNombre),
    }));
  }

  partido(
    idPartido: string | null,
    descripcion: string | null,
    acta: string | null,
    fechaIso: string | null,
  ): string | null {
    const id = textoONulo(idPartido);
    const desc = textoONulo(descripcion);
    if (!id && !desc) return null;
    // Sin ID PARTIDO se identifica por la descripcion. La clave tiene que
    // seguir exactamente la misma regla que `claveDe` al releer la fila, o la
    // fila quedaria registrada en la cola sin id.
    const clave = id ? `I:${id}` : `D:${normalizar(desc!)}`;
    return this.registrar('fact_partido', clave, () => ({
      idPartido: id ?? `SIN-ID-${normalizar(desc!)}`,
      descripcion: desc ?? id!,
      acta: textoONulo(acta),
      fechaActa: fechaIso ? new Date(fechaIso) : null,
    }));
  }

  // --- CATALOGOS (normas y articulos) -----------------------------------

  /**
   * Indice de codigos de norma y articulo, para resolver las citas de las
   * columnas NORMA y ARTICULOS.
   *
   * La hoja cita las normas por abreviatura ("RD", "NRLFJ", "E-FVF", "CD FIFA")
   * y a veces por nombre completo ("REGLAS DE JUEGO"). Para los articulos usa el
   * codigo CON el prefijo de la norma ("RD-67-6"), mientras que `dim_articulo`
   * guarda el codigo pelado ("67-6") con la norma en otra columna. Sin esta
   * traduccion, el 99% de las citas de articulo quedan sin resolver.
   */
  private readonly indiceNorma = new Map<string, number>();
  /** normaId -> codigo de articulo normalizado -> id de articulo */
  private readonly indiceArticulo = new Map<number, Map<string, number>>();
  private readonly indiceArticuloCompacto = new Map<number, Map<string, number>>();
  private readonly prefijosNorma: { prefijo: string; prefijoSep: string; normaId: number }[] =
    [];

  async cargarCatalogos(): Promise<void> {
    for (const n of await this.prisma.dim_norma.findMany({ select: { id: true, codigo: true } })) {
      this.registrarAliasNorma(n.codigo, n.id);
      this.prefijosNorma.push({
        prefijo: normalizar(n.codigo),
        // La hoja escribe "E-FVF-77-B" y el catalogo guarda "E_FVF". Comparar
        // con guiones yunderscores normalizados a espacio hace que ambos
        // emparejen sin cambiar la longitud, que es lo que permite luego cortar
        // el literal original por la posicion del prefijo.
        prefijoSep: normalizar(n.codigo).replace(/[-_]+/g, ' '),
        normaId: n.id,
      });
    }
    // El prefijo mas largo primero: "NRLFJ-" debe ganar a "NR-", y "RD_FVF-" a
    // "RD-". Sin ordenar, "NRLFJ-..." se resolveria contra la norma NR.
    this.prefijosNorma.sort((a, b) => b.prefijo.length - a.prefijo.length);

    for (const a of await this.prisma.dim_articulo.findMany({
      select: { id: true, codigo: true, normaId: true },
    })) {
      let porCodigo = this.indiceArticulo.get(a.normaId);
      if (!porCodigo) {
        porCodigo = new Map<string, number>();
        this.indiceArticulo.set(a.normaId, porCodigo);
      }
      porCodigo.set(normalizar(a.codigo), a.id);

      // Indice sin separadores, para las citas que la hoja escribe con otros
      // separadores que el catalogo ("68 U.P" frente a "68-U.P").
      let porCompacto = this.indiceArticuloCompacto.get(a.normaId);
      if (!porCompacto) {
        porCompacto = new Map<string, number>();
        this.indiceArticuloCompacto.set(a.normaId, porCompacto);
      }
      const c = compacta(a.codigo);
      if (!porCompacto.has(c)) porCompacto.set(c, a.id);
    }
  }

  /** Acepta la abreviatura de la hoja y tambien el nombre completo de la norma. */
  private registrarAliasNorma(codigo: string, id: number): void {
    this.indiceNorma.set(normalizar(codigo), id);
    this.indiceNorma.set(normalizar(codigo.replace(/_/g, ' ')), id);
    // Indice sin separadores: la hoja escribe "E-FVF" y el catalogo guarda
    // "E_FVF", que sin guiones ni espacios son el mismo texto.
    this.indiceNorma.set(compacta(codigo), id);
  }

  /**
   * Normas citadas, en el orden en que las resuelve.
   *
   * Primero se prueba el literal tal cual. Si no esta en el catalogo se intenta
   * partirlo en varias normas, porque la hoja a veces pega dos codigos con un
   * guion ("RD-NRLFJ" son el RD y las Normas Reguladoras de la Liga FUTVE
   * Junior). La particion es codiciosa y solo se acepta si se consume todo el
   * texto, de modo que un literal ilegible se queda sin resolver en vez de
   * inventar una combinacion.
   */
  idsNorma(citado: string | null | undefined): number[] {
    if (!citado) return [];
    const k = normalizar(citado);

    for (const variante of [k, k.replace(/\s+/g, '_'), k.replace(/\s+/g, '-'), compacta(k)]) {
      const id = this.indiceNorma.get(variante);
      if (id !== undefined) return [id];
    }

    const partida = this.partirEnNormas(k);
    return partida.length ? partida : [];
  }

  /**
   * Reparte un literal en codigos de norma conocidos, de mas largo a mas corto.
   * Cada trozo tiene que ser un alias del catalogo y no puede quedar sobrando
   * nada; si sobra, el literal no es una combinacion de normas y se descarta.
   */
  private partirEnNormas(texto: string): number[] {
    const alias = [...this.indiceNorma.keys()].sort((a, b) => b.length - a.length);
    const salida: number[] = [];
    let resto = texto;
    let avanzada = true;

    while (resto.length && avanzada) {
      avanzada = false;
      for (const codigo of alias) {
        if (!resto.toUpperCase().startsWith(codigo)) continue;
        const cola = resto.slice(codigo.length).replace(/^[\s\-_.]+/, '');
        // Un trozo que se come todo el texto ("RD") ya esta: es el caso directo.
        const id = this.indiceNorma.get(codigo)!;
        if (!salida.includes(id)) salida.push(id);
        resto = cola;
        avanzada = true;
        break;
      }
    }

    if (!avanzada || resto.length) return [];
    return salida;
  }

  /** Id de la norma citada, o null si la hoja cita algo fuera del catalogo. */
  idNorma(citado: string | null | undefined): number | null {
    return this.idsNorma(citado)[0] ?? null;
  }

  /**
   * Id del articulo citado, o null.
   *
   * La hoja escribe "RD-67-6" y el catalogo guarda "67-6" dentro de la norma RD.
   * Hay tres reglas, en este orden:
   *
   *   1. Si el literal empieza por un codigo de norma conocido ("RD-", "NR-",
   *      "RJ-"), se busca **solo** dentro de esa norma. Es lo que impide que
   *      "NR-41" acabe apuntando al articulo 41 del RD, que es un error grave:
   *      son reglamentos distintos.
   *   2. Si no lleva prefijo reconocible ("43", "67"), se busca el codigo exacto
   *      en cualquier norma.
   *   3. Se reintenta ignorando separadores y espacios ("68 U.P" frente a
   *      "68-U.P"), siempre dentro de la misma norma que se haya deducido.
   */
  idArticulo(citado: string | null | undefined): number | null {
    if (!citado) return null;
    const k = normalizar(citado);

    // Prefijo de norma, si lo hay. El mas largo gana: "NRLFJ-" debe vencimiento
    // a "NR-".
    let normaForzada: number | null = null;
    let resto = '';
    const kSep = k.replace(/[-_]+/g, ' ');
    for (const { prefijoSep, normaId } of this.prefijosNorma) {
      if (!kSep.startsWith(prefijoSep)) continue;
      const cola = k.slice(prefijoSep.length).replace(/^[-_. ]+/, '');
      if (cola === '') break; // el literal es solo el nombre de la norma
      normaForzada = normaId;
      resto = cola;
      break;
    }

    // 1. Con prefijo de norma, solo dentro de esa norma.
    if (normaForzada !== null) {
      const porCodigo = this.indiceArticulo.get(normaForzada);
      const directo = porCodigo?.get(resto);
      if (directo !== undefined) return directo;
      const laxo = porCodigo?.get(compacta(resto));
      if (laxo !== undefined) return laxo;
      return null;
    }

    // 2. Sin prefijo: el codigo exacto puede estar en cualquier norma.
    for (const porCodigo of this.indiceArticulo.values()) {
      const id = porCodigo.get(k);
      if (id !== undefined) return id;
    }

    // 3. Ultimo recurso, normalizando separadores y espacios.
    const c = compacta(k);
    for (const porCompacto of this.indiceArticuloCompacto.values()) {
      const id = porCompacto.get(c);
      if (id !== undefined) return id;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // VOLCADO
  // ---------------------------------------------------------------------------

  /**
   * Inserta lo que falte y rellena `ids` con el id real de cada clave.
   *
   * El orden importa por las claves foraneas: torneo antes que fase, club antes
   * que persona, tipoDecision antes que motivo, incidencia antes que detalle.
   * Primero se lee lo existente (para no duplicar nada y respetar lo que dejo el
   * seed) y despues se inserta solo lo que de verdad falta.
   */
  async volcar(): Promise<Record<string, number>> {
    const p = this.prisma as unknown as ClienteDinamico;
    const resumen: Record<string, number> = {};
    const delegado = (modelo: string) => {
      const resultado = p[modelo];
      if (!resultado) throw new Error(`Delegate Prisma no definido para ${modelo}`);
      return resultado;
    };

    /** Quita los campos auxiliares `__*` que solo sirven dentro de la cola. */
    const limpiar = (d: Fila): Fila => {
      const { __torneo, __club, __tipoDecision, __incidencia, ...limpio } = d;
      void __torneo;
      void __club;
      void __tipoDecision;
      void __incidencia;
      return limpio;
    };

    const pendientes = (modelo: string) =>
      [...this.cola.entries()].filter(
        ([clave, v]) => v.modelo === modelo && !this.ids.has(clave),
      );

    /**
     * Campos por los que se identifica cada modelo, y la relacion que hay que
     * incluir para reconstruir su clave.
     *
     * No todas las tablas tienen `codigo` (`dim_club` y `dim_fecha` no), asi que
     * la clave de lectura tiene que ser distinta por modelo. Buscar siempre por
     * `codigo` devolveria la PRIMERA fila de la tabla en las que no lo tienen,
     * y todas las filas de la hoja se colgarian del mismo id.
     */
    const LECTURA: Record<string, { campos: string[]; incluir?: string }> = {
      dim_fecha: { campos: ['fecha', 'nombreMes', 'nombreTrimestre'] },
      dim_torneo: { campos: ['nombre'] },
      dim_categoria: { campos: ['nombre'] },
      dim_club: { campos: ['nombre', 'nombreNormalizado'] },
      dim_tipo_sancionado: { campos: ['nombre'] },
      dim_tipo_decision: { campos: ['nombre'] },
      dim_tipo_infraccion: { campos: ['nombre'] },
      dim_observacion: { campos: ['textoNormalizado'] },
      dim_incidencia_licencia: { campos: ['nombre', 'codigo'] },
      dim_motivo: { campos: ['nombre'] },
      dim_persona: { campos: ['cedula', 'nombreNormalizado'] },
      fact_partido: { campos: ['idPartido', 'descripcion'] },
      dim_fase: { campos: ['nombre'], incluir: 'torneo' },
      dim_ronda: { campos: ['nombre'], incluir: 'torneo' },
      dim_jornada: { campos: ['nombre'], incluir: 'torneo' },
      dim_detalle_incidencia: { campos: ['nombre'], incluir: 'incidencia' },
    };

    // --- 1. Reutilizar lo que ya existe -------------------------------------
    // Se comparan SIEMPRE las claves normalizadas. Sin esto, "JUEGO" (hoja) y
    // "Juego" (seed) se insertarian como dos filas y el indice unico de
    // `nombre` reventaria la ingesta.
    const cargarExistentes = async (modelo: string) => {
      const cfg = LECTURA[modelo];
      if (!cfg) throw new Error(`LECTURA no definida para ${modelo}`);
      // `id` siempre se pide: sin el, `fila.id` seria undefined y la clave
      // quedaria apuntando a undefined, que es como si no existiera.
      // `include` y `select` son excluyentes en Prisma, asi que la relacion del
      // padre va anidada dentro del propio `select`.
      const select: Record<string, unknown> = Object.fromEntries(
        [...cfg.campos, 'id'].map((c) => [c, true]),
      );
      if (cfg.incluir) select[cfg.incluir] = { select: { nombre: true } };
      const g = await delegado(modelo).findMany({ select });
      for (const fila of g) {
        const relacion = cfg.incluir ? fila[cfg.incluir] : undefined;
        const padre =
          typeof relacion === 'object' &&
          relacion !== null &&
          'nombre' in relacion &&
          typeof relacion.nombre === 'string'
            ? relacion.nombre
            : '';
        if (typeof fila.id !== 'number') {
          throw new Error(`La consulta de ${modelo} no devolvio un id numerico`);
        }
        this.ids.set(this.claveDe(modelo, fila, padre), fila.id);
        if (
          modelo === 'dim_persona' &&
          typeof fila.nombreNormalizado === 'string' &&
          typeof fila.cedula === 'string'
        ) {
          this.cedulaPorNombre.set(fila.nombreNormalizado, fila.cedula);
        }
      }
    };

    for (const modelo of Object.keys(LECTURA)) {
      await cargarExistentes(modelo);
    }

    // --- 2. Insertar lo que falta, en orden de dependencia ------------------
    const insertar = async (modelo: string, preparar?: (d: Fila) => Fila) => {
      const entradas = pendientes(modelo);
      if (!entradas.length) return;
      const datos = entradas.map(([, v]) => (preparar ? preparar(v.datos) : limpiar(v.datos)));
      const r = await delegado(modelo).createMany({ data: datos, skipDuplicates: true });
      resumen[modelo] = (resumen[modelo] ?? 0) + r.count;
      if (r.count < entradas.length) {
        console.warn(
          `  [aviso] ${modelo}: se pidieron ${entradas.length} filas y se insertaron ${r.count};` +
            ` ${entradas.length - r.count} chocaron con una fila existente (skipDuplicates).`,
        );
      }

      // Se relee la tabla entera con `cargarExistentes` en vez de buscar fila
      // por fila. Motivo: `createMany` con skipDuplicates puede descartar una
      // fila (por ejemplo si el `codigo` generado choca con otro ya presente) y
      // un `findFirst` por un campo que la tabla no tiene (dim_club, dim_fecha)
      // devolveria la primera fila de la tabla, colgando todas las sanctiones
      // del mismo id. Releer aplica la MISMA normalizacion con la que se
      // registro la cola, que es justo lo que hace que la clave coincida.
      await cargarExistentes(modelo);
    };

    await insertar('dim_fecha');
    await insertar('dim_torneo');
    await insertar('dim_categoria');
    await insertar('dim_club');
    await insertar('dim_tipo_sancionado');
    await insertar('dim_tipo_decision');
    await insertar('dim_tipo_infraccion');
    await insertar('dim_observacion');
    await insertar('dim_incidencia_licencia');
    await insertar('fact_partido');

    for (const modelo of ['dim_fase', 'dim_ronda', 'dim_jornada'] as const) {
      await insertar(modelo, (d) => ({
        ...limpiar(d),
        torneoId:
          this.ids.get(
            `dim_torneo::${this.canonico(typeof d.__torneo === 'string' ? d.__torneo : '')}`,
          ) ?? 0,
      }));
    }

    await insertar('dim_persona', (d) => ({
      ...limpiar(d),
      clubId: this.idDeNombre('dim_club', typeof d.__club === 'string' ? d.__club : null),
    }));

    await insertar('dim_motivo', (d) => ({
      ...limpiar(d),
      tipoDecisionId:
        this.idDeNombre('dim_tipo_decision', typeof d.__tipoDecision === 'string' ? d.__tipoDecision : null),
    }));

    await insertar('dim_detalle_incidencia', (d) => ({
      ...limpiar(d),
      incidenciaId:
        this.idDeNombre(
          'dim_incidencia_licencia',
          typeof d.__incidencia === 'string' ? d.__incidencia : null,
        ) ?? 0,
    }));

    // --- 3. Aviso de claves sin resolver ------------------------------------
    // Si algo quedo sin id, el hecho se guardara con la FK a null. Se informa
    // para que no pase inadvertido.
    const sinResolver = [...this.cola.keys()].filter((k) => !this.ids.has(k));
    if (sinResolver.length) {
      resumen['SIN_RESOLVER'] = sinResolver.length;
      console.warn(`  [aviso] ${sinResolver.length} claves sin id (se guardaran con FK nula):`);
      // Sin `CDH_DEBUG` solo se muestran las primeras 10: son miles de filas y
      // el detalle completo se lee de verdad en el log de `ingesta_log`.
      for (const k of sinResolver.slice(0, process.env.CDH_DEBUG ? sinResolver.length : 10)) {
        console.warn(`     ${k}`);
      }
    }

    this.cola.clear();
    return resumen;
  }

  /** Reconstruye la clave local de una fila ya existente en la base. */
  private claveDe(modelo: string, fila: Fila, padreNombre: string): string {
    switch (modelo) {
      case 'dim_fecha':
        return `${modelo}::${isoDe(fila.fecha instanceof Date ? fila.fecha : new Date(String(fila.fecha)))}`;
      case 'dim_observacion':
        return `${modelo}::${String(fila.textoNormalizado ?? '')}`;
      case 'dim_persona':
        return `${modelo}::C:${String(fila.cedula ?? '')}`;
      case 'fact_partido':
        // Mismo criterio que en `partido()`: si la fila se creo sin ID PARTIDO,
        // su clave es la descripcion normalizada, no `I:SIN-ID-...`.
        return typeof fila.idPartido === 'string' && fila.idPartido.startsWith('SIN-ID-')
          ? `${modelo}::D:${normalizar(String(fila.descripcion ?? ''))}`
          : `${modelo}::I:${String(fila.idPartido ?? '')}`;
      case 'dim_fase':
      case 'dim_ronda':
      case 'dim_jornada':
        return `${modelo}::${this.canonico(padreNombre)}::${this.canonico(String(fila.nombre ?? ''))}`;
      case 'dim_detalle_incidencia':
        return `${modelo}::${normalizar(padreNombre)}::${normalizar(String(fila.nombre ?? ''))}`;
      case 'dim_torneo':
      case 'dim_categoria':
        return `${modelo}::${this.canonico(String(fila.nombre ?? ''))}`;
      default:
        return `${modelo}::${normalizar(String(fila.nombre ?? ''))}`;
    }
  }
}

function isoDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function semanaIso(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}
