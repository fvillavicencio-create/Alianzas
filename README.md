# CRM Maestro de Leads, Eventos y Auditoría HubSpot — Regcheq

Fuente única de verdad para los contactos generados por Marketing y Alianzas
(eventos, webinars propios y con aliados, bases históricas), cruzada
automáticamente contra HubSpot. El producto final es un Google Sheet — este
repositorio contiene el código Apps Script que lo hace funcionar y la
documentación para instalarlo.

## Contenido del repositorio

- `apps-script/` — código Apps Script (`.gs`) a pegar en el Sheet. Ver
  `docs/INSTRUCCIONES_SETUP.md` para el paso a paso.
- `tools/build_workbook.py` — script que genera el workbook base (10
  pestañas, fórmulas, validaciones, formato condicional) usado para crear el
  Sheet inicial. Solo hace falta volver a correrlo si se quiere reconstruir
  la estructura desde cero.
- `docs/arquitectura.md` — referencia técnica: deduplicación, lógica de
  estatus comercial, endpoints de HubSpot usados, limitaciones conocidas.
- `docs/propuesta-arquitectura.md` — la propuesta original completa (A–H)
  presentada y aprobada antes de implementar.
- `docs/INSTRUCCIONES_SETUP.md` — instalación paso a paso (subir el
  workbook a Drive, pegar el código, configurar el token de HubSpot).

## Pestañas del Sheet

DASHBOARD · CONTACTOS MAESTROS · INTERACCIONES · EVENTOS · BASES ORIGINALES
· DUPLICADOS · HUBSPOT AUDIT · IMPORTAR BASE · CONFIGURACIÓN · README.

## Estado

- Workbook base generado y validado (0 errores de fórmula).
- Apps Script implementado: importación con mapeo automático de columnas,
  deduplicación en cascada, sincronización con HubSpot (API v3), menú
  personalizado.
- Pendiente (a cargo del usuario, ver `docs/INSTRUCCIONES_SETUP.md`): subir
  el Sheet a Drive, pegar el código en el editor de Apps Script, configurar
  el token de HubSpot como propiedad del script, y confirmar en
  `CONFIGURACIÓN` qué pipelines de HubSpot aplican a Marketing/Alianzas.
