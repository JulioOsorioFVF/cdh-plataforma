# Importación histórica de expedientes

## Preparación

1. Ejecuta `npm run db:generate`, `npm run db:deploy` y `npm run db:seed:roles`.
2. Inicia la plataforma con `npm run dev` e ingresa con un usuario que tenga el permiso `ingesta:run`.
3. Abre **Operación → Sincronización** (`/ingesta`).

La importación de expedientes admite CSV y XLSX de hasta 20 MB. Los libros XLS antiguos deben guardarse como XLSX. En los libros se usa la hoja llamada `ALL` si existe; de lo contrario, se usa la primera. El encabezado y el orden posicional de las columnas deben respetar el contrato del cuadro de expedientes, que incluye encabezados repetidos. La previsualización muestra conteos y advertencias; la promoción de filas aceptadas requiere una confirmación aparte. El historial presenta el avance y los errores de cada lote.

## PDFs locales y Google Drive

Los PDF pueden adjuntarse desde el equipo a un expediente existente. Para sincronizar una carpeta de Drive:

- Habilita Google Drive API y comparte la carpeta con la cuenta de servicio como lector.
- Configura `GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` en el entorno del servidor.
- Incluye el número y año en el nombre del archivo, por ejemplo `EXP-012-2025.pdf`. Los nombres que no permitan encontrar un expediente se omiten y se reportan.

Los archivos se guardan bajo `CDH_ARCHIVOS_DIR` con nombres internos aleatorios, fuera de `public`. En producción esa ruta debe apuntar a un volumen privado, persistente y respaldado. El acceso a los archivos pasa por una ruta autenticada. El límite por PDF es 25 MB.

La extracción de texto se ejecuta localmente. Un PDF escaneado sin capa de texto requiere transcripción manual anonimizada; no se envía el archivo original a un servicio OCR o de IA.

## Revisión e indexación para el agente

Cada documento queda pendiente de revisión. La aplicación propone una redacción anonimizada en el servidor; una persona debe corregirla y confirmar que no quedan nombres, identificaciones ni datos de menores. Solo el texto editado y aprobado se envía a Gemini para crear el embedding y se incorpora a la memoria jurídica. El PDF original permanece en el almacenamiento privado.

El agente consulta las normas y los precedentes aprobados. Sus consultas también requieren confirmación de anonimización; la aplicación elimina identificadores directos comunes antes de solicitar embeddings o análisis. No hay entrenamiento autónomo ni cambios automáticos en playbooks o reglas procesales. La guía y sus borradores son apoyo para revisión profesional, no decisiones jurídicas automáticas.
