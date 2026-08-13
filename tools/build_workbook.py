#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el workbook maestro CRM Regcheq (multi-pestaña) con openpyxl."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName

OUT = "/tmp/claude-0/-home-user-Alianzas/4bd4d246-1109-5329-9102-43da7515c7c8/scratchpad/crm_maestro.xlsx"

FONT_NAME = "Arial"
NAVY = "1F3864"

header_font = Font(name=FONT_NAME, bold=True, color="FFFFFF", size=10)
header_fill = PatternFill("solid", fgColor=NAVY)
title_font = Font(name=FONT_NAME, bold=True, color=NAVY, size=14)
subtitle_font = Font(name=FONT_NAME, bold=True, color=NAVY, size=11)
normal_font = Font(name=FONT_NAME, size=10)
bold_font = Font(name=FONT_NAME, bold=True, size=10)
italic_font = Font(name=FONT_NAME, size=9, italic=True, color="808080")
green_fill = PatternFill("solid", fgColor="C6EFCE")
red_fill = PatternFill("solid", fgColor="FFC7CE")
yellow_fill = PatternFill("solid", fgColor="FFEB9C")
green_font = Font(name=FONT_NAME, size=10, color="006100")
red_font = Font(name=FONT_NAME, size=10, color="9C0006")
thin = Side(style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

DATA_ROWS = 2          # filas con formulas precargadas en tablas principales
EVENT_ROWS = 2          # filas con formulas precargadas en EVENTOS

TIPOS_ORIGEN = ["Evento", "Webinar", "Webinar con aliado", "Evento de aliado", "Otro"]
ESTATUS_LIST = [
    "Pendiente de cargar a HubSpot", "En HubSpot — Sin SDR", "Asignado — Sin contacto",
    "Contactado", "Respondió", "Reunión agendada", "No interesado", "No responde",
    "Convertido", "Revisión manual",
]

wb = Workbook()
wb.remove(wb.active)


def add_sheet(name):
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    return ws


def write_headers(ws, headers, row=1, widths=None):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=row, column=i, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border
        if widths:
            ws.column_dimensions[get_column_letter(i)].width = widths[i - 1]
    ws.freeze_panes = ws.cell(row=row + 1, column=1).coordinate
    ws.auto_filter.ref = f"A{row}:{get_column_letter(len(headers))}{row}"
    ws.row_dimensions[row].height = 30


def style_rows(ws, n_cols, first_row, last_row):
    for r in range(first_row, last_row + 1):
        for c in range(1, n_cols + 1):
            cell = ws.cell(row=r, column=c)
            if cell.font is None or cell.font.name != FONT_NAME:
                cell.font = normal_font
            cell.border = border


def list_dv(ws, cell_range, options, strict=True):
    dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"',
                         allow_blank=True, showDropDown=False)
    dv.showErrorMessage = strict
    ws.add_data_validation(dv)
    dv.add(cell_range)
    return dv


def range_dv(ws, cell_range, ref_formula, strict=False):
    dv = DataValidation(type="list", formula1=ref_formula, allow_blank=True, showDropDown=False)
    dv.showErrorMessage = strict
    ws.add_data_validation(dv)
    dv.add(cell_range)
    return dv


def add_name(name, ref):
    wb.defined_names[name] = DefinedName(name, attr_text=ref)


# =============================================================================
# README
# =============================================================================
ws = add_sheet("README")
ws.column_dimensions["A"].width = 118
lines = [
    ("Regcheq — CRM Maestro de Leads, Eventos y Auditoría HubSpot", title_font),
    ("", normal_font),
    ("Fuente única de verdad para los contactos de Marketing y Alianzas, cruzada contra HubSpot. "
     "DASHBOARD, CONTACTOS MAESTROS (columnas de HubSpot) y HUBSPOT AUDIT se calculan solas — no se "
     "editan a mano.", normal_font),
    ("", normal_font),
    ("Primer paso obligatorio: Menú Regcheq CRM → 'Instalar/extender fórmulas'.", subtitle_font),
    ("", normal_font),
    ("Documentación completa (arquitectura, instrucciones paso a paso, cómo importar/sincronizar/revisar "
     "duplicados) en el repositorio de git: docs/INSTRUCCIONES_SETUP.md y docs/arquitectura.md.", normal_font),
    ("", normal_font),
    ("Seguridad del token de HubSpot: se guarda una sola vez en Extensiones → Apps Script → Configuración "
     "del proyecto → Propiedades del script, con la clave HUBSPOT_TOKEN. Nunca en una celda ni en el código.", normal_font),
]
r = 1
for text, font in lines:
    cell = ws.cell(row=r, column=1, value=text)
    cell.font = font
    cell.alignment = Alignment(wrap_text=True, vertical="top")
    r += 1
ws.sheet_properties.tabColor = NAVY

# =============================================================================
# CONFIGURACION
# =============================================================================
cfg = add_sheet("CONFIGURACION")
cfg.column_dimensions["A"].width = 34
cfg.column_dimensions["B"].width = 46
cfg.column_dimensions["C"].width = 46
cfg.column_dimensions["D"].width = 20
cfg.sheet_properties.tabColor = "808080"

cfg["A1"] = "CONFIGURACIÓN"
cfg["A1"].font = title_font

row = 3
cfg.cell(row=row, column=1, value="Portal HubSpot").font = subtitle_font
row += 1
cfg.cell(row=row, column=1, value="Portal ID").font = bold_font
cfg.cell(row=row, column=2, value=24042219)
PORTAL_ID_CELL = f"CONFIGURACION!$B${row}"
row += 1
cfg.cell(row=row, column=1, value="UI Domain").font = bold_font
cfg.cell(row=row, column=2, value="app.hubspot.com")

row += 2
cfg.cell(row=row, column=1, value="SDR (Sales Development Representatives)").font = subtitle_font
row += 1
sdr_header_row = row
write_headers(cfg, ["Nombre", "HubSpot Owner ID", "Activo"], row=row,
              widths=None)
row += 1
SDR_FIRST_ROW = row
sdrs = [("Brenda Ochoa", 79427048, "Sí"), ("Elizabeth Zúñiga", 82474248, "Sí"), ("Joaquín Kim", 89330030, "Sí")]
for nombre, oid, activo in sdrs:
    cfg.cell(row=row, column=1, value=nombre).font = normal_font
    cfg.cell(row=row, column=2, value=oid).font = normal_font
    cfg.cell(row=row, column=3, value=activo).font = normal_font
    row += 1
SDR_LAST_ROW = row - 1
list_dv(cfg, f"C{SDR_FIRST_ROW}:C{SDR_FIRST_ROW+10}", ["Sí", "No"])
cfg.cell(row=row, column=1, value=(
    "Agrega aquí más SDR si el equipo crece; el HubSpot Owner ID se obtiene de HubSpot → Configuración → "
    "Usuarios y permisos, o pidiéndolo al admin del portal.")).font = italic_font
row += 2

cfg.cell(row=row, column=1, value="Sinónimos de columnas para importación").font = subtitle_font
row += 1
write_headers(cfg, ["Campo canónico", "Sinónimos (separados por coma)"], row=row)
row += 1
SYN_FIRST_ROW = row
synonyms = [
    ("HubSpot Contact ID", "ID de registro - Contact,Contact ID,hs_object_id,Record ID,HubSpot Contact ID"),
    ("Email", "Correo,Correo electrónico,Email,E-mail,Mail,work_email,WORK_EMAIL,EMAIL"),
    ("Nombre", "Nombre,Nombres,First Name,first_name,name"),
    ("Apellido", "Apellido,Apellidos,Last Name,last_name"),
    ("Empresa", "Empresa,Compañía,Company,Company Name,Nombre de la empresa,¿Para qué empresa trabajas?"),
    ("Teléfono", "Teléfono,Telefono,Celular,Phone,Phone Number,phone_number,Número de teléfono,PHONE_NUMBER"),
    ("Cargo", "Cargo,Puesto,Job Title,job_title,Ocupación"),
    ("Industria", "Industria,Sector,Giro"),
    ("Ciudad/Estado", "Ciudad,Estado,City,Ciudad/Estado"),
    ("Fecha de registro", "Fecha de registro,created_at,Fecha de creación,Created At,Hora de envío (UTC)"),
]
for campo, syns in synonyms:
    cfg.cell(row=row, column=1, value=campo).font = bold_font
    cfg.cell(row=row, column=2, value=syns).font = normal_font
    row += 1
SYN_LAST_ROW = row - 1
row += 1

cfg.cell(row=row, column=1, value=(
    "Pipelines de Deals (HubSpot) — confirma cuáles aplican a leads de Marketing/Alianzas")).font = subtitle_font
row += 1
write_headers(cfg, ["Pipeline", "Pipeline ID", "¿Incluir en Dashboard M&A?"], row=row)
row += 1
pipelines = [
    ("Pipeline de ventas Financial", "default"),
    ("Pipeline de Ventas Real Estate", "772899746"),
    ("Pipeline Cars & Others", "786915607"),
    ("Sesiones Consultivas / Marketing", "765142856"),
    ("Alianzas y Brokers", "36592760"),
    ("Upsellings", "62320982"),
    ("Pipeline Gaby", "925698135"),
]
for name, pid in pipelines:
    cfg.cell(row=row, column=1, value=name).font = normal_font
    cfg.cell(row=row, column=2, value=pid).font = normal_font
    cfg.cell(row=row, column=3, value="Pendiente de confirmar").font = normal_font
    row += 1
list_dv(cfg, f"C{row-len(pipelines)}:C{row-1}", ["Sí", "No", "Pendiente de confirmar"])
row += 1

cfg.cell(row=row, column=1, value="Mapeo de Dealstage → Estatus comercial").font = subtitle_font
row += 1
write_headers(cfg, ["Pipeline", "Stage ID", "Stage Label (HubSpot)", "Estatus mapeado"], row=row)
row += 1
DEALSTAGE_FIRST_ROW = row


def stage_map(label):
    l = label.lower()
    if any(k in l for k in ["reunión agendada", "reunión calificada", "cita programada", "cita realizada"]):
        return "Reunión agendada"
    if any(k in l for k in ["contrato firmado", "cliente listo", "broker firmado", "anexo firmado",
                             "propuesta aceptada"]):
        return "Convertido"
    if any(k in l for k in ["cierre perdido", "churn", "broker perdido"]):
        return "No interesado"
    return "Revisión manual"


dealstages_by_pipeline = {
    "default": [("qualifiedtobuy", "Reunión Agendada"), ("1331040521", "Reunión Calificada"),
                ("presentationscheduled", "Propuesta de Valor"), ("decisionmakerboughtin", "Negociación"),
                ("contractsent", "Negociación Avanzada"), ("closedwon", "Contrato Firmado"),
                ("59846928", "Cliente Listo: Firmado y Activado"), ("59846929", "Retomar Contacto"),
                ("closedlost", "Cierre perdido"), ("59846930", "Churn"), ("1018318164", "Churn no facturado")],
    "772899746": [("1128447623", "Reunión Agendada"), ("1331038643", "Reunión Calificada"),
                  ("1128447624", "Propuesta de Valor"), ("1380915768", "Esperando reglas"),
                  ("1128447625", "Negociación"), ("1128447626", "Negociación Avanzada"),
                  ("1128447627", "Contrato Firmado"), ("1128447629", "Cliente Listo: Firmado y Activado"),
                  ("1128568484", "Retomar Contacto"), ("1128568485", "Cierre perdido"),
                  ("1128522499", "Churn"), ("1128522500", "Churn no Facturado")],
    "786915607": [("1150932645", "Reunión Agendada"), ("1334105610", "Reunión Calificada"),
                  ("1150932646", "Propuesta de Valor"), ("1380915773", "Esperando reglas"),
                  ("1150932647", "Negociación"), ("1150932648", "Negociación Avanzada"),
                  ("1150932649", "Contrato Firmado"), ("1150932650", "Cliente Listo: Firmado y Activado"),
                  ("1150932651", "Retomar Contacto"), ("1151001871", "Cierre Perdido"),
                  ("1151001872", "Churn"), ("1151001873", "Churn no Facturado")],
    "765142856": [("1114604288", "Cita programada"), ("1114823817", "Cita Realizada")],
    "36592760": [("1012769700", "Reunión Agendada"), ("1012769701", "Propuesta Enviada"),
                 ("1012769702", "Broker Firmado"), ("1016279224", "Retomar Contacto"),
                 ("1016279223", "Broker Perdido"), ("172497573", "Asociaciones")],
    "62320982": [("1004839259", "Implementación de Upselling")],
    "925698135": [("1003044172", "Nuevo"), ("121998767", "Contactado"), ("121998769", "Reunión Agendada"),
                  ("121998768", "Propuesta Enviada"), ("121998770", "Propuesta Aceptada"),
                  ("121998771", "Anexo Firmado")],
}
# Las 49 filas de mapeo Pipeline/Stage ID/Estatus las siembra Apps Script la primera vez que
# corres "Instalar/extender fórmulas" (ver sembrarDealstages_ en apps-script/09_InstalarFormulas.gs) —
# aquí solo dejamos el encabezado para que el archivo pese poco.
list_dv(cfg, f"D{DEALSTAGE_FIRST_ROW}:D{DEALSTAGE_FIRST_ROW+60}", ESTATUS_LIST, strict=False)
row += 1

cfg.cell(row=row, column=1, value="Alertas").font = subtitle_font
row += 1
cfg.cell(row=row, column=1, value="Días sin contacto para alerta 🟡").font = bold_font
cfg.cell(row=row, column=2, value=7)
ALERT_YELLOW_CELL = f"CONFIGURACION!$B${row}"
row += 1
cfg.cell(row=row, column=1, value="Días sin contacto para alerta 🔴").font = bold_font
cfg.cell(row=row, column=2, value=21)
ALERT_RED_CELL = f"CONFIGURACION!$B${row}"
row += 2

cfg.cell(row=row, column=1, value="Propiedades HubSpot a consultar").font = subtitle_font
row += 1
write_headers(cfg, ["Objeto", "Propiedades (separadas por coma)"], row=row)
row += 1
props = [
    ("contacts", "email,firstname,lastname,company,jobtitle,phone,hubspot_owner_id,hs_lead_status,"
                 "lifecyclestage,hs_last_activity_date,notes_last_contacted,createdate"),
    ("companies", "name,domain,industry,city,state"),
    ("deals", "dealname,dealstage,pipeline,amount,closedate"),
]
for obj, plist in props:
    cfg.cell(row=row, column=1, value=obj).font = normal_font
    cfg.cell(row=row, column=2, value=plist).font = normal_font
    row += 1
row += 1

cfg.cell(row=row, column=1, value="Registro de sincronizaciones").font = subtitle_font
row += 1
SYNC_LOG_HEADER_ROW = row
write_headers(cfg, ["Fecha/Hora", "Tipo", "Registros procesados", "Errores", "Registros no encontrados",
                     "Detalle"], row=row)
row += 1

cfg.sheet_view.showGridLines = False
print("CONFIGURACION lista, hasta fila", row)

# =============================================================================
# EVENTOS
# =============================================================================
ev = add_sheet("EVENTOS")
ev_headers = ["Event ID", "Nombre del evento", "Tipo", "Aliado", "Fecha del evento",
              "Fecha de recepción de la base", "Responsable", "Nombre de archivo original",
              "Liga a la base original", "# registros", "# contactos únicos", "# duplicados",
              "# en HubSpot", "# no en HubSpot", "Última sincronización", "Observaciones"]
ev_widths = [10, 42, 18, 18, 16, 16, 16, 34, 30, 12, 14, 12, 12, 14, 16, 34]
write_headers(ev, ev_headers, widths=ev_widths)
ev.sheet_properties.tabColor = "2E75B6"

eventos_seed = [
    ("EV-001", "Cumbre INM", "Evento", "INM", "",
     "https://drive.google.com/drive/folders/1nNbFVyRORF-Sw_opClPrVooVKfKsPp5P"),
    ("EV-002", "Doorvel", "Evento de aliado", "Doorvel", "",
     "https://drive.google.com/drive/folders/1gDUMJJl_AJO9ezGvbcQ5Hd5p1B1SZRP2"),
    ("EV-003", "2.º Congreso Internacional de Oficiales de Cumplimiento ASONOC y TOP COMPLIANCE",
     "Evento de aliado", "ASONOC / TOP COMPLIANCE", "",
     "https://drive.google.com/drive/folders/1NGvQADsSPRW4Q1595WT4rZDukOv5cY6G"),
    ("EV-004", "AMPI Cuernavaca", "Evento de aliado", "AMPI", "",
     "https://drive.google.com/drive/folders/1PzGxPpo9elT_kRb-cH88dFeb6VvwyUbX"),
    ("EV-005", "David Merino", "Webinar con aliado", "David Merino", "",
     "https://drive.google.com/drive/folders/1Qq-zZZCQbNjv9ZWBnfGLuwbkkCRWzLMZ"),
    ("EV-006", "Webinar AMPI", "Webinar con aliado", "AMPI", "",
     "https://drive.google.com/drive/folders/1U5dem3qviKxxGNszIT506Hj4Xi2SJ7Lr"),
    ("EV-007", "UPIM", "Evento de aliado", "UPIM", "",
     "https://drive.google.com/drive/folders/1oFIPFmQybOYFYyR8U9Zxgjaf95Cttzp-"),
    ("EV-008", "Datos contactos clientes actuales", "Otro", "", "",
     "https://drive.google.com/drive/folders/1OPA2ExwAAFFftKyjN2dov5AhUIiUfUpf"),
    ("EV-009", "Google Leads Forms (Google Ads)", "Otro", "", "",
     "https://docs.google.com/spreadsheets/d/1GIifxlptz-aBUD9CS41esHnSRyjgRnUyKNcD8q56-PI/edit"),
    ("EV-010", "Correo Jornada Nacional (reuniones agendadas)", "Otro", "", "",
     "https://docs.google.com/spreadsheets/d/1P6HvpkHtyH9NQo6H-90YVSY039lCd1vLc8-XfpC0nwE/edit"),
    ("EV-011", "PLD para Transmisores de Dinero - Invitados", "Evento", "", "",
     "https://docs.google.com/spreadsheets/d/1Z7GTkXJHKd9qU4GtezziklTu-zGSnIekCKmyGiPVLp0/edit"),
    ("EV-012", "Transmisores de Dinero - Delibanez IT", "Webinar con aliado", "Delibanez IT", "",
     "https://docs.google.com/spreadsheets/d/1ujjYCb-crn9bJagz1XtEYV0D-1NF6D7f2fz33U1fMTU/edit"),
    ("EV-013", "Exportación HubSpot — Contactos que enviaron formulario (2025-04-04)", "Otro", "", "",
     "https://docs.google.com/spreadsheets/d/10TBSi64o7qUUgNCrj_xipMAD47-3gGtNjWu1TiAWXM0/edit"),
    ("EV-014", "Exportación HubSpot — Contactos que han enviado formulario, con empresa (2025-04-04)", "Otro",
     "", "", "https://docs.google.com/spreadsheets/d/1e83qhK2sVOHA9vw1LD9xK6wbzI-URpO3WhaECqtaX_g/edit"),
]
# Las 14 filas de eventos precargados las siembra Apps Script la primera vez que corres
# "Instalar/extender fórmulas" (ver sembrarEventos_ en apps-script/09_InstalarFormulas.gs) —
# aquí solo dejamos el encabezado para que el archivo pese poco.
EVENTOS_SEED_LAST_ROW = 1

style_rows(ev, len(ev_headers), 2, EVENT_ROWS + 1)
list_dv(ev, f"C2:C{EVENT_ROWS+1}", TIPOS_ORIGEN)
print("EVENTOS listo,", EVENTOS_SEED_LAST_ROW - 1, "eventos precargados")

# =============================================================================
# BASES ORIGINALES
# =============================================================================
bo = add_sheet("BASES ORIGINALES")
bo_headers = ["Base ID", "Nombre de base", "Fuente", "URL o ID origen", "Fecha de importación",
              "Importado por", "# registros", "# contactos únicos generados", "# duplicados detectados",
              "Event ID relacionado", "Estado de importación", "Columnas no mapeadas"]
bo_widths = [10, 40, 16, 34, 16, 16, 12, 16, 14, 14, 16, 34]
write_headers(bo, bo_headers, widths=bo_widths)
bo.sheet_properties.tabColor = "808080"
list_dv(bo, "C2:C15", ["Google Sheets", "HubSpot export", "Otro"])
list_dv(bo, "K2:K15", ["OK", "Con errores"])
range_dv(bo, "J2:J15", f"=EVENTOS!$A$2:$A${EVENT_ROWS+1}")
style_rows(bo, len(bo_headers), 2, 15)

# =============================================================================
# IMPORTAR BASE
# =============================================================================
ib = add_sheet("IMPORTAR BASE")
ib_headers = ["URL o ID del Google Sheet", "Nombre de la pestaña", "Evento asociado (Event ID)",
              "Tipo de origen", "Aliado", "Fecha del evento", "Fecha de registro",
              "Fuente original (nombre de archivo)", "Estado", "Resultado"]
ib_widths = [40, 20, 20, 18, 16, 16, 16, 34, 14, 46]
write_headers(ib, ib_headers, widths=ib_widths)
ib.sheet_properties.tabColor = "2E75B6"
range_dv(ib, f"C2:C10", f"=EVENTOS!$A$2:$A${EVENT_ROWS+1}")
list_dv(ib, "D2:D10", TIPOS_ORIGEN)
list_dv(ib, "I2:I10", ["Pendiente", "Procesando", "Completado", "Error"])
style_rows(ib, len(ib_headers), 2, 10)

# =============================================================================
# INTERACCIONES / ORIGENES
# =============================================================================
it = add_sheet("INTERACCIONES")
it_headers = ["Interacción ID", "Master Contact ID", "Event ID", "Evento", "Tipo de origen", "Aliado",
              "Fecha del evento", "Fecha de registro", "Base ID", "Fila original",
              "Email tal como apareció", "Teléfono tal como apareció",
              "[Ayuda] Existe en HubSpot", "[Ayuda] SDR asignado", "[Ayuda] Tiene actividad",
              "[Ayuda] Estatus comercial", "[Ayuda] Tiene deal"]
it_widths = [14, 16, 10, 30, 16, 16, 14, 14, 10, 12, 26, 18, 14, 16, 14, 18, 14]
write_headers(it, it_headers, widths=it_widths)
it.sheet_properties.tabColor = "2E75B6"

style_rows(it, len(it_headers), 2, DATA_ROWS + 1)
for col in ("M", "N", "O", "P", "Q"):
    it.column_dimensions[col].width = 16
print("INTERACCIONES lista")

# =============================================================================
# HUBSPOT AUDIT
# =============================================================================
ha = add_sheet("HUBSPOT AUDIT")
ha_headers = ["Master Contact ID", "Existe en HubSpot", "HubSpot Contact ID", "Liga HubSpot",
              "Empresa asociada", "HubSpot Company ID", "Deal asociado (nombre)", "HubSpot Deal ID",
              "Asignado a SDR (Sí/No)", "Nombre SDR", "Fecha de asignación", "Tiene actividad",
              "# actividades", "Última actividad (fecha)", "Tipo última actividad",
              "Fecha de último contacto", "Días sin contacto", "Estatus comercial",
              "Confianza del estatus", "Semáforo", "Última sincronización"]
ha_widths = [16, 14, 16, 34, 26, 16, 26, 14, 14, 18, 14, 12, 12, 16, 18, 16, 12, 20, 16, 22, 16]
write_headers(ha, ha_headers, widths=ha_widths)
ha.sheet_properties.tabColor = "C00000"

style_rows(ha, len(ha_headers), 2, DATA_ROWS + 1)
list_dv(ha, f"S2:S{DATA_ROWS+1}", ["Automático", "Revisión manual"])
list_dv(ha, f"R2:R{DATA_ROWS+1}", ESTATUS_LIST)
list_dv(ha, f"B2:B{DATA_ROWS+1}", ["Sí", "No"])
list_dv(ha, f"I2:I{DATA_ROWS+1}", ["Sí", "No"])
list_dv(ha, f"L2:L{DATA_ROWS+1}", ["Sí", "No"])

ha.conditional_formatting.add(
    f"B2:B{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=green_fill, font=green_font))
ha.conditional_formatting.add(
    f"B2:B{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"No"'], fill=red_fill, font=red_font))
ha.conditional_formatting.add(
    f"I2:I{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=green_fill, font=green_font))
ha.conditional_formatting.add(
    f"I2:I{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"No"'], fill=red_fill, font=red_font))
ha.conditional_formatting.add(
    f"T2:T{DATA_ROWS+1}", FormulaRule(formula=[f'ISNUMBER(SEARCH("🔴",T2))'], fill=red_fill, font=red_font))
ha.conditional_formatting.add(
    f"T2:T{DATA_ROWS+1}", FormulaRule(formula=[f'ISNUMBER(SEARCH("🟡",T2))'], fill=yellow_fill))
ha.conditional_formatting.add(
    f"T2:T{DATA_ROWS+1}", FormulaRule(formula=[f'ISNUMBER(SEARCH("🟢",T2))'], fill=green_fill, font=green_font))
print("HUBSPOT AUDIT lista")

# =============================================================================
# DUPLICADOS
# =============================================================================
du = add_sheet("DUPLICADOS")
du_headers = ["Par ID", "Master Contact ID A", "Master Contact ID B", "Tipo de coincidencia",
              "Campo que generó la coincidencia", "Valor coincidente", "Nivel de confianza (%)",
              "HubSpot Contact ID A", "HubSpot Contact ID B", "Evento A", "Evento B",
              "Estatus de revisión", "Acción recomendada", "Revisado por", "Fecha de revisión"]
du_widths = [10, 16, 16, 16, 26, 26, 14, 16, 16, 26, 26, 20, 30, 16, 16]
write_headers(du, du_headers, widths=du_widths)
du.sheet_properties.tabColor = "C00000"

style_rows(du, len(du_headers), 2, DATA_ROWS + 1)
list_dv(du, f"D2:D{DATA_ROWS+1}", ["fuerte", "media", "débil"])
list_dv(du, f"L2:L{DATA_ROWS+1}", ["Pendiente", "Confirmado duplicado", "Falso positivo", "Fusionado"])
print("DUPLICADOS listo")

# =============================================================================
# CONTACTOS MAESTROS
# =============================================================================
cm = add_sheet("CONTACTOS MAESTROS")
cm_headers = ["Master Contact ID", "Nombre", "Apellido", "Nombre completo", "Empresa",
              "Email (normalizado)", "Email original", "Teléfono (normalizado)", "Teléfono original",
              "Cargo", "Industria", "Ciudad/Estado", "Fecha de registro más antigua",
              "HubSpot Contact ID", "HubSpot Company ID", "HubSpot Deal ID", "Existe en HubSpot",
              "Liga HubSpot", "SDR asignado", "Está asignado a SDR", "Tiene actividad",
              "# actividades", "Última actividad (fecha)", "Tipo última actividad",
              "Fecha de último contacto", "Estatus comercial", "# fuentes", "# eventos",
              "Duplicado detectado", "Tipo de duplicado", "IDs relacionados",
              "Última sincronización con HubSpot"]
cm_widths = [16, 16, 16, 22, 26, 26, 26, 16, 16, 20, 16, 16, 16, 16, 16, 14, 14, 34, 18, 14, 12, 12, 16,
             18, 16, 20, 10, 10, 14, 16, 20, 18]
write_headers(cm, cm_headers, widths=cm_widths)
cm.sheet_properties.tabColor = NAVY

style_rows(cm, len(cm_headers), 2, DATA_ROWS + 1)
cm["AB1"].comment = None  # placeholder to keep openpyxl import consistent
from openpyxl.comments import Comment
cm.cell(row=1, column=28).comment = Comment(
    "Aproximación v1: se asume 1 interacción = 1 evento. Si un contacto puede repetirse dentro del mismo "
    "evento (ej. dos registros en la misma base), ajustar esta fórmula para contar eventos distintos.",
    "Regcheq CRM")
list_dv(cm, f"Q2:Q{DATA_ROWS+1}", ["Sí", "No"])
cm.conditional_formatting.add(
    f"Q2:Q{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=green_fill, font=green_font))
cm.conditional_formatting.add(
    f"Q2:Q{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"No"'], fill=red_fill, font=red_font))
cm.conditional_formatting.add(
    f"T2:T{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=green_fill, font=green_font))
cm.conditional_formatting.add(
    f"T2:T{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"No"'], fill=red_fill, font=red_font))
cm.conditional_formatting.add(
    f"U2:U{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=green_fill, font=green_font))
cm.conditional_formatting.add(
    f"U2:U{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"No"'], fill=red_fill, font=red_font))
cm.conditional_formatting.add(
    f"AC2:AC{DATA_ROWS+1}", CellIsRule(operator="equal", formula=['"Sí"'], fill=yellow_fill))
print("CONTACTOS MAESTROS listo")

# =============================================================================
# DASHBOARD
# =============================================================================
db = wb.create_sheet("DASHBOARD", 0)  # primera pestaña
db.sheet_view.showGridLines = False
for col, w in zip("ABCDEFGHIJ", [26, 20, 14, 20, 14, 20, 16, 22, 14, 22]):
    db.column_dimensions[col].width = w

db["A1"] = "DASHBOARD — Regcheq CRM Maestro"
db["A1"].font = title_font
db["A2"] = "Vista ejecutiva Marketing y Alianzas"
db["A2"].font = italic_font

db["A4"] = "Filtros"
db["A4"].font = subtitle_font
filter_labels = [("A5", "Evento:"), ("C5", "Aliado:"), ("E5", "SDR:"), ("G5", "Tipo de origen:"),
                  ("I5", "Estatus:")]
for addr, label in filter_labels:
    db[addr] = label
    db[addr].font = bold_font
for addr in ("B5", "D5", "F5", "H5", "J5"):
    db[addr] = "(Todos)"
    db[addr].fill = PatternFill("solid", fgColor="FFF2CC")
    db[addr].border = border

evento_names = ["(Todos)"] + [e[1] for e in eventos_seed]
aliado_names = ["(Todos)"] + sorted({e[3] for e in eventos_seed if e[3]})
sdr_names = ["(Todos)"] + [s[0] for s in sdrs]
list_dv(db, "B5", evento_names, strict=False)
list_dv(db, "D5", aliado_names, strict=False)
list_dv(db, "F5", sdr_names, strict=False)
list_dv(db, "H5", ["(Todos)"] + TIPOS_ORIGEN, strict=False)
list_dv(db, "J5", ["(Todos)"] + ESTATUS_LIST, strict=False)

# Las fórmulas de KPIs (columna C), tabla "KPIs por origen" y tabla "KPIs por SDR"
# las instala Apps Script (instalarFormulasDashboard_ en 09_InstalarFormulas.gs) —
# aquí solo dejamos las etiquetas y encabezados para que el archivo pese poco.
db["A7"] = "KPIs generales"
db["A7"].font = subtitle_font
kpi_row = 8
kpi_labels = [
    "Total de contactos únicos (global)", "Total de registros/orígenes (filtrado)",
    "Contactos en HubSpot (filtrado)", "Contactos no en HubSpot (filtrado)",
    "% de contactos en HubSpot (filtrado)", "Contactos asignados a SDR (filtrado)",
    "Contactos sin SDR (filtrado)", "Aún sin contactar (filtrado)", "Contactados (filtrado)",
    "Con actividad (filtrado)", "Sin actividad (filtrado)", "Reuniones generadas (filtrado)",
    "Negocios generados (filtrado)", "Convertidos (filtrado)",
    "Con estatus definido (auxiliar, filtrado)", "Duplicados detectados (global)",
]
for i, label in enumerate(kpi_labels):
    db.cell(row=kpi_row + i, column=1, value=label).font = normal_font
db.cell(row=kpi_row + 8, column=1).comment = Comment(
    "Contactados = Con estatus definido − Aún sin contactar. Incluye los marcados como 'Revisión manual'; "
    "si se necesita excluirlos, agregar un contador separado y restarlo aquí también.", "Regcheq CRM")

origen_row0 = kpi_row + len(kpi_labels) + 2
db.cell(row=origen_row0 - 1, column=1, value="KPIs por origen").font = subtitle_font
origen_headers = ["Origen", "Contactos", "En HubSpot", "Asignados", "Contactados", "Reuniones"]
write_headers(db, origen_headers, row=origen_row0, widths=None)

sdr_row0 = origen_row0 + len(eventos_seed) + 3
db.cell(row=sdr_row0 - 1, column=1, value="KPIs por SDR").font = subtitle_font
sdr_headers = ["SDR", "Leads asignados", "Contactados", "No contactados", "% avance", "Reuniones"]
write_headers(db, sdr_headers, row=sdr_row0, widths=None)
db.freeze_panes = "A6"
print("DASHBOARD listo — corre 'Instalar/extender fórmulas' desde el menú al abrir el Sheet.")

# =============================================================================
# Nombres definidos (para las fórmulas del Dashboard)
# =============================================================================
add_name("Filtro_Evento", "DASHBOARD!$B$5")
add_name("Filtro_Aliado", "DASHBOARD!$D$5")
add_name("Filtro_SDR", "DASHBOARD!$F$5")
add_name("Filtro_Tipo", "DASHBOARD!$H$5")
add_name("Filtro_Estatus", "DASHBOARD!$J$5")

wb.active = 0

wb.save(OUT)
print("Guardado:", OUT)
