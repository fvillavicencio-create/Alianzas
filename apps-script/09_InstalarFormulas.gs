/**
 * Instala (o re-instala/extiende) todas las fórmulas del workbook.
 *
 * El workbook base que se sube a Drive viene SIN estas fórmulas pre-cargadas
 * (para que el archivo pese poco); esta función las escribe en tiempo de
 * ejecución. Es idempotente: se puede correr las veces que haga falta —
 * por ejemplo, si algún día se necesitan más de FORMULA_DATA_ROWS filas,
 * solo hay que subir esa constante aquí y volver a correr
 * "Instalar/extender fórmulas" desde el menú.
 */

const FORMULA_DATA_ROWS = 2000;  // techo de filas con fórmula en Interacciones/Contactos/Audit/Duplicados
const FORMULA_EVENT_ROWS = 200;  // techo de filas con fórmula en Eventos

function instalarFormulas() {
  const n = FORMULA_DATA_ROWS, nEv = FORMULA_EVENT_ROWS;
  sembrarDealstages_();
  sembrarEventos_();
  instalarFormulasEventos_(nEv, n);
  instalarFormulasInteracciones_(n, nEv);
  instalarFormulasHubspotAudit_(n);
  instalarFormulasDuplicados_(n);
  instalarFormulasContactosMaestros_(n);
  instalarFormulasDashboard_(n);
  toast_(`Fórmulas instaladas/actualizadas para ${n} filas de datos y ${nEv} eventos.`);
}

/**
 * Siembra la tabla "Mapeo de Dealstage → Estatus comercial" de CONFIGURACIÓN la primera vez
 * (el workbook base viene solo con el encabezado, para pesar poco). No pisa filas que ya
 * existan — si vuelves a correr esto no duplica nada.
 */
function sembrarDealstages_() {
  const cfg = sheet_(SHEETS.CONFIG);
  const block = findConfigBlock_(cfg, 'Mapeo de Dealstage → Estatus comercial');
  if (block.rows.length > 0) return; // ya sembrado

  const pipelines = {
    'Pipeline de ventas Financial': [
      ['qualifiedtobuy', 'Reunión Agendada'], ['1331040521', 'Reunión Calificada'],
      ['presentationscheduled', 'Propuesta de Valor'], ['decisionmakerboughtin', 'Negociación'],
      ['contractsent', 'Negociación Avanzada'], ['closedwon', 'Contrato Firmado'],
      ['59846928', 'Cliente Listo: Firmado y Activado'], ['59846929', 'Retomar Contacto'],
      ['closedlost', 'Cierre perdido'], ['59846930', 'Churn'], ['1018318164', 'Churn no facturado'],
    ],
    'Pipeline de Ventas Real Estate': [
      ['1128447623', 'Reunión Agendada'], ['1331038643', 'Reunión Calificada'],
      ['1128447624', 'Propuesta de Valor'], ['1380915768', 'Esperando reglas'],
      ['1128447625', 'Negociación'], ['1128447626', 'Negociación Avanzada'],
      ['1128447627', 'Contrato Firmado'], ['1128447629', 'Cliente Listo: Firmado y Activado'],
      ['1128568484', 'Retomar Contacto'], ['1128568485', 'Cierre perdido'],
      ['1128522499', 'Churn'], ['1128522500', 'Churn no Facturado'],
    ],
    'Pipeline Cars & Others': [
      ['1150932645', 'Reunión Agendada'], ['1334105610', 'Reunión Calificada'],
      ['1150932646', 'Propuesta de Valor'], ['1380915773', 'Esperando reglas'],
      ['1150932647', 'Negociación'], ['1150932648', 'Negociación Avanzada'],
      ['1150932649', 'Contrato Firmado'], ['1150932650', 'Cliente Listo: Firmado y Activado'],
      ['1150932651', 'Retomar Contacto'], ['1151001871', 'Cierre Perdido'],
      ['1151001872', 'Churn'], ['1151001873', 'Churn no Facturado'],
    ],
    'Sesiones Consultivas / Marketing': [
      ['1114604288', 'Cita programada'], ['1114823817', 'Cita Realizada'],
    ],
    'Alianzas y Brokers': [
      ['1012769700', 'Reunión Agendada'], ['1012769701', 'Propuesta Enviada'],
      ['1012769702', 'Broker Firmado'], ['1016279224', 'Retomar Contacto'],
      ['1016279223', 'Broker Perdido'], ['172497573', 'Asociaciones'],
    ],
    'Upsellings': [['1004839259', 'Implementación de Upselling']],
    'Pipeline Gaby': [
      ['1003044172', 'Nuevo'], ['121998767', 'Contactado'], ['121998769', 'Reunión Agendada'],
      ['121998768', 'Propuesta Enviada'], ['121998770', 'Propuesta Aceptada'],
      ['121998771', 'Anexo Firmado'],
    ],
  };

  const mapEstatus = (label) => {
    const l = label.toLowerCase();
    if (['reunión agendada', 'reunión calificada', 'cita programada', 'cita realizada']
      .some(k => l.indexOf(k) !== -1)) return 'Reunión agendada';
    if (['contrato firmado', 'cliente listo', 'broker firmado', 'anexo firmado', 'propuesta aceptada']
      .some(k => l.indexOf(k) !== -1)) return 'Convertido';
    if (['cierre perdido', 'churn', 'broker perdido'].some(k => l.indexOf(k) !== -1)) return 'No interesado';
    return 'Revisión manual';
  };

  const rows = [];
  Object.keys(pipelines).forEach(pipelineName => {
    pipelines[pipelineName].forEach(([stageId, stageLabel]) => {
      rows.push([pipelineName, stageId, stageLabel, mapEstatus(stageLabel)]);
    });
  });
  cfg.getRange(block.headerRow + 1, 1, rows.length, 4).setValues(rows);
}

/** Escribe formulaFn(row) en sheet!col para cada fila de startRow a endRow, en una sola llamada. */
function fillColumnFormulas_(sheet, col, startRow, endRow, formulaFn) {
  const rows = endRow - startRow + 1;
  const formulas = [];
  for (let r = startRow; r <= endRow; r++) formulas.push([formulaFn(r)]);
  sheet.getRange(startRow, col, rows, 1).setFormulas(formulas);
}

/**
 * Siembra el catálogo inicial de EVENTOS (las carpetas/bases encontradas en Drive al diseñar
 * el sistema) la primera vez. El workbook base viene solo con el encabezado, para pesar poco.
 * No pisa filas que ya existan.
 */
function sembrarEventos_() {
  const ev = sheet_(SHEETS.EVENTOS);
  if (lastDataRow_(ev) >= 2) return; // ya sembrado

  const seed = [
    ['EV-001', 'Cumbre INM', 'Evento', 'INM', '',
      'https://drive.google.com/drive/folders/1nNbFVyRORF-Sw_opClPrVooVKfKsPp5P'],
    ['EV-002', 'Doorvel', 'Evento de aliado', 'Doorvel', '',
      'https://drive.google.com/drive/folders/1gDUMJJl_AJO9ezGvbcQ5Hd5p1B1SZRP2'],
    ['EV-003', '2.º Congreso Internacional de Oficiales de Cumplimiento ASONOC y TOP COMPLIANCE',
      'Evento de aliado', 'ASONOC / TOP COMPLIANCE', '',
      'https://drive.google.com/drive/folders/1NGvQADsSPRW4Q1595WT4rZDukOv5cY6G'],
    ['EV-004', 'AMPI Cuernavaca', 'Evento de aliado', 'AMPI', '',
      'https://drive.google.com/drive/folders/1PzGxPpo9elT_kRb-cH88dFeb6VvwyUbX'],
    ['EV-005', 'David Merino', 'Webinar con aliado', 'David Merino', '',
      'https://drive.google.com/drive/folders/1Qq-zZZCQbNjv9ZWBnfGLuwbkkCRWzLMZ'],
    ['EV-006', 'Webinar AMPI', 'Webinar con aliado', 'AMPI', '',
      'https://drive.google.com/drive/folders/1U5dem3qviKxxGNszIT506Hj4Xi2SJ7Lr'],
    ['EV-007', 'UPIM', 'Evento de aliado', 'UPIM', '',
      'https://drive.google.com/drive/folders/1oFIPFmQybOYFYyR8U9Zxgjaf95Cttzp-'],
    ['EV-008', 'Datos contactos clientes actuales', 'Otro', '', '',
      'https://drive.google.com/drive/folders/1OPA2ExwAAFFftKyjN2dov5AhUIiUfUpf'],
    ['EV-009', 'Google Leads Forms (Google Ads)', 'Otro', '', '',
      'https://docs.google.com/spreadsheets/d/1GIifxlptz-aBUD9CS41esHnSRyjgRnUyKNcD8q56-PI/edit'],
    ['EV-010', 'Correo Jornada Nacional (reuniones agendadas)', 'Otro', '', '',
      'https://docs.google.com/spreadsheets/d/1P6HvpkHtyH9NQo6H-90YVSY039lCd1vLc8-XfpC0nwE/edit'],
    ['EV-011', 'PLD para Transmisores de Dinero - Invitados', 'Evento', '', '',
      'https://docs.google.com/spreadsheets/d/1Z7GTkXJHKd9qU4GtezziklTu-zGSnIekCKmyGiPVLp0/edit'],
    ['EV-012', 'Transmisores de Dinero - Delibanez IT', 'Webinar con aliado', 'Delibanez IT', '',
      'https://docs.google.com/spreadsheets/d/1ujjYCb-crn9bJagz1XtEYV0D-1NF6D7f2fz33U1fMTU/edit'],
    ['EV-013', 'Exportación HubSpot — Contactos que enviaron formulario (2025-04-04)', 'Otro', '', '',
      'https://docs.google.com/spreadsheets/d/10TBSi64o7qUUgNCrj_xipMAD47-3gGtNjWu1TiAWXM0/edit'],
    ['EV-014', 'Exportación HubSpot — Contactos que han enviado formulario, con empresa (2025-04-04)',
      'Otro', '', '', 'https://docs.google.com/spreadsheets/d/1e83qhK2sVOHA9vw1LD9xK6wbzI-URpO3WhaECqtaX_g/edit'],
  ];
  seed.forEach((row, i) => {
    const r = i + 2;
    ev.getRange(r, COL.EVENTOS.EVENT_ID).setValue(row[0]);
    ev.getRange(r, COL.EVENTOS.NOMBRE).setValue(row[1]);
    ev.getRange(r, COL.EVENTOS.TIPO).setValue(row[2]);
    ev.getRange(r, COL.EVENTOS.ALIADO).setValue(row[3]);
    if (row[4]) ev.getRange(r, COL.EVENTOS.FECHA_EVENTO).setValue(row[4]);
    ev.getRange(r, COL.EVENTOS.LIGA_ORIGINAL).setValue(row[5]);
    ev.getRange(r, COL.EVENTOS.OBSERVACIONES).setValue('Pendiente de importar');
  });
}

function instalarFormulasEventos_(nEv, n) {
  const ev = sheet_(SHEETS.EVENTOS);
  const last = nEv + 1;
  fillColumnFormulas_(ev, COL.EVENTOS.NUM_UNICOS, 2, last,
    r => `=IFERROR(COUNTIF(INTERACCIONES!$C$2:$C$${n + 1},$A${r}),0)`);
  fillColumnFormulas_(ev, COL.EVENTOS.NUM_DUPLICADOS, 2, last,
    r => `=IFERROR(COUNTIF(DUPLICADOS!$J$2:$J$${n + 1},$B${r})+COUNTIF(DUPLICADOS!$K$2:$K$${n + 1},$B${r}),0)`);
  fillColumnFormulas_(ev, COL.EVENTOS.NUM_EN_HUBSPOT, 2, last,
    r => `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${n + 1},$A${r},INTERACCIONES!$M$2:$M$${n + 1},"Sí"),0)`);
  fillColumnFormulas_(ev, COL.EVENTOS.NUM_NO_HUBSPOT, 2, last,
    r => `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${n + 1},$A${r},INTERACCIONES!$M$2:$M$${n + 1},"No"),0)`);
}

function instalarFormulasInteracciones_(n, nEv) {
  const it = sheet_(SHEETS.INTERACCIONES);
  const last = n + 1, lastEv = nEv + 1;
  fillColumnFormulas_(it, COL.INTERACCIONES.EVENTO, 2, last,
    r => `=IFERROR(INDEX(EVENTOS!$B$2:$B$${lastEv},MATCH($C${r},EVENTOS!$A$2:$A$${lastEv},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.TIPO_ORIGEN, 2, last,
    r => `=IFERROR(INDEX(EVENTOS!$C$2:$C$${lastEv},MATCH($C${r},EVENTOS!$A$2:$A$${lastEv},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.ALIADO, 2, last,
    r => `=IFERROR(INDEX(EVENTOS!$D$2:$D$${lastEv},MATCH($C${r},EVENTOS!$A$2:$A$${lastEv},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.FECHA_EVENTO, 2, last,
    r => `=IFERROR(INDEX(EVENTOS!$E$2:$E$${lastEv},MATCH($C${r},EVENTOS!$A$2:$A$${lastEv},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.AYUDA_EXISTE_HUBSPOT, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$B$2:$B$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.AYUDA_SDR, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$J$2:$J$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.AYUDA_ACTIVIDAD, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$L$2:$L$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.AYUDA_ESTATUS, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$R$2:$R$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(it, COL.INTERACCIONES.AYUDA_DEAL, 2, last, r =>
    `=IF(IFERROR(INDEX('HUBSPOT AUDIT'!$H$2:$H$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")<>"","Sí","No")`);
}

function instalarFormulasHubspotAudit_(n) {
  const ha = sheet_(SHEETS.AUDIT);
  const last = n + 1;
  const thresholds = getAlertThresholdCells_();
  fillColumnFormulas_(ha, COL.AUDIT.DIAS_SIN_CONTACTO, 2, last,
    r => `=IF($P${r}="","",TODAY()-$P${r})`);
  fillColumnFormulas_(ha, COL.AUDIT.SEMAFORO, 2, last, r =>
    `=IF($B${r}<>"Sí","🔴 No está en HubSpot",` +
    `IF($I${r}="No","🔴 Sin SDR asignado",` +
    `IF($L${r}="No","🔴 Sin actividad registrada",` +
    `IF(AND(ISNUMBER($Q${r}),$Q${r}>=${thresholds.rojo}),"🔴 "&$Q${r}&" días sin contacto",` +
    `IF(AND(ISNUMBER($Q${r}),$Q${r}>=${thresholds.amarillo}),"🟡 "&$Q${r}&" días sin contacto",` +
    `"🟢 Al corriente")))))`);
}

function instalarFormulasDuplicados_(n) {
  const du = sheet_(SHEETS.DUPLICADOS);
  const last = n + 1;
  fillColumnFormulas_(du, COL.DUPLICADOS.HS_ID_A, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$C$2:$C$${last},MATCH($B${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(du, COL.DUPLICADOS.HS_ID_B, 2, last,
    r => `=IFERROR(INDEX('HUBSPOT AUDIT'!$C$2:$C$${last},MATCH($C${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)),"")`);
  fillColumnFormulas_(du, COL.DUPLICADOS.EVENTO_A, 2, last,
    r => `=IFERROR(INDEX(INTERACCIONES!$D$2:$D$${last},MATCH($B${r},INTERACCIONES!$B$2:$B$${last},0)),"")`);
  fillColumnFormulas_(du, COL.DUPLICADOS.EVENTO_B, 2, last,
    r => `=IFERROR(INDEX(INTERACCIONES!$D$2:$D$${last},MATCH($C${r},INTERACCIONES!$B$2:$B$${last},0)),"")`);
}

function instalarFormulasContactosMaestros_(n) {
  const cm = sheet_(SHEETS.CONTACTOS);
  const last = n + 1;
  const ha = c => `'HUBSPOT AUDIT'!$${c}$2:$${c}$${last}`;
  const haMatch = r => `MATCH($A${r},'HUBSPOT AUDIT'!$A$2:$A$${last},0)`;

  fillColumnFormulas_(cm, COL.CONTACTOS.NOMBRE_COMPLETO, 2, last,
    r => `=IF(AND($B${r}="",$C${r}=""),"",TRIM($B${r}&" "&$C${r}))`);
  fillColumnFormulas_(cm, COL.CONTACTOS.HS_CONTACT_ID, 2, last,
    r => `=IFERROR(INDEX(${ha('C')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.HS_COMPANY_ID, 2, last,
    r => `=IFERROR(INDEX(${ha('F')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.HS_DEAL_ID, 2, last,
    r => `=IFERROR(INDEX(${ha('H')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.EXISTE_HUBSPOT, 2, last,
    r => `=IFERROR(INDEX(${ha('B')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.LIGA_HUBSPOT, 2, last,
    r => `=IFERROR(INDEX(${ha('D')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.SDR_ASIGNADO, 2, last,
    r => `=IFERROR(INDEX(${ha('J')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.ESTA_ASIGNADO, 2, last,
    r => `=IFERROR(INDEX(${ha('I')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.TIENE_ACTIVIDAD, 2, last,
    r => `=IFERROR(INDEX(${ha('L')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.NUM_ACTIVIDADES, 2, last,
    r => `=IFERROR(INDEX(${ha('M')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.ULTIMA_ACTIVIDAD, 2, last,
    r => `=IFERROR(INDEX(${ha('N')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.TIPO_ULTIMA_ACTIVIDAD, 2, last,
    r => `=IFERROR(INDEX(${ha('O')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.FECHA_ULTIMO_CONTACTO, 2, last,
    r => `=IFERROR(INDEX(${ha('P')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.ESTATUS_COMERCIAL, 2, last,
    r => `=IFERROR(INDEX(${ha('R')},${haMatch(r)}),"")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.NUM_FUENTES, 2, last,
    r => `=IFERROR(COUNTIF(INTERACCIONES!$B$2:$B$${last},$A${r}),0)`);
  fillColumnFormulas_(cm, COL.CONTACTOS.NUM_EVENTOS, 2, last,
    r => `=IFERROR(COUNTIF(INTERACCIONES!$B$2:$B$${last},$A${r}),0)`);
  fillColumnFormulas_(cm, COL.CONTACTOS.DUPLICADO_DETECTADO, 2, last,
    r => `=IF(COUNTIF(DUPLICADOS!$B$2:$B$${last},$A${r})+COUNTIF(DUPLICADOS!$C$2:$C$${last},$A${r})>0,"Sí","No")`);
  fillColumnFormulas_(cm, COL.CONTACTOS.ULTIMA_SYNC, 2, last,
    r => `=IFERROR(INDEX(${ha('U')},${haMatch(r)}),"")`);
}

function instalarFormulasDashboard_(n) {
  const db = sheet_(SHEETS.DASHBOARD);
  const last = n + 1;
  const base5 =
    `INTERACCIONES!$D$2:$D$${last},IF(Filtro_Evento="(Todos)","<>",Filtro_Evento),` +
    `INTERACCIONES!$F$2:$F$${last},IF(Filtro_Aliado="(Todos)","<>",Filtro_Aliado),` +
    `INTERACCIONES!$N$2:$N$${last},IF(Filtro_SDR="(Todos)","<>",Filtro_SDR),` +
    `INTERACCIONES!$E$2:$E$${last},IF(Filtro_Tipo="(Todos)","<>",Filtro_Tipo),` +
    `INTERACCIONES!$P$2:$P$${last},IF(Filtro_Estatus="(Todos)","<>",Filtro_Estatus)`;

  const kpiRow = 8;
  const kpis = [
    ['=COUNTA(\'CONTACTOS MAESTROS\'!$A$2:$A$' + last + ')', null],
    [`=COUNTIFS(${base5})`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$M$2:$M$${last},"Sí")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$M$2:$M$${last},"No")`, null],
    ['=IFERROR(C10/C9,0)', '0.0%'],
    [`=COUNTIFS(${base5},INTERACCIONES!$N$2:$N$${last},"<>")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$M$2:$M$${last},"Sí",INTERACCIONES!$N$2:$N$${last},"")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"Pendiente de cargar a HubSpot")` +
      `+COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"En HubSpot — Sin SDR")` +
      `+COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"Asignado — Sin contacto")`, null],
    ['=IFERROR(C22-C15,0)', null],
    [`=COUNTIFS(${base5},INTERACCIONES!$O$2:$O$${last},"Sí")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$M$2:$M$${last},"Sí",INTERACCIONES!$O$2:$O$${last},"No")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"Reunión agendada")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$Q$2:$Q$${last},"Sí")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"Convertido")`, null],
    [`=COUNTIFS(${base5},INTERACCIONES!$P$2:$P$${last},"<>")`, null],
    ['=COUNTIF(\'CONTACTOS MAESTROS\'!$AC:$AC,"Sí")', null],
  ];
  kpis.forEach(([formula, fmt], i) => {
    const cell = db.getRange(kpiRow + i, 3);
    cell.setFormula(formula);
    if (fmt) cell.setNumberFormat(fmt);
  });

  // Tabla "KPIs por origen": una fila por evento REAL en EVENTOS (no por el techo de fórmulas).
  const ev = sheet_(SHEETS.EVENTOS);
  const evLast = lastDataRow_(ev);
  const eventIds = evLast >= 2
    ? ev.getRange(2, COL.EVENTOS.EVENT_ID, evLast - 1, 1).getValues().map(r => r[0]).filter(Boolean)
    : [];
  const origenRow0 = kpiRow + kpis.length + 2;
  eventIds.forEach((eid, i) => {
    const r = origenRow0 + 1 + i;
    db.getRange(r, 1).setFormula(
      `=IFERROR(INDEX(EVENTOS!$B$2:$B$${evLast},MATCH("${eid}",EVENTOS!$A$2:$A$${evLast},0)),"")`);
    db.getRange(r, 2).setFormula(`=IFERROR(COUNTIF(INTERACCIONES!$C$2:$C$${last},"${eid}"),0)`);
    db.getRange(r, 3).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$M$2:$M$${last},"Sí"),0)`);
    db.getRange(r, 4).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$N$2:$N$${last},"<>"),0)`);
    db.getRange(r, 5).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$P$2:$P$${last},"Contactado")` +
      `+COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$P$2:$P$${last},"Respondió")` +
      `+COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$P$2:$P$${last},"Reunión agendada")` +
      `+COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$P$2:$P$${last},"Convertido"),0)`);
    db.getRange(r, 6).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$C$2:$C$${last},"${eid}",INTERACCIONES!$P$2:$P$${last},"Reunión agendada"),0)`);
  });

  // Tabla "KPIs por SDR": una fila por SDR activo en CONFIGURACIÓN.
  const sdrs = getSdrList_();
  const sdrRow0 = origenRow0 + eventIds.length + 3;
  sdrs.forEach((sdr, i) => {
    const r = sdrRow0 + 1 + i;
    const nombre = sdr.nombre;
    db.getRange(r, 1).setValue(nombre);
    db.getRange(r, 2).setFormula(`=IFERROR(COUNTIF(INTERACCIONES!$N$2:$N$${last},"${nombre}"),0)`);
    db.getRange(r, 3).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Contactado")` +
      `+COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Respondió")` +
      `+COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Reunión agendada")` +
      `+COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Convertido"),0)`);
    db.getRange(r, 4).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Asignado — Sin contacto"),0)`);
    const pctCell = db.getRange(r, 5);
    pctCell.setFormula(`=IFERROR(C${r}/B${r},0)`);
    pctCell.setNumberFormat('0.0%');
    db.getRange(r, 6).setFormula(
      `=IFERROR(COUNTIFS(INTERACCIONES!$N$2:$N$${last},"${nombre}",INTERACCIONES!$P$2:$P$${last},"Reunión agendada"),0)`);
  });
}
