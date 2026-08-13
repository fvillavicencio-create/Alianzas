# Arquitectura — CRM Maestro de Leads, Eventos y Auditoría HubSpot (Regcheq)

Copia de referencia de la propuesta de arquitectura aprobada. Ver también el
artefacto publicado con el mismo contenido para lectura visual.

## A. Pestañas y relaciones

```
BASES ORIGINALES (1 fila = 1 archivo importado)
      │
      ▼
INTERACCIONES (1 fila = 1 aparición de un contacto en una base/evento)
      │  se agrupa por HubSpot ID / email / teléfono / nombre+empresa normalizados
      ▼
CONTACTOS MAESTROS (1 fila = 1 contacto único, Master Contact ID)
      │  cruce con HubSpot por email (o HubSpot Contact ID si la base ya lo trae)
      ▼
HUBSPOT AUDIT (1 fila = 1 Master Contact ID, calculada por Apps Script)
      │
      ├──► DUPLICADOS (pares en revisión manual)
      ├──► EVENTOS (catálogo + agregados)
      └──► DASHBOARD (KPIs, 100% fórmulas)
```

`CONTACTOS MAESTROS` nunca se escribe a mano: nace en `IMPORTAR BASE`, pasa por
normalización + deduplicación (Apps Script) y las columnas relacionadas con
HubSpot son fórmulas `INDEX/MATCH` que leen `HUBSPOT AUDIT` — así el estatus
comercial nunca depende de una edición manual en el Sheet.

## B. Deduplicación (cascada, se detiene en el primer match)

1. **HubSpot Contact ID idéntico** — confianza 100. Solo aplica si la base
   origen ya trae ese ID (p. ej. una exportación de HubSpot) o si el contacto
   ya fue sincronizado antes.
2. **Email normalizado idéntico** — confianza 95. Excepción: si el local-part
   es genérico (`contacto@`, `ventas@`, `info@`, etc. — ver `PREFIJOS_GENERICOS`
   en `00_Constantes.gs`), NO se fusiona automáticamente.
3. **Teléfono normalizado idéntico** — confianza 75, siempre a revisión manual
   (`DUPLICADOS`), nunca fusiona solo.
4. **Nombre completo + Empresa similares** (Levenshtein ≥ 0.85) — confianza
   variable, siempre a revisión manual.

Solo 1 y 2 fusionan automáticamente durante la importación. 3 y 4 generan
Master Contact IDs distintos + una fila en `DUPLICADOS` para que un humano
decida (`detectarDuplicados()`, corre también al final de cada importación).

## C. Estatus comercial (árbol de decisión)

Ver `06_HubSpotSync.gs` → `computeEstatus_()`. Usa, en este orden:

1. Algún deal asociado con `dealstage` mapeado a *Convertido* → **Convertido**.
2. Algún deal mapeado a *Reunión agendada* → **Reunión agendada**.
3. Algún deal mapeado a *No interesado* (cierre perdido/churn) → **No interesado**.
4. `hs_lead_status` en un valor de "no interesado" (Mal momento, Sin
   presupuesto, Competencia, Descartado, Eliminado, Correo inválido) →
   **No interesado**.
5. `hs_lead_status` = "Sin respuesta" y han pasado ≥ N días (umbral 🟡 en
   `CONFIGURACIÓN`) → **No responde**; si no, **Contactado**.
6. `hs_lead_status` en Contactado/Intento de contacto/Esperando RCG →
   **Contactado**.
7. Tiene SDR asignado pero cero actividad → **Asignado — Sin contacto**.
8. Sin SDR asignado → **En HubSpot — Sin SDR**.
9. No existe en HubSpot → **Pendiente de cargar a HubSpot**.
10. Cualquier otro caso → **Revisión manual** (columna "Confianza del
    estatus" queda en "Revisión manual" para que se note que no fue 100%
    automático).

El mapeo de `dealstage` → estatus vive en `CONFIGURACIÓN` (bloque "Mapeo de
Dealstage → Estatus comercial"), pre-cargado con los 7 pipelines reales del
portal — es editable sin tocar código.

## D. Integración HubSpot

API REST v3 directa desde Apps Script (`UrlFetchApp`), token en
`PropertiesService` (ver `docs/INSTRUCCIONES_SETUP.md`):

| Necesidad | Endpoint |
|---|---|
| Buscar contactos por email (lotes de 100, operador `IN`) | `POST /crm/v3/objects/contacts/search` |
| Asociaciones de un contacto (empresa/deals) | `GET /crm/v3/objects/contacts/{id}?associations=companies,deals` |
| Detalle de empresas/deals en lote | `POST /crm/v3/objects/{tipo}/batch/read` |
| Lista de propietarios (para nombre de SDR) | `GET /crm/v3/owners` |

Las propiedades exactas a traer de `contacts`/`companies`/`deals` viven en
`CONFIGURACIÓN` (bloque "Propiedades HubSpot a consultar") — agregar una
propiedad ahí no requiere cambiar el código.

## E. Limitaciones conocidas (v1)

- **# de actividades y tipo de última actividad** requieren la API de
  engagements (`/engagements/v1/engagements/associated/contact/{id}/paged`),
  no implementada aún para no disparar una llamada extra por contacto en cada
  sincronización masiva. Se usa `hs_last_activity_date`/`notes_last_contacted`
  (ya calculadas por HubSpot) como proxy de "tiene actividad" y "fecha de
  último contacto". Ampliar esto es sencillo: agregar la llamada dentro de
  `actualizarHubSpot()` en `06_HubSpotSync.gs`.
- **Fecha de asignación del SDR** no la expone la API estándar de HubSpot.
- **Un solo llamado por contacto** para asociaciones (companies/deals) — con
  cientos de contactos esto es rápido; con miles, considerar la API de
  asociaciones en lote v4 (`/crm/v4/associations/.../batch/read`) para
  reducir el número de llamadas.
- **# eventos** en `CONTACTOS MAESTROS` asume 1 interacción = 1 evento
  (ver comentario en la celda de encabezado de esa columna).
- **Emails de HubSpot Export sin columna de Contact ID reconocida**: si una
  base trae el ID de HubSpot bajo un encabezado no listado en
  `CONFIGURACIÓN` → "Sinónimos de columnas", agrégalo ahí.
