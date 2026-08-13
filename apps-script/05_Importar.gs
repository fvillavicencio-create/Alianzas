/**
 * Importación de una nueva base. Flujo (ver docs/arquitectura.md sección F):
 *   Base original -> Normalización -> Deduplicación -> Contacto maestro ->
 *   Interacción -> (Actualizar HubSpot se corre aparte, menú separado).
 */

function importarBase() {
  const ib = sheet_(SHEETS.IMPORTAR);
  const lastRow = lastDataRow_(ib);
  if (lastRow < 2) { toast_('No hay filas en IMPORTAR BASE.'); return; }

  const synonyms = getColumnSynonyms_();
  const idx = construirIndiceContactos_();
  let algoProcesado = false;

  for (let r = 2; r <= lastRow; r++) {
    const estado = ib.getRange(r, COL.IMPORTAR.ESTADO).getValue();
    if (estado === 'Completado') continue;
    algoProcesado = true;
    ib.getRange(r, COL.IMPORTAR.ESTADO).setValue('Procesando');
    SpreadsheetApp.flush();
    try {
      const resultado = procesarFilaImportar_(ib, r, synonyms, idx);
      ib.getRange(r, COL.IMPORTAR.ESTADO).setValue('Completado');
      ib.getRange(r, COL.IMPORTAR.RESULTADO).setValue(resultado);
    } catch (err) {
      ib.getRange(r, COL.IMPORTAR.ESTADO).setValue('Error');
      ib.getRange(r, COL.IMPORTAR.RESULTADO).setValue(String(err.message || err));
    }
  }

  if (!algoProcesado) { toast_('No hay bases pendientes por importar (todas dicen Completado).'); return; }
  detectarDuplicados();
  toast_('Importación finalizada. Revisa la columna Resultado en IMPORTAR BASE.');
}

function procesarFilaImportar_(ib, r, synonyms, idx) {
  const cfg = {
    url: ib.getRange(r, COL.IMPORTAR.URL_SHEET).getValue(),
    pestana: ib.getRange(r, COL.IMPORTAR.NOMBRE_PESTANA).getValue(),
    eventId: ib.getRange(r, COL.IMPORTAR.EVENT_ID).getValue(),
    fechaEvento: ib.getRange(r, COL.IMPORTAR.FECHA_EVENTO).getValue(),
    fechaRegistroDefault: ib.getRange(r, COL.IMPORTAR.FECHA_REGISTRO).getValue(),
    fuenteOriginal: ib.getRange(r, COL.IMPORTAR.FUENTE_ORIGINAL).getValue(),
  };
  if (!cfg.url) throw new Error('Falta la URL o ID del Google Sheet.');
  if (!cfg.eventId) throw new Error('Falta el Evento asociado (Event ID). Agrégalo primero en EVENTOS.');

  const srcId = extractSpreadsheetId_(cfg.url);
  const srcSs = SpreadsheetApp.openById(srcId);
  const srcSheet = cfg.pestana ? srcSs.getSheetByName(cfg.pestana) : srcSs.getSheets()[0];
  if (!srcSheet) throw new Error(`No se encontró la pestaña "${cfg.pestana}" en la base origen.`);

  const values = srcSheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('La base origen no tiene filas de datos.');

  const headerRow = values[0];
  const mapeo = []; // índice de columna origen -> campo canónico (o null)
  const sinMapear = [];
  headerRow.forEach((h, i) => {
    const key = normalizeHeader_(h);
    const canonico = synonyms[key] || null;
    mapeo.push(canonico);
    if (!canonico && String(h).trim()) sinMapear.push(String(h).trim());
  });

  const baseId = nextId_(sheet_(SHEETS.BASES), COL.BASES.BASE_ID, 'BASE-', 5);
  let nuevos = 0, reutilizados = 0, saltados = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(v => v === '' || v === null)) continue;
    const campos = { Email: '', Nombre: '', Apellido: '', Empresa: '', 'Teléfono': '', Cargo: '',
      Industria: '', 'Ciudad/Estado': '', 'Fecha de registro': '', 'HubSpot Contact ID': '' };
    mapeo.forEach((canonico, ci) => {
      if (canonico && row[ci] !== '' && row[ci] !== null) {
        campos[canonico] = campos[canonico] ? `${campos[canonico]} ${row[ci]}` : row[ci];
      }
    });

    const emailNorm = normalizeEmail_(campos.Email);
    const telNorm = normalizePhone_(campos['Teléfono']);
    const nombre = normalizeName_(campos.Nombre);
    const apellido = normalizeName_(campos.Apellido);
    const empresa = normalizeCompany_(campos.Empresa);
    const nombreCompleto = `${nombre} ${apellido}`.trim();

    const hsId = String(campos['HubSpot Contact ID'] || '').trim();
    if (!emailNorm && !telNorm && !nombreCompleto && !hsId) { saltados++; continue; }

    const nuevo = { email: emailNorm, tel: telNorm, nombreCompleto, empresa, hsId };
    const match = buscarCoincidenciaFuerte_(nuevo, idx);
    let masterId;
    if (match) {
      masterId = match.masterId;
      reutilizados++;
      rellenarCamposVacios_(masterId, campos, emailNorm, telNorm);
    } else {
      masterId = crearContactoMaestro_(campos, emailNorm, telNorm, nombre, apellido, empresa);
      nuevos++;
      idx.filas.push({ masterId, email: emailNorm, tel: telNorm, nombreCompleto, empresa });
      if (emailNorm) (idx.porEmail[emailNorm] = idx.porEmail[emailNorm] || []).push(masterId);
      if (telNorm) (idx.porTelefono[telNorm] = idx.porTelefono[telNorm] || []).push(masterId);
    }

    agregarInteraccion_(masterId, cfg.eventId, baseId, i + 1, campos.Email, campos['Teléfono'],
      cfg.fechaRegistroDefault || campos['Fecha de registro']);
  }

  registrarBaseOriginal_(baseId, cfg, srcSheet.getName(), values.length - 1, nuevos, sinMapear);

  return `OK: ${nuevos} contacto(s) nuevo(s), ${reutilizados} reutilizado(s), ${saltados} fila(s) sin datos ` +
    `suficientes. Columnas sin mapear: ${sinMapear.length ? sinMapear.join(', ') : 'ninguna'}.`;
}

function crearContactoMaestro_(campos, emailNorm, telNorm, nombre, apellido, empresa) {
  const cm = sheet_(SHEETS.CONTACTOS);
  const lastRow = lastDataRow_(cm);
  const targetRow = lastRow + 1;
  if (lastRow >= 2) copyRowFormulas_(cm, lastRow, targetRow);
  const masterId = nextId_(cm, COL.CONTACTOS.MASTER_ID, 'MC-', 6);

  cm.getRange(targetRow, COL.CONTACTOS.MASTER_ID).setValue(masterId);
  cm.getRange(targetRow, COL.CONTACTOS.NOMBRE).setValue(nombre);
  cm.getRange(targetRow, COL.CONTACTOS.APELLIDO).setValue(apellido);
  cm.getRange(targetRow, COL.CONTACTOS.EMPRESA).setValue(empresa);
  cm.getRange(targetRow, COL.CONTACTOS.EMAIL_NORM).setValue(emailNorm);
  cm.getRange(targetRow, COL.CONTACTOS.EMAIL_ORIG).setValue(campos.Email);
  cm.getRange(targetRow, COL.CONTACTOS.TEL_NORM).setValue(telNorm);
  cm.getRange(targetRow, COL.CONTACTOS.TEL_ORIG).setValue(campos['Teléfono']);
  cm.getRange(targetRow, COL.CONTACTOS.CARGO).setValue(campos.Cargo);
  cm.getRange(targetRow, COL.CONTACTOS.INDUSTRIA).setValue(campos.Industria);
  cm.getRange(targetRow, COL.CONTACTOS.CIUDAD_ESTADO).setValue(campos['Ciudad/Estado']);
  if (campos['Fecha de registro']) {
    cm.getRange(targetRow, COL.CONTACTOS.FECHA_REGISTRO).setValue(campos['Fecha de registro']);
  }
  return masterId;
}

/** Rellena SOLO campos vacíos de un contacto existente; nunca sobreescribe un dato ya capturado. */
function rellenarCamposVacios_(masterId, campos, emailNorm, telNorm) {
  const cm = sheet_(SHEETS.CONTACTOS);
  const lastRow = lastDataRow_(cm);
  const ids = cm.getRange(2, COL.CONTACTOS.MASTER_ID, lastRow - 1, 1).getValues();
  const rowIdx = ids.findIndex(r => r[0] === masterId);
  if (rowIdx === -1) return;
  const row = rowIdx + 2;

  const setIfEmpty = (col, value) => {
    if (!value) return;
    const cell = cm.getRange(row, col);
    if (!cell.getValue()) cell.setValue(value);
  };
  setIfEmpty(COL.CONTACTOS.NOMBRE, normalizeName_(campos.Nombre));
  setIfEmpty(COL.CONTACTOS.APELLIDO, normalizeName_(campos.Apellido));
  setIfEmpty(COL.CONTACTOS.EMPRESA, normalizeCompany_(campos.Empresa));
  setIfEmpty(COL.CONTACTOS.EMAIL_NORM, emailNorm);
  setIfEmpty(COL.CONTACTOS.EMAIL_ORIG, campos.Email);
  setIfEmpty(COL.CONTACTOS.TEL_NORM, telNorm);
  setIfEmpty(COL.CONTACTOS.TEL_ORIG, campos['Teléfono']);
  setIfEmpty(COL.CONTACTOS.CARGO, campos.Cargo);
  setIfEmpty(COL.CONTACTOS.INDUSTRIA, campos.Industria);
  setIfEmpty(COL.CONTACTOS.CIUDAD_ESTADO, campos['Ciudad/Estado']);
}

function agregarInteraccion_(masterId, eventId, baseId, filaOriginal, emailAparecio, telAparecio, fechaRegistro) {
  const it = sheet_(SHEETS.INTERACCIONES);
  const lastRow = lastDataRow_(it);
  const targetRow = lastRow + 1;
  if (lastRow >= 2) copyRowFormulas_(it, lastRow, targetRow);
  const interaccionId = nextId_(it, COL.INTERACCIONES.INTERACCION_ID, 'INT-', 6);

  it.getRange(targetRow, COL.INTERACCIONES.INTERACCION_ID).setValue(interaccionId);
  it.getRange(targetRow, COL.INTERACCIONES.MASTER_ID).setValue(masterId);
  it.getRange(targetRow, COL.INTERACCIONES.EVENT_ID).setValue(eventId);
  it.getRange(targetRow, COL.INTERACCIONES.BASE_ID).setValue(baseId);
  it.getRange(targetRow, COL.INTERACCIONES.FILA_ORIGINAL).setValue(filaOriginal);
  it.getRange(targetRow, COL.INTERACCIONES.EMAIL_APARECIO).setValue(emailAparecio);
  it.getRange(targetRow, COL.INTERACCIONES.TEL_APARECIO).setValue(telAparecio);
  if (fechaRegistro) it.getRange(targetRow, COL.INTERACCIONES.FECHA_REGISTRO).setValue(fechaRegistro);
}

function registrarBaseOriginal_(baseId, cfg, nombrePestana, numRegistros, numNuevos, sinMapear) {
  const bo = sheet_(SHEETS.BASES);
  const lastRow = lastDataRow_(bo);
  const targetRow = lastRow + 1;
  if (lastRow >= 2) copyRowFormulas_(bo, lastRow, targetRow);

  bo.getRange(targetRow, COL.BASES.BASE_ID).setValue(baseId);
  bo.getRange(targetRow, COL.BASES.NOMBRE).setValue(cfg.fuenteOriginal || nombrePestana);
  bo.getRange(targetRow, COL.BASES.FUENTE).setValue('Google Sheets');
  bo.getRange(targetRow, COL.BASES.URL_ORIGEN).setValue(cfg.url);
  bo.getRange(targetRow, COL.BASES.FECHA_IMPORTACION).setValue(new Date());
  bo.getRange(targetRow, COL.BASES.IMPORTADO_POR).setValue(Session.getActiveUser().getEmail());
  bo.getRange(targetRow, COL.BASES.NUM_REGISTROS).setValue(numRegistros);
  bo.getRange(targetRow, COL.BASES.NUM_UNICOS).setValue(numNuevos);
  bo.getRange(targetRow, COL.BASES.EVENT_ID).setValue(cfg.eventId);
  bo.getRange(targetRow, COL.BASES.ESTADO).setValue(sinMapear.length ? 'Con errores' : 'OK');
  bo.getRange(targetRow, COL.BASES.COLUMNAS_NO_MAPEADAS).setValue(sinMapear.join(', '));
}
