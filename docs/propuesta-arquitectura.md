# Arquitectura propuesta — Google Sheet Maestro de Leads, Eventos y Auditoría HubSpot

Verifiqué el portal de HubSpot conectado (Regcheq México, portal 24042219) para basar esta propuesta en datos reales, no supuestos. Hallazgos clave abajo en la sección E.

## A. Arquitectura propuesta — pestañas y relaciones

```
BASES ORIGINALES (1 fila = 1 archivo importado)
      │  cada importación crea/actualiza filas en:
      ▼
INTERACCIONES / ORÍGENES (1 fila = 1 aparición de un contacto en una base/evento)
      │  se agrupa por email/teléfono/nombre+empresa/HubSpot ID normalizados
      ▼
CONTACTOS MAESTROS (1 fila = 1 contacto único, con Master Contact ID)
      │  se cruza contra HubSpot por email → Contact ID
      ▼
HUBSPOT AUDIT (1 fila = 1 Master Contact ID, columnas calculadas desde HubSpot)
      │
      ├──► DUPLICADOS (pares de Master Contact ID / HubSpot ID en conflicto, para revisión manual)
      ├──► EVENTOS (catálogo, agregados desde INTERACCIONES + HUBSPOT AUDIT)
      └──► DASHBOARD (KPIs agregados desde todas las anteriores)

Soporte: IMPORTAR BASE (mecanismo de carga) · CONFIGURACIÓN (mapeos, umbrales, scopes) · README
```

Principio: **CONTACTOS MAESTROS nunca se escribe a mano.** Toda fila nueva nace en `IMPORTAR BASE`, pasa por normalización + deduplicación, y termina como una fila en INTERACCIONES (siempre) más, si es un contacto nuevo, una fila en CONTACTOS MAESTROS. HUBSPOT AUDIT y DASHBOARD son 100% calculadas — nunca se editan a mano, para que el estatus no dependa de captura manual (como pediste en el punto 8).

## B. Estructura de datos por pestaña

### 1. DASHBOARD
Solo fórmulas/QUERY sobre las demás pestañas + filtros (Data Validation en celdas ancla: Fecha desde/hasta, Evento, Aliado, SDR, Tipo de origen, Estatus). KPIs generales, tabla por origen y tabla por SDR tal como los describiste.

### 2. CONTACTOS MAESTROS
`Master Contact ID · Nombre · Apellido · Nombre completo · Empresa · Email (normalizado) · Email original · Teléfono (normalizado) · Teléfono original · Cargo · Industria · Ciudad/Estado · Fecha de registro más antigua · HubSpot Contact ID · HubSpot Company ID · HubSpot Deal ID(s) · Existe en HubSpot · Liga HubSpot · SDR asignado (hubspot_owner_id → nombre) · Está asignado · Tiene actividad · # actividades · Última actividad (fecha) · Tipo última actividad · Estatus comercial (calculado) · # fuentes · # eventos · Duplicado detectado (Sí/No) · Tipo de duplicado · IDs relacionados (lista MC-IDs) · Última sincronización HubSpot`

### 3. INTERACCIONES / ORÍGENES
`Interacción ID · Master Contact ID · Event ID · Tipo de origen · Aliado · Fecha del evento · Fecha de registro · Base ID (fuente original) · Fila original (referencia) · Email tal como apareció · Teléfono tal como apareció`

### 4. EVENTOS
`Event ID · Nombre · Tipo (Evento/Webinar/Webinar con aliado/Evento de aliado/Otro) · Aliado · Fecha del evento · Fecha de recepción de base · Responsable · Nombre de archivo original · Liga a base original · # registros · # contactos únicos · # duplicados · # en HubSpot · # no en HubSpot · Última sincronización · Observaciones`

### 5. BASES ORIGINALES
`Base ID · Nombre de base · Fuente (Sheets/HubSpot export/otro) · URL o ID origen · Fecha de importación · Importado por · # registros · # contactos únicos generados · # duplicados detectados · Event ID relacionado · Estado de importación (OK/Con errores) · Columnas no mapeadas (si las hubo)`

### 6. DUPLICADOS
`Par ID · Master Contact ID A · Master Contact ID B · Tipo de coincidencia (fuerte/media/débil) · Campo que generó la coincidencia · Valor coincidente · Nivel de confianza (%) · HubSpot Contact ID A/B · Evento A/B · Estatus de revisión (Pendiente/Confirmado duplicado/Falso positivo/Fusionado) · Acción recomendada · Revisado por · Fecha de revisión`
Fusionar es siempre una acción manual explícita desde el menú (nunca automática) que mueve las filas de INTERACCIONES de un MC-ID al otro y marca uno como "Fusionado en X".

### 7. HUBSPOT AUDIT
Una fila por Master Contact ID, recalculada en cada sincronización: bloques HubSpot / SDR / Actividad / Estado, tal como los listaste en el punto 8, más una columna `Confianza del estatus` (Automático / Revisión manual) para los casos donde HubSpot no tiene suficiente señal.

### Soporte
- **IMPORTAR BASE**: formulario de una fila con los campos que listaste (URL/ID, pestaña, evento, tipo, aliado, fechas, fuente) + botón de menú "Procesar importación".
- **CONFIGURACIÓN**: tabla de mapeo de encabezados (sinónimos → campo canónico), lista de IDs de owners = SDR, umbrales de alerta (días sin contacto), scopes de API, pipeline(s)/dealstage(s) que cuentan como "Reunión agendada"/"Convertido".
- **README / INSTRUCCIONES**: la guía paso a paso pedida en el punto 21.4.

## C. Lógica de deduplicación

Cascada de reglas, en este orden, deteniéndose en el primer match (evita falsos positivos por aplicar reglas débiles cuando ya hay una fuerte):

1. **HubSpot Contact ID idéntico** → mismo contacto, confianza 100%.
2. **Email normalizado idéntico** (minúsculas, sin espacios, formato válido) → mismo contacto, confianza alta (~95%). Excepción: dominios genéricos compartidos (`info@`, `contacto@`, `ventas@empresa.com`) se excluyen de auto-merge y van directo a DUPLICADOS para revisión, porque un email genérico puede representar personas distintas.
3. **Teléfono normalizado idéntico** (solo dígitos, con código de país inferido: si tiene 10 dígitos y no trae lada internacional se asume +52) → coincidencia media (~75%), va a DUPLICADOS salvo que además coincida nombre.
4. **Nombre completo normalizado + Empresa normalizada** (mayúsculas, sin acentos, sin espacios dobles, comparación por similitud tipo Levenshtein/Jaro-Winkler con umbral ≥ 0.85) → coincidencia media/débil según score exacto, siempre a revisión manual.

Nunca se fusiona automáticamente por reglas 3 o 4 — solo se generan Master Contact IDs distintos y se listan en DUPLICADOS con "Acción recomendada". Solo 1 y 2 (con la excepción de dominios genéricos) generan auto-asignación al mismo Master Contact ID durante la importación.

Cuando un contacto nuevo hace match con uno existente, no se crea Master Contact ID nuevo: se agrega una fila en INTERACCIONES apuntando al MC-ID existente, y se actualizan en CONTACTOS MAESTROS solo los campos vacíos (nunca se sobreescribe un dato ya capturado con uno nuevo "en blanco"), sumando 1 a `# fuentes`/`# eventos`.

## D. Lógica de estatus comercial

Confirmé las propiedades reales del portal — no son genéricas, son las tuyas:

- `hs_lead_status` (Lead Status): Nuevo, Abierto, En progreso, Negocio Abierto, No calificado, Intento de contacto, Contactado, Mal momento, Descartado, Eliminado, Sin presupuesto, Sin respuesta, Competencia, Esperando RCG, Correo inválido/rebotado.
- `lifecyclestage`: Suscriptor → Lead → MQL → SQL → Oportunidad → Cliente, más "Lead de Alianzas" / "Alianza Cerrada" / "Lead de Alianzas Descartado" (relevante para Alianzas específicamente).
- `dealstage` + `pipeline`: hay **7 pipelines activos** (Financial, Real Estate, Cars & Others, Sesiones Consultivas/Marketing, Alianzas y Brokers, Upsellings, Pipeline Gaby), cada uno con sus propios stage IDs para "Reunión Agendada", "Contrato Firmado", "Cierre perdido", etc.
- `hubspot_owner_id` (Contact owner): 35 usuarios en el portal — no hay un campo que distinga "SDR" de otros roles (Ventas, Marketing, Alianzas, Regbot). **Esto requiere que me digas qué owners cuentan como SDR** (ver preguntas, sección H).
- Actividad: se obtiene de engagements asociados al contacto (EMAIL logeados vía el objeto EMAIL, más llamadas/reuniones/notas/tareas vía la API de engagements — el MCP actual solo expone EMAIL como objeto de actividad de primer nivel; calls/meetings/notes requieren el endpoint de engagements v3, que Apps Script sí puede llamar directamente).

Propuesta de árbol de decisión (evaluado en este orden, se detiene en el primer "Sí"):

| # | Condición (HubSpot) | Estatus asignado |
|---|---|---|
| 1 | `dealstage` en cualquier pipeline mapeado como "cerrado ganado" (closedwon y equivalentes) | Convertido |
| 2 | `dealstage` mapeado como "reunión agendada/calificada" en cualquier pipeline | Reunión agendada |
| 3 | `hs_lead_status` = "Mal momento" / "Sin presupuesto" / "Competencia" / "Descartado" | No interesado |
| 4 | `hs_lead_status` = "Sin respuesta" y última actividad > N días (configurable) | No responde |
| 5 | `hs_lead_status` = "Contactado" o hay ≥1 engagement saliente registrado | Contactado |
| 6 | Existe engagement pero es solo entrante (ej. abrió un email) sin respuesta/registro de contacto | Respondió *(si aplica; si la señal no es clara → Revisión manual)* |
| 7 | `hubspot_owner_id` no vacío pero 0 actividades | Asignado — Sin contacto |
| 8 | `hubspot_owner_id` vacío y existe en HubSpot | En HubSpot — Sin SDR |
| 9 | No existe Contact ID en HubSpot | Pendiente de cargar a HubSpot |
| — | Ninguna regla aplica con certeza | **Revisión manual** |

"Contactando" (de tu lista original) lo fusioné con "Contactado" porque HubSpot no distingue de forma fiable un intento-en-curso de un contacto ya logrado sin más contexto — si prefieres separarlos, defíneme la señal exacta (ej. una tarea abierta vs. cerrada) y la agrego como regla intermedia.

## E. Integración HubSpot — qué necesito consultar

Ya verifiqué acceso de lectura/escritura a **CONTACT, COMPANY, DEAL, EMAIL** en tu portal. Endpoints que usará Apps Script (vía `UrlFetchApp` + HubSpot API v3, no el MCP — el Sheet debe funcionar de forma autónoma):

| Necesidad | Endpoint HubSpot |
|---|---|
| Buscar contacto por email | `POST /crm/v3/objects/contacts/search` |
| Propiedades del contacto | `GET /crm/v3/objects/contacts/{id}` con `properties=` |
| Empresa asociada | `GET /crm/v3/objects/contacts/{id}/associations/companies` |
| Deals asociados | `GET /crm/v3/objects/contacts/{id}/associations/deals` |
| Propietario/SDR | `hubspot_owner_id` (ya en el contacto) + `GET /crm/v3/owners/{id}` para el nombre |
| Actividades (emails, llamadas, reuniones, notas, tareas) | `GET /crm/v3/objects/contacts/{id}/associations/{engagement_type}` por cada tipo, o `GET /engagements/v1/engagements/associated/contact/{id}/paged` (API legacy pero más completa en un solo llamado) |
| Última actividad | `hs_last_activity_date` / `notes_last_contacted` / `hs_last_sales_activity_timestamp` (propiedades ya calculadas por HubSpot, más baratas que traer todos los engagements) |
| Liga directa | `https://app.hubspot.com/contacts/24042219/record/0-1/{contactId}` (uso el portal ID real que confirmé: 24042219) |

Propongo guardar la **lista de propiedades a consultar en la pestaña CONFIGURACIÓN**, no en el código, para que puedas agregar/quitar propiedades sin tocar Apps Script (cumple tu punto 9 in fine).

## F. Flujo de importación

```
1. Usuario llena fila en "IMPORTAR BASE" (URL/ID Sheet, pestaña, evento, tipo, aliado, fechas, fuente)
2. Menú → "Importar nueva base"
3. Apps Script lee la hoja origen, detecta encabezados, mapea a campos canónicos
   (usando tabla de sinónimos en CONFIGURACIÓN; si no reconoce una columna, la reporta y detiene esa columna sin bloquear el resto)
4. Normalización: email, teléfono, nombre, empresa (conservando valor original + normalizado)
5. Deduplicación en cascada (sección C) contra CONTACTOS MAESTROS existente
6. Por cada fila:
     - Si hace match fuerte → nueva fila en INTERACCIONES, actualiza campos vacíos en CONTACTOS MAESTROS
     - Si no hace match → nuevo Master Contact ID + fila en CONTACTOS MAESTROS + fila en INTERACCIONES
     - Si hace match débil/medio → igual que match fuerte, PERO además crea entrada en DUPLICADOS para revisión
7. Se crea/actualiza fila en BASES ORIGINALES y EVENTOS con los conteos resultantes
8. (Opcional, mismo run o por separado) "Actualizar HubSpot" busca cada contacto nuevo por email,
   trae propiedades, calcula estatus, llena HUBSPOT AUDIT y actualiza CONTACTOS MAESTROS
9. "Actualizar dashboard" recalcula KPIs (o el Dashboard usa QUERY/fórmulas en vivo, sin botón)
```

## G. Riesgos y limitaciones

- **"SDR" no es un campo en HubSpot.** Es una interpretación sobre `hubspot_owner_id`. Sin una lista de qué owners son SDR, el sistema no puede distinguir "asignado a SDR" de "asignado a un Account Manager" o a Alianzas.
- **Múltiples pipelines de deals (7)** con IDs de stage distintos que se llaman igual en texto (ej. "Reunión Agendada" aparece en 5 pipelines con IDs diferentes). El mapeo de estatus debe hacerse por ID de stage, no por texto, y hay que decidir qué pipelines aplican a leads de Marketing/Alianzas (probablemente no todos — "Upsellings" o "Cars & Others" seguramente no).
- **Actividad completa (llamadas/reuniones/notas)** requiere el endpoint legacy de engagements o llamadas repetidas por tipo — más lento que leer solo contactos. Para portales con miles de contactos esto puede acercarse a los límites de cuota de la API (100 req/10s en la mayoría de cuentas) y al tiempo máximo de ejecución de Apps Script (6 min por ejecución, 30 min con triggers encadenados). Mitigación: usar `hs_last_activity_date` y similares (ya calculados por HubSpot) como fuente principal, y solo profundizar en engagements bajo demanda (ej. al hacer clic en un contacto específico), no en cada sincronización masiva.
- **Volumen**: si el histórico son cientos de contactos, todo corre en un solo trigger manual. Si son decenas de miles, se necesita procesamiento por lotes con `Utilities.sleep` entre llamadas y triggers instalables (time-driven) para no exceder el límite de 6 min/ejecución — el diseño lo soporta, pero cambia cómo se invoca "Actualizar HubSpot" (botón síncrono vs. cola en background).
- **Similitud de nombres/empresas** (regla débil de deduplicación) no es 100% determinística — cualquier umbral generará algunos falsos positivos y negativos; por diseño esos casos van a revisión manual, nunca se autofusionan.
- **Apps Script no puede alojar credenciales de forma "secreta" de verdad** — un token de HubSpot Private App guardado en Script Properties es razonablemente seguro (no visible en el Sheet, no exportable por usuarios normales) pero cualquier editor del script con permiso de "Ver > Editor de secuencia de comandos" y ejecución podría, en teoría, loguearlo. Aceptable para un equipo interno pequeño (Marketing/Alianzas), pero vale la pena que lo sepas.
- **Este entorno (sesión remota) no tiene una herramienta para crear/editar directamente un Google Sheet en vivo con Apps Script vinculado** (bound script) ni ejecutar `clasp push`. Puedo: (a) generar todo el código fuente (.gs) y la estructura de pestañas como archivos en este repo de git para que tú los despliegues (copiar/pegar en el editor de Apps Script, o `clasp push` si usas clasp), o (b) si me das un Google Sheet ya creado y compartido, usar las herramientas de Google Drive disponibles para leer/escribir contenido — pero la vinculación de Apps Script y el menú personalizado requieren que el script viva en ese Sheet, lo cual normalmente se hace desde la UI de Google o vía clasp con tus credenciales, no desde este chat. Necesito que definamos esto en la sección H.

## H. Preguntas pendientes (antes de escribir código)

1. **SDR**: ¿qué subconjunto de los 35 owners del portal cuenta como "SDR"? (¿un team de HubSpot, un patrón de puesto, o me das la lista de nombres?)
2. **Pipelines relevantes**: de los 7 pipelines (Financial, Real Estate, Cars & Others, Sesiones Consultivas/Marketing, Alianzas y Brokers, Upsellings, Pipeline Gaby), ¿cuáles debo considerar para "Reunión agendada" / "Convertido" en el contexto de leads de Marketing y Alianzas? ¿Todos, o solo algunos?
3. **Despliegue**: ¿prefieres que (a) te entregue el código Apps Script + estructura de pestañas como archivos en este repo para que tú lo despliegues en un Google Sheet (manual o vía clasp), o (b) ya tienes un Google Sheet creado y compartido conmigo (o con una cuenta de servicio) donde deba trabajar directamente?
4. **Bases históricas**: ¿ya existen como Google Sheets accesibles (dame carpeta/liga de Drive), o hay también archivos Excel/CSV sueltos que haya que subir primero a Drive?
5. **Volumen aproximado**: ¿cuántos contactos históricos estimas en total (decenas, cientos, miles)? Define si el diseño necesita procesamiento por lotes desde el día uno.
6. **Token de HubSpot**: ¿tienes ya (o puedes crear) una Private App en HubSpot con scopes de lectura sobre contacts, companies, deals y engagements para que Apps Script la use? (Yo no puedo generarla por ti — requiere acceso admin al portal).
7. **Actividad "entrante" vs "saliente"**: para el estatus "Respondió", ¿qué señal específica en HubSpot debo usar (ej. un email entrante logeado, un cambio de `hs_lead_status` a "Contactado", una tarea marcada completada)?
