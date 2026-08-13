# Instrucciones de instalación — CRM Maestro Regcheq

## 1. Sube el workbook a Google Drive

1. Descarga `crm_maestro.xlsx` (te lo compartí directamente en la conversación).
2. Súbelo a tu carpeta de Drive compartida de bases (la misma que me pasaste:
   `Bases de eventos`, id `1Fb73ensde6b_neyRUyP4L7hcW1q85iyS`).
3. Da clic derecho sobre el archivo subido → **Abrir con → Google Sheets**.
   Esto crea una copia nativa de Google Sheets con todas las fórmulas,
   validaciones y formato condicional ya funcionando (probado: 875 fórmulas,
   0 errores).
4. Renombra el archivo nativo a algo como **"CRM Maestro Regcheq"** y borra
   el `.xlsx` original si ya no lo necesitas (Drive no lo actualiza solo).

## 2. Pega el código de Apps Script

1. En el Google Sheet nativo: **Extensiones → Apps Script**.
2. Borra el archivo `Código.gs` que Apps Script crea vacío por default.
3. Por cada archivo en la carpeta `apps-script/` de este repositorio, crea un
   archivo de script nuevo con el mismo nombre (sin la extensión `.gs` al
   nombrarlo, Apps Script la agrega sola) y pega el contenido:
   - `00_Constantes`
   - `01_Utilidades`
   - `02_Configuracion`
   - `03_Normalizacion`
   - `04_Deduplicacion`
   - `05_Importar`
   - `06_HubSpotSync`
   - `07_Dashboard`
   - `08_Menu`
4. En **Configuración del proyecto** (ícono de engrane) → pega el contenido
   de `apps-script/appsscript.json` reemplazando el manifiesto por default
   (necesitas activar "Mostrar archivo de manifiesto appsscript.json" en esa
   misma pantalla de configuración).
5. Guarda todo (Ctrl+S / ⌘S).

Si prefieres usar [`clasp`](https://github.com/google/clasp) en vez de
copiar y pegar: `clasp create --type sheets --title "CRM Maestro Regcheq"`
desde la carpeta `apps-script/`, o `clasp clone <scriptId>` si ya generaste
el proyecto desde la UI y quieres seguir editando en tu máquina.

## 3. Configura el token de HubSpot (nunca en una celda ni en el código)

1. En el editor de Apps Script: **Configuración del proyecto** (engrane) →
   baja hasta **Propiedades del script**.
2. Agrega una propiedad:
   - Nombre: `HUBSPOT_TOKEN`
   - Valor: tu token de Private App de HubSpot (empieza con `pat-na1-...`)
3. Guarda. El código lee este valor con
   `PropertiesService.getScriptProperties().getProperty('HUBSPOT_TOKEN')` —
   nunca queda expuesto en el Sheet ni se sube a ningún repositorio.

### Scopes necesarios en la Private App de HubSpot

En HubSpot → Configuración → Integraciones → Apps privadas → tu app → pestaña
**Scopes**, activa como mínimo (solo lectura):

- `crm.objects.contacts.read`
- `crm.objects.companies.read`
- `crm.objects.deals.read`
- `crm.schemas.contacts.read`

## 4. Primera corrida

1. Recarga el Google Sheet (para que aparezca el menú **Regcheq CRM**).
2. La primera vez Google pedirá autorizar el script — es normal, acéptalo con
   tu cuenta de Regcheq.
3. Llena una fila en `IMPORTAR BASE` apuntando a una de las bases de tu Drive
   y corre **Regcheq CRM → Importar nueva base**.
4. Corre **Regcheq CRM → Actualizar HubSpot** para cruzar los contactos
   importados contra tu portal.
5. Revisa `DASHBOARD` — ya debería mostrar KPIs reales.

## 5. Revisión de scopes/pipelines pendiente

Antes de confiar en los KPIs de "Reuniones"/"Convertidos", confirma en
`CONFIGURACIÓN` → "Pipelines de Deals" cuáles de los 7 pipelines aplican a
leads de Marketing/Alianzas (llegan marcados como "Pendiente de confirmar").
