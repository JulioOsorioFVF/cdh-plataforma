/**
 * Módulo de Privacidad, Anonimización y Seguridad Criptográfica de la Información.
 * Diseñado conforme a los estándares de protección de datos y el Art. 161 del RDFVF.
 */

/**
 * Elimina identificadores directos, información financiera y datos confidenciales
 * antes de cualquier indexación, exportación o envío a modelos de IA.
 */
export function anonimizarIdentificadoresDirectos(texto: string): string {
  if (!texto) return '';

  return texto
    // 1. Correos electrónicos
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/giu, '[CORREO_PROTEGIDO]')
    // 2. Números de cuentas bancarias venezolanas (20 dígitos)
    .replace(/\b01\d{2}[\s-]?\d{4}[\s-]?\d{2}[\s-]?\d{10}\b/g, '[CUENTA_BANCARIA_CONFIDENCIAL]')
    .replace(/\b\d{20}\b/g, '[CUENTA_BANCARIA_CONFIDENCIAL]')
    // 3. Tarjetas de crédito/débito (13-19 dígitos)
    .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[TARJETA_PAGO_CONFIDENCIAL]')
    // 4. Identificación Venezolana (Cédula / RIF: V, E, J, G, P)
    .replace(/\b(?:V|E|J|G|P)[-\s]?\d{6,12}\b/giu, '[IDENTIFICACIÓN_PROTEGIDA]')
    // 5. Números de Pasaporte (ej: A1234567, PAS123456)
    .replace(/\b(?:PASAPORTE|PASSPORT|PAS)[#:\s]*([A-Z0-9]{6,12})\b/giu, '[PASAPORTE_PROTEGIDO]')
    // 6. Teléfonos nacionales e internacionales
    .replace(/(?:\+?58|0)?[-\s]?(?:412|414|424|416|426|212)[-\s]?\d{3}[-\s]?\d{4}\b/g, '[TELÉFONO_PROTEGIDO]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[TELÉFONO_PROTEGIDO]')
    // 7. Direcciones IP privadas y públicas
    .replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_PROTEGIDA]')
    // 8. Fichas de registro COMET o identificadores de 6 a 12 dígitos aislados
    .replace(/\b(?:COMET|FICHA)[#:\s]*(\d{5,10})\b/giu, '[COMET_ID_PROTEGIDO]');
}

/**
 * Enmascara una cédula o RIF para exhibición en pantallas públicas o auditorías.
 * Ejemplo: V-12345678 -> V-12***678
 */
export function enmascararCedula(cedula: string | null | undefined): string {
  if (!cedula) return 'N/A';
  const limpia = cedula.trim();
  if (limpia.length <= 4) return limpia;
  const prefijo = limpia.slice(0, 3);
  const sufijo = limpia.slice(-2);
  return `${prefijo}${'*'.repeat(Math.max(2, limpia.length - 5))}${sufijo}`;
}

/**
 * Enmascara una dirección de correo electrónico.
 * Ejemplo: julio.osorio@fvf.com.ve -> j***o@fvf.com.ve
 */
export function enmascararCorreo(correo: string | null | undefined): string {
  if (!correo) return 'N/A';
  const partes = correo.split('@');
  if (partes.length !== 2) return '[CORREO]';
  const usuario = partes[0] || '';
  const dominio = partes[1] || '';
  if (usuario.length <= 2) return `${usuario[0] || '*'}***@${dominio}`;
  return `${usuario[0]}***${usuario[usuario.length - 1]}@${dominio}`;
}

/**
 * Genera un sello criptográfico inmutable SHA-256 (WebCrypto) para auditoría Art. 161 RDFVF.
 * Compatible con Node.js y Edge runtime.
 */
export async function generarHashCriptograficoIntegridad(contenido: string): Promise<string> {
  const codificador = new TextEncoder();
  const datos = codificador.encode(contenido);
  const hashBuffer = await crypto.subtle.digest('SHA-256', datos);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Comprueba si un documento o registro mantiene su integridad criptográfica original.
 */
export async function verificarIntegridadHash(
  contenido: string,
  hashEsperado: string
): Promise<boolean> {
  if (!contenido || !hashEsperado) return false;
  const hashCalculado = await generarHashCriptograficoIntegridad(contenido);
  return hashCalculado.toLowerCase() === hashEsperado.toLowerCase();
}
